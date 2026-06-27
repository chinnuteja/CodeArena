import Docker from 'dockerode';
const JAVA_IMAGE = 'openjdk:22-slim';
import fs from 'fs';

const docker = new Docker({ socketPath: '//./pipe/dockerDesktopLinuxEngine' });

async function run() {
    const input = '3\n3 2 4\n6';
    const sourceCode = `
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
            token = token.replaceAll("\\[|\\]", "");
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
            String[] parts = sc.nextLine().trim().split("\\\\s+");
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
`;

    // write Main.java to temp dir
    const workdir = 'C:/Users/Profile 1/Compiler/online-judge/tmp-test';
    if (!fs.existsSync(workdir)) fs.mkdirSync(workdir);
    fs.writeFileSync(workdir + '/Main.java', sourceCode);

    // compile
    console.log('Compiling...');
    const compileCmd = ['javac', 'Main.java'];
    const compileContainer = await docker.createContainer({
        Image: JAVA_IMAGE,
        Cmd: compileCmd,
        HostConfig: {
            Binds: [workdir + ':/app:rw']
        },
        User: '1000'
    });
    await compileContainer.start();
    const waitRes = await compileContainer.wait();
    console.log('Compile exit code:', waitRes.StatusCode);
    if (waitRes.StatusCode !== 0) {
        const logs = await compileContainer.logs({ stdout: true, stderr: true });
        console.log('Compile error:', logs.toString('utf8'));
        return;
    }

    // run
    console.log('Running...');
    const runContainer = await docker.createContainer({
        Image: languages.java.image,
        Cmd: ['java', '-cp', '/app', 'Main'],
        HostConfig: {
            Binds: [workdir + ':/app:ro']
        },
        User: '1000',
        OpenStdin: true,
        StdinOnce: true
    });

    const stream = await runContainer.attach({ stream: true, stdin: true, stdout: true, stderr: true });
    stream.write(input);
    stream.end();

    await runContainer.start();
    const runWait = await runContainer.wait();
    console.log('Run exit code:', runWait.StatusCode);

    const logs = await runContainer.logs({ stdout: true, stderr: true });
    
    let cleanOutput = '';
    let offset = 0;
    while (offset < logs.length) {
      if (offset + 8 > logs.length) break;
      const size = logs.readUInt32BE(offset + 4);
      offset += 8;
      if (offset + size > logs.length) break;
      cleanOutput += logs.toString('utf8', offset, offset + size);
      offset += size;
    }
    
    console.log('Output:', JSON.stringify(cleanOutput));
}

run().catch(console.error);
