async function run() {
  const res = await fetch('http://localhost:4000/problems/palindrome-number/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: 'java',
      source: `class Solution {
    public boolean isPalindrome(int x) {
        return x == 121;
    }
}`,
      input: ''
    })
  });
  const data = await res.json();
  console.log("Response:", data);
}
run();
