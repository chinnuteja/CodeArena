import { DockerEngine } from '../src/lib/execution/docker.engine.js';
import { Language } from '../src/config/constants.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

async function testAdversarialCode(name: string, code: string) {
  console.log(`\n--- Running Adversarial Test: ${name} ---`);
  const engine = new DockerEngine();
  const workdir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-adv-'));
  
  try {
    const sourcePath = path.join(workdir, 'main.py');
    await fs.writeFile(sourcePath, code);

    const result = await engine.run({
      language: Language.Python,
      sourcePath: 'main.py',
      workdir,
      stdin: '',
      timeLimitMs: 2000,
      memoryLimitMb: 256,
    });

    console.log(`Result for ${name}:`);
    console.log(`Exit Code: ${result.exitCode}`);
    console.log(`Timed Out: ${result.timedOut}`);
    console.log(`OOM Killed: ${result.oomKilled}`);
    console.log(`Stdout/Stderr:\n${result.stdout}`);
  } catch (err) {
    console.error(`Error for ${name}:`, err);
  } finally {
    await fs.rm(workdir, { recursive: true, force: true });
  }
}

async function main() {
  const tests = [
    {
      name: 'Network Access',
      code: 'import urllib.request\ntry:\n    urllib.request.urlopen("http://google.com", timeout=1)\n    print("Network success!")\nexcept Exception as e:\n    print(f"Network failed: {e}")'
    },
    {
      name: 'File System Write (Read-Only Root)',
      code: 'try:\n    with open("/app/hacked.txt", "w") as f:\n        f.write("hacked")\n    print("Write success!")\nexcept Exception as e:\n    print(f"Write failed: {e}")'
    },
    {
      name: 'Fork Bomb (PID Limit)',
      code: 'import os\nimport time\nprint("Starting fork bomb")\ntry:\n    while True:\n        os.fork()\nexcept Exception as e:\n    print(f"Fork bomb stopped: {e}")\ntime.sleep(2)'
    }
  ];

  for (const t of tests) {
    await testAdversarialCode(t.name, t.code);
  }
}

main();
