import { DockerEngine } from '../src/lib/execution/docker.engine.js';
import { Language } from '../src/config/constants.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

async function main() {
  const engine = new DockerEngine();
  const workdir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-docker-'));
  
  try {
    const sourcePath = path.join(workdir, 'main.py');
    await fs.writeFile(sourcePath, 'import sys\nprint("Hello from Docker!")\nprint("Stderr test", file=sys.stderr)\n');

    console.log('Running python code in Docker...');
    const result = await engine.run({
      language: Language.Python,
      sourcePath: 'main.py',
      workdir,
      stdin: 'Testing 123',
      timeLimitMs: 2000,
      memoryLimitMb: 256,
    });

    console.log('Result:', result);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await fs.rm(workdir, { recursive: true, force: true });
  }
}

main();
