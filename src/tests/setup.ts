import { vi } from 'vitest';

vi.mock('ioredis', async () => {
  const RedisMock = await import('ioredis-mock');
  return {
    default: RedisMock.default
  };
});

process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.MONGO_URI = 'mongodb://localhost:27017/test_oj';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET = 'super-secret-test-key-long-enough';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL_DAYS = '7';
process.env.ARGON2_MEMORY_COST = '1024';
process.env.LOG_LEVEL = 'silent';
process.env.REFRESH_COOKIE_PATH = '/auth/refresh';
