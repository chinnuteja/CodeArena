import { Problem, IProblem } from './problem.model.js';
import { TestCase } from '../testcase/testcase.model.js';
import { Submission } from '../submission/submission.model.js';
import { AppError } from '../../lib/AppError.js';
import { redisClient } from '../../db/redis.js';
import { REDIS_KEYS, Verdict } from '../../config/constants.js';
import crypto from 'crypto';
import slugify from 'slugify';
import { Types } from 'mongoose';

const attachSolvedStatus = async (problems: any[], userId: string) => {
  const problemIds = problems.map((p) => p._id);
  const solvedIds = await Submission.distinct('problemId', {
    userId: new Types.ObjectId(userId),
    problemId: { $in: problemIds },
    verdict: Verdict.AC,
    contestId: null,
  });
  const solvedSet = new Set(solvedIds.map((id) => id.toString()));
  return problems.map((p) => ({
    ...(typeof p.toObject === 'function' ? p.toObject() : p),
    solved: solvedSet.has(p._id.toString()),
  }));
};

export const listProblems = async (query: any, userId?: string) => {
  const hash = crypto.createHash('md5').update(JSON.stringify(query)).digest('hex');
  const cacheKey = REDIS_KEYS.problemListCache(hash);

  // Authenticated users always get fresh solved status from MongoDB
  if (!userId) {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  }

  const { page, limit, difficulty, tag, search, isPractice } = query;
  const filter: any = {};

  if (difficulty) filter.difficulty = difficulty;
  if (tag) filter.tags = tag;
  if (isPractice !== undefined) filter.isPractice = isPractice;
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { slug: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    Problem.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Problem.countDocuments(filter),
  ]);

  const plainData = data.map((p) => (typeof p.toObject === 'function' ? p.toObject() : p));
  const result = {
    data: userId ? await attachSolvedStatus(plainData, userId) : plainData,
    meta: { page, limit, total },
  };

  await redisClient.set(cacheKey, JSON.stringify({ data: plainData, meta: result.meta }), 'EX', 30);

  return result;
};

export const invalidateProblemListCache = async () => {
  const keys = await redisClient.keys('cache:problemlist:*');
  if (keys.length > 0) {
    await redisClient.del(...keys);
  }
};

export const getProblem = async (slug: string) => {
  const cacheKey = REDIS_KEYS.problemCache(slug);
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const problem = await Problem.findOne({ slug });
  if (!problem) {
    throw new AppError('PROBLEM_NOT_FOUND', 404, 'Problem not found');
  }

  const sampleTestCases = await TestCase.find({ problemId: problem._id, isSample: true }).sort({ order: 1 });

  const result = { ...problem.toObject(), sampleTestCases };
  
  await redisClient.set(cacheKey, JSON.stringify(result), 'EX', 300); // 5m cache
  
  return result;
};

export const createProblem = async (data: any, userId: string) => {
  const slug = slugify.default ? slugify.default(data.title, { lower: true, strict: true }) : slugify(data.title, { lower: true, strict: true });
  
  const existing = await Problem.findOne({ slug });
  if (existing) {
    throw new AppError('SLUG_TAKEN', 409, 'A problem with a similar title already exists');
  }

  const problem = new Problem({
    ...data,
    slug,
    createdBy: userId,
  });

  await problem.save();
  return problem;
};

export const updateProblem = async (slug: string, data: any) => {
  const problem = await Problem.findOne({ slug });
  if (!problem) {
    throw new AppError('PROBLEM_NOT_FOUND', 404, 'Problem not found');
  }

  Object.assign(problem, data);
  await problem.save();

  await invalidateProblemCache(slug);
  return problem;
};

export const deleteProblem = async (slug: string) => {
  const problem = await Problem.findOne({ slug });
  if (!problem) {
    throw new AppError('PROBLEM_NOT_FOUND', 404, 'Problem not found');
  }

  await TestCase.deleteMany({ problemId: problem._id });
  await problem.deleteOne();

  await invalidateProblemCache(slug);
};

export const invalidateProblemCache = async (slug: string) => {
  await redisClient.del(REDIS_KEYS.problemCache(slug));
  await invalidateProblemListCache();
};
