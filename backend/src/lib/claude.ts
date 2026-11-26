import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import { AppError } from './errors';

let client: Anthropic | null = null;

function getClient() {
  if (!env.ANTHROPIC_API_KEY) throw new AppError(503, 'AI_UNAVAILABLE', 'Layanan AI belum dikonfigurasi');
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 30_000, maxRetries: 2 });
  return client;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export async function complete(opts: {
  system: string;
  messages: ChatTurn[];
  maxTokens?: number;
  effort?: 'low' | 'medium' | 'high';
  /** When set, the model is constrained to return JSON matching this schema (structured outputs). */
  jsonSchema?: Record<string, unknown>;
}): Promise<string> {
  const res = await getClient().messages.create({
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
