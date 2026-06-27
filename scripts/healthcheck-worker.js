const Redis = require('ioredis');

const url = process.env.REDIS_QUEUE_URL || process.env.REDIS_URL;

if (!url) {
  process.exit(1);
}

const redis = new Redis(url, {
  maxRetriesPerRequest: 1,
  connectTimeout: 4000,
  lazyConnect: true,
});

redis
  .connect()
  .then(() => redis.ping())
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
  .finally(() => redis.disconnect());
