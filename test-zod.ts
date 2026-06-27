import { z } from 'zod';
import { Difficulty } from './src/config/constants.js';

const schema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  difficulty: z.nativeEnum(Difficulty).optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
  isPractice: z.string().optional().transform(val => val ? val === 'true' : undefined),
});

console.log(schema.parse({}));
