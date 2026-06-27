export function wrapPythonSolutionSource(source: string): string {
  if (source.includes('def main():') || !source.includes('class Solution')) {
    return source;
  }

  return `import sys
import json
import typing
import inspect
import ast

${source}

def main():
    if 'Solution' not in globals():
        return
    sol = Solution()
    methods = [m for m in dir(sol) if not m.startswith('_') and callable(getattr(sol, m))]
    if not methods:
        return
    
    method_name = methods[0]
    method = getattr(sol, method_name)
    
    hints = typing.get_type_hints(method)
    sig = inspect.signature(method)
    params = [p for p in sig.parameters.values() if p.name != 'self']
    
    input_data = sys.stdin.read().split()
    if not input_data:
        return
        
    idx = 0
    args = []
    
    for p in params:
        th_str = str(hints.get(p.name, str))
        if 'int' in th_str and 'List' in th_str:
            if idx < len(input_data):
                n = int(input_data[idx])
                idx += 1
                arr = []
                for _ in range(n):
                    if idx < len(input_data):
                        arr.append(int(input_data[idx]))
                        idx += 1
                args.append(arr)
        elif 'int' in th_str:
            if idx < len(input_data):
                args.append(int(input_data[idx]))
                idx += 1
        elif 'bool' in th_str:
            if idx < len(input_data):
                args.append(input_data[idx].lower() == 'true')
                idx += 1
        else:
            if idx < len(input_data):
                args.append(input_data[idx])
                idx += 1
                
    try:
        res = method(*args)
        if isinstance(res, list):
            print(json.dumps(res).replace(",", ", ")) # ensures [0, 1] format
        elif isinstance(res, bool):
            print(str(res).lower())
        else:
            print(str(res))
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
`;
}
