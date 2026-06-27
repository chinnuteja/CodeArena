import { Request, Response } from 'express';
import * as submissionService from './submission.service.js';

export const createSubmission = async (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
  const data = await submissionService.createSubmission({
    userId: req.user!.id,
    ...req.body,
    meta: {
      ip,
    }
  });
  res.status(202).json({ data: { submissionId: data.id, status: data.status } });
};

export const getSubmission = async (req: Request, res: Response) => {
  const data = await submissionService.getSubmissionForUser(req.params.id as string, req.user);
  res.status(200).json({ data });
};

export const listSubmissions = async (req: Request, res: Response) => {
  const data = await submissionService.listUserSubmissions(req.user!.id, req.query as any);
  res.status(200).json(data);
};
