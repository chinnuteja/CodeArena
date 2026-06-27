import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    logger.warn({ err, reqId: req.id }, `AppError: ${err.message}`);
    return res.status(err.httpStatus).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  logger.error({ err, reqId: req.id }, 'Unhandled Exception');
  return res.status(500).json({
    error: {
      code: 'INTERNAL',
      message: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
};
