import mongoose, { Schema, Document, Types } from 'mongoose';
import { env } from '../../config/env.js';

export interface IContestInvite extends Document {
  contestId: Types.ObjectId;
  tokenHash: string;
  createdBy: Types.ObjectId;
  maxUses?: number;
  uses: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const contestInviteSchema = new Schema<IContestInvite>(
  {
    contestId: { type: Schema.Types.ObjectId, ref: 'Contest', required: true, index: true },
    tokenHash: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    maxUses: { type: Number, default: null }, // null = unlimited
    uses: { type: Number, default: 0 },
    expiresAt: {
      type: Date,
      default: () => {
        const d = new Date();
        d.setDate(d.getDate() + env.INVITE_TOKEN_TTL_DAYS);
        return d;
      },
    },
  },
  {
    timestamps: true,
  }
);

export const ContestInvite = mongoose.model<IContestInvite>(
  'ContestInvite',
  contestInviteSchema,
  'contest_invites'
);
