import { Request, Response } from 'express';
import { AppError } from '../../lib/AppError.js';
import * as leaderboardService from './leaderboard.service.js';
import { Contest } from '../contest/contest.model.js';
import { isLive, isRegistered } from '../contest/contest.service.js';
import { env } from '../../config/env.js';
import { subClient } from '../../db/redis.js';
import { REDIS_KEYS } from '../../config/constants.js';

export const getLeaderboard = async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  const { page, limit } = req.query as any;

  const contest = await Contest.findOne({ slug });
  if (!contest) throw new AppError('CONTEST_NOT_FOUND', 404, 'Contest not found');

  const result = await leaderboardService.getLeaderboard(contest._id.toString(), page, limit);
  res.json(result);
};

export const getMyRank = async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  const contest = await Contest.findOne({ slug });
  if (!contest) throw new AppError('CONTEST_NOT_FOUND', 404, 'Contest not found');

  const result = await leaderboardService.getMyRank(contest._id.toString(), req.user!.id);
  res.json(result);
};

export const subscribeToLeaderboard = async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  const contest = await Contest.findOne({ slug });
  
  if (!contest) {
    res.status(404).json({ error: 'Contest not found' });
    return;
  }

  // Authorize participant / creator / admin
  const isCreator = contest.createdBy.toString() === req.user!.id;
  const isAdmin = req.user!.role === 'admin';
  const participant = await isRegistered(contest._id.toString(), req.user!.id);

  if (!isCreator && !isAdmin && !participant) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(': heartbeat\n\n');
  const heartbeatInterval = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, env.SSE_HEARTBEAT_MS || 15000);

  const targetChannel = REDIS_KEYS.sseLeaderboard(contest._id.toString());

  const messageHandler = (channel: string, message: string) => {
    if (channel === targetChannel) {
      try {
        const payload = JSON.parse(message);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (e) {
        console.error('Failed to parse SSE message', e);
      }
    }
  };

  subClient.subscribe(targetChannel);
  subClient.on('message', messageHandler);

  req.on('close', () => {
    clearInterval(heartbeatInterval);
    subClient.off('message', messageHandler);
    subClient.unsubscribe(targetChannel);
    res.end();
  });
};

export const rebuildLeaderboard = async (req: Request, res: Response) => {
  const { slug } = req.params;
  const contest = await Contest.findOne({ slug });
  if (!contest) throw new AppError('CONTEST_NOT_FOUND', 404, 'Contest not found');

  const result = await leaderboardService.rebuildLeaderboard(contest._id.toString());
  res.json({ message: 'Leaderboard rebuilt', ...result });
};
