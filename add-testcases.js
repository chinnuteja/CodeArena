const problemId = ObjectId("6a3a88ae9a305d4f12bcc374");

db.test_cases.insertMany([
  {
    problemId: problemId,
    input: "5\n-1 -2 -3 -4 -5\n-8",
    expectedOutput: "[2, 4]",
    isSample: false,
    points: 10,
    order: 4,
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0
  },
  {
    problemId: problemId,
    input: "6\n0 4 3 0 5 9\n0",
    expectedOutput: "[0, 3]",
    isSample: false,
    points: 10,
    order: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0
  },
  {
    problemId: problemId,
    input: "4\n1000000000 1000000000 5 6\n2000000000",
    expectedOutput: "[0, 1]",
    isSample: false,
    points: 10,
    order: 6,
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0
  },
  {
    problemId: problemId,
    input: "7\n2 7 11 15 2 7 11\n26",
    expectedOutput: "[2, 3]",
    isSample: false,
    points: 10,
    order: 7,
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0
  },
  {
    problemId: problemId,
    input: "3\n5 5 5\n10",
    expectedOutput: "[0, 1]",
    isSample: false,
    points: 10,
    order: 8,
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0
  },
  {
    problemId: problemId,
    input: "8\n10 -10 20 -20 30 -30 40 -40\n10",
    expectedOutput: "[4, 5]",
    isSample: false,
    points: 10,
    order: 9,
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0
  },
  {
    problemId: problemId,
    input: "10\n1 2 3 4 5 6 7 8 9 10\n19",
    expectedOutput: "[8, 9]",
    isSample: false,
    points: 10,
    order: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0
  }
]);

print("Added 7 new hidden test cases!");
