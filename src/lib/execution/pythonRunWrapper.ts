export function wrapPythonSolutionSource(source: string): string {
  if (source.includes('if __name__') || !source.includes('class Solution')) {
    return source;
  }

  return `import sys
import inspect
import typing

${source}

def _format_output(res):
    if isinstance(res, list):
        return '[' + ', '.join(str(x) for x in res) + ']'
    if isinstance(res, bool):
        return str(res).lower()
    if isinstance(res, float):
        return ('%.5f' % res)
    return str(res)

def main():
    sol = Solution()
    methods = [
        name for name in dir(sol)
        if not name.startswith('_') and callable(getattr(sol, name))
    ]
    if not methods:
        return

    method = getattr(sol, methods[0])
    hints = typing.get_type_hints(method)
    sig = inspect.signature(method)
    params = [p for p in sig.parameters.values() if p.name != 'self']

    raw = sys.stdin.read()
    if not raw.strip():
        return

    if len(params) == 1:
        hint = hints.get(params[0].name)
        th = str(hint).lower() if hint else ''
        if 'str' in th:
            res = method(raw.strip())
            print(_format_output(res))
            return

    tokens = raw.split()
    idx = 0
    args = []

    for p in params:
        hint = hints.get(p.name)
        th = str(hint).lower() if hint else ''
        origin = getattr(hint, '__origin__', None)
        is_list = origin is list or 'list' in th

        if is_list and 'int' in th:
            n = int(tokens[idx]); idx += 1
            arr = [int(tokens[idx + i]) for i in range(n)]
            idx += n
            args.append(arr)
        elif is_list:
            n = int(tokens[idx]); idx += 1
            arr = tokens[idx:idx + n]
            idx += n
            args.append(arr)
        elif 'int' in th or hint is int:
            args.append(int(tokens[idx])); idx += 1
        elif 'float' in th or hint is float:
            args.append(float(tokens[idx])); idx += 1
        elif 'bool' in th or hint is bool:
            args.append(tokens[idx].lower() == 'true'); idx += 1
        elif 'str' in th or hint is str:
            args.append(tokens[idx]); idx += 1
        else:
            try:
                args.append(int(tokens[idx]))
            except ValueError:
                args.append(tokens[idx])
            idx += 1

    res = method(*args)
    print(_format_output(res))

if __name__ == '__main__':
    main()
`;
}
