import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Email tidak valid').max(254);

export const registerSchema = z.object({
  email,
  password: z
    .string()
    .min(10, 'Password minimal 10 karakter')
    .max(128)
    .regex(/[A-Za-z]/, 'Password harus mengandung huruf')
    .regex(/\d/, 'Password harus mengandung angka'),
  fullName: z.string().trim().min(2).max(100),
  role: z.enum(['USER', 'PSYCHOLOGIST']).default('USER'),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'Anda harus menyetujui syarat & kebijakan privasi' }),
  }),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
