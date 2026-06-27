import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { app } from '../app.js';
import { User } from '../modules/user/user.model.js';
import { Problem } from '../modules/problem/problem.model.js';
import { TestCase } from '../modules/testcase/testcase.model.js';
import { redisClient } from '../db/redis.js';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  await redisClient.quit();
});

describe('Security & Integrity Verification', () => {
  
  let accessToken: string;
  let refreshTokenCookie: string;
  let userId: string;

  it('No token ever in Mongo & passwordHash has select: false', async () => {
    const res = await request(app).post('/auth/register').send({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(201);
    
    // Direct Mongo assertion
    const dbUser = await User.findOne({ username: 'testuser' }).lean();
    expect(dbUser).toBeDefined();
    
    // Assert no token fields
    expect(dbUser).not.toHaveProperty('token');
    expect(dbUser).not.toHaveProperty('accessToken');
    expect(dbUser).not.toHaveProperty('refreshToken');
    
    // Assert passwordHash is excluded by default lean() query
    expect(dbUser).not.toHaveProperty('passwordHash');
    
    // Explicitly requesting it should reveal it exists in DB
    const dbUserWithPass = await User.findOne({ username: 'testuser' }).select('+passwordHash').lean();
    expect(dbUserWithPass).toHaveProperty('passwordHash');
  });

  it('Refresh token lives in Redis, hashed', async () => {
    const res = await request(app).post('/auth/login').send({
      emailOrUsername: 'testuser',
      password: 'password123',
    });
    expect(res.status).toBe(200);
    
    accessToken = res.body.data.accessToken;
    userId = res.body.data.user.id;
    refreshTokenCookie = res.headers['set-cookie'][0];
    
    expect(refreshTokenCookie).toMatch(/HttpOnly/i);
    expect(refreshTokenCookie).toMatch(/SameSite=Strict/i);
    expect(refreshTokenCookie).toMatch(/Path=\/auth\/refresh/i);
    
    // Look for key in Redis
    const keys = await redisClient.keys('auth:refresh:*');
    expect(keys.length).toBe(1);
    expect(keys[0]).toContain(`auth:refresh:${userId}`);
    
    // Assert it is hashed and has TTL
    const stored = JSON.parse((await redisClient.get(keys[0]))!);
    expect(stored).toHaveProperty('tokenHash');
    expect(stored).toHaveProperty('userId', userId);
    expect(stored).not.toHaveProperty('rawToken'); // raw token NOT stored
    
    const ttl = await redisClient.ttl(keys[0]);
    expect(ttl).toBeGreaterThan(0);
  });

  it('Logout actually revokes access and refresh tokens', async () => {
    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);
      
    expect(res.status).toBe(204);
    
    // Attempt to reuse access token -> should be rejected by denylist
    const meRes = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
      
    expect(meRes.status).toBe(401);
    expect(meRes.body.error.code).toBe('TOKEN_INVALID');
    
    // Attempt to reuse refresh token -> should fail
    const refreshRes = await request(app)
      .post('/auth/refresh')
      .set('Cookie', refreshTokenCookie);
      
    expect(refreshRes.status).toBe(401);
  });

  it('Refresh rotation is single-use', async () => {
    // Login again
    const loginRes = await request(app).post('/auth/login').send({
      emailOrUsername: 'testuser',
      password: 'password123',
    });
    
    const firstRefreshCookie = loginRes.headers['set-cookie'][0];
    
    // Use it once (rotate)
    const refreshRes1 = await request(app)
      .post('/auth/refresh')
      .set('Cookie', firstRefreshCookie);
      
    expect(refreshRes1.status).toBe(200);
    const secondRefreshCookie = refreshRes1.headers['set-cookie'][0];
    
    // Try to use the first one again -> should fail and revoke session
    const refreshRes2 = await request(app)
      .post('/auth/refresh')
      .set('Cookie', firstRefreshCookie);
      
    expect(refreshRes2.status).toBe(401);
    
    // Now even the valid second one should fail (session revoked)
    const refreshRes3 = await request(app)
      .post('/auth/refresh')
      .set('Cookie', secondRefreshCookie);
      
    expect(refreshRes3.status).toBe(401);
  });

  it('Hidden test cases are never public', async () => {
    // 1. Create a setter to make a problem
    await request(app).post('/auth/register').send({
      username: 'setter', email: 'setter@test.com', password: 'password123'
    });
    
    // Manually promote to setter via DB
    await User.updateOne({ username: 'setter' }, { role: 'setter' });
    
    const setterLogin = await request(app).post('/auth/login').send({
      emailOrUsername: 'setter', password: 'password123'
    });
    const setterToken = setterLogin.body.data.accessToken;
    
    // 2. Create problem
    const probRes = await request(app)
      .post('/problems')
      .set('Authorization', `Bearer ${setterToken}`)
      .send({
        title: 'Hidden Test Prob',
        statement: 'Solve this.',
        difficulty: 'easy'
      });
      
    const slug = probRes.body.data.slug;
    
    // 3. Add Sample Test Case
    await request(app)
      .post(`/problems/${slug}/testcases`)
      .set('Authorization', `Bearer ${setterToken}`)
      .send({
        input: 'sample_in', expectedOutput: 'sample_out', isSample: true
      });
      
    // 4. Add Hidden Test Case
    await request(app)
      .post(`/problems/${slug}/testcases`)
      .set('Authorization', `Bearer ${setterToken}`)
      .send({
        input: 'hidden_in', expectedOutput: 'hidden_out', isSample: false
      });
      
    // 5. Hit Public Problem Detail GET /problems/:slug
    const publicDetailRes = await request(app).get(`/problems/${slug}`);
    expect(publicDetailRes.status).toBe(200);
    
    const returnedTestCases = publicDetailRes.body.data.sampleTestCases;
    expect(returnedTestCases.length).toBe(1);
    expect(returnedTestCases[0].input).toBe('sample_in');
    expect(returnedTestCases[0].isSample).toBe(true);
    
    // Ensure hidden test cases are truly not there
    const hiddenFound = returnedTestCases.some((tc: any) => !tc.isSample);
    expect(hiddenFound).toBe(false);
  });
});
