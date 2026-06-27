import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { Submission } from '../submission/submission.model.js';
import { Problem } from '../problem/problem.model.js';
import { User } from '../user/user.model.js';
import { Verdict, SubmissionStatus, Language } from '../../config/constants.js';
import { judgeSubmission } from './judge.service.js';
import { engine } from '../../lib/execution/index.js';
import { storage } from '../../lib/storage/index.js';
import crypto from 'crypto';

vi.mock('../../lib/execution/index.js', () => ({
  engine: {
    compile: vi.fn(),
    run: vi.fn(),
  },
}));

let userToken: string;
let problemId: string;
let userId: string;

describe('Phase 8: Judge Worker', () => {
  beforeAll(async () => {
    vi.resetAllMocks();

    const username = 'judge-tester-' + crypto.randomUUID().slice(0, 5);
    const email = username + '@test.com';

    await request(app).post('/auth/register').send({
      username,
      email,
      password: 'password123',
    });
    
    await User.updateOne({ username }, { role: 'setter' });

    const loginRes = await request(app).post('/auth/login').send({
      emailOrUsername: username,
      password: 'password123',
    });
    userToken = loginRes.body.data.accessToken;
    userId = loginRes.body.data.user.id;

    const probRes = await request(app)
      .post('/problems')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Return 42',
        statement: 'Print 42',
        difficulty: 'easy',
        allowedLanguages: ['cpp', 'python'],
      });
    problemId = probRes.body.data.id;

    await request(app)
      .post(`/problems/${problemId}/testcases`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        input: '1',
        expectedOutput: '42',
        isHidden: false,
        scoreWeight: 100,
      });
  });

  it('Executes judging logic and updates status to AC', async () => {
    const sub = await Submission.create({
      userId,
      problemId,
      language: Language.Python,
      sourceRef: 'ac-ref.txt',
    });
    await storage.putObject('ac-ref.txt', 'print(42)');

    (engine.compile as any).mockResolvedValue({ ok: true, artifactPath: 'main' });
    (engine.run as any).mockResolvedValue({
      stdout: '42',
      exitCode: 0,
      timedOut: false,
      oomKilled: false,
      durationMs: 10,
      memKb: 1024,
    });

    await judgeSubmission(sub.id);

    const updated = await Submission.findById(sub.id);
    expect(updated?.status).toBe(SubmissionStatus.Done);
    expect(updated?.verdict).toBe(Verdict.AC);
    expect(updated?.score).toBe(100);
  }, 10000);

  it('Handles WA (Wrong Answer)', async () => {
    const sub = await Submission.create({
      userId,
      problemId,
      language: Language.Python,
      sourceRef: 'wa-ref.txt',
    });
    await storage.putObject('wa-ref.txt', 'print(43)');

    (engine.compile as any).mockResolvedValue({ ok: true, artifactPath: 'main' });
    (engine.run as any).mockResolvedValue({
      stdout: '43',
      exitCode: 0,
      timedOut: false,
      oomKilled: false,
      durationMs: 10,
      memKb: 1024,
    });

    await judgeSubmission(sub.id);

    const updated = await Submission.findById(sub.id);
    expect(updated?.status).toBe(SubmissionStatus.Done);
    expect(updated?.verdict).toBe(Verdict.WA);
    expect(updated?.score).toBe(0);
  }, 10000);
});
