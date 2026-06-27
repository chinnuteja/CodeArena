import { Request, Response } from 'express';
import * as problemService from './problem.service.js';
import { AppError } from '../../lib/AppError.js';

export const listProblems = async (req: Request, res: Response) => {
  const result = await problemService.listProblems(req.query, req.user?.id);
  res.status(200).json(result);
};

export const getProblem = async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  const data = await problemService.getProblem(slug);
  res.status(200).json({ data });
};

export const createProblem = async (req: Request, res: Response) => {
  const data = await problemService.createProblem(req.body, req.user!.id);
  res.status(201).json({ data });
};

export const updateProblem = async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  const data = await problemService.updateProblem(slug, req.body);
  res.status(200).json({ data });
};

export const deleteProblem = async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  await problemService.deleteProblem(slug);
  res.status(204).send();
};

import { engine } from '../../lib/execution/index.js';
import { languages } from '../../lib/execution/languages.js';
import { wrapJavaSolutionSource } from '../../lib/execution/javaRunWrapper.js';
import { wrapPythonSolutionSource } from '../../lib/execution/pythonRunWrapper.js';
import { wrapCppSolutionSource } from '../../lib/execution/cppRunWrapper.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

import { env } from '../../config/env.js';

export const runCode = async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  const { language, source, input } = req.body;
  
  const problem = await problemService.getProblem(slug);

  if (
    problem.allowedLanguages?.length > 0 &&
    !problem.allowedLanguages.includes(language)
  ) {
    throw new AppError('LANGUAGE_NOT_ALLOWED', 400, 'Language not allowed for this problem');
  }

  const judgeBase = path.resolve(process.cwd(), env.JUDGE_WORKDIR);
  const workdir = await fs.mkdtemp(path.join(judgeBase, 'oj-run-'));
  await fs.chmod(workdir, 0o777);
  
  try {
    let finalSource = source;
    if (language === 'java') {
      finalSource = wrapJavaSolutionSource(source);
    } else if (language === 'python') {
      finalSource = wrapPythonSolutionSource(source);
    } else if (language === 'cpp') {
      finalSource = wrapCppSolutionSource(source);
    }

    const langSpec = languages[language as keyof typeof languages];
    const sourcePath = path.join(workdir, langSpec.sourceFilename);
    const inputPath = path.join(workdir, 'input.txt');
    
    await fs.writeFile(sourcePath, finalSource, { mode: 0o666 });
    await fs.writeFile(inputPath, input || '', { mode: 0o666 });
    
    const compileRes = await engine.compile(language, sourcePath, workdir);
    if (!compileRes.ok) {
      res.status(200).json({ data: { status: 'Compile Error', output: compileRes.error, runtime: 'N/A', memory: 'N/A' } });
      return;
    }
    
    const runRes = await engine.run({
      language,
      sourcePath: langSpec.sourceFilename,
      workdir,
      stdin: input,
      timeLimitMs: problem.timeLimitMs || 2000,
      memoryLimitMb: problem.memoryLimitMb || 256,
    });
    
    let status = 'Finished';
    if (runRes.timedOut) status = 'Time Limit Exceeded';
    if (runRes.oomKilled) status = 'Memory Limit Exceeded';
    if (runRes.exitCode !== 0 && !runRes.timedOut && !runRes.oomKilled) status = 'Runtime Error';
    
    res.status(200).json({
      data: {
        status,
        output: runRes.stdout,
        runtime: `${runRes.durationMs} ms`,
        memory: `${Math.round((runRes.memKb ?? 0) / 1024)} MB`
      }
    });
  } finally {
    try {
      await fs.rm(workdir, { recursive: true, force: true });
    } catch (e) {}
  }
};
