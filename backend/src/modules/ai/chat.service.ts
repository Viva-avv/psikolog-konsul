import type { Request } from 'express';
import { prisma } from '../../lib/prisma';
import { complete } from '../../lib/llm';
import { decrypt, encrypt } from '../../lib/crypto';
import { audit } from '../../lib/audit';
import { AppError, badRequest, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { hasConsent, requireConsent } from '../consents/consents.service';
import { COMPANION_SYSTEM_PROMPT } from './prompts';
import { filterOutput, sanitizeInput, signAssistantMessage, verifyAssistantMessage } from './guard';
import { CRISIS_RESOURCES, classifierCheck, keywordCheck, recordIncident, type RiskAssessment } from './crisis/detector';
import type { ChatTurn } from '../../lib/llm';
import type { EphemeralChatInput } from './ai.schema';

const CONTEXT_TURNS = 20;

type Crisis = Extract<RiskAssessment, { isCrisis: true }>;
type PipelineResult = { crisis: Crisis } | { reply: string };

export const crisisResponse = () => ({ type: 'CRISIS' as const, crisis: CRISIS_RESOURCES });

/** Chat models expect alternating roles starting with "user"; merge consecutive same-role turns. */
function normalizeTurns(turns: ChatTurn[]): ChatTurn[] {
  const out: ChatTurn[] = [];
  for (const t of turns) {
    if (!out.length && t.role === 'assistant') continue;
    const last = out[out.length - 1];
    if (last?.role === t.role) last.content += `\n\n${t.content}`;
    else out.push({ ...t });
  }
  return out;
}

/** Crisis keyword check runs first; classifier and companion then run in parallel to reduce latency. */
async function runPipeline(history: ChatTurn[]): Promise<PipelineResult> {
  const userMessages = history.filter((t) => t.role === 'user').map((t) => t.content);
  const keyword = keywordCheck(userMessages[userMessages.length - 1]);
  if (keyword.isCrisis) return { crisis: keyword };

  const [risk, reply] = await Promise.allSettled([
    classifierCheck(userMessages),
    complete({
      system: COMPANION_SYSTEM_PROMPT,
      messages: normalizeTurns(history).slice(-CONTEXT_TURNS),
      maxTokens: 500,
    }),
  ]);
  if (risk.status === 'rejected') throw risk.reason;
  if (risk.value.isCrisis) return { crisis: risk.value };
  if (reply.status === 'rejected') {
    if (reply.reason instanceof AppError) throw reply.reason;
    logger.error({ err: reply.reason }, 'Companion completion failed');
    throw new AppError(503, 'AI_UNAVAILABLE', 'Layanan AI sedang tidak tersedia');
  }
  return { reply: filterOutput(reply.value).text };
}

// ---------- Stored conversations (requires STORE_AI_CHAT) ----------

async function requireOwnConversation(userId: string, id: string) {
  const conv = await prisma.aiConversation.findFirst({ where: { id, userId } });
  if (!conv) throw notFound('Percakapan tidak ditemukan');
  return conv;
}

export async function createConversation(req: Request, userId: string) {
  await requireConsent(userId, 'AI_PROCESSING');
  await requireConsent(userId, 'STORE_AI_CHAT');
  const conv = await prisma.aiConversation.create({ data: { userId } });
  await audit(req, { action: 'ai.conversation_create', entityType: 'AiConversation', entityId: conv.id });
  return { id: conv.id, status: conv.status, createdAt: conv.createdAt };
}

export function listConversations(userId: string) {
  return prisma.aiConversation.findMany({
    where: { userId },
    select: { id: true, status: true, createdAt: true, updatedAt: true, _count: { select: { messages: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
}

export async function getMessages(userId: string, id: string) {
  const conv = await requireOwnConversation(userId, id);
  const messages = await prisma.aiMessage.findMany({ where: { conversationId: id }, orderBy: { createdAt: 'asc' } });
  return {
    conversation: { id: conv.id, status: conv.status },
    ...(conv.status === 'CRISIS_LOCKED' && { crisis: CRISIS_RESOURCES }),
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role === 'USER' ? 'user' : 'assistant',
      content: decrypt(m.contentEnc),
      createdAt: m.createdAt,
    })),
  };
}

export async function deleteConversation(req: Request, userId: string, id: string) {
  await requireOwnConversation(userId, id);
  await prisma.aiConversation.delete({ where: { id } });
  await audit(req, { action: 'ai.conversation_delete', entityType: 'AiConversation', entityId: id });
}

export async function sendMessage(userId: string, conversationId: string, raw: string) {
  await requireConsent(userId, 'AI_PROCESSING');
  const conv = await requireOwnConversation(userId, conversationId);
  if (conv.status === 'CRISIS_LOCKED') return crisisResponse();
  if (!(await hasConsent(userId, 'STORE_AI_CHAT'))) {
    throw new AppError(403, 'CONSENT_REQUIRED', 'Persetujuan penyimpanan chat telah dicabut');
  }

  const text = sanitizeInput(raw);
  if (!text) throw badRequest('Pesan kosong');

  const previous = await prisma.aiMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: CONTEXT_TURNS - 1,
  });
  const history: ChatTurn[] = [
    ...previous.reverse().map((m) => ({
      role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
      content: decrypt(m.contentEnc),
    })),
    { role: 'user', content: text },
  ];

  await prisma.aiMessage.create({ data: { conversationId, role: 'USER', contentEnc: encrypt(text) } });
  const result = await runPipeline(history);

  if ('crisis' in result) {
    await prisma.aiConversation.update({ where: { id: conversationId }, data: { status: 'CRISIS_LOCKED' } });
    await recordIncident(userId, 'AI_CHAT', result.crisis);
    return crisisResponse();
  }

  const saved = await prisma.aiMessage.create({
    data: { conversationId, role: 'ASSISTANT', contentEnc: encrypt(result.reply) },
  });
  await prisma.aiConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  return {
    type: 'MESSAGE' as const,
    message: { id: saved.id, role: 'assistant' as const, content: result.reply, createdAt: saved.createdAt },
  };
}

// ---------- Ephemeral chat (nothing persisted server-side) ----------

export async function ephemeralChat(userId: string, input: EphemeralChatInput) {
  await requireConsent(userId, 'AI_PROCESSING');

  const history: ChatTurn[] = [];
  for (const m of input.messages) {
    if (m.role === 'assistant') {
      // Unsigned or tampered assistant turns are dropped (prompt-injection via forged history).
      if (verifyAssistantMessage(userId, m.content, m.sig)) history.push({ role: 'assistant', content: m.content });
    } else {
      const text = sanitizeInput(m.content);
      if (text) history.push({ role: 'user', content: text });
    }
  }
  if (history[history.length - 1]?.role !== 'user') throw badRequest('Pesan kosong');

  const result = await runPipeline(history);
  if ('crisis' in result) {
    await recordIncident(userId, 'AI_CHAT', result.crisis);
    return crisisResponse();
  }
  return {
    type: 'MESSAGE' as const,
    message: { role: 'assistant' as const, content: result.reply, sig: signAssistantMessage(userId, result.reply) },
  };
}
