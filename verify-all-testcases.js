// Comprehensive verification of ALL test cases across ALL problems
// For each problem, we compute the correct answer and compare against expectedOutput

db.problems.find({}).forEach(function(prob) {
  var slug = prob.slug;
  print("==== Verifying problem: " + slug + " ====");
  
  db.test_cases.find({ problemId: prob._id }).sort({ order: 1 }).forEach(function(tc) {
    var input = tc.input;
    var expected = tc.expectedOutput;
    var correct = null;
    
    if (slug === 'two-sum') {
      var lines = input.trim().split('\n');
      var n = parseInt(lines[0].trim(), 10);
      var arr = lines[1].trim().split(/\s+/).map(function(x) { return parseInt(x, 10); });
      var target = parseInt(lines[2].trim(), 10);
      
      var found = false;
      for (var i = 0; i < arr.length && !found; i++) {
        for (var j = i + 1; j < arr.length && !found; j++) {
          if (arr[i] + arr[j] === target) {
            correct = "[" + i + ", " + j + "]";
            found = true;
          }
        }
      }
      if (!found) correct = "[]";
    }
    
    else if (slug === 'palindrome-number') {
      var val = input.trim();
      var num = parseInt(val, 10);
      if (num < 0) {
        correct = "false";
      } else {
        var s = num.toString();
        correct = (s === s.split('').reverse().join('')) ? "true" : "false";
      }
    }
    
    else if (slug === 'valid-parentheses') {
      var s = input.trim();
      var stack = [];
      var valid = true;
      var map = { ')': '(', ']': '[', '}': '{' };
      for (var i = 0; i < s.length; i++) {
        var c = s[i];
        if (c === '(' || c === '[' || c === '{') {
          stack.push(c);
        } else if (c === ')' || c === ']' || c === '}') {
          if (stack.length === 0 || stack[stack.length - 1] !== map[c]) {
            valid = false;
            break;
          }
          stack.pop();
        }
      }
      if (stack.length !== 0) valid = false;
      correct = valid ? "true" : "false";
    }
    
    else if (slug === 'longest-substring') {
      var s = input.trim();
      var maxLen = 0;
      var start = 0;
      var charMap = {};
      for (var i = 0; i < s.length; i++) {
        var c = s[i];
        if (charMap[c] !== undefined && charMap[c] >= start) {
          start = charMap[c] + 1;
        }
        charMap[c] = i;
        var len = i - start + 1;
        if (len > maxLen) maxLen = len;
      }
      correct = maxLen.toString();
    }
    
    else if (slug === 'median-of-arrays') {
      var lines = input.trim().split('\n');
      var idx = 0;
      var n1 = parseInt(lines[idx++].trim(), 10);
      var arr1 = [];
      if (n1 > 0 && lines[idx]) {
        arr1 = lines[idx].trim().split(/\s+/).map(function(x) { return parseInt(x, 10); });
      }
      idx++;
      var n2 = parseInt(lines[idx++].trim(), 10);
      var arr2 = [];
      if (n2 > 0 && lines[idx]) {
        arr2 = lines[idx].trim().split(/\s+/).map(function(x) { return parseInt(x, 10); });
      }
      
      var merged = arr1.concat(arr2).sort(function(a, b) { return a - b; });
      var total = merged.length;
      var median;
      if (total % 2 === 0) {
        median = (merged[total / 2 - 1] + merged[total / 2]) / 2.0;
      } else {
        median = merged[Math.floor(total / 2)];
      }
      correct = median.toFixed(5);
    }
    
    if (correct !== null && correct !== expected) {
      print("  FIXING TC " + tc._id + " order=" + tc.order + ": DB has '" + expected + "' but correct is '" + correct + "'");
      db.test_cases.updateOne({ _id: tc._id }, { $set: { expectedOutput: correct } });
    } else if (correct !== null) {
      print("  OK TC " + tc._id + " order=" + tc.order + ": '" + expected + "'");
    } else {
      print("  SKIP TC " + tc._id + " order=" + tc.order + ": could not compute (input='" + input.substring(0, 30) + "...')");
    }
  });
});

print("\n==== ALL DONE ====");
