import { Types } from 'mongoose';
import { pubClient, redisClient } from '../../db/redis.js';
import { ContestStanding } from './standing.model.js';
import { Contest } from '../contest/contest.model.js';
import { ISubmission } from '../submission/submission.model.js';
import { REDIS_KEYS, ScoringMode, Verdict } from '../../config/constants.js';
import { env } from '../../config/env.js';

export const encodeScore = (scoringMode: ScoringMode, primary: number, secondary: number): number => {
  if (scoringMode === ScoringMode.ICPC) {
    // Primary: Solved Count (higher is better)
    // Secondary: Penalty Minutes (lower is better, so we subtract)
    // LARGE must be larger than maximum possible penalty. 1e7 is safe.
    const LARGE = 1e7;
    return primary * LARGE - secondary;
  } else {
    // IOI Mode
    // Primary: Total Points (higher is better)
    // Secondary: Time Taken in seconds (lower is better, so we subtract)
    const LARGE = 1e9;
    return primary * LARGE - secondary;
  }
};

export const onContestSubmissionFinalized = async (submission: ISubmission) => {
  if (!submission.contestId || submission.status !== 'DONE') {
    return;
  }

  const contest = await Contest.findById(submission.contestId);
  if (!contest) return;

  const contestStartMs = contest.startAt.getTime();
  const submissionTimeMs = submission.createdAt.getTime();
  
  // Find or create the user's standing document for this contest
  let standing = await ContestStanding.findOne({
    contestId: contest._id,
    userId: submission.userId,
  });

  if (!standing) {
    standing = new ContestStanding({
      contestId: contest._id,
      userId: submission.userId,
      problems: [],
      appliedSubmissionIds: [],
    });
  }

  // Idempotency check: Ensure we don't process the same submission twice
  if (standing.appliedSubmissionIds.includes(submission._id.toString())) {
    return;
  }
  standing.appliedSubmissionIds.push(submission._id.toString());

  // Find the problem entry
  let problemEntry = standing.problems.find((p) => p.problemId.equals(submission.problemId));
  if (!problemEntry) {
    problemEntry = {
      problemId: submission.problemId,
      solved: false,
      wrongCount: 0,
      bestPoints: 0,
    };
    standing.problems.push(problemEntry);
  }

  const isReject = [Verdict.WA, Verdict.TLE, Verdict.MLE, Verdict.RE].includes(submission.verdict as Verdict);
  const isAC = submission.verdict === Verdict.AC;
  const isCE = submission.verdict === Verdict.CE;

  if (contest.scoringMode === ScoringMode.ICPC) {
    if (!problemEntry.solved) {
      if (isAC) {
        problemEntry.solved = true;
        problemEntry.solvedAtMs = submissionTimeMs;
        
        const minutesTaken = Math.floor(Math.max(0, submissionTimeMs - contestStartMs) / 60000);
        const penalty = minutesTaken + (env.ICPC_PENALTY_MINUTES * problemEntry.wrongCount);
        
        standing.solvedCount += 1;
        standing.penaltyMinutes += penalty;
      } else if (isReject && !isCE) {
        // Compile errors do not add penalty
        problemEntry.wrongCount += 1;
      }
    }
  } else if (contest.scoringMode === ScoringMode.IOI) {
    // IOI mode points logic. Phase 8 gives AC=100 or 0 for now.
    // TODO(phase-future): Implement per-testcase partial scoring. For now, 100 for AC, 0 otherwise.
    const submissionPoints = isAC ? 100 : 0;
    
    if (submissionPoints > problemEntry.bestPoints) {
      const pointsDiff = submissionPoints - problemEntry.bestPoints;
      problemEntry.bestPoints = submissionPoints;
      standing.totalPoints += pointsDiff;
      standing.lastImprovementMs = submissionTimeMs;
    }
  }

  await standing.save();

  // Compute Redis Composite Score
  let compositeScore = 0;
  if (contest.scoringMode === ScoringMode.ICPC) {
    compositeScore = encodeScore(ScoringMode.ICPC, standing.solvedCount, standing.penaltyMinutes);
  } else {
    const secondsTaken = standing.lastImprovementMs 
      ? Math.floor(Math.max(0, standing.lastImprovementMs - contestStartMs) / 1000) 
      : 0;
    compositeScore = encodeScore(ScoringMode.IOI, standing.totalPoints, secondsTaken);
  }

  // Write to Redis ZSET
  const zsetKey = REDIS_KEYS.leaderboard(contest._id.toString());
  await redisClient.zadd(zsetKey, compositeScore, standing.userId.toString());

  // Publish SSE Event
  const sseChannel = REDIS_KEYS.sseLeaderboard(contest._id.toString());
  await pubClient.publish(sseChannel, JSON.stringify({ type: 'LEADERBOARD_UPDATE', userId: standing.userId }));
};

export const getLeaderboard = async (contestId: string, page: number = 1, limit: number = 20) => {
  const zsetKey = REDIS_KEYS.leaderboard(contestId);
  
  const start = (page - 1) * limit;
  const stop = start + limit - 1;

  const total = await redisClient.zcard(zsetKey);
  const rawRanks = await redisClient.zrevrange(zsetKey, start, stop, 'WITHSCORES');

  const userIds = [];
  for (let i = 0; i < rawRanks.length; i += 2) {
    userIds.push(rawRanks[i]);
  }

  // Hydrate standings
  const standings = await ContestStanding.find({
    contestId: new Types.ObjectId(contestId),
    userId: { $in: userIds.map(id => new Types.ObjectId(id)) }
  }).populate('userId', 'username');

  // Maintain sorted order from Redis
  const orderedStandings = userIds.map(uid => 
    standings.find(s => s.userId._id.toString() === uid)
  ).filter(Boolean);

  return { standings: orderedStandings, meta: { total, page, limit } };
};

export const getMyRank = async (contestId: string, userId: string) => {
  const zsetKey = REDIS_KEYS.leaderboard(contestId);
  const rank = await redisClient.zrevrank(zsetKey, userId);

  if (rank === null) return { rank: null, standing: null, neighbours: [] };

  const start = Math.max(0, rank - 3);
  const stop = rank + 3;

  const rawRanks = await redisClient.zrevrange(zsetKey, start, stop);
  
  const standings = await ContestStanding.find({
    contestId: new Types.ObjectId(contestId),
    userId: { $in: rawRanks.map(id => new Types.ObjectId(id)) }
  }).populate('userId', 'username');

  const orderedNeighbours = rawRanks.map(uid => 
    standings.find(s => s.userId._id.toString() === uid)
  ).filter(Boolean);

  const myStanding = orderedNeighbours.find(s => s?.userId._id.toString() === userId);

  return { rank: rank + 1, standing: myStanding, neighbours: orderedNeighbours };
};

export const rebuildLeaderboard = async (contestId: string) => {
  // Wipe ZSET
  const zsetKey = REDIS_KEYS.leaderboard(contestId);
  await redisClient.del(zsetKey);

  // Clear Mongo Standings
  await ContestStanding.deleteMany({ contestId: new Types.ObjectId(contestId) });

  // Replay all finalized submissions for this contest in chronological order
  const { Submission } = await import('../submission/submission.model.js');
  const { SubmissionStatus } = await import('../../config/constants.js');
  const submissions = await Submission.find({ contestId: new Types.ObjectId(contestId), status: SubmissionStatus.Done })
    .sort({ createdAt: 1 });

  for (const sub of submissions) {
    await onContestSubmissionFinalized(sub);
  }

  return { rebuiltSubmissions: submissions.length };
};
