import { Request, Response } from 'express';
import * as testCaseService from './testcase.service.js';

export const listTestCases = async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  const data = await testCaseService.listTestCases(slug);
  res.status(200).json({ data });
};

export const createTestCase = async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  const data = await testCaseService.createTestCase(slug, req.body);
  res.status(201).json({ data });
};

export const updateTestCase = async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  const id = req.params.id as string;
  const data = await testCaseService.updateTestCase(slug, id, req.body);
  res.status(200).json({ data });
};

export const deleteTestCase = async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  const id = req.params.id as string;
  await testCaseService.deleteTestCase(slug, id);
  res.status(204).send();
};

export const bulkCreate = async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  const data = await testCaseService.bulkCreate(slug, req.body);
  res.status(201).json({ data });
};
