import argon2 from 'argon2';
import { env } from '../config/env.js';

export const hashPassword = async (plain: string): Promise<string> => {
  return argon2.hash(plain, { memoryCost: env.ARGON2_MEMORY_COST });
};

export const verifyPassword = async (plain: string, hash: string): Promise<boolean> => {
  return argon2.verify(hash, plain);
};
