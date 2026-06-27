const DEFAULT_TEMPLATES: Record<string, string> = {
  cpp: `#include <iostream>
using namespace std;

int main() {
    
    return 0;
}`,
  java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        
    }
}`,
  python: `import sys

def solve():
    pass

if __name__ == "__main__":
    solve()`,
  javascript: `const fs = require('fs');
const input = fs.readFileSync(0, 'utf8').trim();

`,
};

const PROBLEM_TEMPLATES: Record<string, Record<string, string>> = {
  'palindrome-number': {
    java: `class Solution {
    public boolean isPalindrome(int x) {
        
    }
}`,
    python: `class Solution:
    def isPalindrome(self, x: int) -> bool:
        pass`,
    cpp: `class Solution {
public:
    bool isPalindrome(int x) {
        
    }
};`,
    javascript: `var isPalindrome = function(x) {
    
};`,
  },
  'two-sum': {
    java: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        
    }
}`,
    python: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        pass`,
    cpp: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        
    }
};`,
    javascript: `var twoSum = function(nums, target) {
    
};`,
  },
  'valid-parentheses': {
    java: `class Solution {
    public boolean isValid(String s) {
        
    }
}`,
    python: `s = input().strip()
print("true")`,
    cpp: `#include <iostream>
#include <string>
using namespace std;

int main() {
    string s;
    getline(cin, s);
    cout << "true" << endl;
    return 0;
}`,
    javascript: `const fs = require('fs');
const s = fs.readFileSync(0, 'utf8').trim();
console.log('true');`,
  },
  'longest-substring': {
    java: `class Solution {
    public int lengthOfLongestSubstring(String s) {
        
    }
}`,
    python: `s = input().strip()
print(0)`,
    cpp: `#include <iostream>
#include <string>
using namespace std;

int main() {
    string s;
    getline(cin, s);
    cout << 0 << endl;
    return 0;
}`,
    javascript: `const fs = require('fs');
const s = fs.readFileSync(0, 'utf8').trim();
console.log(0);`,
  },
};

export function getCodeTemplate(language: string, slug?: string): string {
  if (slug && PROBLEM_TEMPLATES[slug]?.[language]) {
    return PROBLEM_TEMPLATES[slug][language];
  }
  return DEFAULT_TEMPLATES[language] ?? DEFAULT_TEMPLATES.javascript;
}

export function codeStorageKey(slug: string, language: string): string {
  return `oj:code:${slug}:${language}`;
}
