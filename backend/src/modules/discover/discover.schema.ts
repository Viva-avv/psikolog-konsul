import { z } from 'zod';
import { TEST_SLUGS } from './tests';

const answers = z.array(z.number().int().min(0).max(9)).min(1).max(60);

export const slugParams = z.object({ slug: z.enum(TEST_SLUGS) });
export const resultParams = z.object({ id: z.string().uuid() });

export const submitSchema = z.object({ answers });

/** Insight for a stored result, or for a fresh (possibly unsaved) result recomputed from its answers. */
export const insightSchema = z.union([
  z.object({ resultId: z.string().uuid() }),
  z.object({ slug: z.enum(TEST_SLUGS), answers }),
]);

export type InsightInput = z.infer<typeof insightSchema>;
