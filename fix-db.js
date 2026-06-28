db.test_cases.find({}).forEach(function(tc) {
  if (!tc.expectedOutput.startsWith("[")) {
    var parts = tc.expectedOutput.trim().split(/\s+/);
    if (parts.length > 1) {
      tc.expectedOutput = "[" + parts.join(", ") + "]";
      db.test_cases.updateOne({ _id: tc._id }, { $set: { expectedOutput: tc.expectedOutput } });
      print("Updated test case " + tc._id + " to " + tc.expectedOutput);
    }
  }
});
print("Done fixing database!");
