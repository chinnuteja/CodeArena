import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { app } from '../../app.js';
import { User } from '../user/user.model.js';
import { Problem } from '../problem/problem.model.js';
import { Submission } from './submission.model.js';
import { redisClient, queueConnection } from '../../db/redis.js';
import { storage } from '../../lib/storage/index.js';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  await redisClient.quit();
  await queueConnection.quit();
});

describe('Phase 7: Submission Intake & Queue', () => {
  let userToken: string;
  let problemSlug: string;

  it('Setup user and problem', async () => {
    await request(app).post('/auth/register').send({
      username: 'submitter',
      email: 'submit@test.com',
      password: 'password123',
    });
    
    await User.updateOne({ username: 'submitter' }, { role: 'setter' });

    const loginRes = await request(app).post('/auth/login').send({
      emailOrUsername: 'submitter',
      password: 'password123',
    });
    userToken = loginRes.body.data.accessToken;

    const probRes = await request(app)
      .post('/problems')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Two Sum',
        statement: 'Solve two sum.',
        difficulty: 'easy',
        allowedLanguages: ['cpp', 'python'],
      });
    if (!probRes.body.data) console.log('ERROR PROB:', probRes.body);
    problemSlug = probRes.body.data.slug;
  });

  it('Rejects unknown problem', async () => {
    const res = await request(app)
      .post('/submissions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        problemSlug: 'does-not-exist',
        language: 'cpp',
        source: 'int main() {}',
      });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PROBLEM_NOT_FOUND');
  });

  it('Rejects disallowed language', async () => {
    const res = await request(app)
      .post('/submissions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        problemSlug,
        language: 'java',
        source: 'class Main {}',
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('LANGUAGE_NOT_ALLOWED');
  });

  it('Accepts valid submission and enqueues job', async () => {
    const sourceCode = 'print("Hello World")';
    const res = await request(app)
      .post('/submissions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        problemSlug,
        language: 'python',
        source: sourceCode,
      });

    expect(res.status).toBe(202);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data).toHaveProperty('submissionId');

    const submissionId = res.body.data.submissionId;

    const dbSub = await Submission.findById(submissionId).lean();
    expect(dbSub).toBeDefined();
    expect(dbSub!.status).toBe('PENDING');
    expect(dbSub!.verdict).toBeNull();
    expect(dbSub).toHaveProperty('sourceRef');
    expect(dbSub).not.toHaveProperty('source');

    const storedSource = await storage.getObject(dbSub!.sourceRef);
    expect(storedSource).toBe(sourceCode);
  });
});
