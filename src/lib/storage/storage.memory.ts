import { ObjectStorage } from './storage.interface.js';

export class MemoryStorage implements ObjectStorage {
  private store = new Map<string, string>();

  async putObject(key: string, data: Buffer | string): Promise<void> {
    this.store.set(key, data.toString());
  }

  async getObject(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async deleteObject(key: string): Promise<void> {
    this.store.delete(key);
  }
}
