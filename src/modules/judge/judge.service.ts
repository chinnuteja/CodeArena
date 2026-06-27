import fs from 'fs/promises';
import path from 'path';
import { Submission } from '../submission/submission.model.js';
import { Problem } from '../problem/problem.model.js';
import { getAllForProblem } from '../testcase/testcase.service.js';
import { storage } from '../../lib/storage/index.js';
import { engine } from '../../lib/execution/index.js';
import { publishVerdict } from '../stream/verdict.publisher.js';
import { Verdict, SubmissionStatus, Language } from '../../config/constants.js';
import { languages } from '../../lib/execution/languages.js';
import { env } from '../../config/env.js';

export const judgeSubmission = async (submissionId: string) => {
  const submission = await Submission.findById(submissionId).populate('problemId');
  if (!submission) return;

  const problem = submission.problemId as any;

  submission.status = SubmissionStatus.Judging;
  await submission.save();

  await publishVerdict(submissionId, {
    submissionId,
    status: SubmissionStatus.Judging,
    verdict: null,
    score: 0,
  });

  const judgeBase = path.resolve(process.cwd(), env.JUDGE_WORKDIR);
  await fs.mkdir(judgeBase, { recursive: true });
  const workdir = await fs.mkdtemp(path.join(judgeBase, 'oj-'));
  await fs.chmod(workdir, 0o777);

  try {
    const sourceCode = await storage.getObject(submission.sourceRef);
    if (!sourceCode) {
      submission.status = SubmissionStatus.SystemError;
      await submission.save();
      await publishVerdict(submissionId, { submissionId, status: SubmissionStatus.SystemError, verdict: null, score: 0 });
      return;
    }

    const langSpec = languages[submission.language as Language];
    const sourcePath = path.join(workdir, langSpec.sourceFilename);
    await fs.writeFile(sourcePath, sourceCode, { mode: 0o666 });

    const compileRes = await engine.compile(submission.language as Language, sourcePath, workdir);
    if (!compileRes.ok) {
      submission.status = SubmissionStatus.Done;
      submission.verdict = Verdict.CE;
      submission.score = 0;
      submission.compileError = compileRes.error;
      await submission.save();
      await publishVerdict(submissionId, { submissionId, status: SubmissionStatus.Done, verdict: Verdict.CE, score: 0 });
      return;
    }

    const testcases = await getAllForProblem(problem._id.toString());
    let allPassed = true;
    let failedIndex = -1;
    let maxMs = 0;
    let maxMem = 0;
    let finalVerdict = Verdict.AC;
    let passedCount = 0;
    let failedTestCaseData: any = undefined;

    for (let i = 0; i < testcases.length; i++) {
      const tc = testcases[i];
      const runRes = await engine.run({
        language: submission.language as Language,
        sourcePath: langSpec.sourceFilename,
        workdir,
        stdin: tc.input,
        timeLimitMs: problem.timeLimitMs || 2000,
        memoryLimitMb: problem.memoryLimitMb || 256,
      });

      maxMs = Math.max(maxMs, runRes.durationMs);
      maxMem = Math.max(maxMem, runRes.memKb || 0);

      if (runRes.timedOut) {
        finalVerdict = Verdict.TLE;
        allPassed = false;
        failedIndex = i;
        failedTestCaseData = { input: tc.input, expectedOutput: tc.expectedOutput, actualOutput: '' };
        break;
      }
      if (runRes.oomKilled) {
        finalVerdict = Verdict.MLE;
        allPassed = false;
        failedIndex = i;
        failedTestCaseData = { input: tc.input, expectedOutput: tc.expectedOutput, actualOutput: '' };
        break;
      }
      if (runRes.exitCode !== 0) {
        finalVerdict = Verdict.RE;
        allPassed = false;
        failedIndex = i;
        failedTestCaseData = { input: tc.input, expectedOutput: tc.expectedOutput, actualOutput: '' };
        break;
      }

      const expected = tc.expectedOutput.trim();
      const actual = runRes.stdout.trim();
      console.log(`[JUDGE TRACE] Testcase ${i + 1}`);
      console.log(`[JUDGE TRACE] Expected: ${JSON.stringify(expected)}`);
      console.log(`[JUDGE TRACE] Actual: ${JSON.stringify(actual)}`);
      if (actual !== expected) {
        finalVerdict = Verdict.WA;
        allPassed = false;
        failedIndex = i;
        failedTestCaseData = { input: tc.input, expectedOutput: tc.expectedOutput, actualOutput: actual };
        break;
      }
      passedCount++;
    }

    submission.status = SubmissionStatus.Done;
    submission.verdict = finalVerdict;
    submission.score = allPassed ? 100 : 0;
    submission.execMs = maxMs;
    submission.memKb = maxMem;
    submission.failedCaseIndex = failedIndex !== -1 ? failedIndex : undefined;
    submission.passedTestCases = passedCount;
    submission.totalTestCases = testcases.length;
    if (failedTestCaseData) {
      submission.failedTestCase = failedTestCaseData;
    }
    await submission.save();

    await publishVerdict(submissionId, {
      submissionId,
      status: SubmissionStatus.Done,
      verdict: finalVerdict,
      score: submission.score,
      execMs: maxMs,
      memKb: maxMem,
      failedCaseIndex: failedIndex !== -1 ? failedIndex : undefined,
      passedTestCases: passedCount,
      totalTestCases: testcases.length,
      failedTestCase: failedTestCaseData,
    });

    if (submission.contestId) {
      const { onContestSubmissionFinalized } = await import('../leaderboard/leaderboard.service.js');
      await onContestSubmissionFinalized(submission);
    }

  } catch (err) {
    console.error('Judge error:', err);
    submission.status = SubmissionStatus.SystemError;
    await submission.save();
    await publishVerdict(submissionId, { submissionId, status: SubmissionStatus.SystemError, verdict: null, score: 0 });
  } finally {
    try {
      await fs.rm(workdir, { recursive: true, force: true });
    } catch (e) {}
  }
};
