import Redis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export const redisClient = new Redis(env.REDIS_URL);

export const queueConnection = new Redis(env.REDIS_QUEUE_URL || env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const pubClient = new Redis(env.REDIS_URL);

export const subClient = new Redis(env.REDIS_URL);

export const connectRedis = async () => {
  try {
    await redisClient.ping();
    await queueConnection.ping();
    await pubClient.ping();
    await subClient.ping();
    logger.info('Connected to Redis instances successfully');
  } catch (error) {
    logger.error({ err: error }, 'Failed to connect to Redis instances');
    throw error;
  }
};

export const disconnectRedis = async () => {
  await redisClient.quit();
  await queueConnection.quit();
  await pubClient.quit();
  await subClient.quit();
  logger.info('Disconnected from Redis instances');
};
