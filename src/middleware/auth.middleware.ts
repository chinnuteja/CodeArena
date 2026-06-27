import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/AppError.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { isAccessJtiDenied } from '../lib/tokens.js';
import { UserRole } from '../config/constants.js';

export interface AuthUser {
  id: string;
  role: UserRole;
  jti: string;
  sid: string;
  exp: number;
}

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const claims = verifyAccessToken(token);

    const isDenied = await isAccessJtiDenied(claims.jti);
    if (!isDenied) {
      req.user = {
        id: claims.sub,
        role: claims.role,
        jti: claims.jti,
        sid: claims.sid,
        exp: claims.exp || (Math.floor(Date.now() / 1000) + 900),
      };
    }
    next();
  } catch (error) {
    next();
  }
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('UNAUTHENTICATED', 401, 'Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];
    const claims = verifyAccessToken(token);

    const isDenied = await isAccessJtiDenied(claims.jti);
    if (isDenied) {
      throw new AppError('TOKEN_INVALID', 401, 'Token has been revoked');
    }

    req.user = {
      id: claims.sub,
      role: claims.role,
      jti: claims.jti,
      sid: claims.sid,
      exp: claims.exp || (Math.floor(Date.now() / 1000) + 900),
    };

    next();
  } catch {
    next(new AppError('TOKEN_INVALID', 401, 'Invalid access token'));
  }
};

export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError('FORBIDDEN', 403, 'Insufficient permissions'));
      return;
    }
    next();
  };
};
