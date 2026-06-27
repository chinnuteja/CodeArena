import express from 'express';
import { env } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { notFoundHandler } from './middleware/notFound.middleware.js';

export const app = express();

if (env.TRUST_PROXY) {
  app.set('trust proxy', 1);
}

if (env.CORS_ORIGIN) {
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });
}

app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.get('/health', (req, res) => {
  res.status(200).json({
    data: {
      status: 'ok',
      uptime: process.uptime(),
      ts: Date.now(),
    },
  });
});

import { authRouter } from './modules/auth/auth.routes.js';
import { userRouter } from './modules/user/user.routes.js';
import { problemRouter } from './modules/problem/problem.routes.js';
import { testcaseRouter } from './modules/testcase/testcase.routes.js';
import { submissionRouter } from './modules/submission/submission.routes.js';
import { contestRouter } from './modules/contest/contest.routes.js';

// Feature routers will be added here
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Online Judge API is running. Welcome!',
  });
});

app.use('/auth', authRouter);
app.use('/users', userRouter);
app.use('/problems', problemRouter);
app.use('/problems/:slug/testcases', testcaseRouter);
app.use('/submissions', submissionRouter);
app.use('/contests', contestRouter);

app.use(notFoundHandler);
app.use(errorHandler);
