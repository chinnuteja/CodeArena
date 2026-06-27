// Seed script for remaining testcases

// Remove unsupported languages from all problems
db.problems.updateMany({}, {
  $pull: { allowedLanguages: { $in: ["javascript", "go", "js"] } }
});

const getProb = (slug) => db.problems.findOne({ slug: slug });

const p_palindrome = getProb("palindrome-number");
if (p_palindrome) {
  db.test_cases.insertMany([
    { problemId: p_palindrome._id, input: "121", expectedOutput: "true", order: 1 },
    { problemId: p_palindrome._id, input: "-121", expectedOutput: "false", order: 2 },
    { problemId: p_palindrome._id, input: "10", expectedOutput: "false", order: 3 },
    { problemId: p_palindrome._id, input: "12321", expectedOutput: "true", order: 4 },
    { problemId: p_palindrome._id, input: "11", expectedOutput: "true", order: 5 },
    { problemId: p_palindrome._id, input: "0", expectedOutput: "true", order: 6 },
    { problemId: p_palindrome._id, input: "1000000001", expectedOutput: "true", order: 7 }
  ]);
}

const p_valid = getProb("valid-parentheses");
if (p_valid) {
  db.test_cases.insertMany([
    { problemId: p_valid._id, input: "()", expectedOutput: "true", order: 1 },
    { problemId: p_valid._id, input: "()[]{}", expectedOutput: "true", order: 2 },
    { problemId: p_valid._id, input: "(]", expectedOutput: "false", order: 3 },
    { problemId: p_valid._id, input: "([)]", expectedOutput: "false", order: 4 },
    { problemId: p_valid._id, input: "{[]}", expectedOutput: "true", order: 5 },
    { problemId: p_valid._id, input: "(((((((())))))))", expectedOutput: "true", order: 6 },
    { problemId: p_valid._id, input: "]", expectedOutput: "false", order: 7 }
  ]);
}

const p_longest = getProb("longest-substring");
if (p_longest) {
  db.test_cases.insertMany([
    { problemId: p_longest._id, input: "abcabcbb", expectedOutput: "3", order: 1 },
    { problemId: p_longest._id, input: "bbbbb", expectedOutput: "1", order: 2 },
    { problemId: p_longest._id, input: "pwwkew", expectedOutput: "3", order: 3 },
    { problemId: p_longest._id, input: "", expectedOutput: "0", order: 4 },
    { problemId: p_longest._id, input: "abcdefg", expectedOutput: "7", order: 5 },
    { problemId: p_longest._id, input: "aab", expectedOutput: "2", order: 6 },
    { problemId: p_longest._id, input: "dvdf", expectedOutput: "3", order: 7 }
  ]);
}

const p_median = getProb("median-of-arrays");
if (p_median) {
  db.test_cases.insertMany([
    { problemId: p_median._id, input: "2\n1 3\n1\n2", expectedOutput: "2.00000", order: 1 },
    { problemId: p_median._id, input: "2\n1 2\n2\n3 4", expectedOutput: "2.50000", order: 2 },
    { problemId: p_median._id, input: "2\n0 0\n2\n0 0", expectedOutput: "0.00000", order: 3 },
    { problemId: p_median._id, input: "0\n\n1\n1", expectedOutput: "1.00000", order: 4 },
    { problemId: p_median._id, input: "1\n2\n0\n", expectedOutput: "2.00000", order: 5 },
    { problemId: p_median._id, input: "3\n1 2 3\n2\n4 5", expectedOutput: "3.00000", order: 6 },
    { problemId: p_median._id, input: "4\n1 2 3 4\n4\n5 6 7 8", expectedOutput: "4.50000", order: 7 }
  ]);
}

print("Finished seeding all testcases!");
