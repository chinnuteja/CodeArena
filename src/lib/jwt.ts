import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { AppError } from './AppError.js';
import { UserRole } from '../config/constants.js';

export interface AccessClaims {
  sub: string;
  role: UserRole;
  jti: string;
  sid: string;
  iat?: number;
  exp?: number;
}

export const signAccessToken = (payload: { sub: string; role: UserRole; sid: string }) => {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { sub: payload.sub, role: payload.role, sid: payload.sid, jti },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_TTL as any }
  );

  // Approximate expiry in seconds for denylist
  const match = env.JWT_ACCESS_TTL.match(/^(\d+)([smhd])$/);
  let expSeconds = 900; // default 15m
  if (match) {
    const val = parseInt(match[1], 10);
    const unit = match[2];
    if (unit === 's') expSeconds = val;
    if (unit === 'm') expSeconds = val * 60;
    if (unit === 'h') expSeconds = val * 3600;
    if (unit === 'd') expSeconds = val * 86400;
  }

  return { token, jti, expSeconds };
};

export const verifyAccessToken = (token: string): AccessClaims => {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessClaims;
  } catch (err) {
    console.log('JWT VERIFY ERROR:', err);
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('TOKEN_EXPIRED', 401, 'Access token expired');
    }
    throw new AppError('TOKEN_INVALID', 401, 'Invalid access token');
  }
};
