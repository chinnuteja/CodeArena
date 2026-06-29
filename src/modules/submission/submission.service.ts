import { Submission } from './submission.model.js';
import { Problem } from '../problem/problem.model.js';
import { AppError } from '../../lib/AppError.js';
import { enqueueJudgeJob } from './submission.queue.js';
import { storage } from '../../lib/storage/index.js';
import crypto from 'crypto';
import { Contest } from '../contest/contest.model.js';
import { isLive, isRegistered } from '../contest/contest.service.js';

interface CreateSubmissionDto {
  userId: string;
  problemSlug: string;
  language: string;
  source: string;
  contestId?: string;
}

export const createSubmission = async (data: CreateSubmissionDto) => {
  const problem = await Problem.findOne({ slug: data.problemSlug });
  if (!problem) {
    throw new AppError('PROBLEM_NOT_FOUND', 404, 'Problem not found');
  }

  if (problem.allowedLanguages.length > 0 && !problem.allowedLanguages.includes(data.language as any)) {
    throw new AppError('LANGUAGE_NOT_ALLOWED', 400, 'Language not allowed for this problem');
  }

  const sourceBytes = Buffer.byteLength(data.source, 'utf8');
  if (sourceBytes > Number(process.env.SUBMISSION_MAX_SOURCE_BYTES || 65536)) {
    throw new AppError('SOURCE_TOO_LARGE', 400, 'Source code exceeds maximum allowed size');
  }

  if (data.contestId) {
    const contest = await Contest.findById(data.contestId);
    if (!contest) throw new AppError('CONTEST_NOT_FOUND', 404, 'Contest not found');
    
    if (!isLive(contest)) {
      throw new AppError('CONTEST_NOT_LIVE', 400, 'Contest is not currently live');
    }

    const problemIdsString = contest.problemIds.map((id) => id.toString());
    if (!problemIdsString.includes(problem._id.toString())) {
      throw new AppError('PROBLEM_NOT_SUBMITTABLE', 400, 'Problem is not part of this contest');
    }

    const registered = await isRegistered(data.contestId, data.userId);
    if (!registered) {
      throw new AppError('NOT_REGISTERED', 403, 'User is not registered for this contest');
    }
  }

  const sourceRef = crypto.randomUUID() + '.txt';
  await storage.putObject(sourceRef, data.source);

  const submission = new Submission({
    userId: data.userId,
    problemId: problem._id,
    language: data.language,
    sourceRef,
    contestId: data.contestId || null,
  });

  await submission.save();

  await enqueueJudgeJob(submission.id, { isContest: !!submission.contestId });

  return submission;
};

export const getSubmissionForUser = async (submissionId: string, user: any) => {
  const submission = await Submission.findById(submissionId);
  if (!submission) {
    throw new AppError('SUBMISSION_NOT_FOUND', 404, 'Submission not found');
  }

  if (submission.userId.toString() !== user.id && user.role !== 'admin' && user.role !== 'setter') {
    throw new AppError('FORBIDDEN', 403, 'Access denied');
  }

  return submission;
};

export const listUserSubmissions = async (userId: string, query: { page: number; limit: number }) => {
  const skip = (query.page - 1) * query.limit;
  const [data, total] = await Promise.all([
    Submission.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    Submission.countDocuments({ userId }),
  ]);

  return { data, meta: { page: query.page, limit: query.limit, total } };
};
