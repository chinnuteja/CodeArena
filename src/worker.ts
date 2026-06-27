import { Worker } from 'bullmq';
import { connectMongo } from './db/mongo.js';
import { connectRedis } from './db/redis.js';
import { JUDGE_QUEUE_NAME, JudgeJob } from './modules/submission/submission.queue.js';
import { judgeSubmission } from './modules/judge/judge.service.js';
import { env } from './config/env.js';

async function main() {
  await connectMongo();
  await connectRedis();

  const worker = new Worker<JudgeJob>(
    JUDGE_QUEUE_NAME,
    async (job) => {
      console.log(`Starting job ${job.id} for submission ${job.data.submissionId}`);
      await judgeSubmission(job.data.submissionId);
    },
    {
      connection: {
        url: env.REDIS_QUEUE_URL || env.REDIS_URL,
      },
      concurrency: env.JUDGE_CONCURRENCY,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
  });

  console.log('Worker started and listening to queue...');

  process.on('SIGINT', async () => {
    console.log('Shutting down worker...');
    await worker.close();
    process.exit(0);
  });
}

main().catch(console.error);
