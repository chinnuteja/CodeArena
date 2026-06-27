import { TestCase } from './testcase.model.js';
import { Problem } from '../problem/problem.model.js';
import { AppError } from '../../lib/AppError.js';
import { invalidateProblemCache } from '../problem/problem.service.js';

export const getAllForProblem = async (problemId: string) => {
  return TestCase.find({ problemId }).sort({ order: 1 });
};

export const listTestCases = async (slug: string) => {
  const problem = await Problem.findOne({ slug });
  if (!problem) throw new AppError('PROBLEM_NOT_FOUND', 404, 'Problem not found');

  return getAllForProblem(problem._id.toString());
};

export const createTestCase = async (slug: string, data: any) => {
  const problem = await Problem.findOne({ slug });
  if (!problem) throw new AppError('PROBLEM_NOT_FOUND', 404, 'Problem not found');

  if (data.order === undefined) {
    const last = await TestCase.findOne({ problemId: problem._id }).sort({ order: -1 });
    data.order = last ? last.order + 1 : 1;
  }

  const testCase = new TestCase({
    ...data,
    problemId: problem._id,
  });

  await testCase.save();
  await invalidateProblemCache(slug);
  return testCase;
};

export const updateTestCase = async (slug: string, id: string, data: any) => {
  const problem = await Problem.findOne({ slug });
  if (!problem) throw new AppError('PROBLEM_NOT_FOUND', 404, 'Problem not found');

  const testCase = await TestCase.findOne({ _id: id, problemId: problem._id });
  if (!testCase) throw new AppError('TESTCASE_NOT_FOUND', 404, 'Test case not found');

  Object.assign(testCase, data);
  await testCase.save();
  await invalidateProblemCache(slug);
  return testCase;
};

export const deleteTestCase = async (slug: string, id: string) => {
  const problem = await Problem.findOne({ slug });
  if (!problem) throw new AppError('PROBLEM_NOT_FOUND', 404, 'Problem not found');

  const testCase = await TestCase.findOne({ _id: id, problemId: problem._id });
  if (!testCase) throw new AppError('TESTCASE_NOT_FOUND', 404, 'Test case not found');

  await testCase.deleteOne();
  await invalidateProblemCache(slug);
};

export const bulkCreate = async (slug: string, data: any[]) => {
  const problem = await Problem.findOne({ slug });
  if (!problem) throw new AppError('PROBLEM_NOT_FOUND', 404, 'Problem not found');

  let currentOrder = 1;
  const last = await TestCase.findOne({ problemId: problem._id }).sort({ order: -1 });
  if (last) currentOrder = last.order + 1;

  const docs = data.map((d: any) => ({
    ...d,
    problemId: problem._id,
    order: d.order !== undefined ? d.order : currentOrder++,
  }));

  const created = await TestCase.insertMany(docs);
  await invalidateProblemCache(slug);
  return created;
};
