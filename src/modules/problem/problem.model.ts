import mongoose, { Schema, Document } from 'mongoose';
import { Difficulty, Language } from '../../config/constants.js';

export interface IProblem extends Document {
  slug: string;
  title: string;
  statement: string;
  difficulty: Difficulty;
  timeLimitMs: number;
  memoryLimitMb: number;
  allowedLanguages: Language[];
  isPractice: boolean;
  tags: string[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const problemSchema = new Schema<IProblem>(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    statement: { type: String, required: true },
    difficulty: { type: String, enum: Object.values(Difficulty), required: true },
    timeLimitMs: { type: Number, default: 2000 },
    memoryLimitMb: { type: Number, default: 256 },
    allowedLanguages: { type: [String], enum: Object.values(Language), default: [] },
    isPractice: { type: Boolean, default: true },
    tags: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    collection: 'problems',
  }
);

problemSchema.index({ slug: 1 }, { unique: true });
problemSchema.index({ tags: 1 });
problemSchema.index({ difficulty: 1 });

export const Problem = mongoose.model<IProblem>('Problem', problemSchema);
