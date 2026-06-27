import { Request, Response } from 'express';
import * as userService from './user.service.js';
import { getMe } from '../auth/auth.service.js';
import { env } from '../../config/env.js';

export const getMyProfile = async (req: Request, res: Response) => {
  const user = await getMe(req.user!.id);
  res.status(200).json({ data: userService.toSafeUser(user) });
};

export const updateMyProfile = async (req: Request, res: Response) => {
  const user = await userService.updateProfile(req.user!.id, req.body);
  res.status(200).json({ data: userService.toSafeUser(user) });
};

export const changeMyPassword = async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const { id, jti, exp } = req.user!;
  const ttl = exp - Math.floor(Date.now() / 1000);

  await userService.changePassword(id, currentPassword, newPassword, jti, ttl);
  res.clearCookie('refreshToken', { path: env.REFRESH_COOKIE_PATH });
  res.status(204).send();
};

export const getPublicProfile = async (req: Request, res: Response) => {
  const username = req.params.username as string;
  const profile = await userService.getPublicProfile(username);
  res.status(200).json({ data: profile });
};
