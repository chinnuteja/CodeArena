# AI-Native Online Judge — Build Specification (Phases 10–11)

> **For the AI code editor.** Continuation of `OJ_BUILD_PHASES_1-6.md` and `OJ_BUILD_PHASES_7-9.md`.
> Everything in both prior **Continuity Contracts** is assumed to exist and must NOT be re-implemented
> or renamed. This document specifies **Contests + Invites (Phase 10)** and the **Leaderboard (Phase 11)**.
>
> Implement exactly what is written. Do not substitute libraries. Where something belongs to a later
> phase, leave a `// TODO(phase-N):` note. These phases are about **correctness under concurrency** —
> the leaderboard math and the contest-window gating are where subtle bugs hide. Follow the rules precisely.

---

## 0. Continuity — What Already Exists (must reuse)

- **Shared spine:** `AppError` + codes, `asyncHandler`, `validate`, response/error envelopes, pino
  `logger`, Mongo lifecycle, Redis lifecycle. **Reuse — never duplicate.**
- **Auth:** `requireAuth` → `req.user = { id, role, jti, sid }`; `requireRole(...)`.
- **Models:** `User`, `Problem`, `TestCase`, `Submission` implemented. `Contest` exists as a **stub
  file** with fixed collection name `contests` — Phase 10 implements it for real. `attempt` stub exists.
- **Submission** already has a nullable `contestId` field and a worker-written `verdict`. The judge
  finalizes a submission (status DONE, verdict, score) and calls `publishVerdict(...)` (Phase 9).
- **Enums:** `Verdict` (AC|WA|TLE|MLE|RE|CE), `ScoringMode` (icpc|ioi), `SubmissionStatus`.
- **Redis namespacing** via `REDIS_KEYS`: `auth:*`, `cache:*`, `queue:*`, `sse:*` in use. Phase 11
  claims a new `leaderboard:*` namespace.
- **Integrity rules (unchanged, still enforced):** verdict is worker-written only; public problem
  endpoints expose sample test cases only; scores are computed server-side, never client-supplied.
- **Storage note (project-specific):** deployment is **EC2 + ECR only (no S3)**. Source blobs go through
  the `ObjectStorage` interface (disk locally; a Redis-backed impl in production). Do not add S3.

---

## 1. Concepts (read before coding)

### 1.1 What a contest is here
A contest is a time-boxed set of problems with a fixed list of participants and a scoring mode. While a
contest is **live** (now between `startAt` and `endAt`), submissions to its problems count toward the
ranking. Outside that window, they don't. Two contest kinds:
- **Friendly** — private, join only via a secure invite link/token.
- **Global** — public, anyone authenticated can register before/while it's live.

### 1.2 The two scoring models (implement both; a contest picks one via `scoringMode`)

**ICPC mode** (binary per problem + penalty time):
- A problem is either *solved* (first AC) or not. Partial credit does not exist.
- Rank primarily by **number of problems solved** (more is better).
- Tiebreak by **total penalty time** (less is better), where penalty for a solved problem =
  `(minutes from contest start to the accepted submission)` + `(PENALTY_PER_WRONG × number of rejected
  submissions on that problem BEFORE the accepted one)`. Wrong submissions on problems never solved add
  **no** penalty.
- `PENALTY_PER_WRONG` = 20 minutes (standard; put in config as `ICPC_PENALTY_MINUTES`).

**IOI mode** (partial points):
- Each problem awards points = sum of `points` of the test cases (or subtasks) passed by the user's
  **best** submission for that problem. (Phase 8 currently records full-or-zero; Phase 11 introduces the
  `passedPoints` needed for partial — see §3.3. Until per-case points are wired, IOI falls back to
  full-or-zero, which is acceptable and noted with a TODO.)
- Rank by **total points** (more is better). Tiebreak by **time of reaching that score** (earlier better).

> **Critical correctness rule:** ranking math is computed **server-side only**, from stored submissions.
> The client never sends scores or ranks. This is an integrity guarantee, same family as worker-only verdicts.

---

## Phase 10 — Contests & Invites

**Goal:** create/manage contests, register/join participants (public registration + private invite
tokens), and **gate submissions** so they only count when made by a registered participant during the
live window.

### 10.1 New env vars (add to `env.ts` + `.env.example`)
```
ICPC_PENALTY_MINUTES=20
INVITE_TOKEN_TTL_DAYS=14
CONTEST_MAX_PROBLEMS=26
```

### 10.2 New error codes (extend `ErrorCode`)
```
| 'CONTEST_NOT_FOUND' | 'CONTEST_NOT_LIVE' | 'CONTEST_ALREADY_STARTED'
| 'NOT_REGISTERED' | 'ALREADY_REGISTERED' | 'INVITE_INVALID' | 'INVITE_EXPIRED'
```

### 10.3 Implement the Contest model (was a stub)
`modules/contest/contest.model.ts`, collection `contests`:
- `title: string`
- `slug: string` (unique, indexed)
- `description?: string`
- `kind: 'friendly' | 'global'` (enum — add `ContestKind` to constants)
- `scoringMode: ScoringMode` (icpc | ioi)
- `startAt: Date`, `endAt: Date` (validate `endAt > startAt`)
- `problemIds: ObjectId[]` (ref Problem; max `CONTEST_MAX_PROBLEMS`)
- `createdBy: ObjectId` (ref User)
- timestamps
- Indexes: unique `slug`, index `{ startAt: 1, endAt: 1 }`.

> Do NOT store participants as a giant array on the contest doc (it doesn't scale and causes write
> contention). Use a separate `contest_participants` collection.

### 10.4 New model: ContestParticipant
`modules/contest/participant.model.ts`, collection `contest_participants`:
- `contestId: ObjectId` (indexed)
- `userId: ObjectId` (indexed)
- `registeredAt: Date`
- **compound unique index** `{ contestId: 1, userId: 1 }` — prevents double-registration at the DB level
  (don't rely only on app checks; uniqueness must be enforced by the DB to be race-safe).

### 10.5 New model: ContestInvite (for friendly contests)
`modules/contest/invite.model.ts`, collection `contest_invites`:
- `contestId: ObjectId` (indexed)
- `tokenHash: string` — **store SHA-256 hash of the token, never the raw token** (same discipline as
  refresh tokens; a leaked DB shouldn't hand out working invites)
- `createdBy: ObjectId`
- `maxUses?: number` (null = unlimited), `uses: number` (default 0)
- `expiresAt: Date` (default now + `INVITE_TOKEN_TTL_DAYS`)
- timestamps

### 10.6 Contest service (HTTP-free)
`modules/contest/contest.service.ts`:
- `createContest(input, creatorId)` — setter/admin only (enforced at route). Validate window, problem
  count, unique slug (else `CONFLICT`/`SLUG_TAKEN`).
- `updateContest(slug, patch)` — **forbid changing `startAt`/`problemIds`/`scoringMode` once the contest
  has started** (`CONTEST_ALREADY_STARTED`). Editing a running contest's problem set corrupts the
  leaderboard. Allow editing title/description anytime.
- `listContests({ kind?, status?, page, limit })` — `status` derived from now vs start/end
  (`upcoming` | `live` | `ended`). Global contests are listable publicly; friendly contests are not
  listed (join by link only).
- `getContest(slug, requestingUser?)` — for friendly contests, only return full detail to registered
  participants / creator / admin; others get 404 (don't reveal existence of private contests).
- `isLive(contest)` helper: `now >= startAt && now < endAt`.

### 10.7 Registration & invites
In `contest.service.ts`:
- `registerForGlobal(contestId, userId)` — only for `kind === 'global'`; allowed if contest is upcoming
  or live; create a `ContestParticipant`. Duplicate → `ALREADY_REGISTERED` (rely on the unique index;
  catch the duplicate-key error and map it).
- `createInvite(contestId, creatorId, { maxUses?, expiresAt? })` — friendly contests only; generate a
  random token (32+ bytes base64url), store its SHA-256 hash, return the **raw token once** to the
  creator (never retrievable again).
- `acceptInvite(rawToken, userId)` — hash the token, find a matching non-expired invite with uses left;
  if none → `INVITE_INVALID`/`INVITE_EXPIRED`. Create a `ContestParticipant` (idempotent — if already
  registered, treat as success). Atomically increment `uses` (`$inc`); if `maxUses` reached, stop
  accepting further. Return the contest summary.
- `isRegistered(contestId, userId): boolean`.

### 10.8 Submission gating (wire into existing submission flow)
This is the integration point with Phase 7. In `submission.service.createSubmission`, replace the
earlier `// TODO(phase-10): check contest window` with real logic:
- The submit request may include an optional `contestId` (or `contestSlug`). If present:
  1. Load contest. Not found → `CONTEST_NOT_FOUND`.
  2. If not `isLive(contest)` → `CONTEST_NOT_LIVE`.
  3. If the problem is not in `contest.problemIds` → `PROBLEM_NOT_SUBMITTABLE`.
  4. If `!isRegistered(contestId, userId)` → `NOT_REGISTERED`.
  5. Set `submission.contestId = contestId` (this is what makes it count).
- If no `contestId` → it's a practice submission (contestId stays null), judged normally, never affects
  any leaderboard.

> The judge worker does NOT change. It already finalizes verdicts. Phase 11 listens for finalized
> **contest** submissions to update rankings.

### 10.9 Routes/controllers (`modules/contest`)
| Method | Route | Auth | Behavior |
|---|---|---|---|
| POST | `/contests` | requireRole(setter, admin) | create contest |
| PATCH | `/contests/:slug` | requireRole(setter, admin) | update (respect frozen-after-start rule) |
| GET | `/contests` | public | list (global only; filters: kind, status) |
| GET | `/contests/:slug` | optional auth | detail (friendly → participants/creator/admin only) |
| POST | `/contests/:slug/register` | requireAuth | register for a global contest |
| POST | `/contests/:slug/invites` | requireRole(setter, admin) | create invite (returns raw token once) |
| POST | `/contests/invites/accept` | requireAuth | body `{ token }` → join friendly contest |
| GET | `/contests/:slug/me` | requireAuth | current user's registration + per-problem status |

All inputs zod-validated. All times in UTC (store/compare in UTC; never trust client clocks).

### 10.10 Acceptance criteria (Phase 10)
- Create a global contest; a user registers; double-registration is rejected by the unique index.
- Friendly contest: create invite → raw token returned once → another user accepts → becomes a
  participant. Expired/over-used token → rejected. Raw token never stored (only hash) — test asserts.
- Submission gating: submitting to a contest problem when not registered → `NOT_REGISTERED`; outside the
  window → `CONTEST_NOT_LIVE`; to a problem not in the set → rejected; valid case → submission gets
  `contestId` set.
- A practice submission (no contestId) is unaffected by all contest logic.
- Editing `problemIds` after start → `CONTEST_ALREADY_STARTED`.

### 10.11 Context for Phase 11
- A finalized submission with a non-null `contestId` and a verdict is the event that drives ranking.
- `contest.scoringMode` decides which math the leaderboard applies.

---

## Phase 11 — Leaderboard (Redis ZSET)

**Goal:** live, correct rankings per contest, served fast from a Redis sorted set, updated whenever a
contest submission is finalized — with MongoDB remaining the source of truth.

### 11.0 Why a Redis ZSET (the shape — understand before coding)
Recomputing a leaderboard from Mongo on every page view does not scale (a live contest gets constant
leaderboard reads). A Redis **sorted set** keeps members (users) ordered by a numeric **score**, giving
O(log N) inserts and O(log N + M) range reads ("top 100", "my rank ± neighbours"). So:
- **MongoDB = source of truth** (every submission/verdict is durably stored).
- **Redis ZSET = a derived, rebuildable index** for fast ranking. If Redis is lost, rebuild it from
  Mongo. The ZSET never holds anything that isn't reconstructable.
- Because only the worker-finalized verdicts feed it, the ZSET **cannot be poisoned by clients**.

### 11.1 The hard part: encoding rank into ONE sortable number
A ZSET sorts by a single float. But our ranking has **two or three criteria** (e.g. ICPC: solved DESC,
then penalty ASC). We must encode them into one score such that normal numeric ordering reproduces the
true ranking. Standard technique — **composite score**:

**ICPC:** higher solved should win; among equal solved, lower penalty should win.
```
score = (solvedCount * LARGE) - penaltyMinutes
```
where `LARGE` is bigger than any achievable penalty (e.g. 1e7). Then **higher ZSET score = better rank**.
Read with `ZREVRANGE` (descending). Two people with same solved compare by penalty automatically because
penalty is subtracted.

**IOI:** higher points wins; among equal points, earlier time wins.
```
score = (totalPoints * LARGE) - secondsFromStartToReachScore
```
Same idea: higher = better, earlier time breaks ties.

> Document the `LARGE` constant and the encoding in code comments. This composite-score trick is the
> crux of the phase; get it wrong and ranks are subtly incorrect. Add unit tests for the encoder.

### 11.2 Per-user contest state (needed to compute the score)
You cannot derive penalty/solved from the ZSET alone — you need per-user, per-problem state. Store it in
Mongo for truth and correctness; the ZSET is just the fast index.

New model `modules/leaderboard/standing.model.ts`, collection `contest_standings`:
- `contestId, userId` (compound unique index)
- `problems: { problemId, solved: boolean, solvedAtMs?: number, wrongCount: number, bestPoints: number }[]`
- `solvedCount: number`, `penaltyMinutes: number`, `totalPoints: number`
- `lastImprovementMs?: number` (for IOI tiebreak)
- timestamps

### 11.3 The update path (driven by finalized contest submissions)
Add `modules/leaderboard/leaderboard.service.ts`:
- `onContestSubmissionFinalized(submission)` — called when a submission with a non-null `contestId`
  reaches status DONE. Steps (must be **idempotent** — a re-judged submission must not double-count):
  1. Load contest + the user's `contest_standings` doc (create if missing).
  2. Find the per-problem entry. If the problem is already `solved`, ignore further submissions for ICPC
     (first AC locks it); for IOI, update `bestPoints` only if improved.
  3. **ICPC:** if verdict is AC and not yet solved → mark solved, set `solvedAtMs`, recompute
     `penaltyMinutes += (solvedAtMs - startAtMs)/60000 + ICPC_PENALTY_MINUTES * wrongCount`, increment
     `solvedCount`. If verdict is a *reject* (WA/TLE/MLE/RE — NOT CE; compile errors conventionally don't
     penalize, follow ICPC rules: count only non-CE rejects) and problem not yet solved → `wrongCount++`.
  4. **IOI:** compute this submission's points (see §3.3 note); if `> bestPoints`, update `bestPoints`,
     recompute `totalPoints`, set `lastImprovementMs`.
  5. Persist the standings doc.
  6. Compute the composite score (§11.1) and write to Redis:
     `ZADD leaderboard:<contestId> <score> <userId>`.
  7. Publish a leaderboard-update event on `sse:leaderboard:<contestId>` (reuse the Phase 9 pub/sub
     mechanism) so live viewers can refresh.
- **Where it's called from:** in the judge finalize step (Phase 8 `judge.service`), after writing the
  verdict and calling `publishVerdict`, add: `if (submission.contestId) await onContestSubmissionFinalized(submission)`.
  Keep it inside the worker (it's HTTP-free) — do not move ranking logic into an HTTP route.

> Idempotency detail: guard with the submission's identity — track which submissionIds have already been
> applied to a standings/problem entry (e.g. store `appliedSubmissionIds` or compare `solvedAtMs`), so a
> retry/re-judge doesn't add penalty twice.

### 11.4 Read path (serving the leaderboard)
- `getLeaderboard(contestId, { page, limit })`:
  - `ZREVRANGE leaderboard:<contestId> <start> <stop> WITHSCORES` → ordered userIds.
  - Hydrate display rows from `contest_standings` + `toSafeUser` (username, solved, penalty/points). Do
    NOT expose internal composite scores raw; present human fields.
  - `meta: { page, limit, total }` where total = `ZCARD`.
- `getMyRank(contestId, userId)`: `ZREVRANK` for position + the user's standings row + a small neighbour
  window (rank-3 .. rank+3) for the "my position" UI.
- Optional short cache only if needed; the ZSET is already fast — prefer reading it directly so it's live.

### 11.5 Rebuild path (resilience)
- `rebuildLeaderboard(contestId)` — admin-only utility: wipe `leaderboard:<contestId>`, replay all
  finalized contest submissions (ordered by time) through the same `onContestSubmissionFinalized` logic
  to reconstruct standings + ZSET from Mongo. This proves the ZSET is a pure derived index and gives an
  operational recovery tool.

### 11.6 Routes/controllers (`modules/leaderboard`)
| Method | Route | Auth | Behavior |
|---|---|---|---|
| GET | `/contests/:slug/leaderboard` | optional auth | ranked standings (paginated) |
| GET | `/contests/:slug/leaderboard/me` | requireAuth | current user's rank + neighbours |
| GET | `/contests/:slug/leaderboard/stream` | requireAuth | SSE stream of leaderboard-update events (reuse Phase 9 pattern; authorize: participant/creator/admin) |
| POST | `/contests/:slug/leaderboard/rebuild` | requireRole(admin) | rebuild from Mongo |

### 11.7 Acceptance criteria (Phase 11)
- Composite-score encoder unit tests: for hand-crafted standings, ZSET ordering equals the correct
  ICPC/IOI ranking (including tiebreaks).
- End-to-end: two users in a live contest submit; AC/WA affect solved/penalty correctly; the leaderboard
  reflects the right order; first-to-solve ranks above a later solver with the same count.
- Idempotency: re-judging an already-counted submission does NOT change penalty/score (test asserts).
- A reject after a problem is already solved adds no penalty (ICPC). CE doesn't add penalty.
- `rebuildLeaderboard` reconstructs identical standings/ZSET from Mongo after flushing Redis.
- Practice (non-contest) submissions never touch any leaderboard.

### 11.8 Context for later phases
- The leaderboard SSE channel reuses `sse:*`; the web tier stays stateless.
- AI features (Phase 12) and admin (13–14) do not touch ranking. Final ratings (if added later) would be
  computed from final standings — leave a `// TODO(phase-future): rating update from final standings`.

---

## Updated Continuity Contract (now includes Phases 10–11)

All prior guarantees hold. Added:
1. **Contest** model implemented (`contests`); participants in `contest_participants` (unique
   `{contestId,userId}`); invites in `contest_invites` storing only token **hashes**.
2. **Submission gating**: a submission counts for a contest only if made by a registered participant,
   during the live window, to a problem in the set — enforced in `submission.service`. Practice
   submissions are untouched.
3. **Leaderboard**: per-user truth in `contest_standings` (Mongo); fast ranking in Redis ZSET
   `leaderboard:<contestId>` via a composite score; updated by the worker on finalized contest verdicts;
   rebuildable from Mongo. Ranking math is server-side only and idempotent.
4. **New Redis namespace** `leaderboard:*` claimed; leaderboard SSE on `sse:leaderboard:<contestId>`.
5. **Scoring** supports ICPC and IOI via `contest.scoringMode`.

> **Phase 12+ preview (do NOT implement now):** AI hints + review on a separate guardrailed AI job queue
> (never blocks judging, never leaks hidden tests), then admin/moderation (RBAC over problems/contests,
> user restrictions, audit log). All slot onto existing seams.

---

## Final Notes to the AI Code Editor

- Implement Phase 10 fully, then Phase 11. Run `typecheck`, `lint`, and each phase's tests before moving on.
- **Correctness over cleverness:** the composite-score encoder and the idempotent update path are the two
  places to be most careful. Write unit tests for both first.
- Keep all ranking logic in the **service/worker layer** (HTTP-free); routes only call services.
- Use UTC everywhere for time math; never trust client-supplied times, scores, or ranks.
- Do not add libraries or scope beyond this spec; use `// TODO(phase-N):` for anything later.
- When unsure, re-read §11.1 (score encoding) and the Continuity Contract — they encode the HLD and are
  non-negotiable.
