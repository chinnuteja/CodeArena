import { z } from 'zod';
import { ContestKind, ScoringMode } from '../../config/constants.js';

export const createContestSchema = {
  body: z.object({
    title: z.string().min(3).max(100),
    slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/),
    description: z.string().optional(),
    kind: z.nativeEnum(ContestKind),
    scoringMode: z.nativeEnum(ScoringMode),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    problemIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).default([]),
  }),
};

export const updateContestSchema = {
  params: z.object({
    slug: z.string(),
  }),
  body: z.object({
    title: z.string().min(3).max(100).optional(),
    description: z.string().optional(),
    startAt: z.coerce.date().optional(),
    endAt: z.coerce.date().optional(),
    problemIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
    scoringMode: z.nativeEnum(ScoringMode).optional(),
  }),
};

export const listContestsSchema = {
  query: z.object({
    kind: z.nativeEnum(ContestKind).optional(),
    status: z.enum(['upcoming', 'live', 'ended']).optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
  }),
};

export const createInviteSchema = {
  params: z.object({
    slug: z.string(),
  }),
  body: z.object({
    maxUses: z.number().int().min(1).optional(),
    expiresAt: z.coerce.date().optional(),
  }),
};

export const acceptInviteSchema = {
  body: z.object({
    token: z.string().min(10),
  }),
};
