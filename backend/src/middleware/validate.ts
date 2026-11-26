import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Parses request parts with zod. Body is replaced in place; parsed query/params
 * are exposed via res.locals because Express 5 makes req.query read-only.
 */
export const validate =
  (schemas: Schemas) => (req: Request, res: Response, next: NextFunction) => {
    if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
    if (schemas.query) res.locals.query = schemas.query.parse(req.query);
    if (schemas.params) res.locals.params = schemas.params.parse(req.params);
    next();
  };

export const parsedQuery = <S extends ZodTypeAny>(res: Response): z.infer<S> => res.locals.query;
export const parsedParams = <S extends ZodTypeAny>(res: Response): z.infer<S> => res.locals.params;
