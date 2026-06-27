const mongoose = require('mongoose');
require('dotenv').config();

async function seed() {
  await mongoose.connect('mongodb://localhost:27017/online-judge');
  
  const { Problem } = require('./dist/modules/problem/problem.model.js');
  
  await Problem.deleteMany({});
  
  await Problem.create({
    title: 'Two Sum',
    slug: 'two-sum',
    difficulty: 'Easy',
    description: `
<h1>Two Sum</h1>
<p>Given an array of integers <code>nums</code> and an integer <code>target</code>, return <em>indices of the two numbers such that they add up to <code>target</code></em>.</p>

<h3>Example 1:</h3>
<pre>
<strong>Input:</strong> nums = [2,7,11,15], target = 9
<strong>Output:</strong> [0,1]
</pre>
    `,
    timeLimit: 2,
    memoryLimit: 256,
    testCases: [
      { input: '4\n2 7 11 15\n9', output: '0 1', isHidden: false },
      { input: '3\n3 2 4\n6', output: '1 2', isHidden: false },
      { input: '2\n3 3\n6', output: '0 1', isHidden: true }
    ],
    author: new mongoose.Types.ObjectId()
  });

  console.log('Seeded Two Sum problem successfully!');
  process.exit(0);
}

seed();
