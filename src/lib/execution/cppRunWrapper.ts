export function wrapCppSolutionSource(source: string): string {
  if (source.includes('int main(') || !source.includes('class Solution')) {
    return source;
  }

  // Regex to extract the public method
  // Matches: returnType methodName(param1Type param1Name, param2Type param2Name)
  const methodMatch = source.match(/class\s+Solution\s*\{[\s\S]*?public:\s*([a-zA-Z0-9_<>:\s]+)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/);
  if (!methodMatch) return source;

  const returnType = methodMatch[1].trim();
  const methodName = methodMatch[2].trim();
  const paramsStr = methodMatch[3].trim();

  const params = paramsStr.split(',').map(p => {
    const parts = p.trim().split(/\s+/);
    const name = parts.pop()?.replace(/[&]/g, '') || '';
    const type = parts.join(' ').replace(/[&]/g, '');
    return { name, type };
  }).filter(p => p.name);

  let paramReads = '';
  let paramNames = [];

  for (let i = 0; i < params.length; i++) {
    const p = params[i];
    paramNames.push(p.name);
    
    if (p.type.includes('vector<int>')) {
      paramReads += `
    int n_${i};
    if (!(cin >> n_${i})) return 0;
    vector<int> ${p.name}(n_${i});
    for(int j=0; j<n_${i}; j++) {
        cin >> ${p.name}[j];
    }
`;
    } else if (p.type.includes('vector<string>')) {
      paramReads += `
    int n_${i};
    if (!(cin >> n_${i})) return 0;
    vector<string> ${p.name}(n_${i});
    for(int j=0; j<n_${i}; j++) {
        cin >> ${p.name}[j];
    }
`;
    } else if (p.type.includes('string')) {
      paramReads += `
    string ${p.name};
    if (!(cin >> ${p.name})) return 0;
`;
    } else if (p.type.includes('bool')) {
      paramReads += `
    string _b_${i};
    if (!(cin >> _b_${i})) return 0;
    bool ${p.name} = (_b_${i} == "true" || _b_${i} == "1");
`;
    } else if (p.type.includes('double') || p.type.includes('float')) {
      paramReads += `
    ${p.type} ${p.name};
    if (!(cin >> ${p.name})) return 0;
`;
    } else {
      // Default to int or whatever
      paramReads += `
    ${p.type} ${p.name};
    if (!(cin >> ${p.name})) return 0;
`;
    }
  }

  let printRes = '';
  if (returnType.includes('vector<int>')) {
    printRes = `
    cout << "[";
    for(size_t i=0; i<res.size(); i++) {
        cout << res[i] << (i == res.size()-1 ? "" : ", ");
    }
    cout << "]" << endl;
`;
  } else if (returnType.includes('vector<string>')) {
    printRes = `
    cout << "[";
    for(size_t i=0; i<res.size(); i++) {
        cout << "\\"" << res[i] << "\\"" << (i == res.size()-1 ? "" : ", ");
    }
    cout << "]" << endl;
`;
  } else if (returnType.includes('bool')) {
    printRes = `
    cout << (res ? "true" : "false") << endl;
`;
  } else if (returnType.includes('double') || returnType.includes('float')) {
    printRes = `
    cout << fixed << setprecision(5) << res << endl;
`;
  } else {
    printRes = `
    cout << res << endl;
`;
  }

  return `
#include <iostream>
#include <vector>
#include <string>
#include <iomanip>
using namespace std;

${source}

int main() {
    Solution sol;
    ${paramReads}
    
    auto res = sol.${methodName}(${paramNames.join(', ')});
    ${printRes}
    
    return 0;
}
`;
}
