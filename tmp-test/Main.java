
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int[] nums = readIntArray(sc);
        int target = sc.hasNextInt() ? sc.nextInt() : 0;
        int[] res = twoSum(nums, target);
        printResult(res);
    }

    private static int[] readIntArray(Scanner sc) {
        if (!sc.hasNext()) return new int[0];
        String token = sc.nextLine().trim();
        if (token.isEmpty() && sc.hasNextLine()) token = sc.nextLine().trim();
        if (token.contains("[") || token.contains(",")) {
            token = token.replaceAll("\[|\]", "");
            String[] parts = token.split(",");
            if (token.isEmpty()) parts = new String[0];
            int[] arr = new int[parts.length];
            for (int i = 0; i < parts.length; i++) {
                String p = parts[i].trim();
                if (!p.isEmpty()) arr[i] = Integer.parseInt(p);
            }
            return arr;
        }
        int n = Integer.parseInt(token);
        int[] arr = new int[n];
        if (sc.hasNextLine()) {
            String[] parts = sc.nextLine().trim().split("\\s+");
            for (int i = 0; i < n && i < parts.length; i++) {
                if (!parts[i].trim().isEmpty()) arr[i] = Integer.parseInt(parts[i].trim());
            }
        }
        return arr;
    }

    private static void printResult(Object result) {
        if (result == null) return;
        if (result instanceof int[]) {
            int[] arr = (int[]) result;
            for (int i = 0; i < arr.length; i++) {
                System.out.print(arr[i] + (i == arr.length - 1 ? "" : " "));
            }
            System.out.println();
        } else if (result instanceof Boolean) {
            System.out.println(result);
        } else {
            System.out.println(result);
        }
    }

    public static int[] twoSum(int[] nums, int target) {
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
