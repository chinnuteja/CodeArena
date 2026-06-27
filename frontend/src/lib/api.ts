import { getAccessToken } from './auth';

export const API_URL = '/api';

async function parseResponse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || res.statusText || 'Request failed';
    throw new Error(message);
  }
  return data;
}

function authHeaders(): HeadersInit {
  const token = getAccessToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export type UserProfile = {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  role?: string;
  rating?: number;
  createdAt?: string;
};

export type PublicUserProfile = {
  username: string;
  fullName?: string;
  rating?: number;
  createdAt?: string;
};

export function isStaffRole(role?: string) {
  return role === 'setter' || role === 'admin';
}

export async function fetchProblems() {
  const res = await fetch(`${API_URL}/problems`, { headers: authHeaders() });
  const data = await parseResponse(res);
  return data.data as Array<{
    _id: string;
    slug: string;
    title: string;
    difficulty: string;
    tags?: string[];
    solved?: boolean;
  }>;
}

export type Contest = {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  kind: string;
  scoringMode: string;
  startAt: string;
  endAt: string;
};

export type ContestProblem = {
  _id: string;
  title: string;
  slug: string;
  difficulty: string;
};

export type ContestDetail = Contest & {
  problemIds: ContestProblem[];
  createdBy?: { _id: string; username: string };
};

export type LeaderboardStanding = {
  _id: string;
  userId: { _id: string; username: string };
  solvedCount: number;
  penaltyMinutes: number;
  totalPoints: number;
};

export type ProblemAdmin = {
  _id: string;
  slug: string;
  title: string;
  statement: string;
  difficulty: string;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  allowedLanguages?: string[];
  isPractice?: boolean;
  tags?: string[];
};

export type TestCaseItem = {
  _id: string;
  input: string;
  expectedOutput: string;
  isSample?: boolean;
  points?: number;
  order?: number;
};

export async function fetchContests(status?: 'upcoming' | 'live' | 'ended') {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const res = await fetch(`${API_URL}/contests?${params}`, { headers: authHeaders() });
  const data = await parseResponse(res);
  return data as { contests: Contest[]; meta: { total: number; page: number; limit: number } };
}

export async function fetchContest(slug: string) {
  const res = await fetch(`${API_URL}/contests/${slug}`, { headers: authHeaders() });
  const data = await parseResponse(res);
  return data.contest as ContestDetail;
}

export async function fetchMyContestRegistration(slug: string) {
  const res = await fetch(`${API_URL}/contests/${slug}/me`, { headers: authHeaders() });
  const data = await parseResponse(res);
  return data as { isRegistered: boolean };
}

export async function registerForContest(slug: string) {
  const res = await fetch(`${API_URL}/contests/${slug}/register`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const data = await parseResponse(res);
  return data.participant;
}

export async function createContest(payload: {
  title: string;
  slug: string;
  description?: string;
  kind: 'global' | 'friendly';
  scoringMode: 'icpc' | 'ioi';
  startAt: string;
  endAt: string;
  problemIds?: string[];
}) {
  const res = await fetch(`${API_URL}/contests`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseResponse(res);
  return data.contest as ContestDetail;
}

export async function updateContest(
  slug: string,
  payload: Partial<{
    title: string;
    description: string;
    startAt: string;
    endAt: string;
    problemIds: string[];
    scoringMode: 'icpc' | 'ioi';
  }>,
) {
  const res = await fetch(`${API_URL}/contests/${slug}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseResponse(res);
  return data.contest as ContestDetail;
}

export async function createContestInvite(slug: string, payload?: { maxUses?: number; expiresAt?: string }) {
  const res = await fetch(`${API_URL}/contests/${slug}/invites`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload ?? {}),
  });
  const data = await parseResponse(res);
  return data.token as string;
}

export async function acceptContestInvite(token: string) {
  const res = await fetch(`${API_URL}/contests/invites/accept`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ token }),
  });
  const data = await parseResponse(res);
  return data as { message: string; contest: ContestDetail };
}

export async function fetchLeaderboard(slug: string, page = 1, limit = 50) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const res = await fetch(`${API_URL}/contests/${slug}/leaderboard?${params}`, { headers: authHeaders() });
  const data = await parseResponse(res);
  return data as { standings: LeaderboardStanding[]; meta: { total: number; page: number; limit: number } };
}

export async function fetchMyLeaderboardRank(slug: string) {
  const res = await fetch(`${API_URL}/contests/${slug}/leaderboard/me`, { headers: authHeaders() });
  const data = await parseResponse(res);
  return data as { rank: number | null; standing: LeaderboardStanding | null };
}

export type LeaderboardStreamUpdate = { type: string; userId: string };

export function streamLeaderboard(
  slug: string,
  onUpdate: (update: LeaderboardStreamUpdate) => void,
  onError?: (err: Error) => void,
): () => void {
  const controller = new AbortController();
  const token = getAccessToken();

  (async () => {
    try {
      const res = await fetch(`${API_URL}/contests/${slug}/leaderboard/stream`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(res.status === 403 ? 'Leaderboard stream requires registration' : 'Failed to connect to leaderboard stream');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            onUpdate(JSON.parse(line.slice(6)));
          } catch {
            // ignore malformed chunks
          }
        }
      }
    } catch (err) {
      if (!controller.signal.aborted && onError) {
        onError(err instanceof Error ? err : new Error('Stream failed'));
      }
    }
  })();

  return () => controller.abort();
}

export async function fetchProblem(slug: string) {
  const res = await fetch(`${API_URL}/problems/${slug}`);
  const data = await parseResponse(res);
  return data.data;
}

export async function runCode(slug: string, payload: { language: string; source: string; input: string }) {
  const res = await fetch(`${API_URL}/problems/${slug}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseResponse(res);
  return data.data;
}

export async function refreshAccessToken() {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  const data = await parseResponse(res);
  return data.data as { accessToken: string };
}

export async function login(emailOrUsername: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ emailOrUsername, password }),
  });
  const data = await parseResponse(res);
  return data.data as { accessToken: string; user: { id: string; username: string } };
}

export async function register(username: string, email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });
  await parseResponse(res);
  return login(email, password);
}

export async function fetchMe() {
  const res = await fetch(`${API_URL}/users/me`, { headers: authHeaders() });
  const data = await parseResponse(res);
  return data.data as UserProfile;
}

export async function updateProfile(payload: { fullName?: string }) {
  const res = await fetch(`${API_URL}/users/me`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseResponse(res);
  return data.data as UserProfile;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const res = await fetch(`${API_URL}/users/me/change-password`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok && res.status !== 204) await parseResponse(res);
}

export async function fetchPublicProfile(username: string) {
  const res = await fetch(`${API_URL}/users/${encodeURIComponent(username)}`);
  const data = await parseResponse(res);
  return data.data as PublicUserProfile;
}

export async function logout() {
  const res = await fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
  });
  if (!res.ok && res.status !== 204) await parseResponse(res);
}

export async function getSubmission(id: string) {
  const res = await fetch(`${API_URL}/submissions/${id}`, { headers: authHeaders() });
  const data = await parseResponse(res);
  return data.data as {
    status: string;
    verdict: string | null;
    compileError?: string;
    execMs?: number;
    memKb?: number;
    failedCaseIndex?: number;
    passedTestCases?: number;
    totalTestCases?: number;
    failedTestCase?: {
      input: string;
      expectedOutput: string;
      actualOutput?: string;
    };
    score?: number;
  };
}

export async function submitCode(payload: {
  problemSlug: string;
  language: string;
  source: string;
  contestId?: string;
}) {
  const res = await fetch(`${API_URL}/submissions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseResponse(res);
  return data.data as { submissionId: string; status: string };
}

export async function createProblem(payload: {
  title: string;
  statement: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimitMs?: number;
  memoryLimitMb?: number;
  allowedLanguages?: string[];
  isPractice?: boolean;
  tags?: string[];
}) {
  const res = await fetch(`${API_URL}/problems`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseResponse(res);
  return data.data as ProblemAdmin;
}

export async function updateProblem(slug: string, payload: Partial<{
  title: string;
  statement: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimitMs: number;
  memoryLimitMb: number;
  allowedLanguages: string[];
  isPractice: boolean;
  tags: string[];
}>) {
  const res = await fetch(`${API_URL}/problems/${slug}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseResponse(res);
  return data.data as ProblemAdmin;
}

export async function deleteProblem(slug: string) {
  const res = await fetch(`${API_URL}/problems/${slug}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok && res.status !== 204) await parseResponse(res);
}

export async function fetchTestCases(slug: string) {
  const res = await fetch(`${API_URL}/problems/${slug}/testcases`, { headers: authHeaders() });
  const data = await parseResponse(res);
  return data.data as TestCaseItem[];
}

export async function createTestCase(
  slug: string,
  payload: { input: string; expectedOutput: string; isSample?: boolean; points?: number; order?: number },
) {
  const res = await fetch(`${API_URL}/problems/${slug}/testcases`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseResponse(res);
  return data.data as TestCaseItem;
}

export async function updateTestCase(
  slug: string,
  id: string,
  payload: Partial<{ input: string; expectedOutput: string; isSample: boolean; points: number; order: number }>,
) {
  const res = await fetch(`${API_URL}/problems/${slug}/testcases/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseResponse(res);
  return data.data as TestCaseItem;
}

export async function deleteTestCase(slug: string, id: string) {
  const res = await fetch(`${API_URL}/problems/${slug}/testcases/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok && res.status !== 204) await parseResponse(res);
}

export type VerdictUpdate = {
  submissionId: string;
  status: string;
  verdict: string | null;
  score?: number;
  execMs?: number;
  memKb?: number;
  failedCaseIndex?: number;
  passedTestCases?: number;
  totalTestCases?: number;
  failedTestCase?: {
    input: string;
    expectedOutput: string;
    actualOutput?: string;
  };
};

export function streamVerdict(
  submissionId: string,
  onUpdate: (update: VerdictUpdate) => void,
  onError?: (err: Error) => void,
): () => void {
  const controller = new AbortController();
  const token = getAccessToken();

  (async () => {
    try {
      const res = await fetch(`${API_URL}/submissions/${submissionId}/stream`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error('Failed to connect to verdict stream');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            onUpdate(JSON.parse(line.slice(6)));
          } catch {
            // ignore malformed chunks
          }
        }
      }
    } catch (err) {
      if (!controller.signal.aborted && onError) {
        onError(err instanceof Error ? err : new Error('Stream failed'));
      }
    }
  })();

  return () => controller.abort();
}
