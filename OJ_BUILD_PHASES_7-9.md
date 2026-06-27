# AI-Native Online Judge — Build Specification (Phases 7–9)

> **For the AI code editor.** This is the continuation of `OJ_BUILD_PHASES_1-6.md`. Everything in that
> file's **Continuity Contract** is assumed to already exist and must NOT be re-implemented or renamed.
> This document specifies the **evaluation engine**: submission intake + queue (Phase 7), the judge
> worker + Docker sandbox (Phase 8 — security-critical), and live verdict streaming (Phase 9).
>
> Implement exactly what is written. Do not substitute libraries, do not weaken the sandbox controls,
> do not invent scope. Where something belongs to a later phase, leave a `// TODO(phase-N):` note.
>
> **This is the most security-sensitive part of the entire system.** The sandbox runs arbitrary,
> hostile code written by strangers. Treat every control in Phase 8 as mandatory, not optional.

---

## 0. Continuity — What Already Exists (from Phases 1–6)

You MUST reuse these. Do not duplicate them.

- **Shared spine:** `AppError` + error codes, `asyncHandler`, `validate` middleware, response/error
  envelopes, pino `logger`, Mongo lifecycle (`connectMongo/disconnectMongo`), Redis lifecycle + client
  (`db/redis.ts`).
- **Services are HTTP-free** — importable by a non-HTTP worker. (Phase 8's worker relies on this.)
- **Auth:** `requireAuth` populates `req.user = { id, role, jti, sid }`; `requireRole(...)` exists.
- **Redis namespacing** via `REDIS_KEYS`: `auth:*` and `cache:*` are in use. `queue:*` and `sse:*`
  are **reserved and untouched** — Phases 7–9 now claim them.
- **Models exist:** `User`, `Problem`, `TestCase` implemented. `Submission`, `Contest`, etc. exist as
  **stub files** with fixed collection names — Phase 7 implements `Submission` for real.
- **Enums exist:** `SubmissionStatus` (PENDING|JUDGING|DONE|SYSTEM_ERROR), `Verdict`
  (AC|WA|TLE|MLE|RE|CE), `Language` (cpp|java|python|javascript|go).
- **Integrity rule (HLD):** the `submissions.verdict` field is **worker-written only**. No HTTP route
  ever sets a verdict. Public problem endpoints expose **sample test cases only**; the worker reads the
  full set via `testcase.service.getAllForProblem(problemId)`.
- **Object storage:** `ObjectStorage` interface + in-memory impl exist (real S3 impl is Phase deferred).
  Source-code blobs and large test files go through this interface, never raw disk.

---

## 1. New Project-Wide Additions (apply across Phases 7–9)

### 1.1 New dependencies (fixed — from the HLD)

| Purpose | Library | Notes |
|---|---|---|
| Job queue | **bullmq** | on top of the existing Redis (claims `queue:*`) |
| Docker control | **dockerode** | worker → host Docker daemon (see §Phase 8 for AWS deployment) |
| Pub/sub for SSE | **ioredis** (already present) | a dedicated subscriber connection (claims `sse:*`) |

> Do NOT introduce Kafka, RabbitMQ, Socket.IO, or any other broker/realtime lib. BullMQ + Redis
> pub/sub + SSE is the approved design.

### 1.2 Redis connection rule (important for BullMQ + AWS)

- BullMQ requires a Redis connection with `maxRetriesPerRequest: null`. Create a **separate ioredis
  connection** for BullMQ (do not reuse the app's default client, whose settings differ).
- Centralize in `db/redis.ts`:
  - `redis` — existing app client (auth, cache).
  - `queueConnection` — for BullMQ (new).
  - `pubClient` / `subClient` — for SSE pub/sub (new; a subscriber connection cannot run normal commands,
    so it must be separate).
- The HLD requires cache-Redis and queue-Redis to be **separable**. Keep these as distinct connection
  objects reading from config so that on AWS they can point at **different ElastiCache clusters** later
  by changing only env (`REDIS_URL` vs `REDIS_QUEUE_URL`). Default both to `REDIS_URL` if the queue URL
  is unset.

### 1.3 New env vars (add to `env.ts` + `.env.example`)

```
# Queue
REDIS_QUEUE_URL=redis://localhost:6379      # defaults to REDIS_URL if unset
JUDGE_CONCURRENCY=4                          # parallel jobs per worker process
SUBMISSION_MAX_SOURCE_BYTES=65536            # reject larger source

# Docker sandbox (Phase 8)
DOCKER_SOCKET=/var/run/docker.sock           # host daemon
SANDBOX_DEFAULT_TIME_MS=2000                 # fallback per-case wall-clock (problem can override)
SANDBOX_DEFAULT_MEMORY_MB=256
SANDBOX_PIDS_LIMIT=64
SANDBOX_OUTPUT_MAX_BYTES=65536               # truncate stdout beyond this
SANDBOX_CPUS=1
COMPILE_TIME_MS=10000                        # compilation gets its own (larger) limit

# SSE (Phase 9)
SSE_HEARTBEAT_MS=15000
```

### 1.4 New error codes (extend the `ErrorCode` union)

```
| 'SUBMISSION_NOT_FOUND' | 'PROBLEM_NOT_SUBMITTABLE' | 'LANGUAGE_NOT_ALLOWED'
| 'SOURCE_TOO_LARGE' | 'SANDBOX_ERROR' | 'STREAM_GONE'
```

---

## Phase 7 — Submission Intake & Queue

**Goal:** accept a submission over HTTP, persist it as PENDING, enqueue a job, and return **202**
immediately. The HTTP request NEVER runs user code. A separate worker (Phase 8) drains the queue.

### 7.0 The shape of the async boundary (understand before coding)

```
POST /submissions
   → validate (problem exists & submittable, language allowed, size ok)
   → create Submission doc { status: PENDING, verdict: null }   [Mongo]
   → enqueue job { submissionId }                               [BullMQ / queue:*]
   → respond 202 { submissionId, status: PENDING }              [request ends here]

... later, independently ...

Worker picks job → judges → updates Submission → publishes verdict event (Phase 8/9)
```

The request path does the cheap, safe work (validate + write + enqueue) and returns. All heavy/unsafe
work happens in the worker. This is what absorbs the contest-deadline burst as **queue depth** instead
of load.

### 7.1 Implement the Submission model (was a stub)

`modules/submission/submission.model.ts`, collection `submissions`:

- `userId: ObjectId` (ref User, indexed)
- `problemId: ObjectId` (ref Problem, indexed)
- `contestId?: ObjectId` (ref Contest, nullable — contests are a later phase; keep the field)
- `language: Language`
- `sourceRef: string` — **object-storage key** for the source blob (store source via `ObjectStorage`,
  not inline in Mongo). Keep raw source out of the DB.
- `status: SubmissionStatus` (default PENDING)
- `verdict: Verdict | null` (default null) — **worker-written ONLY**
- `score: number` (default 0)
- `execMs?: number`, `memKb?: number` — resource usage, filled by worker
- `compileError?: string` — populated on CE
- `failedCaseIndex?: number` — first failing case (for WA/RE), worker-filled
- `judgedBy?: string` — worker id (audit)
- `attempt?: number` — retry count (worker/queue-filled)
- timestamps
- Indexes: `{ userId: 1, contestId: 1 }`, `{ problemId: 1, createdAt: -1 }`.

> The submission carries a `sourceRef`, not the code. The worker fetches the blob via `ObjectStorage`.

### 7.2 Queue module

Create `modules/submission/submission.queue.ts`:

- Define `JUDGE_QUEUE_NAME = 'judge'` (BullMQ namespaces its keys under `queue:*` automatically via the
  connection — keep the `bull` prefix configured so it lands in the reserved namespace).
- Export a singleton **Queue** (`new Queue(JUDGE_QUEUE_NAME, { connection: queueConnection })`).
- Job data type: `interface JudgeJob { submissionId: string }`. **ID only** — never put source/code in
  the job. The worker re-reads everything from Mongo/object storage (single source of truth).
- Job options:
  - `attempts: 3`, `backoff: { type: 'exponential', delay: 2000 }` — retries are for **infra failures
    only** (worker crash, transient Docker error). A program timing out is a *valid verdict*, NOT a job
    failure — never retried.
  - `removeOnComplete: { count: 1000 }`, `removeOnFail: false` (keep failed jobs for the DLQ/inspection).
  - `priority`: contest submissions get higher priority than practice. Define
    `priority = isContest ? 1 : 10` (lower number = higher priority in BullMQ).
- Export `enqueueJudgeJob(submissionId, { isContest })`.

### 7.3 Submission service (HTTP-free)

`modules/submission/submission.service.ts`:

- `createSubmission({ userId, problemSlug, language, source }): Submission`
  1. Load problem by slug. If not found → `PROBLEM_NOT_FOUND`.
  2. If `language` not in `problem.allowedLanguages` → `LANGUAGE_NOT_ALLOWED`.
  3. If `Buffer.byteLength(source) > SUBMISSION_MAX_SOURCE_BYTES` → `SOURCE_TOO_LARGE`.
  4. (Contest gating is a later phase — leave a `// TODO(phase-10): check contest window` note.)
  5. Store source via `ObjectStorage.put()` → get `sourceRef`.
  6. Create Submission doc (status PENDING, verdict null).
  7. `await enqueueJudgeJob(submission.id, { isContest: !!contestId })`.
  8. Return the submission.
- `getSubmissionForUser(submissionId, requestingUser)` — load; authorize (owner, or setter/admin);
  else `FORBIDDEN`. Used by the polling endpoint and Phase 9 SSE auth.
- `listUserSubmissions(userId, { page, limit })` — paginated history.

### 7.4 Submission routes/controller

| Method | Route | Auth | Behavior |
|---|---|---|---|
| POST | `/submissions` | requireAuth | body `{ problemSlug, language, source }` → `createSubmission` → **202** `{ data: { submissionId, status: 'PENDING' } }` |
| GET | `/submissions/:id` | requireAuth | `getSubmissionForUser` → submission incl. status/verdict/score. **This is also the SSE polling fallback (Phase 9).** |
| GET | `/submissions` | requireAuth | `listUserSubmissions` for the current user |

- Validate all inputs with zod (`submission.schema.ts`).
- The POST controller returns **202**, not 200/201 — the work is accepted, not completed.

### 7.5 Acceptance criteria (Phase 7)
- POST /submissions creates a PENDING submission, enqueues exactly one job, returns 202 with the id.
- Source is stored via ObjectStorage; Mongo holds only `sourceRef` (test asserts no raw source in the doc).
- Oversized source / disallowed language / unknown problem are rejected with the right codes.
- A job with `{ submissionId }` (and nothing else) lands in the `judge` queue (verify via BullMQ API in test).
- No route can set `verdict` (it's not in any request schema) — verify.

### 7.6 Context for later phases
- Phase 8's worker consumes `JUDGE_QUEUE_NAME`, reads the submission + its `sourceRef`, fetches test
  cases via `testcase.service.getAllForProblem`, and writes back status/verdict/score.
- Phase 9 streams the verdict; `GET /submissions/:id` is already the polling fallback.

---

## Phase 8 — Judge Worker & Docker Sandbox (THE compiler — security-critical)

**Goal:** a worker process that consumes judge jobs, compiles and runs the user's code inside a
locked-down Docker container (one per submission), compares output against test cases, and writes the
verdict. **This is where untrusted code actually executes. Every isolation control below is mandatory.**

> **Local-first.** This phase targets your local machine with Docker Desktop installed. The execution
> logic is hidden behind an `ExecutionEngine` interface so that deploying to AWS EC2 later (worker talks
> to the host Docker daemon, images pulled from ECR) requires NO code change — only config. Do not
> hardcode anything that assumes "local" vs "cloud" outside the config layer.

### 8.0 Threat model (why each control exists — do not skip any)

The code being run is hostile by assumption. Map of attack → control (ALL must be implemented):

| Attack | Example | Control (mandatory) |
|---|---|---|
| Destroy filesystem | `rm -rf /` | `--read-only` root FS + small writable `--tmpfs /tmp` only |
| Fork bomb | `:(){ :|:& };:` | `--pids-limit` (from `SANDBOX_PIDS_LIMIT`) |
| Memory exhaustion | allocate forever | `--memory` + `--memory-swap` equal (no swap escape) |
| CPU hog / infinite loop | `while(true){}` | `--cpus` quota **and** a worker-side wall-clock kill |
| Network abuse | exfiltrate / mine / call home | `--network none` (no network at all) |
| Privilege escalation | break out to host | non-root `--user`, `--cap-drop ALL`, `--security-opt no-new-privileges` |
| Read other data / tests | peek at host or peers | nothing host-side mounted; fresh container per run; destroyed after |
| Infinite output | print forever | truncate stdout at `SANDBOX_OUTPUT_MAX_BYTES` |
| Compiler abuse | malicious compile step | compile in its own limited container with `COMPILE_TIME_MS` |

> **If a control here is ever weakened to "make it work," that is a bug, not a shortcut. Stop and fix
> the real cause.**

### 8.1 The ExecutionEngine interface (swap-able backend)

`src/lib/execution/execution.interface.ts`:

```ts
export interface RunRequest {
  language: Language;
  sourcePath: string;        // path to source inside a prepared temp workdir
  stdin: string;             // the test case input
  timeLimitMs: number;
  memoryLimitMb: number;
}
export interface RunResult {
  stdout: string;            // truncated to SANDBOX_OUTPUT_MAX_BYTES
  exitCode: number | null;
  timedOut: boolean;
  oomKilled: boolean;        // memory limit hit
  durationMs: number;
  memKb?: number;
}
export interface CompileResult {
  ok: boolean;
  artifactPath?: string;     // compiled binary/class location (in workdir)
  error?: string;            // compiler stderr on failure (truncated)
}
export interface ExecutionEngine {
  compile(language: Language, sourcePath: string, workdir: string): Promise<CompileResult>;
  run(req: RunRequest): Promise<RunResult>;
}
```

- `src/lib/execution/docker.engine.ts` — the real implementation using **dockerode**, applying every
  control in §8.0. This is the only file that knows about Docker.
- `src/lib/execution/index.ts` — exports a singleton engine chosen by config (default: docker). Leaves
  room for `gvisor.engine.ts` / `firecracker.engine.ts` later (HLD upgrade path) with zero churn.

### 8.2 Language runtimes (the "compiler part")

Define a per-language config map `src/lib/execution/languages.ts`:

```ts
interface LangSpec {
  image: string;                  // Docker image (local build now; ECR ref later)
  sourceFilename: string;         // e.g. main.cpp, Main.java, main.py
  compileCmd?: string[];          // omitted for interpreted langs
  runCmd: string[];               // command to execute the program
  needsCompile: boolean;
}
```

Minimum languages for this phase: **cpp, python, javascript** (java/go can follow the same pattern;
add them but they share the identical mechanism).

- Provide a `docker/` folder at repo root with a small Dockerfile per runtime (e.g.
  `docker/cpp.Dockerfile` based on `gcc:slim`, `docker/python.Dockerfile` on `python:slim`,
  `docker/node.Dockerfile` on `node:slim`). Each image has a non-root user (`uid 1000`) and only the
  toolchain. Add an `npm run build:images` script that builds them locally and tags them
  `oj-runtime-<lang>:latest`. (On AWS these images get pushed to ECR; same tags.)
- `compile()`:
  - interpreted langs → return `{ ok: true }` (nothing to compile).
  - compiled langs → run `compileCmd` inside a container with `COMPILE_TIME_MS`, capped memory, no
    network, read-only except the workdir. On non-zero exit → `{ ok: false, error: <stderr truncated> }`.
- `run()`:
  - Start a container from the language image with the FULL §8.0 control set, mount nothing from host
    except the prepared workdir (read-only) and a tmpfs scratch, pipe `stdin` in, capture `stdout`.
  - Enforce BOTH the container `--cpus`/`--memory` limits AND a worker-side wall-clock timer
    (`timeLimitMs` + small grace); if the timer fires, kill/remove the container and set
    `timedOut: true`.
  - Detect OOM (dockerode reports `OOMKilled`) → `oomKilled: true`.
  - Always `--rm` / force-remove the container in a `finally`, even on error. Never leak containers.

### 8.3 The judge service (verdict logic — HTTP-free, reusable)

`modules/judge/judge.service.ts`:

```ts
async function judgeSubmission(submissionId: string): Promise<void>
```

Steps:
1. Load submission. If missing → log + return (job is stale). Set `status: JUDGING`.
2. Load problem (limits, allowedLanguages). Fetch source blob via `ObjectStorage.get(sourceRef)`.
3. Fetch ALL test cases via `testcase.service.getAllForProblem(problemId)` (sample + hidden), ordered.
4. Prepare a temp workdir; write the source as the language's `sourceFilename`.
5. **Compile** (if needed). On failure → verdict `CE`, store `compileError`, finalize, return.
6. **Run each test case in order:**
   - call `engine.run({ stdin: testcase.input, timeLimitMs: problem.timeLimitMs, ... })`.
   - if `timedOut` → verdict `TLE` (record `failedCaseIndex`), stop.
   - if `oomKilled` → verdict `MLE`, stop.
   - if `exitCode !== 0` → verdict `RE`, stop.
   - compare `stdout` to `testcase.expectedOutput` using **normalized comparison** (trim trailing
     whitespace per line and trailing newlines at EOF — do NOT do a raw byte compare; trailing-newline
     mismatches are the #1 false WA). If mismatch → verdict `WA` (record `failedCaseIndex`), stop.
   - track max `durationMs`/`memKb` across cases.
7. If all cases pass → verdict `AC`. Compute `score`:
   - simple mode now: `AC` → full points (or `100`); otherwise `0`.
   - leave `// TODO(phase-11): IOI partial scoring from testcase.points` — the field already exists.
8. **Finalize** (single update): set `status: DONE`, `verdict`, `score`, `execMs`, `memKb`,
   `failedCaseIndex?`, `judgedBy: <workerId>`. Then **publish** the verdict event (Phase 9 — call
   `publishVerdict(submissionId, payload)`; implement the publisher in Phase 9 and call it here).
9. Wrap the whole thing: any unexpected/infra error → rethrow so BullMQ retries (attempts=3). After
   retries exhausted, the worker's `failed` handler sets `status: SYSTEM_ERROR` (NOT a verdict) and logs
   for the DLQ. A timeout/OOM/RE/WA/CE is a **normal verdict**, never an error, never retried.

> Idempotency: finalizing is keyed on `submissionId`; re-running a job overwrites with the same result.
> Safe under retries.

### 8.4 The worker process (separate entrypoint)

`src/worker.ts` (a SECOND process, distinct from `src/index.ts`):

- Connect Mongo + the queue Redis (reuse the lifecycle helpers — do NOT start the Express server here).
- Create a BullMQ **Worker** on `JUDGE_QUEUE_NAME` with `concurrency: JUDGE_CONCURRENCY`,
  `connection: queueConnection`.
- Processor: `async (job) => judgeSubmission(job.data.submissionId)`.
- Handlers: `completed` (log), `failed` (if `job.attemptsMade >= attempts` → set submission
  `SYSTEM_ERROR`, log DLQ), graceful shutdown on SIGINT/SIGTERM (let in-flight jobs finish, close worker).
- `package.json` scripts: `worker` (run `src/worker.ts`), `worker:dev` (watch mode).

> The API (`src/index.ts`) and the worker (`src/worker.ts`) are **separate processes** sharing the same
> codebase and the same Redis/Mongo. Locally you run both (`npm run dev` + `npm run worker:dev`). On AWS
> later they become separate services (API on its instances, workers on EC2 with Docker). The code
> doesn't change — only how many of each you run.

### 8.5 Acceptance criteria (Phase 8)
- A correct solution to a sample problem → `AC`; wrong output → `WA` with `failedCaseIndex`.
- An infinite loop → `TLE` (worker wall-clock kill fires; container is removed).
- A program allocating huge memory → `MLE`.
- A crashing program (non-zero exit) → `RE`. A non-compiling program → `CE` with `compileError`.
- A program doing `rm -rf /`, opening a socket, or fork-bombing → contained; no host effect; produces a
  normal failing verdict or RE, never harms the worker.
- Containers are always removed (no leaked containers after a run, even on timeout) — verify with
  `docker ps -a` being clean after the suite.
- `submissions.verdict` is written ONLY by the worker (no HTTP path can).
- Retries fire only on injected infra errors, never on TLE/WA/etc.

### 8.6 Context for later phases
- Phase 9 implements `publishVerdict` (called in step 8) and the SSE endpoint.
- Phase 11 (leaderboard) listens for finalized contest verdicts to update the ZSET.
- The `ExecutionEngine` interface is the seam for gVisor/Firecracker and for AWS (images from ECR).

---

## Phase 9 — SSE Verdict Streaming (live result push)

**Goal:** push the verdict to the user's browser the instant it's ready, with polling as a fallback.

### 9.0 Why SSE + Redis pub/sub (the shape)

The worker and the web server are **different processes** (and later, different machines). The browser's
SSE connection is held by a web-server instance; the verdict is produced by a worker. They connect via
**Redis pub/sub**: the worker publishes a verdict event on a channel; every web instance subscribes; the
one holding that user's SSE connection forwards it. This keeps the web tier stateless and horizontally
scalable (any instance can serve any client) — matching the HLD.

```
worker → publishVerdict(submissionId, payload) → Redis PUBLISH sse:verdict:<submissionId>
web instance (subscribed) → receives → pushes down the open SSE connection → browser updates live
```

### 9.1 The publisher (used by Phase 8 step 8)

`modules/stream/verdict.publisher.ts`:

- `publishVerdict(submissionId, payload)` → `pubClient.publish(REDIS_KEYS sse channel, JSON.stringify(payload))`.
- Add to `REDIS_KEYS`: `sseVerdict: (submissionId) => `sse:verdict:${submissionId}``.
- Payload = `{ submissionId, status, verdict, score, execMs, failedCaseIndex? }`.

### 9.2 The SSE endpoint

`modules/stream/stream.routes.ts`:

| Method | Route | Auth | Behavior |
|---|---|---|---|
| GET | `/submissions/:id/stream` | requireAuth | open an SSE stream for this submission's verdict |

Controller behavior:
1. Authorize via `submission.service.getSubmissionForUser(id, req.user)` (owner/setter/admin) → else 403.
2. If the submission is **already DONE** (race: it finished before the client connected), immediately
   send the verdict event and close. (Always check current state first — do not assume the event is
   still coming.)
3. Else set SSE headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`,
   `Connection: keep-alive`), flush headers, and:
   - Create a dedicated `subClient` subscription to `sseVerdict(id)`. On message → write
     `data: <json>\n\n` to the response, then end the stream.
   - Send a heartbeat comment (`: ping\n\n`) every `SSE_HEARTBEAT_MS` to keep the connection alive
     through proxies.
   - On client disconnect (`req.on('close')`) → unsubscribe, clear heartbeat, clean up. **No leaks.**
4. Never block; never hold Mongo connections open for the duration.

### 9.3 Polling fallback (already exists)

`GET /submissions/:id` (Phase 7) is the fallback: if SSE can't connect, the client polls every 2–3s
until `status !== PENDING`. No new endpoint needed — just documented client behavior.

### 9.4 Acceptance criteria (Phase 9)
- Submit → open stream → when the worker finishes, the browser receives one `data:` event with the
  verdict, then the stream closes.
- If the submission is already DONE when the stream opens, the verdict is sent immediately.
- Client disconnect cleans up the Redis subscription and heartbeat (no leaked subscribers — verify).
- Polling `GET /submissions/:id` reflects the same final verdict.

### 9.5 Context for later phases
- Contests (Phase 10–11) reuse the same pub/sub mechanism for leaderboard-update events on `sse:*`.
- The publisher/subscriber split is the seam that lets the web tier scale on AWS behind a load balancer.

---

## Updated Continuity Contract (now includes Phases 7–9)

Everything from Phases 1–6 still holds. Added guarantees Phase 10+ will assume:

1. **Submission model** implemented (collection `submissions`); `verdict` is worker-written only;
   source is in object storage (`sourceRef`), not Mongo.
2. **Queue**: BullMQ `judge` queue on the `queue:*` Redis; jobs carry `{ submissionId }` only; retries
   are infra-only; failures → `SYSTEM_ERROR` + DLQ.
3. **ExecutionEngine** interface + Docker implementation enforce the full §8.0 sandbox control set;
   swappable for gVisor/Firecracker and AWS (ECR images) via config only.
4. **Two processes**: API (`src/index.ts`) and worker (`src/worker.ts`), same codebase, shared
   Redis/Mongo. Scalable independently.
5. **Verdict streaming**: worker `publishVerdict` → Redis pub/sub on `sse:*` → SSE endpoint pushes to
   client; `GET /submissions/:id` is the polling fallback. Web tier stays stateless.
6. **Verdict semantics fixed**: AC/WA/TLE/MLE/RE/CE are normal verdicts (never retried);
   `SYSTEM_ERROR` is an infra failure (distinct from any verdict).

> **Phase 10+ preview (do NOT implement now):** contests + invites (contest window gating on submission,
> participant state), leaderboard (Redis ZSET updated on finalized contest verdicts, served O(log N)),
> AI hints/review (separate AI job queue, guardrailed, never blocks judging), admin/moderation. All slot
> onto the seams above without refactoring.

---

## Final Notes to the AI Code Editor

- Implement Phase 7 → 8 → 9 in order. After each, run `typecheck`, `lint`, and that phase's tests.
- **Local-first**: assume Docker Desktop is running locally. Do not add AWS SDK calls or cloud assumptions
  in code — cloud specifics come from config/env at deploy time only.
- **Never weaken a sandbox control to make a test pass.** If code escapes or a container leaks, fix the
  isolation, not the test.
- Keep services HTTP-free so the worker can import them. Keep the API and worker as separate entrypoints.
- Do not add libraries or scope beyond this spec; use `// TODO(phase-N):` for anything that belongs later.
- When unsure, re-read the Threat Model (§8.0) and the Continuity Contract — they encode the HLD and are
  non-negotiable.
