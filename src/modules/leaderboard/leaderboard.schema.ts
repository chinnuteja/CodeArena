import { z } from 'zod';

export const getLeaderboardSchema = {
  params: z.object({
    slug: z.string(),
  }),
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
  }),
};
