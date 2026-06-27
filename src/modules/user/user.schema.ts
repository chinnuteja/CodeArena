import { z } from 'zod';

export const updateProfileSchema = {
  body: z.object({
    fullName: z.string().optional(),
    dob: z.coerce.date().optional(),
    preferences: z.object({
      theme: z.enum(['light', 'dark']).optional(),
      editorFontSize: z.number().optional(),
    }).optional(),
  }),
};

export const changePasswordSchema = {
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
  }),
};
