import { Router, type Request, type Response } from 'express';
import { Readable } from 'node:stream';
import {
  buildPreQuizMessages,
  buildQuizMessages,
  buildSummaryMessages,
  chatCompletion,
  chatCompletionStream,
  parsePreQuizJSON,
  parseQuizJSON,
  type Language,
  type SummaryData,
} from '../services/openrouter.js';

export const api = Router();

function normLanguage(v: unknown): Language {
  return v === 'es' ? 'es' : 'en';
}

function fail(res: Response, err: unknown) {
  const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  res.status(502).json({ error: message });
}

/** POST /api/prequiz — quiz generated from the raw contract text/image. */
api.post('/prequiz', async (req: Request, res: Response) => {
  const { content, isImage, language } = req.body ?? {};
  if (typeof content !== 'string' || !content) {
    return res.status(400).json({ error: 'Missing contract content.' });
  }
  try {
    const raw = await chatCompletion(
      buildPreQuizMessages(content, Boolean(isImage), normLanguage(language)),
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
    );
    res.json({ questions: parseQuizJSON(raw) });
  } catch (err) {
    fail(res, err);
  }
});

/**
 * POST /api/summary — streams the OpenRouter SSE response straight through to the
 * client, unchanged. The frontend parses the same `data: {json}` / `[DONE]`
 * format the old `callOpenRouterStream` did.
 */
api.post('/summary', async (req: Request, res: Response) => {
  const { content, isImage, language } = req.body ?? {};
  if (typeof content !== 'string' || !content) {
    return res.status(400).json({ error: 'Missing contract content.' });
  }
  try {
    const upstream = await chatCompletionStream(
      buildSummaryMessages(content, Boolean(isImage), normLanguage(language)),
    );

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    if (!upstream.body) {
      res.end();
      return;
    }

    const nodeStream = Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream);
    nodeStream.on('error', () => res.end());
    req.on('close', () => nodeStream.destroy());
    nodeStream.pipe(res);
  } catch (err) {
    // Headers not sent yet on this path — safe to send JSON.
    fail(res, err);
  }
});
