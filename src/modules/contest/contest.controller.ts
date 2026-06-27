import { Request, Response } from 'express';
import * as contestService from './contest.service.js';
import { AppError } from '../../lib/AppError.js';
import { Contest } from './contest.model.js';

export const createContest = async (req: Request, res: Response) => {
  const contest = await contestService.createContest(req.body, req.user!.id);
  res.status(201).json({ contest });
};

export const updateContest = async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  const contest = await contestService.updateContest(slug, req.body);
  res.json({ contest });
};

export const listContests = async (req: Request, res: Response) => {
  const { kind, status, page, limit } = req.query;
  // If not authenticated or not admin/setter, don't allow listing Friendly contests
  let queryKind = kind as string | undefined;
  if (queryKind === 'friendly' && (!req.user || req.user.role === 'participant')) {
    queryKind = 'global'; // Fallback or reject, we'll just restrict to global
  }

  // Public listings usually only show global
  if (!queryKind) {
    queryKind = 'global';
  }

  const result = await contestService.listContests({
    kind: queryKind as any,
    status: status as any,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  res.json(result);
};

export const getContest = async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  const contest = await contestService.getContest(slug, req.user as any);
  res.json({ contest });
};

export const registerForGlobal = async (req: Request, res: Response) => {
  const { slug } = req.params;
  const contest = await Contest.findOne({ slug });
  if (!contest) throw new AppError('CONTEST_NOT_FOUND', 404, 'Contest not found');

  const participant = await contestService.registerForGlobal(contest._id.toString(), req.user!.id);
  res.status(201).json({ participant });
};

export const createInvite = async (req: Request, res: Response) => {
  const { slug } = req.params;
  const contest = await Contest.findOne({ slug });
  if (!contest) throw new AppError('CONTEST_NOT_FOUND', 404, 'Contest not found');

  const token = await contestService.createInvite(contest._id.toString(), req.user!.id, req.body);
  res.status(201).json({ token });
};

export const acceptInvite = async (req: Request, res: Response) => {
  const { token } = req.body;
  const contest = await contestService.acceptInvite(token, req.user!.id);
  res.json({ message: 'Successfully joined friendly contest', contest });
};

export const getMyRegistration = async (req: Request, res: Response) => {
  const { slug } = req.params;
  const contest = await Contest.findOne({ slug });
  if (!contest) throw new AppError('CONTEST_NOT_FOUND', 404, 'Contest not found');

  const isRegistered = await contestService.isRegistered(contest._id.toString(), req.user!.id);
  res.json({ isRegistered });
};
