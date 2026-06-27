import { z } from 'zod';

export const createTestCaseSchema = {
  body: z.object({
    input: z.string().min(1),
    expectedOutput: z.string().min(1),
    isSample: z.boolean().optional(),
    points: z.number().optional(),
    order: z.number().optional(),
  }),
};

export const updateTestCaseSchema = {
  body: z.object({
    input: z.string().min(1).optional(),
    expectedOutput: z.string().min(1).optional(),
    isSample: z.boolean().optional(),
    points: z.number().optional(),
    order: z.number().optional(),
  }),
};

export const bulkCreateTestCaseSchema = {
  body: z.array(
    z.object({
      input: z.string().min(1),
      expectedOutput: z.string().min(1),
      isSample: z.boolean().optional(),
      points: z.number().optional(),
      order: z.number().optional(),
    })
  ).min(1),
};
