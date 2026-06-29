import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGO_URI: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(10),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().default(7),
  // Cookie path must match how the browser reaches /auth/refresh (e.g. /api/auth/refresh behind Vite/nginx)
  REFRESH_COOKIE_PATH: z.string().default('/api/auth/refresh'),
  ARGON2_MEMORY_COST: z.coerce.number().default(19456),
  LOG_LEVEL: z.string().default('info'),
  // Queue
  REDIS_QUEUE_URL: z.string().url().optional(),
  JUDGE_CONCURRENCY: z.coerce.number().default(4),
  SUBMISSION_MAX_SOURCE_BYTES: z.coerce.number().default(65536),

  // Docker sandbox
  DOCKER_SOCKET: z.string().default('/var/run/docker.sock'),
  SANDBOX_DEFAULT_TIME_MS: z.coerce.number().default(2000),
  SANDBOX_DEFAULT_MEMORY_MB: z.coerce.number().default(256),
  SANDBOX_PIDS_LIMIT: z.coerce.number().default(64),
  SANDBOX_OUTPUT_MAX_BYTES: z.coerce.number().default(65536),
  SANDBOX_CPUS: z.coerce.number().default(1),
  COMPILE_TIME_MS: z.coerce.number().default(10000),

  // SSE
  SSE_HEARTBEAT_MS: z.coerce.number().default(15000),

  // Contests
  ICPC_PENALTY_MINUTES: z.coerce.number().default(20),
  INVITE_TOKEN_TTL_DAYS: z.coerce.number().default(14),
  CONTEST_MAX_PROBLEMS: z.coerce.number().default(26),

  // Persistent storage (submission source files)
  STORAGE_PATH: z.string().default('.tmp/storage'),

  // Host-visible temp dir for judge sandboxes (must match docker bind mounts when worker uses docker.sock)
  JUDGE_WORKDIR: z.string().default('.tmp/workdir'),

  // Behind reverse proxy (nginx / ALB)
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // Comma-separated allowed origins; omit for same-origin (nginx proxy — preferred in production)
  CORS_ORIGIN: z.string().optional(),

  // Azure OpenAI (AI assistant in workspace)
  AZURE_OPENAI_ENDPOINT: z.string().url().optional(),
  AZURE_OPENAI_API_KEY: z.string().min(1).optional(),
  AZURE_OPENAI_DEPLOYMENT: z.string().default('gpt-5.4-nano'),
  AZURE_OPENAI_API_VERSION: z.string().default('2024-12-01-preview'),
  AI_MAX_COMPLETION_TOKENS: z.coerce.number().default(4096),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
