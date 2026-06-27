import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validate } from '../../middleware/validate.middleware.js';
import { requireAuth, optionalAuth, requireRole } from '../../middleware/auth.middleware.js';
import { UserRole } from '../../config/constants.js';
import * as leaderboardController from './leaderboard.controller.js';
import { getLeaderboardSchema } from './leaderboard.schema.js';

export const leaderboardRouter = Router({ mergeParams: true });

leaderboardRouter.get(
  '/',
  optionalAuth,
  validate(getLeaderboardSchema),
  asyncHandler(leaderboardController.getLeaderboard)
);

leaderboardRouter.get(
  '/me',
  requireAuth,
  asyncHandler(leaderboardController.getMyRank)
);

leaderboardRouter.get(
  '/stream',
  requireAuth,
  asyncHandler(leaderboardController.subscribeToLeaderboard)
);

leaderboardRouter.post(
  '/rebuild',
  requireAuth,
  requireRole(UserRole.Admin),
  asyncHandler(leaderboardController.rebuildLeaderboard)
);
