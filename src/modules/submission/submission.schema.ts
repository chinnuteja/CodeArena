import { z } from 'zod';
import { Language } from '../../config/constants.js';

export const createSubmissionSchema = {
  body: z.object({
    problemSlug: z.string().min(1),
    language: z.nativeEnum(Language),
    source: z.string().min(1),
    contestId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  }),
};

export const listSubmissionsSchema = {
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
  }),
};
