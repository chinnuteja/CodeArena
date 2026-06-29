export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL'
  | 'EMAIL_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'TOKEN_INVALID'
  | 'TOKEN_EXPIRED'
  | 'PROBLEM_NOT_FOUND'
  | 'SLUG_TAKEN'
  | 'TESTCASE_NOT_FOUND'
  | 'LANGUAGE_NOT_ALLOWED'
  | 'SOURCE_TOO_LARGE'
  | 'SUBMISSION_NOT_FOUND'
  | 'CONTEST_NOT_FOUND'
  | 'CONTEST_NOT_LIVE'
  | 'CONTEST_ALREADY_STARTED'
  | 'NOT_REGISTERED'
  | 'ALREADY_REGISTERED'
  | 'INVITE_INVALID'
  | 'INVITE_EXPIRED'
  | 'PROBLEM_NOT_SUBMITTABLE'
  | 'AI_NOT_CONFIGURED'
  | 'AI_EMPTY_RESPONSE'
  | 'AI_REQUEST_FAILED';

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public httpStatus: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
