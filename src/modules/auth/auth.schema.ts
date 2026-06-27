import { z } from 'zod';

export const registerSchema = {
  body: z.object({
    username: z.string().min(3).max(30),
    email: z.string().email(),
    password: z.string().min(8),
    fullName: z.string().optional(),
    dob: z.coerce.date().optional(),
  }),
};

export const loginSchema = {
  body: z.object({
    emailOrUsername: z.string().min(1),
    password: z.string().min(1),
  }),
};
