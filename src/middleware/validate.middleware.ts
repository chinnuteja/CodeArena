import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from '../lib/AppError.js';

interface ValidationSchemas {
  body?: ZodSchema<any>;
  params?: ZodSchema<any>;
  query?: ZodSchema<any>;
}

export const validate =
  (schemas: ValidationSchemas) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        Object.defineProperty(req, 'body', { value: schemas.body.parse(req.body), writable: true });
      }
      if (schemas.params) {
        Object.defineProperty(req, 'params', { value: schemas.params.parse(req.params), writable: true });
      }
      if (schemas.query) {
        Object.defineProperty(req, 'query', { value: schemas.query.parse(req.query), writable: true });
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(new AppError('VALIDATION_ERROR', 400, 'Validation failed', err.flatten()));
      } else {
        next(err);
      }
    }
  };
