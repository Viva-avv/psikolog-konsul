import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import { AppError } from './errors';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompleteOptions {
  system: string;
  messages: ChatTurn[];
  maxTokens?: number;
  /** Anthropic only; ignored by Ollama. */
  effort?: 'low' | 'medium' | 'high';
  /** When set, the model is constrained to return JSON matching this schema (structured outputs). */
  jsonSchema?: Record<string, unknown>;
}

const notConfigured = () => new AppError(503, 'AI_UNAVAILABLE', 'Layanan AI belum dikonfigurasi');

export function complete(opts: CompleteOptions): Promise<string> {
  return env.AI_PROVIDER === 'anthropic' ? completeAnthropic(opts) : completeOllama(opts);
}

// ---------- Ollama (default: free, self-hosted) ----------

interface OllamaChatResponse {
  message?: { content?: string };
  error?: string;
}

async function completeOllama(opts: CompleteOptions): Promise<string> {
  if (!env.OLLAMA_BASE_URL) throw notConfigured();
  const res = await fetch(`${env.OLLAMA_BASE_URL.replace(/\/+$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(env.OLLAMA_TIMEOUT_MS),
    body: JSON.stringify({
      model: env.OLLAMA_MODEL,
      stream: false,
      messages: [{ role: 'system', content: opts.system }, ...opts.messages],
      ...(opts.jsonSchema && { format: opts.jsonSchema }),
      options: {
        num_predict: opts.maxTokens ?? 600,
        // Explicit context size so the long system prompt is never truncated by Ollama's small default.
        num_ctx: env.OLLAMA_NUM_CTX,
        ...(opts.jsonSchema && { temperature: 0 }),
      },
    }),
  });
  const body = (await res.json().catch(() => ({}))) as OllamaChatResponse;
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${body.error ?? res.statusText}`);
  // Reasoning models may inline their chain of thought; never show it to users.
  return (body.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

// ---------- Anthropic Claude (optional, paid) ----------

let anthropic: Anthropic | null = null;

async function completeAnthropic(opts: CompleteOptions): Promise<string> {
  if (!env.ANTHROPIC_API_KEY) throw notConfigured();
  anthropic ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 30_000, maxRetries: 2 });
  const res = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: opts.maxTokens ?? 600,
    system: opts.system,
    messages: opts.messages,
    output_config: {
      ...(opts.effort && { effort: opts.effort }),
      ...(opts.jsonSchema && { format: { type: 'json_schema', schema: opts.jsonSchema } }),
    },
  });
  return res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

/** Extracts and parses the first JSON object in a model response. */
export function parseJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object in model output');
  return JSON.parse(text.slice(start, end + 1));
}
