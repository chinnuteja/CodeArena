import { z } from 'zod';
import { Difficulty, Language } from '../../config/constants.js';

export const createProblemSchema = {
  body: z.object({
    title: z.string().min(1),
    statement: z.string().min(1),
    difficulty: z.nativeEnum(Difficulty),
    timeLimitMs: z.number().optional(),
    memoryLimitMb: z.number().optional(),
    allowedLanguages: z.array(z.nativeEnum(Language)).optional(),
    isPractice: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
  }),
};

export const updateProblemSchema = {
  body: z.object({
    title: z.string().min(1).optional(),
    statement: z.string().min(1).optional(),
    difficulty: z.nativeEnum(Difficulty).optional(),
    timeLimitMs: z.number().optional(),
    memoryLimitMb: z.number().optional(),
    allowedLanguages: z.array(z.nativeEnum(Language)).optional(),
    isPractice: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
  }),
};

export const listProblemsSchema = {
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    difficulty: z.nativeEnum(Difficulty).optional(),
    tag: z.string().optional(),
    search: z.string().optional(),
    isPractice: z.string().optional().transform(val => val ? val === 'true' : undefined),
  }),
};

export const runCodeSchema = {
  params: z.object({
    slug: z.string(),
  }),
  body: z.object({
    language: z.nativeEnum(Language),
    source: z.string().min(1),
    input: z.string().default(''),
  }),
};
