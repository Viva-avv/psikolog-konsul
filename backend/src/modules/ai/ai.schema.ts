import { z } from 'zod';
import { MAX_MESSAGE_CHARS } from './guard';

const content = z.string().min(1).max(MAX_MESSAGE_CHARS);

export const idParams = z.object({ id: z.string().uuid() });

export const sendMessageSchema = z.object({ content });

export const ephemeralChatSchema = z.object({
  messages: z
    .array(
      z.discriminatedUnion('role', [
        z.object({ role: z.literal('user'), content }),
        z.object({ role: z.literal('assistant'), content: z.string().max(4000), sig: z.string().max(100) }),
      ]),
    )
    .min(1)
    .max(20)
    .refine((m) => m[m.length - 1].role === 'user', 'Pesan terakhir harus dari pengguna'),
});

export const assessmentTypeParams = z.object({ type: z.enum(['PHQ9', 'GAD7']) });

export const submitAssessmentSchema = z.object({
  type: z.enum(['PHQ9', 'GAD7']),
  answers: z.array(z.number().int().min(0).max(3)),
});

export const summarySchema = z.object({
  complaint: z.string().min(10).max(MAX_MESSAGE_CHARS),
});

export const recommendationQuery = z.object({ summaryId: z.string().uuid().optional() });

export type EphemeralChatInput = z.infer<typeof ephemeralChatSchema>;
