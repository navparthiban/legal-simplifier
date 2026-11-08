import { Router, type Request, type Response } from 'express';
import { chatCompletion, chatCompletionStream } from '../services/llm.js';
import {
  buildPreQuizMessages,
  buildQuizMessages,
  buildSummaryMessages,
  parsePreQuizJSON,
  parseQuizJSON,
  type Language,
  type SummaryData,
} from '../services/openrouter.js';

export const api = Router();

function normLanguage(v: unknown): Language {
  return v === 'es' ? 'es' : 'en';
}

/** A non-empty string, or a non-empty array of non-empty strings (scanned-PDF pages). */
function validContent(c: unknown): c is string | string[] {
  if (typeof c === 'string') return c.length > 0;
  return Array.isArray(c) && c.length > 0 && c.every((x) => typeof x === 'string' && x.length > 0);
}

function fail(res: Response, err: unknown) {
  const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  res.status(502).json({ error: message });
}

/** POST /api/prequiz — quiz generated from the raw contract text/image. */
api.post('/prequiz', async (req: Request, res: Response) => {
  const { content, isImage, language } = req.body ?? {};
  if (!validContent(content)) {
    return res.status(400).json({ error: 'Missing contract content.' });
  }
  try {
    const raw = await chatCompletion(
      buildPreQuizMessages(content, Boolean(isImage), normLanguage(language)),
      { chain: 'fast', isImage: Boolean(isImage), label: 'prequiz' },
    );
    res.json({ questions: parsePreQuizJSON(raw) });
  } catch (err) {
    fail(res, err);
  }
});

/** POST /api/quiz — quiz generated from the generated summary. */
api.post('/quiz', async (req: Request, res: Response) => {
  const { summaryData, language } = req.body ?? {};
  if (!summaryData || typeof summaryData !== 'object') {
    return res.status(400).json({ error: 'Missing summary data.' });
  }
  try {
    const raw = await chatCompletion(
      buildQuizMessages(summaryData as SummaryData, normLanguage(language)),
      { chain: 'quality', isImage: false, label: 'quiz' },
    );
    res.json({ questions: parseQuizJSON(raw) });
  } catch (err) {
    fail(res, err);
  }
});

/**
 * POST /api/summary — streams the upstream SSE response straight through to the
 * client, unchanged. The model chain commits to a model only once it has sent
 * its first text, so a total failure still returns a normal JSON error here
 * (headers are not sent until then). The frontend parses the same
 * `data: {json}` / `[DONE]` format the old `callOpenRouterStream` did.
 */
api.post('/summary', async (req: Request, res: Response) => {
  const { content, isImage, language } = req.body ?? {};
  if (!validContent(content)) {
    return res.status(400).json({ error: 'Missing contract content.' });
  }
  try {
    const stream = await chatCompletionStream(
      buildSummaryMessages(content, Boolean(isImage), normLanguage(language)),
      { chain: 'quality', isImage: Boolean(isImage), label: 'summary' },
    );

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    stream.on('error', () => res.end());
    req.on('close', () => stream.destroy());
    stream.pipe(res);
  } catch (err) {
    fail(res, err);
  }
});
