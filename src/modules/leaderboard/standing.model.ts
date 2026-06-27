import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IContestProblemStanding {
  problemId: Types.ObjectId;
  solved: boolean;
  solvedAtMs?: number;
  wrongCount: number;
  bestPoints: number;
}

export interface IContestStanding extends Document {
  contestId: Types.ObjectId;
  userId: Types.ObjectId;
  problems: IContestProblemStanding[];
  solvedCount: number;
  penaltyMinutes: number;
  totalPoints: number;
  lastImprovementMs?: number;
  appliedSubmissionIds: string[]; // To handle idempotency
  createdAt: Date;
  updatedAt: Date;
}

const contestProblemStandingSchema = new Schema<IContestProblemStanding>(
  {
    problemId: { type: Schema.Types.ObjectId, ref: 'Problem', required: true },
    solved: { type: Boolean, default: false },
    solvedAtMs: { type: Number },
    wrongCount: { type: Number, default: 0 },
    bestPoints: { type: Number, default: 0 },
  },
  { _id: false }
);

const contestStandingSchema = new Schema<IContestStanding>(
  {
    contestId: { type: Schema.Types.ObjectId, ref: 'Contest', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    problems: [contestProblemStandingSchema],
    solvedCount: { type: Number, default: 0 },
    penaltyMinutes: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
    lastImprovementMs: { type: Number },
    appliedSubmissionIds: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

// Compound unique index for per-user contest standings
contestStandingSchema.index({ contestId: 1, userId: 1 }, { unique: true });

export const ContestStanding = mongoose.model<IContestStanding>(
  'ContestStanding',
  contestStandingSchema,
  'contest_standings'
);
