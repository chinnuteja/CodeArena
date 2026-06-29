import { Language } from '../../config/constants.js';
import { wrapCppSolutionSource } from './cppRunWrapper.js';
import { wrapJavaSolutionSource } from './javaRunWrapper.js';
import { wrapPythonSolutionSource } from './pythonRunWrapper.js';

export function prepareSource(language: string, source: string): string {
  switch (language) {
    case Language.Java:
      return wrapJavaSolutionSource(source);
    case Language.Python:
      return wrapPythonSolutionSource(source);
    case Language.Cpp:
      return wrapCppSolutionSource(source);
    default:
      return source;
  }
}
