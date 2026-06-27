import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/AppError.js';

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  next(new AppError('NOT_FOUND', 404, `Route ${req.method} ${req.originalUrl} not found`));
};
