import { pubClient } from '../../db/redis.js';
import { Verdict, SubmissionStatus, REDIS_KEYS } from '../../config/constants.js';

export interface VerdictPayload {
  submissionId: string;
  status: SubmissionStatus;
  verdict: Verdict | null;
  score: number;
  execMs?: number;
  memKb?: number;
  failedCaseIndex?: number;
  passedTestCases?: number;
  totalTestCases?: number;
  failedTestCase?: {
    input: string;
    expectedOutput: string;
    actualOutput?: string;
  };
}

export const publishVerdict = async (submissionId: string, payload: VerdictPayload) => {
  await pubClient.publish(REDIS_KEYS.sseVerdict(submissionId), JSON.stringify(payload));
};
