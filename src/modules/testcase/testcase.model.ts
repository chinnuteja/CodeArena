import mongoose, { Schema, Document } from 'mongoose';

export interface ITestCase extends Document {
  problemId: mongoose.Types.ObjectId;
  input: string;
  expectedOutput: string;
  inputIsRef: boolean;
  outputIsRef: boolean;
  isSample: boolean;
  points: number;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const testCaseSchema = new Schema<ITestCase>(
  {
    problemId: { type: Schema.Types.ObjectId, ref: 'Problem', required: true },
    input: { type: String, required: true },
    expectedOutput: { type: String, required: true },
    inputIsRef: { type: Boolean, default: false },
    outputIsRef: { type: Boolean, default: false },
    isSample: { type: Boolean, default: false },
    points: { type: Number, default: 0 },
    order: { type: Number, required: true },
  },
  {
    timestamps: true,
    collection: 'test_cases',
  }
);

testCaseSchema.index({ problemId: 1 });
testCaseSchema.index({ problemId: 1, order: 1 });

export const TestCase = mongoose.model<ITestCase>('TestCase', testCaseSchema);
