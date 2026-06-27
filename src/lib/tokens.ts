import crypto from 'crypto';
import { redisClient } from '../db/redis.js';
import { REDIS_KEYS, UserRole } from '../config/constants.js';
import { AppError } from './AppError.js';
import { env } from '../config/env.js';

interface RefreshMeta {
  userAgent?: string;
  ip?: string;
}

export const issueRefreshToken = async (userId: string, role: UserRole, meta: RefreshMeta) => {
  const sessionId = crypto.randomUUID();
  const rawToken = crypto.randomBytes(40).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const ttlSeconds = env.JWT_REFRESH_TTL_DAYS * 86400;
  
  const payload = JSON.stringify({
    tokenHash,
    userId,
    role,
    createdAt: Date.now(),
    ...meta,
  });

  await redisClient.set(REDIS_KEYS.refresh(userId, sessionId), payload, 'EX', ttlSeconds);

  return { rawToken, sessionId };
};

export const rotateRefreshToken = async (userId: string, sessionId: string, presentedRawToken: string) => {
  const key = REDIS_KEYS.refresh(userId, sessionId);
  const data = await redisClient.get(key);

  if (!data) {
    throw new AppError('TOKEN_INVALID', 401, 'Invalid or expired refresh session');
  }

  const session = JSON.parse(data);
  const presentedHash = crypto.createHash('sha256').update(presentedRawToken).digest('hex');

  if (session.tokenHash !== presentedHash) {
    // Possible token theft, revoke session
    await revokeSession(userId, sessionId);
    throw new AppError('TOKEN_INVALID', 401, 'Invalid refresh token (hash mismatch)');
  }

  // Issue new token (rotate)
  const newRawToken = crypto.randomBytes(40).toString('base64url');
  const newTokenHash = crypto.createHash('sha256').update(newRawToken).digest('hex');

  session.tokenHash = newTokenHash;
  session.createdAt = Date.now();

  const ttlSeconds = env.JWT_REFRESH_TTL_DAYS * 86400;
  await redisClient.set(key, JSON.stringify(session), 'EX', ttlSeconds);

  return newRawToken;
};

export const revokeSession = async (userId: string, sessionId: string) => {
  await redisClient.del(REDIS_KEYS.refresh(userId, sessionId));
};

export const revokeAllSessions = async (userId: string) => {
  // In a real production system with cluster, SCAN should be used.
  // For standard redis instance, keys is acceptable for this scoped pattern.
  const prefix = REDIS_KEYS.refresh(userId, '*');
  const keys = await redisClient.keys(prefix);
  if (keys.length > 0) {
    await redisClient.del(...keys);
  }
};

export const denylistAccessJti = async (jti: string, ttlSeconds: number) => {
  if (ttlSeconds > 0) {
    await redisClient.set(REDIS_KEYS.denylist(jti), '1', 'EX', ttlSeconds);
  }
};

export const isAccessJtiDenied = async (jti: string): Promise<boolean> => {
  const exists = await redisClient.exists(REDIS_KEYS.denylist(jti));
  return exists === 1;
};
