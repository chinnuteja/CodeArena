import mongoose, { Schema, Document } from 'mongoose';
import { UserRole } from '../../config/constants.js';

export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  fullName?: string;
  dob?: Date;
  role: UserRole;
  rating: number;
  preferences?: {
    theme?: 'light' | 'dark';
    editorFontSize?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, minlength: 3, maxlength: 30 },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    fullName: { type: String },
    dob: { type: Date },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.Participant },
    rating: { type: Number, default: 0 },
    preferences: {
      theme: { type: String, enum: ['light', 'dark'] },
      editorFontSize: { type: Number },
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });

export const User = mongoose.model<IUser>('User', userSchema);
