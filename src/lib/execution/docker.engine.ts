import Docker from 'dockerode';
import { ExecutionEngine, RunRequest, RunResult, CompileResult } from './execution.interface.js';
import { Language } from '../../config/constants.js';
import { languages } from './languages.js';
import { env } from '../../config/env.js';
import * as path from 'path';
import * as fs from 'fs/promises';

const socketPath = process.platform === 'win32' 
  ? '//./pipe/dockerDesktopLinuxEngine' 
  : env.DOCKER_SOCKET;

const docker = new Docker({ socketPath });

export class DockerEngine implements ExecutionEngine {
  async compile(language: Language, sourcePath: string, workdir: string): Promise<CompileResult> {
    const spec = languages[language];
    if (!spec.needsCompile || !spec.compileCmd) {
      return { ok: true };
    }

    const container = await docker.createContainer({
      Image: spec.image,
      Cmd: spec.compileCmd,
      HostConfig: {
        Binds: [`${workdir}:/app:rw`],
        Memory: env.SANDBOX_DEFAULT_MEMORY_MB * 1024 * 1024,
        MemorySwap: env.SANDBOX_DEFAULT_MEMORY_MB * 1024 * 1024,
        CpuQuota: env.SANDBOX_CPUS * 100000,
        CpuPeriod: 100000,
        NetworkMode: 'none',
        PidsLimit: env.SANDBOX_PIDS_LIMIT,
      },
      User: '1000',
      Tty: false,
    });

    try {
      await container.start();
      
      const timeoutToken = setTimeout(async () => {
        try { await container.kill(); } catch (e) {}
      }, env.COMPILE_TIME_MS);

      const waitResult = await container.wait();
      clearTimeout(timeoutToken);

      if (waitResult.StatusCode !== 0) {
        const logs = await container.logs({ stdout: true, stderr: true });
        const errorStr = this.demuxLogs(logs).substring(0, env.SANDBOX_OUTPUT_MAX_BYTES);
        return { ok: false, error: errorStr };
      }

      let artifactPath = 'main';
      if (language === Language.Java) artifactPath = 'Main.class';

      return { ok: true, artifactPath };
    } finally {
      try {
        await container.remove({ force: true });
      } catch (e) {}
    }
  }

  async run(req: RunRequest): Promise<RunResult> {
    const spec = languages[req.language];
    let artifact = spec.sourceFilename;
    if (spec.needsCompile) {
      artifact = req.language === Language.Java ? 'Main' : 'main';
    }

    const cmd = spec.runCmd(artifact);
    
    const inputPath = path.join(req.workdir, 'input.txt');
    await fs.writeFile(inputPath, req.stdin, { mode: 0o666 });

    const container = await docker.createContainer({
      Image: spec.image,
      Cmd: ['sh', '-c', `${cmd.join(' ')} < /app/input.txt`],
      HostConfig: {
        Binds: [`${req.workdir}:/app:ro`],
        Tmpfs: { '/tmp': 'rw,noexec,nosuid,size=65536k' },
        Memory: req.memoryLimitMb * 1024 * 1024,
        MemorySwap: req.memoryLimitMb * 1024 * 1024,
        CpuQuota: env.SANDBOX_CPUS * 100000,
        CpuPeriod: 100000,
        NetworkMode: 'none',
        PidsLimit: env.SANDBOX_PIDS_LIMIT,
        ReadonlyRootfs: true,
        SecurityOpt: ['no-new-privileges'],
      },
      User: '1000',
      OpenStdin: false,
      StdinOnce: false,
      Tty: false,
    });

    let timedOut = false;
    let oomKilled = false;
    let durationMs = 0;
    
    try {
      const stream = await container.attach({ stream: true, stdout: true, stderr: true });
      const startTime = Date.now();
      await container.start();

      const killTimer = setTimeout(async () => {
        timedOut = true;
        try { await container.kill(); } catch (e) {}
      }, req.timeLimitMs + 500);

      const waitResult = await container.wait();
      clearTimeout(killTimer);
      durationMs = Date.now() - startTime;

      const inspect = await container.inspect();
      if (inspect.State.OOMKilled) oomKilled = true;

      const logs = await container.logs({ stdout: true, stderr: true });
      const cleanOutput = this.demuxLogs(logs).substring(0, env.SANDBOX_OUTPUT_MAX_BYTES);

      return {
        stdout: cleanOutput,
        exitCode: waitResult.StatusCode,
        timedOut: timedOut || (durationMs > req.timeLimitMs && waitResult.StatusCode === 137),
        oomKilled,
        durationMs,
        memKb: 0,
      };

    } finally {
      try {
        await container.remove({ force: true });
      } catch (e) {}
    }
  }

  private demuxLogs(logs: Buffer): string {
    let cleanOutput = '';
    let offset = 0;
    while (offset < logs.length) {
      if (offset + 8 > logs.length) break;
      const size = logs.readUInt32BE(offset + 4);
      offset += 8;
      if (offset + size > logs.length) break;
      cleanOutput += logs.toString('utf8', offset, offset + size);
      offset += size;
      if (cleanOutput.length > env.SANDBOX_OUTPUT_MAX_BYTES) {
          break;
      }
    }
    return cleanOutput;
  }
}
