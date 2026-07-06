import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../lib/AppError';

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fields[issue.path.join('.') || '_root'] = issue.message;
      }
      next(new AppError(400, 'Validation failed', 'VALIDATION_ERROR', { fields }));
      return;
    }
    req.body = result.data;
    next();
  };
}
