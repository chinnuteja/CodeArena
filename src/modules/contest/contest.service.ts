import { Types } from 'mongoose';
import crypto from 'crypto';
import { AppError } from '../../lib/AppError.js';
import { Contest, IContest } from './contest.model.js';
import { ContestParticipant } from './participant.model.js';
import { ContestInvite } from './invite.model.js';
import { ContestKind } from '../../config/constants.js';
import { env } from '../../config/env.js';
import { AuthUser } from '../../middleware/auth.middleware.js';

export const isLive = (contest: IContest): boolean => {
  const now = new Date();
  return now >= contest.startAt && now < contest.endAt;
};

export const createContest = async (input: Partial<IContest>, creatorId: string | Types.ObjectId) => {
  if (input.startAt && input.endAt && input.startAt >= input.endAt) {
    throw new AppError('VALIDATION_ERROR', 400, 'endAt must be after startAt');
  }

  if (input.problemIds && input.problemIds.length > env.CONTEST_MAX_PROBLEMS) {
    throw new AppError('VALIDATION_ERROR', 400, `Cannot exceed ${env.CONTEST_MAX_PROBLEMS} problems`);
  }

  try {
    const contest = await Contest.create({
      ...input,
      createdBy: creatorId,
    });
    return contest;
  } catch (err: any) {
    if (err.code === 11000) {
      throw new AppError('SLUG_TAKEN', 409, 'Contest slug is already taken');
    }
    throw err;
  }
};

export const updateContest = async (slug: string, patch: Partial<IContest>) => {
  const contest = await Contest.findOne({ slug });
  if (!contest) {
    throw new AppError('CONTEST_NOT_FOUND', 404, 'Contest not found');
  }

  const hasStarted = new Date() >= contest.startAt;

  if (hasStarted) {
    if (patch.startAt || patch.problemIds || patch.scoringMode) {
      throw new AppError(
        'CONTEST_ALREADY_STARTED',
        400,
        'Cannot change startAt, problemIds, or scoringMode after contest has started'
      );
    }
  }

  if (patch.startAt && patch.endAt && patch.startAt >= patch.endAt) {
    throw new AppError('VALIDATION_ERROR', 400, 'endAt must be after startAt');
  } else if (patch.startAt && patch.startAt >= contest.endAt) {
    throw new AppError('VALIDATION_ERROR', 400, 'startAt must be before existing endAt');
  } else if (patch.endAt && contest.startAt >= patch.endAt) {
    throw new AppError('VALIDATION_ERROR', 400, 'endAt must be after existing startAt');
  }

  if (patch.problemIds && patch.problemIds.length > env.CONTEST_MAX_PROBLEMS) {
    throw new AppError('VALIDATION_ERROR', 400, `Cannot exceed ${env.CONTEST_MAX_PROBLEMS} problems`);
  }

  Object.assign(contest, patch);

  try {
    await contest.save();
    return contest;
  } catch (err: any) {
    if (err.code === 11000) {
      throw new AppError('SLUG_TAKEN', 409, 'Contest slug is already taken');
    }
    throw err;
  }
};

export const listContests = async ({
  kind,
  status,
  page = 1,
  limit = 20,
}: {
  kind?: ContestKind;
  status?: 'upcoming' | 'live' | 'ended';
  page?: number;
  limit?: number;
}) => {
  const query: any = {};
  
  if (kind) {
    query.kind = kind;
  }

  const now = new Date();
  if (status === 'upcoming') {
    query.startAt = { $gt: now };
  } else if (status === 'live') {
    query.startAt = { $lte: now };
    query.endAt = { $gt: now };
  } else if (status === 'ended') {
    query.endAt = { $lte: now };
  }

  const total = await Contest.countDocuments(query);
  const contests = await Contest.find(query)
    .sort({ startAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('createdBy', 'username');

  return { contests, meta: { total, page, limit } };
};

export const getContest = async (slug: string, requestingUser?: AuthUser) => {
  const contest = await Contest.findOne({ slug }).populate('problemIds', 'title slug difficulty');
  if (!contest) {
    throw new AppError('CONTEST_NOT_FOUND', 404, 'Contest not found');
  }

  if (contest.kind === ContestKind.Friendly) {
    if (!requestingUser) {
      throw new AppError('CONTEST_NOT_FOUND', 404, 'Contest not found'); // Hide existence
    }
    
    // Check if creator or admin
    const isCreator = contest.createdBy.toString() === requestingUser.id;
    const isAdmin = requestingUser.role === 'admin';
    
    if (!isCreator && !isAdmin) {
      // Check if participant
      const isParticipant = await isRegistered(contest._id.toString(), requestingUser.id);
      if (!isParticipant) {
        throw new AppError('CONTEST_NOT_FOUND', 404, 'Contest not found'); // Hide existence
      }
    }
  }

  return contest;
};

export const isRegistered = async (contestId: string, userId: string): Promise<boolean> => {
  const participant = await ContestParticipant.findOne({ contestId, userId });
  return !!participant;
};

export const registerForGlobal = async (contestId: string, userId: string) => {
  const contest = await Contest.findById(contestId);
  if (!contest) throw new AppError('CONTEST_NOT_FOUND', 404, 'Contest not found');
  
  if (contest.kind !== ContestKind.Global) {
    throw new AppError('VALIDATION_ERROR', 400, 'Cannot openly register for a non-global contest');
  }

  const now = new Date();
  if (now >= contest.endAt) {
    throw new AppError('VALIDATION_ERROR', 400, 'Contest has already ended');
  }

  try {
    const participant = await ContestParticipant.create({ contestId, userId });
    return participant;
  } catch (err: any) {
    if (err.code === 11000) {
      throw new AppError('ALREADY_REGISTERED', 409, 'User is already registered for this contest');
    }
    throw err;
  }
};

export const createInvite = async (
  contestId: string,
  creatorId: string,
  opts?: { maxUses?: number; expiresAt?: Date }
) => {
  const contest = await Contest.findById(contestId);
  if (!contest) throw new AppError('CONTEST_NOT_FOUND', 404, 'Contest not found');

  if (contest.kind !== ContestKind.Friendly) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invites can only be created for friendly contests');
  }

  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await ContestInvite.create({
    contestId,
    tokenHash,
    createdBy: creatorId,
    maxUses: opts?.maxUses,
    expiresAt: opts?.expiresAt,
  });

  return rawToken;
};

export const acceptInvite = async (rawToken: string, userId: string) => {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const invite = await ContestInvite.findOne({ tokenHash });
  if (!invite) {
    throw new AppError('INVITE_INVALID', 400, 'Invalid invite token');
  }

  if (new Date() > invite.expiresAt) {
    throw new AppError('INVITE_EXPIRED', 400, 'Invite token has expired');
  }

  if (invite.maxUses !== null && invite.maxUses !== undefined && invite.uses >= invite.maxUses) {
    throw new AppError('INVITE_EXPIRED', 400, 'Invite token usage limit reached');
  }

  const contest = await Contest.findById(invite.contestId);
  if (!contest) throw new AppError('CONTEST_NOT_FOUND', 404, 'Contest not found');

  // Atomically increment uses if within limits
  const updatedInvite = await ContestInvite.findOneAndUpdate(
    {
      _id: invite._id,
      $or: [{ maxUses: null }, { $expr: { $lt: ['$uses', '$maxUses'] } }],
    },
    { $inc: { uses: 1 } },
    { new: true }
  );

  if (!updatedInvite) {
    // If it failed, it means another concurrent request maxed it out
    throw new AppError('INVITE_EXPIRED', 400, 'Invite token usage limit reached concurrently');
  }

  try {
    await ContestParticipant.create({ contestId: contest._id, userId });
  } catch (err: any) {
    // 11000 = duplicate key. Treat as success (idempotent)
    if (err.code !== 11000) {
      throw err;
    }
  }

  return contest;
};
