import { Language } from '../../config/constants.js';

export interface RunRequest {
  language: Language;
  sourcePath: string; // relative to workdir
  workdir: string;    // absolute path on host
  stdin: string;
  timeLimitMs: number;
  memoryLimitMb: number;
}

export interface RunResult {
  stdout: string;
  exitCode: number | null;
  timedOut: boolean;
  oomKilled: boolean;
  durationMs: number;
  memKb?: number;
}

export interface CompileResult {
  ok: boolean;
  artifactPath?: string;
  error?: string;
}

export interface ExecutionEngine {
  compile(language: Language, sourcePath: string, workdir: string): Promise<CompileResult>;
  run(req: RunRequest): Promise<RunResult>;
}
