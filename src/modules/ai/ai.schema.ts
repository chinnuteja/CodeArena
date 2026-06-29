import { z } from 'zod';
import { Language } from '../../config/constants.js';

export const AiAction = z.enum([
  'rate',
  'hints',
  'solution',
  'enhance',
  'time_complexity',
  'space_complexity',
]);

export const aiAssistSchema = {
  body: z.object({
    problemSlug: z.string().min(1),
    language: z.nativeEnum(Language),
    source: z.string().min(1).max(65536),
    action: AiAction,
    executionContext: z
      .object({
        hasRun: z.boolean().optional(),
        hasSubmit: z.boolean().optional(),
        runStatuses: z.array(z.string()).optional(),
        submitVerdict: z.string().nullable().optional(),
        passedTestCases: z.number().optional(),
        totalTestCases: z.number().optional(),
      })
      .optional(),
  }),
};
