import mongoose from 'mongoose';
import 'dotenv/config';
import { Problem } from './src/modules/problem/problem.model.js';
import { TestCase } from './src/modules/testcase/testcase.model.js';
import { Contest } from './src/modules/contest/contest.model.js';
import { Language, ContestKind, ScoringMode } from './src/config/constants.js';
import { redisClient } from './src/db/redis.js';

const ALL_LANGUAGES = [Language.Cpp, Language.Java, Language.Python, Language.JavaScript];

type SeedProblem = {
  title: string;
  slug: string;
  difficulty: 'easy' | 'medium' | 'hard';
  statement: string;
  testCases: { input: string; output: string; isSample?: boolean }[];
};

const problems: SeedProblem[] = [
  {
    title: 'Two Sum',
    slug: 'two-sum',
    difficulty: 'easy',
    statement: `<h1>Two Sum</h1><p>Given an array of integers <code>nums</code> and an integer <code>target</code>, return <em>indices of the two numbers such that they add up to <code>target</code></em>.</p>`,
    testCases: [
      { input: '4\n2 7 11 15\n9', output: '0 1', isSample: true },
      { input: '3\n3 2 4\n6', output: '1 2', isSample: true },
      { input: '2\n3 3\n6', output: '0 1' },
    ],
  },
  {
    title: 'Palindrome Number',
    slug: 'palindrome-number',
    difficulty: 'easy',
    statement: `<h1>Palindrome Number</h1><p>Given an integer <code>x</code>, return <code>true</code> if <code>x</code> is a <em>palindrome</em>, and <code>false</code> otherwise.</p>`,
    testCases: [
      { input: '121', output: 'true', isSample: true },
      { input: '-121', output: 'false', isSample: true },
      { input: '10', output: 'false', isSample: true },
    ],
  },
  {
    title: 'Valid Parentheses',
    slug: 'valid-parentheses',
    difficulty: 'easy',
    statement: `<h1>Valid Parentheses</h1><p>Given a string <code>s</code> containing just the characters <code>'('</code>, <code>')'</code>, <code>'{'</code>, <code>'}'</code>, <code>'['</code> and <code>']'</code>, determine if the input string is valid.</p>`,
    testCases: [
      { input: '()', output: 'true', isSample: true },
      { input: '()[]{}', output: 'true', isSample: true },
      { input: '(]', output: 'false' },
    ],
  },
  {
    title: 'Longest Substring',
    slug: 'longest-substring',
    difficulty: 'medium',
    statement: `<h1>Longest Substring</h1><p>Given a string <code>s</code>, find the length of the longest substring without repeating characters.</p>`,
    testCases: [
      { input: 'abcabcbb', output: '3', isSample: true },
      { input: 'bbbbb', output: '1', isSample: true },
      { input: 'pwwkew', output: '3' },
    ],
  },
  {
    title: 'Median of Two Sorted Arrays',
    slug: 'median-of-arrays',
    difficulty: 'hard',
    statement: `<h1>Median of Two Sorted Arrays</h1><p>Given two sorted arrays, return the median of the two sorted arrays.</p>`,
    testCases: [
      { input: '2\n1 3\n1\n2', output: '2.0', isSample: true },
      { input: '1\n2\n0', output: '2.0', isSample: true },
    ],
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/online_judge');

  const authorId = new mongoose.Types.ObjectId();

  await TestCase.deleteMany({});
  await Problem.deleteMany({});
  await Contest.deleteMany({});

  const createdProblemIds: mongoose.Types.ObjectId[] = [];

  for (const p of problems) {
    const problem = await Problem.create({
      title: p.title,
      slug: p.slug,
      statement: p.statement,
      difficulty: p.difficulty,
      timeLimitMs: 2000,
      memoryLimitMb: 256,
      allowedLanguages: ALL_LANGUAGES,
      isPractice: true,
      tags: [],
      createdBy: authorId,
    });

    await TestCase.insertMany(
      p.testCases.map((tc, i) => ({
        problemId: problem._id,
        input: tc.input,
        expectedOutput: tc.output,
        isSample: tc.isSample ?? false,
        points: 0,
        order: i + 1,
      })),
    );
    createdProblemIds.push(problem._id);
  }

  const now = Date.now();
  await Contest.create({
    title: 'Weekly Challenge #1',
    slug: 'weekly-challenge-1',
    description: 'A practice global contest with the first three archive problems.',
    kind: ContestKind.Global,
    scoringMode: ScoringMode.ICPC,
    startAt: new Date(now - 24 * 60 * 60 * 1000),
    endAt: new Date(now + 7 * 24 * 60 * 60 * 1000),
    problemIds: createdProblemIds.slice(0, 3),
    createdBy: authorId,
  });

  try {
    await redisClient.flushdb();
  } catch {
    // redis optional during seed
  }

  console.log(`Seeded ${problems.length} problems with test cases and 1 contest.`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
