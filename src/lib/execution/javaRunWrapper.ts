/**
 * Wraps LeetCode-style `class Solution` Java sources with a `Main` entrypoint
 * that reads from stdin and invokes the solution via reflection.
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
            Method target = findRunnableMethod(clazz.getDeclaredMethods());
            if (target == null) {
                System.out.println("No runnable method found.");
                return;
            }

            Object[] invokeArgs = buildArgs(sc, target.getParameterTypes());
            Object result = target.invoke(obj, invokeArgs);
            printResult(result, target.getReturnType());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private static Method findRunnableMethod(Method[] methods) {
        Method best = null;
        for (Method m : methods) {
            if (m.getDeclaringClass() == Object.class) continue;
            int mods = m.getModifiers();
            if (Modifier.isStatic(mods) || !Modifier.isPublic(mods)) continue;
            String name = m.getName();
            if (name.equals("main") || name.equals("equals") || name.equals("hashCode") || name.equals("toString")) continue;
            if (best == null || m.getParameterCount() > best.getParameterCount()) {
                best = m;
            }
        }
        return best;
    }

    private static Object[] buildArgs(Scanner sc, Class<?>[] types) {
        if (types.length == 1 && types[0] == String.class) {
            return new Object[] { readAllInput(sc) };
        }

        Object[] args = new Object[types.length];
        for (int i = 0; i < types.length; i++) {
            args[i] = readArg(sc, types[i]);
        }
        return args;
    }

    private static Object readArg(Scanner sc, Class<?> type) {
        if (type == int[].class) {
            return readIntArray(sc);
        }
        if (type == long.class || type == Long.class) {
            return sc.hasNextLong() ? sc.nextLong() : 0L;
        }
        if (type == int.class || type == Integer.class) {
            return sc.hasNextInt() ? sc.nextInt() : 0;
        }
        if (type == double.class || type == Double.class) {
            return sc.hasNextDouble() ? sc.nextDouble() : 0.0;
        }
        if (type == boolean.class || type == Boolean.class) {
            return readBoolean(sc);
        }
        if (type == String.class) {
            return sc.hasNext() ? sc.next() : "";
        }
        if (type == char.class || type == Character.class) {
            String token = sc.hasNext() ? sc.next() : "";
            return token.isEmpty() ? '\\0' : token.charAt(0);
        }
        return sc.hasNext() ? sc.next() : "";
    }

    private static boolean readBoolean(Scanner sc) {
        if (!sc.hasNext()) return false;
        String token = sc.next().toLowerCase();
        if (token.equals("true") || token.equals("1")) return true;
        if (token.equals("false") || token.equals("0")) return false;
        return Boolean.parseBoolean(token);
    }

    private static String readAllInput(Scanner sc) {
        if (!sc.hasNextLine()) return "";
        StringBuilder sb = new StringBuilder(sc.nextLine());
        while (sc.hasNextLine()) {
            sb.append("\\n").append(sc.nextLine());
        }
        return sb.toString().trim();
    }

    private static int[] readIntArray(Scanner sc) {
        if (!sc.hasNext()) return new int[0];

        String first = sc.next();
        if (first.contains(",") || first.contains("[")) {
            String cleaned = first.replaceAll("\\\\[|\\\\]", "");
            String[] parts = cleaned.split(",");
            int[] arr = new int[parts.length];
            for (int i = 0; i < parts.length; i++) {
                String p = parts[i].trim();
                if (!p.isEmpty()) arr[i] = Integer.parseInt(p);
            }
            return arr;
        }

        int n = Integer.parseInt(first);
        int[] arr = new int[n];
        for (int i = 0; i < n; i++) {
            while (!sc.hasNextInt() && sc.hasNext()) sc.next();
            if (sc.hasNextInt()) {
                arr[i] = sc.nextInt();
            }
        }
        return arr;
    }

    private static void printResult(Object result, Class<?> returnType) {
        if (result == null) return;
        if (result instanceof int[]) {
            int[] arr = (int[]) result;
            System.out.print("[");
            for (int i = 0; i < arr.length; i++) {
                System.out.print(arr[i] + (i == arr.length - 1 ? "" : ", "));
            }
            System.out.println("]");
        } else if (result instanceof long[]) {
            long[] arr = (long[]) result;
            System.out.print("[");
            for (int i = 0; i < arr.length; i++) {
                System.out.print(arr[i] + (i == arr.length - 1 ? "" : ", "));
            }
            System.out.println("]");
        } else if (result instanceof Boolean) {
            System.out.println(((Boolean) result) ? "true" : "false");
        } else if (result instanceof Double || result instanceof Float) {
            System.out.printf("%.5f%n", ((Number) result).doubleValue());
        } else {
            System.out.println(result);
        }
    }
}
`;
