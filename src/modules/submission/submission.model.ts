import mongoose, { Schema, Document, Types } from 'mongoose';
import { Language, SubmissionStatus, Verdict } from '../../config/constants.js';

export interface ISubmission extends Document {
  userId: Types.ObjectId;
  problemId: Types.ObjectId;
  contestId?: Types.ObjectId;
  language: Language;
  sourceRef: string;
  status: SubmissionStatus;
  verdict: Verdict | null;
  score: number;
  execMs?: number;
  memKb?: number;
  compileError?: string;
  failedCaseIndex?: number;
  passedTestCases?: number;
  totalTestCases?: number;
  failedTestCase?: {
    input: string;
    expectedOutput: string;
    actualOutput?: string;
  };
  judgedBy?: string;
  attempt?: number;
  createdAt: Date;
  updatedAt: Date;
}

const submissionSchema = new Schema<ISubmission>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    problemId: { type: Schema.Types.ObjectId, ref: 'Problem', required: true },
    contestId: { type: Schema.Types.ObjectId, ref: 'Contest' },
    language: { type: String, enum: Object.values(Language), required: true },
    sourceRef: { type: String, required: true },
    status: { type: String, enum: Object.values(SubmissionStatus), default: SubmissionStatus.Pending },
    verdict: { type: String, enum: Object.values(Verdict), default: null },
    score: { type: Number, default: 0 },
    execMs: { type: Number },
    memKb: { type: Number },
    compileError: { type: String },
    failedCaseIndex: { type: Number },
    passedTestCases: { type: Number },
    totalTestCases: { type: Number },
    failedTestCase: {
      input: { type: String },
      expectedOutput: { type: String },
      actualOutput: { type: String },
    },
    judgedBy: { type: String },
    attempt: { type: Number, default: 0 },
  },
  { timestamps: true }
);

submissionSchema.index({ userId: 1, contestId: 1 });
submissionSchema.index({ problemId: 1, createdAt: -1 });

export const Submission = mongoose.model<ISubmission>('Submission', submissionSchema);
