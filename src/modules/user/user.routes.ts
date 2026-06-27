import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validate } from '../../middleware/validate.middleware.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import * as userController from './user.controller.js';
import { updateProfileSchema, changePasswordSchema } from './user.schema.js';

export const userRouter = Router();

userRouter.get('/me', requireAuth, asyncHandler(userController.getMyProfile));
userRouter.patch('/me', requireAuth, validate(updateProfileSchema), asyncHandler(userController.updateMyProfile));
userRouter.post('/me/change-password', requireAuth, validate(changePasswordSchema), asyncHandler(userController.changeMyPassword));
userRouter.get('/:username', asyncHandler(userController.getPublicProfile));
