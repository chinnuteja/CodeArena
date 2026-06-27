import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validate } from '../../middleware/validate.middleware.js';
import { requireAuth, requireRole, optionalAuth } from '../../middleware/auth.middleware.js';
import { UserRole } from '../../config/constants.js';
import * as contestController from './contest.controller.js';
import {
  createContestSchema,
  updateContestSchema,
  listContestsSchema,
  createInviteSchema,
  acceptInviteSchema,
} from './contest.schema.js';
import { leaderboardRouter } from '../leaderboard/leaderboard.routes.js';

export const contestRouter = Router();

contestRouter.use('/:slug/leaderboard', leaderboardRouter);

contestRouter.post(
  '/',
  requireAuth,
  requireRole(UserRole.Setter, UserRole.Admin),
  validate(createContestSchema),
  asyncHandler(contestController.createContest)
);

contestRouter.patch(
  '/:slug',
  requireAuth,
  requireRole(UserRole.Setter, UserRole.Admin),
  validate(updateContestSchema),
  asyncHandler(contestController.updateContest)
);

contestRouter.get(
  '/',
  optionalAuth,
  validate(listContestsSchema),
  asyncHandler(contestController.listContests)
);

contestRouter.get(
  '/:slug',
  optionalAuth,
  asyncHandler(contestController.getContest)
);

contestRouter.post(
  '/:slug/register',
  requireAuth,
  asyncHandler(contestController.registerForGlobal)
);

contestRouter.post(
  '/:slug/invites',
  requireAuth,
  requireRole(UserRole.Setter, UserRole.Admin),
  validate(createInviteSchema),
  asyncHandler(contestController.createInvite)
);

contestRouter.post(
  '/invites/accept',
  requireAuth,
  validate(acceptInviteSchema),
  asyncHandler(contestController.acceptInvite)
);

contestRouter.get(
  '/:slug/me',
  requireAuth,
  asyncHandler(contestController.getMyRegistration)
);
