import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validate } from '../../middleware/validate.middleware.js';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import { UserRole } from '../../config/constants.js';
import * as problemController from './problem.controller.js';
import { createProblemSchema, updateProblemSchema, listProblemsSchema, runCodeSchema } from './problem.schema.js';

export const problemRouter = Router();

problemRouter.get('/', optionalAuth, validate(listProblemsSchema), asyncHandler(problemController.listProblems));
problemRouter.get('/:slug', asyncHandler(problemController.getProblem));

// Execution route
problemRouter.post('/:slug/run', validate(runCodeSchema), asyncHandler(problemController.runCode));

problemRouter.post('/', requireAuth, requireRole(UserRole.Setter, UserRole.Admin), validate(createProblemSchema), asyncHandler(problemController.createProblem));
problemRouter.patch('/:slug', requireAuth, requireRole(UserRole.Setter, UserRole.Admin), validate(updateProblemSchema), asyncHandler(problemController.updateProblem));
problemRouter.delete('/:slug', requireAuth, requireRole(UserRole.Admin), asyncHandler(problemController.deleteProblem));
