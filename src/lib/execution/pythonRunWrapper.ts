export function wrapPythonSolutionSource(source: string): string {
  if (source.includes('def main():') || !source.includes('class Solution')) {
    return source;
  }

  return `import sys
import json
import typing
import inspect

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
        hint = hints.get(p.name)
        th_str = str(hint).lower() if hint else ''
        
        origin = getattr(hint, '__origin__', None)
        is_list = (origin is list) or ('list' in th_str)
        is_int_list = is_list and ('int' in th_str)
        is_str_list = is_list and ('str' in th_str)
        
        if is_int_list:
            if idx < len(input_data):
                n = int(input_data[idx])
                idx += 1
                arr = []
                for _ in range(n):
                    if idx < len(input_data):
                        arr.append(int(input_data[idx]))
                        idx += 1
                args.append(arr)
        elif is_str_list:
            if idx < len(input_data):
                n = int(input_data[idx])
                idx += 1
                arr = []
                for _ in range(n):
                    if idx < len(input_data):
                        arr.append(input_data[idx])
                        idx += 1
                args.append(arr)
        elif is_list:
            if idx < len(input_data):
                n = int(input_data[idx])
                idx += 1
                arr = []
                for _ in range(n):
                    if idx < len(input_data):
                        arr.append(int(input_data[idx]))
                        idx += 1
                args.append(arr)
        elif 'int' in th_str or hint is int:
            if idx < len(input_data):
                args.append(int(input_data[idx]))
                idx += 1
        elif 'float' in th_str or hint is float:
            if idx < len(input_data):
                args.append(float(input_data[idx]))
                idx += 1
        elif 'bool' in th_str or hint is bool:
            if idx < len(input_data):
                args.append(input_data[idx].lower() == 'true')
                idx += 1
        elif 'str' in th_str or hint is str:
            if idx < len(input_data):
                args.append(input_data[idx])
                idx += 1
        else:
            if idx < len(input_data):
                try:
                    args.append(int(input_data[idx]))
                except ValueError:
                    args.append(input_data[idx])
                idx += 1
                
    try:
        res = method(*args)
        if isinstance(res, list):
            print(json.dumps(res).replace(",", ", "))
        elif isinstance(res, bool):
            print(str(res).lower())
        elif isinstance(res, float):
            print(f"{res:.5f}")
        else:
            print(str(res))
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
`;
}
