import { Queue } from 'bullmq';
import { env } from '../../config/env.js';

export const JUDGE_QUEUE_NAME = 'judge';

export const judgeQueue = process.env.NODE_ENV === 'test' 
  ? ({} as any) 
  : new Queue(JUDGE_QUEUE_NAME, { connection: { url: env.REDIS_QUEUE_URL || env.REDIS_URL } });

export interface JudgeJob {
  submissionId: string;
}

export const enqueueJudgeJob = async (submissionId: string, options: { isContest: boolean }) => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  await judgeQueue.add(
    'judgeSubmission',
    { submissionId },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: false,
      priority: options.isContest ? 1 : 10,
    }
  );
};
