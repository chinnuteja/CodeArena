import mongoose, { Schema, Document, Types } from 'mongoose';
import { ContestKind, ScoringMode } from '../../config/constants.js';

export interface IContest extends Document {
  title: string;
  slug: string;
  description?: string;
  kind: ContestKind;
  scoringMode: ScoringMode;
  startAt: Date;
  endAt: Date;
  problemIds: Types.ObjectId[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const contestSchema = new Schema<IContest>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String },
    kind: { type: String, enum: Object.values(ContestKind), required: true },
    scoringMode: { type: String, enum: Object.values(ScoringMode), required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    problemIds: [{ type: Schema.Types.ObjectId, ref: 'Problem' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
  }
);

// Index for efficiently querying live/upcoming contests
contestSchema.index({ startAt: 1, endAt: 1 });

export const Contest = mongoose.model<IContest>('Contest', contestSchema, 'contests');
