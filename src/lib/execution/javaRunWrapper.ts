/**
 * Wraps LeetCode-style `class Solution` Java sources with a `Main` entrypoint
 * that reads from input.txt and invokes the solution via reflection.
 * Sources that already define `class Main` are returned unchanged.
 */
export function wrapJavaSolutionSource(source: string): string {
  if (source.includes('class Main')) {
    return source;
  }
  if (!source.includes('class Solution')) {
    return source;
  }

  return `${IMPORTS}\n${source}\n${MAIN_CLASS}`;
}

const IMPORTS = `import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.Arrays;
import java.util.Scanner;`;

const MAIN_CLASS = `
public class Main {
    public static void main(String[] args) {
        try {
            Scanner sc = new Scanner(System.in);
            Class<?> clazz = Class.forName("Solution");
            Object obj = clazz.getDeclaredConstructor().newInstance();
            Method[] methods = clazz.getDeclaredMethods();

            Method target = findRunnableMethod(methods);
            if (target == null) {
                System.out.println("No runnable method found.");
                return;
            }

            Object[] invokeArgs = buildArgs(sc, target.getParameterTypes());
            Object result = target.invoke(obj, invokeArgs);
            printResult(result);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private static Method findRunnableMethod(Method[] methods) {
        for (Method m : methods) {
            if (m.getDeclaringClass() == Object.class) continue;
            int mods = m.getModifiers();
            if (Modifier.isStatic(mods) || !Modifier.isPublic(mods)) continue;
            if (m.getName().equals("main")) continue;
            return m;
        }
        return null;
    }

    private static Object[] buildArgs(Scanner sc, Class<?>[] types) {
        Object[] args = new Object[types.length];
        for (int i = 0; i < types.length; i++) {
            Class<?> type = types[i];
            if (type == String.class) {
                args[i] = readRemainingInput(sc);
            } else if (type == int.class || type == Integer.class) {
                args[i] = sc.hasNextInt() ? sc.nextInt() : 0;
            } else if (type == int[].class) {
                args[i] = readIntArray(sc);
            } else if (type == boolean.class || type == Boolean.class) {
                args[i] = sc.hasNextBoolean() ? sc.nextBoolean() : false;
            } else {
                args[i] = readRemainingInput(sc);
            }
        }
        return args;
    }

    private static String readRemainingInput(Scanner sc) {
        if (!sc.hasNextLine()) return "";
        StringBuilder sb = new StringBuilder(sc.nextLine());
        while (sc.hasNextLine()) {
            sb.append("\\n").append(sc.nextLine());
        }
        return sb.toString().trim();
    }

    private static int[] readIntArray(Scanner sc) {
        if (!sc.hasNext()) return new int[0];
        String token = sc.nextLine().trim();
        if (token.isEmpty() && sc.hasNextLine()) token = sc.nextLine().trim();
        if (token.contains("[") || token.contains(",")) {
            token = token.replaceAll("\\\\[|\\\\]", "");
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
        for (int i = 0; i < n; i++) {
            if (sc.hasNextInt()) {
                arr[i] = sc.nextInt();
            } else if (sc.hasNext()) {
                sc.next(); // Consume non-int token if any
            }
        }
        return arr;
    }

    private static void printResult(Object result) {
        if (result == null) return;
        if (result instanceof int[]) {
            int[] arr = (int[]) result;
            System.out.print("[");
            for (int i = 0; i < arr.length; i++) {
                System.out.print(arr[i] + (i == arr.length - 1 ? "" : ", "));
            }
            System.out.println("]");
        } else if (result instanceof Boolean) {
            System.out.println(result);
        } else {
            System.out.println(result);
        }
    }
}
`;
