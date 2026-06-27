import { Language } from '../../config/constants.js';

export interface LangSpec {
  image: string;
  sourceFilename: string;
  compileCmd?: string[];
  runCmd: (artifact: string) => string[];
  needsCompile: boolean;
}

export const languages: Record<Language, LangSpec> = {
  [Language.Cpp]: {
    image: 'oj-runtime-cpp:latest',
    sourceFilename: 'main.cpp',
    compileCmd: ['g++', '-O2', 'main.cpp', '-o', 'main'],
    runCmd: () => ['./main'],
    needsCompile: true,
  },
  [Language.Python]: {
    image: 'oj-runtime-python:latest',
    sourceFilename: 'main.py',
    runCmd: () => ['python3', 'main.py'],
    needsCompile: false,
  },
  [Language.Java]: {
    image: 'oj-runtime-java:latest',
    sourceFilename: 'Main.java',
    compileCmd: ['javac', 'Main.java'],
    runCmd: () => ['java', 'Main'],
    needsCompile: true,
  }
};
