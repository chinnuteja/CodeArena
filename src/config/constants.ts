export enum UserRole {
  Participant = 'participant',
  Setter = 'setter',
  Admin = 'admin',
}

export enum Difficulty {
  Easy = 'easy',
  Medium = 'medium',
  Hard = 'hard',
}

export enum Language {
  Cpp = 'cpp',
  Java = 'java',
  Python = 'python',
}

export enum SubmissionStatus {
  Pending = 'PENDING',
  Judging = 'JUDGING',
  Done = 'DONE',
  SystemError = 'SYSTEM_ERROR',
}

export enum Verdict {
  AC = 'AC',
  WA = 'WA',
  TLE = 'TLE',
  MLE = 'MLE',
  RE = 'RE',
  CE = 'CE',
}

export enum ScoringMode {
  ICPC = 'icpc',
  IOI = 'ioi',
}

export enum ContestKind {
  Friendly = 'friendly',
  Global = 'global',
}

export const REDIS_KEYS = {
  refresh: (userId: string, sessionId: string) => `auth:refresh:${userId}:${sessionId}`,
  denylist: (jti: string) => `auth:denylist:${jti}`,
  problemCache: (slug: string) => `cache:problem:${slug}`,
  problemListCache: (hash: string) => `cache:problemlist:${hash}`,
  sseVerdict: (submissionId: string) => `sse:verdict:${submissionId}`,
  leaderboard: (contestId: string) => `leaderboard:${contestId}`,
  sseLeaderboard: (contestId: string) => `sse:leaderboard:${contestId}`,
} as const;
