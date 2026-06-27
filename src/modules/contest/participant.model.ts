import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IContestParticipant extends Document {
  contestId: Types.ObjectId;
  userId: Types.ObjectId;
  registeredAt: Date;
}

const contestParticipantSchema = new Schema<IContestParticipant>({
  contestId: { type: Schema.Types.ObjectId, ref: 'Contest', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  registeredAt: { type: Date, default: Date.now },
});

// Compound unique index prevents double-registration at DB level
contestParticipantSchema.index({ contestId: 1, userId: 1 }, { unique: true });

export const ContestParticipant = mongoose.model<IContestParticipant>(
  'ContestParticipant',
  contestParticipantSchema,
  'contest_participants'
);
