import { Request, Response } from 'express';
import * as aiService from './ai.service.js';

export const assist = async (req: Request, res: Response) => {
  const { problemSlug, language, source, action, executionContext } = req.body;
  const result = await aiService.assistWithAi({
    problemSlug,
    language,
    source,
    action,
    executionContext,
  });
  res.status(200).json({ data: result });
};

export const status = async (_req: Request, res: Response) => {
  res.status(200).json({ data: { enabled: aiService.isAiConfigured() } });
};
