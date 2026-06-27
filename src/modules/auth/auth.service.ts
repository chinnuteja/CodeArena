import { User } from '../user/user.model.js';
import { AppError } from '../../lib/AppError.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { issueRefreshToken, rotateRefreshToken, revokeSession, revokeAllSessions, denylistAccessJti } from '../../lib/tokens.js';
import { signAccessToken } from '../../lib/jwt.js';

export const registerUser = async (data: any) => {
  const existingEmail = await User.findOne({ email: data.email });
  if (existingEmail) {
    throw new AppError('EMAIL_TAKEN', 409, 'Email is already taken');
  }

  const existingUsername = await User.findOne({ username: data.username });
  if (existingUsername) {
    throw new AppError('CONFLICT', 409, 'Username is already taken');
  }

  const hashedPassword = await hashPassword(data.password);

  const user = new User({
    username: data.username,
    email: data.email,
    passwordHash: hashedPassword,
    fullName: data.fullName,
    dob: data.dob,
  });

  await user.save();
  return user;
};

export const loginUser = async (emailOrUsername: string, plain: string, meta: any) => {
  const user = await User.findOne({
    $or: [{ email: emailOrUsername.toLowerCase() }, { username: emailOrUsername }]
  }).select('+passwordHash');

  if (!user) {
    throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid credentials');
  }

  const isValid = await verifyPassword(plain, user.passwordHash);
  if (!isValid) {
    throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid credentials');
  }

  const { rawToken, sessionId } = await issueRefreshToken(user._id.toString(), user.role, meta);
  const { token: accessToken, expSeconds } = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    sid: sessionId,
  });

  return { user, accessToken, refreshToken: rawToken, sessionId, expSeconds };
};

export const refreshSession = async (userId: string, sessionId: string, presentedRawToken: string) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('UNAUTHENTICATED', 401, 'User not found');
  }

  const newRefreshToken = await rotateRefreshToken(userId, sessionId, presentedRawToken);
  
  const { token: accessToken, expSeconds } = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    sid: sessionId,
  });

  return { accessToken, newRefreshToken, expSeconds };
};

export const logoutUser = async (userId: string, sessionId: string, jti: string, expSeconds: number) => {
  await revokeSession(userId, sessionId);
  await denylistAccessJti(jti, expSeconds);
};

export const logoutAllUserSessions = async (userId: string, jti: string, expSeconds: number) => {
  await revokeAllSessions(userId);
  await denylistAccessJti(jti, expSeconds);
};

export const getMe = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('NOT_FOUND', 404, 'User not found');
  }
  return user;
};
