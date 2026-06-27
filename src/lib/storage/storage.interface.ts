export interface ObjectStorage {
  putObject(key: string, data: Buffer | string): Promise<void>;
  getObject(key: string): Promise<string | null>;
  deleteObject(key: string): Promise<void>;
}
