import { describe, it, expect } from 'vitest';
import { wrapJavaSolutionSource } from './javaRunWrapper.js';
import { wrapPythonSolutionSource } from './pythonRunWrapper.js';
import { wrapCppSolutionSource } from './cppRunWrapper.js';
import { prepareSource } from './prepareSource.js';
import { Language } from '../../config/constants.js';

describe('run wrappers', () => {
  it('java: leaves Main sources unchanged', () => {
    const src = 'public class Main { public static void main(String[] a) {} }';
    expect(wrapJavaSolutionSource(src)).toBe(src);
  });

  it('java: wraps Solution class', () => {
    const src = 'class Solution { public boolean isPalindrome(int x) { return true; } }';
    const wrapped = wrapJavaSolutionSource(src);
    expect(wrapped).toContain('class Main');
    expect(wrapped).toContain('class Solution');
    expect(wrapped).toContain('findRunnableMethod');
  });

  it('python: wraps Solution class with main', () => {
    const src = 'class Solution:\n    def isPalindrome(self, x: int) -> bool:\n        return True';
    const wrapped = wrapPythonSolutionSource(src);
    expect(wrapped).toContain("if __name__ == '__main__'");
    expect(wrapped).toContain('class Solution');
  });

  it('python: leaves stdin scripts unchanged', () => {
    const src = 'print(input())';
    expect(wrapPythonSolutionSource(src)).toBe(src);
  });

  it('cpp: wraps Solution class with main', () => {
    const src = 'class Solution { public: bool isValid(string s) { return true; } };';
    const wrapped = wrapCppSolutionSource(src);
    expect(wrapped).toContain('int main()');
    expect(wrapped).toContain('getline(cin');
  });

  it('prepareSource routes all supported languages', () => {
    expect(prepareSource(Language.Java, 'class Solution {}')).toContain('class Main');
    expect(prepareSource(Language.Python, 'class Solution: pass')).toContain('def main');
    expect(prepareSource(Language.Cpp, 'class Solution { public: int f() { return 0; } };')).toContain('int main');
  });
});
