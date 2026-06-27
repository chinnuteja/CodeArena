import { User, IUser } from './user.model.js';
import { AppError } from '../../lib/AppError.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { revokeAllSessions, denylistAccessJti } from '../../lib/tokens.js';

export const toSafeUser = (user: IUser) => {
  const obj = user.toObject();
  const safeUser = {
    id: obj._id.toString(),
    username: obj.username,
    email: obj.email,
    role: obj.role,
    rating: obj.rating,
    fullName: obj.fullName,
    dob: obj.dob,
    preferences: obj.preferences,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
  return safeUser;
};

export const updateProfile = async (userId: string, data: any) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('NOT_FOUND', 404, 'User not found');
  }

  if (data.fullName !== undefined) user.fullName = data.fullName;
  if (data.dob !== undefined) user.dob = data.dob;
  if (data.preferences) {
    if (data.preferences.theme) user.preferences = { ...user.preferences, theme: data.preferences.theme };
    if (data.preferences.editorFontSize) user.preferences = { ...user.preferences, editorFontSize: data.preferences.editorFontSize };
  }

  await user.save();
  return user;
};

export const changePassword = async (userId: string, currentPassword: string, newPassword: string, jti: string, expSeconds: number) => {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw new AppError('NOT_FOUND', 404, 'User not found');
  }

  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValid) {
    throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid current password');
  }

  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  await revokeAllSessions(userId);
  await denylistAccessJti(jti, expSeconds);
};

export const getPublicProfile = async (username: string) => {
  const user = await User.findOne({ username });
  if (!user) {
    throw new AppError('NOT_FOUND', 404, 'User not found');
  }

  return {
    username: user.username,
    fullName: user.fullName,
    rating: user.rating,
    createdAt: user.createdAt,
  };
};
