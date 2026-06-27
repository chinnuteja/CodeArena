import fs from 'fs/promises';
import path from 'path';
import { ObjectStorage } from './storage.interface.js';

export class DiskStorage implements ObjectStorage {
  private baseDir: string;

  constructor(baseDir: string = path.join(process.cwd(), '.tmp', 'storage')) {
    this.baseDir = baseDir;
  }

  private async ensureDir(filePath: string) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
  }

  async putObject(key: string, data: Buffer | string): Promise<void> {
    const filePath = path.join(this.baseDir, key);
    await this.ensureDir(filePath);
    await fs.writeFile(filePath, data);
  }

  async getObject(key: string): Promise<string | null> {
    const filePath = path.join(this.baseDir, key);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return data;
    } catch (err: any) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  async deleteObject(key: string): Promise<void> {
    const filePath = path.join(this.baseDir, key);
    try {
      await fs.unlink(filePath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
}
