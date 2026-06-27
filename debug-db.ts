import mongoose from 'mongoose';
import 'dotenv/config';
import { Problem } from './src/modules/problem/problem.model.js';

async function test() {
  await mongoose.connect('mongodb://localhost:27017/online-judge');
  console.log('Total in DB:', await Problem.countDocuments());
  console.log('With isPractice=true:', await Problem.countDocuments({ isPractice: true }));
  console.log('With isPractice=false:', await Problem.countDocuments({ isPractice: false }));
  console.log('With isPractice=undefined/null:', await Problem.countDocuments({ isPractice: { $exists: false } }));
  process.exit(0);
}

test();
