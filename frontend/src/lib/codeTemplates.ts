const DEFAULT_TEMPLATES: Record<string, string> = {
  cpp: `class Solution {
public:
    void solve() {
        
    }
};`,
  java: `class Solution {
    public void solve() {
        
    }
}`,
  python: `class Solution:
    def solve(self) -> None:
        pass`,
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
  },
  'valid-parentheses': {
    java: `class Solution {
    public boolean isValid(String s) {
        
    }
}`,
    python: `class Solution:
    def isValid(self, s: str) -> bool:
        pass`,
    cpp: `class Solution {
public:
    bool isValid(string s) {
        
    }
};`,
  },
  'longest-substring': {
    java: `class Solution {
    public int lengthOfLongestSubstring(String s) {
        
    }
}`,
    python: `class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        pass`,
    cpp: `class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        
    }
};`,
  },
  'median-of-arrays': {
    java: `class Solution {
    public double findMedianSortedArrays(int[] nums1, int[] nums2) {
        
    }
}`,
    python: `class Solution:
    def findMedianSortedArrays(self, nums1: list[int], nums2: list[int]) -> float:
        pass`,
    cpp: `class Solution {
public:
    double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {
        
    }
};`,
  },
};

export function getCodeTemplate(language: string, slug?: string): string {
  if (slug && PROBLEM_TEMPLATES[slug]?.[language]) {
    return PROBLEM_TEMPLATES[slug][language];
  }
  return DEFAULT_TEMPLATES[language] ?? DEFAULT_TEMPLATES.python;
}

export function codeStorageKey(slug: string, language: string): string {
  return `oj:code:${slug}:${language}`;
}
