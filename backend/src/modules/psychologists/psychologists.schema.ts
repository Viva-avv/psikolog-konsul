import { z } from 'zod';

export const MIN_SLOT_MINUTES = 30;
export const MAX_SLOT_MINUTES = 180;

export const idParams = z.object({ id: z.string().uuid() });

export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
};

export const listPsychologistsQuery = z.object({
  specialization: z
    .string()
    .regex(/^[a-z0-9-]{1,50}$/)
    .optional(),
  ...pagination,
});

export const dateRangeQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const profileSchema = z.object({
  title: z.string().trim().max(100).optional(),
  bio: z.string().trim().max(2000).optional(),
  yearsExperience: z.number().int().min(0).max(60),
  pricePerSession: z.number().int().min(0).max(10_000_000),
  specializationIds: z.array(z.number().int().positive()).max(5).default([]),
});

export const createSlotsSchema = z.object({
  slots: z
    .array(
      z
        .object({ startAt: z.coerce.date(), endAt: z.coerce.date() })
        .refine((s) => {
          const minutes = (s.endAt.getTime() - s.startAt.getTime()) / 60_000;
          return minutes >= MIN_SLOT_MINUTES && minutes <= MAX_SLOT_MINUTES;
        }, `Durasi slot harus ${MIN_SLOT_MINUTES}-${MAX_SLOT_MINUTES} menit`),
    )
    .min(1)
    .max(50),
});

const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);

// Multipart fields arrive as strings.
export const documentSchema = z.object({
  type: z.enum(['STR', 'SIPP']),
  number: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[A-Za-z0-9.\-/ ]+$/, 'Nomor dokumen hanya boleh huruf, angka, titik, strip, garis miring'),
  expiresAt: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
});

export const verificationListQuery = z.object({
  status: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).default('PENDING'),
  ...pagination,
});

export const rejectSchema = z.object({ note: z.string().trim().min(5).max(500) });

export type ProfileInput = z.infer<typeof profileSchema>;
export type CreateSlotsInput = z.infer<typeof createSlotsSchema>;
export type DocumentInput = z.infer<typeof documentSchema>;
