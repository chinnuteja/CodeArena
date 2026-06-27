import { redisClient } from './src/db/redis.js';

async function flush() {
  await redisClient.flushdb();
  console.log("Redis flushed!");
  process.exit(0);
}
flush();
