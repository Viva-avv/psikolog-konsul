import { z } from 'zod';

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export const listUsersQuery = z.object({
  ...pagination,
  role: z.enum(['USER', 'PSYCHOLOGIST', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  q: z.string().trim().max(100).optional(),
});

export const userStatusSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) });

export const incidentListQuery = z.object({
  ...pagination,
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']).optional(),
});

export const incidentUpdateSchema = z.object({ status: z.enum(['ACKNOWLEDGED', 'RESOLVED']) });

export const auditListQuery = z.object({
  ...pagination,
  action: z
    .string()
    .regex(/^[a-z_.]{1,60}$/)
    .optional(),
  actorId: z.string().uuid().optional(),
});

export const pageQuery = z.object(pagination);
