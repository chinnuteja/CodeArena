import { AzureOpenAI } from 'openai';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/AppError.js';
import { getProblem } from '../problem/problem.service.js';
import type { z } from 'zod';
import { AiAction } from './ai.schema.js';

type AiActionType = z.infer<typeof AiAction>;

let client: AzureOpenAI | null = null;

function getClient(): AzureOpenAI {
  if (!env.AZURE_OPENAI_ENDPOINT || !env.AZURE_OPENAI_API_KEY) {
    throw new AppError('AI_NOT_CONFIGURED', 503, 'AI assistant is not configured on this server');
  }
  if (!client) {
    client = new AzureOpenAI({
      apiVersion: env.AZURE_OPENAI_API_VERSION,
      endpoint: env.AZURE_OPENAI_ENDPOINT,
      apiKey: env.AZURE_OPENAI_API_KEY,
    });
  }
  return client;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function languageLabel(language: string): string {
  if (language === 'cpp') return 'C++';
  if (language === 'python') return 'Python';
  return language.charAt(0).toUpperCase() + language.slice(1);
}

function buildSystemPrompt(action: AiActionType): string {
  const base =
    'You are an expert competitive programming tutor embedded in an online judge. ' +
    'Be concise, accurate, and educational. Use markdown for structure when helpful. ' +
    'For code blocks, use fenced ``` blocks with the correct language tag.';

  switch (action) {
    case 'rate':
      return (
        base +
        ' Rate the user\'s code quality for the given problem on a scale of 1-10. ' +
        'Cover: correctness likelihood, readability, naming, edge cases, and style. ' +
        'End with a one-line overall verdict. Do not rewrite the full solution unless asked.'
      );
    case 'hints':
      return (
        base +
        ' Give progressive hints only — do NOT reveal the full solution or complete code. ' +
        'Provide 3-5 numbered hints from gentle nudge to stronger guidance. ' +
        'Mention the algorithm/data structure idea without giving implementation.'
      );
    case 'solution':
      return (
        base +
        ' Provide a complete, correct solution in the requested language only. ' +
        'Use the LeetCode-style `class Solution` pattern when appropriate. ' +
        'Include brief explanation after the code.'
      );
    case 'enhance':
      return (
        base +
        ' Suggest concrete improvements to the user\'s existing code: cleaner structure, ' +
        'better naming, minor optimizations, and bug fixes if any. ' +
        'Show an improved version in a code block, then explain what changed.'
      );
    case 'time_complexity':
      return (
        base +
        ' Analyze the time complexity of the user\'s code. State Big-O notation, ' +
        'explain the reasoning step by step, and note best/average/worst if they differ.'
      );
    case 'space_complexity':
      return (
        base +
        ' Analyze the space complexity of the user\'s code. State Big-O notation, ' +
        'account for auxiliary space vs total space, and explain clearly.'
      );
    default:
      return base;
  }
}

function buildUserPrompt(input: {
  action: AiActionType;
  language: string;
  source: string;
  problemTitle: string;
  problemStatement: string;
  difficulty?: string;
  executionContext?: {
    hasRun?: boolean;
    hasSubmit?: boolean;
    runStatuses?: string[];
    submitVerdict?: string | null;
    passedTestCases?: number;
    totalTestCases?: number;
  };
}): string {
  const lang = languageLabel(input.language);
  const lines: string[] = [
    `Problem: ${input.problemTitle}`,
    `Difficulty: ${input.difficulty ?? 'unknown'}`,
    '',
    'Problem statement:',
    input.problemStatement,
    '',
    `Language: ${lang}`,
    '',
    'User code:',
    '```',
    input.source,
    '```',
  ];

  const ctx = input.executionContext;
  if (ctx?.hasRun || ctx?.hasSubmit) {
    lines.push('', 'Execution context:');
    if (ctx.hasRun && ctx.runStatuses?.length) {
      lines.push(`- Custom run results: ${ctx.runStatuses.join(', ')}`);
    }
    if (ctx.hasSubmit) {
      lines.push(`- Submit verdict: ${ctx.submitVerdict ?? 'pending'}`);
      if (ctx.totalTestCases != null) {
        lines.push(`- Test cases passed: ${ctx.passedTestCases ?? 0} / ${ctx.totalTestCases}`);
      }
    }
  }

  if (input.action === 'solution') {
    lines.push('', `Write the full solution in ${lang} using class Solution style where applicable.`);
  }

  return lines.join('\n');
}

export async function assistWithAi(input: {
  problemSlug: string;
  language: string;
  source: string;
  action: AiActionType;
  executionContext?: {
    hasRun?: boolean;
    hasSubmit?: boolean;
    runStatuses?: string[];
    submitVerdict?: string | null;
    passedTestCases?: number;
    totalTestCases?: number;
  };
}): Promise<{ content: string; action: AiActionType }> {
  const problem = await getProblem(input.problemSlug);
  const openai = getClient();

  const systemPrompt = buildSystemPrompt(input.action);
  const userPrompt = buildUserPrompt({
    action: input.action,
    language: input.language,
    source: input.source,
    problemTitle: problem.title,
    problemStatement: stripHtml(problem.statement ?? ''),
    difficulty: problem.difficulty,
    executionContext: input.executionContext,
  });

  try {
    const response = await openai.chat.completions.create({
      model: env.AZURE_OPENAI_DEPLOYMENT,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_completion_tokens: env.AI_MAX_COMPLETION_TOKENS,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new AppError('AI_EMPTY_RESPONSE', 502, 'AI returned an empty response');
    }

    return { content, action: input.action };
  } catch (err) {
    if (err instanceof AppError) throw err;
    const message = err instanceof Error ? err.message : 'AI request failed';
    throw new AppError('AI_REQUEST_FAILED', 502, message);
  }
}

export function isAiConfigured(): boolean {
  return Boolean(env.AZURE_OPENAI_ENDPOINT && env.AZURE_OPENAI_API_KEY);
}
