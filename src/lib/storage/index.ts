import path from 'path';
import { env } from '../../config/env.js';
import { DiskStorage } from './storage.disk.js';
import { ObjectStorage } from './storage.interface.js';

// Singleton instance used across the app
export const storage: ObjectStorage = new DiskStorage(
  path.resolve(process.cwd(), env.STORAGE_PATH),
);
