import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validate } from '../../middleware/validate.middleware.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import * as submissionController from './submission.controller.js';
import { createSubmissionSchema, listSubmissionsSchema } from './submission.schema.js';

import { subscribeToVerdict } from '../stream/stream.controller.js';

export const submissionRouter = Router();

submissionRouter.use(requireAuth);

submissionRouter.post('/', validate(createSubmissionSchema), asyncHandler(submissionController.createSubmission));
submissionRouter.get('/:id/stream', asyncHandler(subscribeToVerdict));
submissionRouter.get('/:id', asyncHandler(submissionController.getSubmission));
submissionRouter.get('/', validate(listSubmissionsSchema), asyncHandler(submissionController.listSubmissions));
