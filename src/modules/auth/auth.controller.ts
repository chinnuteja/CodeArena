import { Request, Response } from 'express';
import * as authService from './auth.service.js';
import { toSafeUser } from '../user/user.service.js';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/AppError.js';

const parseCookies = (cookieHeader: string | undefined) => {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    if (!value) return;
    list[name] = decodeURIComponent(value);
  });
  return list;
};

const refreshCookieOptions = () => {
  const crossOrigin = Boolean(env.CORS_ORIGIN);
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    // Cross-origin SPA (e.g. Vercel → EC2) requires SameSite=None for refresh cookies
    sameSite: (crossOrigin ? 'none' : 'strict') as 'none' | 'strict',
    path: env.REFRESH_COOKIE_PATH,
    maxAge: env.JWT_REFRESH_TTL_DAYS * 86400 * 1000,
  };
};

const setRefreshCookie = (res: Response, token: string) => {
  res.cookie('refreshToken', token, refreshCookieOptions());
};

const clearRefreshCookie = (res: Response) => {
  res.clearCookie('refreshToken', refreshCookieOptions());
};

export const register = async (req: Request, res: Response) => {
  const user = await authService.registerUser(req.body);
  res.status(201).json({ data: toSafeUser(user) });
};

export const login = async (req: Request, res: Response) => {
  const { emailOrUsername, password } = req.body;
  const meta = {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  };

  const { user, accessToken, refreshToken, sessionId } = await authService.loginUser(emailOrUsername, password, meta);
  
  setRefreshCookie(res, `${user._id.toString()}:${sessionId}:${refreshToken}`);
  res.status(200).json({ data: { accessToken, user: toSafeUser(user) } });
};

export const refresh = async (req: Request, res: Response) => {
  const cookies = parseCookies(req.headers.cookie);
  const presentedRawToken = cookies['refreshToken'];
  
  if (!presentedRawToken) {
    throw new AppError('UNAUTHENTICATED', 401, 'Missing refresh token');
  }

  const parts = presentedRawToken.split(':');
  if (parts.length !== 3) {
    throw new AppError('UNAUTHENTICATED', 401, 'Invalid refresh token format');
  }
  const [userId, sessionId, tokenValue] = parts;

  const { accessToken, newRefreshToken } = await authService.refreshSession(userId, sessionId, tokenValue);
  
  setRefreshCookie(res, `${userId}:${sessionId}:${newRefreshToken}`);
  res.status(200).json({ data: { accessToken } });
};

export const logout = async (req: Request, res: Response) => {
  const { id, sid, jti, exp } = req.user!;
  const ttl = exp - Math.floor(Date.now() / 1000);
  
  await authService.logoutUser(id, sid, jti, ttl);
  clearRefreshCookie(res);
  res.status(204).send();
};

export const logoutAll = async (req: Request, res: Response) => {
  const { id, jti, exp } = req.user!;
  const ttl = exp - Math.floor(Date.now() / 1000);

  await authService.logoutAllUserSessions(id, jti, ttl);
  clearRefreshCookie(res);
  res.status(204).send();
};

export const me = async (req: Request, res: Response) => {
  const user = await authService.getMe(req.user!.id);
  res.status(200).json({ data: toSafeUser(user) });
};
