import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validate } from '../../middleware/validate.middleware.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import * as aiController from './ai.controller.js';
import { aiAssistSchema } from './ai.schema.js';

export const aiRouter = Router();

aiRouter.get('/status', asyncHandler(aiController.status));
aiRouter.post('/assist', requireAuth, validate(aiAssistSchema), asyncHandler(aiController.assist));
