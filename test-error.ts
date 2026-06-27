import mongoose from 'mongoose';
import 'dotenv/config';
import { listProblems } from './src/modules/problem/problem.service.js';

async function test() {
  await mongoose.connect('mongodb://localhost:27017/online-judge');
  try {
    const res = await listProblems({ page: 1, limit: 20 });
    console.log("Success:", res);
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}

test();
