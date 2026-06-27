const source = `
import java.util.HashMap;
import java.util.Map;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                return new int[] { map.get(complement), i };
            }
            map.put(nums[i], i);
        }
        return new int[] {};
    }
}
`;

async function run() {
    const res = await fetch('http://13.201.42.31/api/problems/two-sum/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            language: 'java',
            source: source,
            input: '2\r\n3 3\r\n6'
        })
    });
    const data = await res.json();
    console.log(data);
}
run();
