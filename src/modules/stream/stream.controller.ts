import { Request, Response } from 'express';
import { subClient } from '../../db/redis.js';
import { env } from '../../config/env.js';
import { REDIS_KEYS } from '../../config/constants.js';
import { getSubmissionForUser } from '../submission/submission.service.js';

export const subscribeToVerdict = async (req: Request, res: Response) => {
  const submissionId = req.params.id as string;
  try {
    // Throws if user does not own submission or submission doesn't exist
    await getSubmissionForUser(submissionId, req.user);
  } catch (err) {
    res.status(403).json({ error: 'Access denied or submission not found' });
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

  const targetChannel = REDIS_KEYS.sseVerdict(submissionId);

  const messageHandler = (channel: string, message: string) => {
    if (channel === targetChannel) {
      try {
        const payload = JSON.parse(message);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        
        // If done or error, we can optionally close the stream
        if (payload.status === 'DONE' || payload.status === 'SYSTEM_ERROR') {
            // we'll let the client close it to avoid missing any late events
        }
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
