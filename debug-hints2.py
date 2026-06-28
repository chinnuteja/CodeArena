import sys, typing, inspect

# This is how many users write it in Python 3.9+
class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        seen = {}
        for i, num in enumerate(nums):
            complement = target - num
            if complement in seen:
                return [seen[complement], i]
            seen[num] = i
        return []

sol = Solution()
method = getattr(sol, 'twoSum')
hints = typing.get_type_hints(method)
sig = inspect.signature(method)
params = [p for p in sig.parameters.values() if p.name != 'self']

for p in params:
    th_str = str(hints.get(p.name, str))
    print(f"param={p.name}, th_str={th_str!r}, 'List' in th_str = {'List' in th_str}, 'list' in th_str = {'list' in th_str}")
