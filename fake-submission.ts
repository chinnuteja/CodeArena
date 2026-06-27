import mongoose from 'mongoose';
import { Submission } from './src/modules/submission/submission.model.js';
import { Problem } from './src/modules/problem/problem.model.js';
import { judgeSubmission } from './src/modules/judge/judge.service.js';
import { env } from './src/config/env.js';

const sourceCode = `
import java.util.HashMap;
import java.util.Map;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                return new int[] { map.get(complement), i };
            }
            map.put(nums[i], i);
        }
        return new int[] {};
    }
}
`;

async function run() {
  await mongoose.connect('mongodb://13.201.42.31:27017/online_judge');
  console.log('Connected to DB');

  const problem = await Problem.findOne({ slug: 'two-sum' });
  if (!problem) throw new Error('Problem not found');

  const submission = new Submission({
    userId: new mongoose.Types.ObjectId(),
    problemId: problem._id,
    language: 'java',
    source: sourceCode, // Wait, judge.service.ts needs sourceRef!
    status: 'PENDING'
  });
  
  // Actually, let's just test the run engine manually using testcases
  const { engine } = await import('./src/lib/execution/index.js');
  const { languages } = await import('./src/lib/execution/languages.js');
  const { wrapJavaSolutionSource } = await import('./src/lib/execution/javaRunWrapper.js');
  const { TestCase } = await import('./src/modules/testcase/testcase.model.js');
  
  const testcases = await TestCase.find({ problemId: problem._id }).sort({ order: 1 });
  
  for (let i = 0; i < testcases.length; i++) {
    const tc = testcases[i];
    console.log(`\n--- Testcase ${i + 1} ---`);
    console.log(`Input: ${JSON.stringify(tc.input)}`);
    console.log(`Expected: ${JSON.stringify(tc.expectedOutput)}`);
    
    // We cannot run the engine easily locally because Docker socket is not available!
    // But wait, the API endpoint worked!
  }
  
  process.exit(0);
}

run().catch(console.error);
