import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validate } from '../../middleware/validate.middleware.js';
import { requireAuth, requireRole } from '../../middleware/auth.middleware.js';
import { UserRole } from '../../config/constants.js';
import * as testCaseController from './testcase.controller.js';
import { createTestCaseSchema, updateTestCaseSchema, bulkCreateTestCaseSchema } from './testcase.schema.js';

export const testcaseRouter = Router({ mergeParams: true });

testcaseRouter.use(requireAuth, requireRole(UserRole.Setter, UserRole.Admin));

testcaseRouter.get('/', asyncHandler(testCaseController.listTestCases));
testcaseRouter.post('/', validate(createTestCaseSchema), asyncHandler(testCaseController.createTestCase));
testcaseRouter.patch('/:id', validate(updateTestCaseSchema), asyncHandler(testCaseController.updateTestCase));
testcaseRouter.delete('/:id', asyncHandler(testCaseController.deleteTestCase));
testcaseRouter.post('/bulk', validate(bulkCreateTestCaseSchema), asyncHandler(testCaseController.bulkCreate));
