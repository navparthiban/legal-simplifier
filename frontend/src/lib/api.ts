/**
 * Fetch wrappers that talk to the ClearSign backend (never OpenRouter directly).
 *
 * `streamSummary` reproduces the SSE read loop from index.html's
 * `callOpenRouterStream` exactly — the backend passes the OpenRouter stream
 * straight through, so the `data:` / `[DONE]` / `delta.content` parsing is
 * unchanged. Because the request needs a POST body, this uses fetch +
 * response.body (a ReadableStream), not EventSource.
 */
import type { Language } from '../i18n/translations';
import type { Question, SummaryData } from './types';

async function errorFromResponse(res: Response): Promise<Error> {
  const err = await res.json().catch(() => ({}) as any);
  const msg =
    (typeof err?.error === 'string' && err.error) ||
    err?.error?.message ||
    `API error (${res.status}). Please try again.`;
  return new Error(msg);
}

interface ContractInput {
  content: string;
  isImage: boolean;
  language: Language;
}

export async function fetchPreQuiz(input: ContractInput): Promise<Question[]> {
  const res = await fetch('/api/prequiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await errorFromResponse(res);
  const data = await res.json();
  return data.questions;
}

export async function fetchQuiz(
  summaryData: SummaryData,
  language: Language,
): Promise<Question[]> {
  const res = await fetch('/api/quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ summaryData, language }),
  });
  if (!res.ok) throw await errorFromResponse(res);
  const data = await res.json();
  return data.questions;
}

/** Streams the summary; fires onChunk(accumulatedText) per token. Returns the
 *  full accumulated text. Ported from `callOpenRouterStream`. */
export async function streamSummary(
  input: ContractInput,
  onChunk: (accumulated: string) => void,
): Promise<string> {
  const res = await fetch('/api/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) throw await errorFromResponse(res);
  if (!res.body) throw new Error('The AI returned an unexpected response. Please try again.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sseBuf = '',
    accumulated = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sseBuf += decoder.decode(value, { stream: true });
    const lines = sseBuf.split('\n');
    sseBuf = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return accumulated;
      try {
        const evt = JSON.parse(payload);
        const delta = evt?.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          accumulated += delta;
          onChunk(accumulated);
        }
      } catch {
        /* ignore keep-alive / partial frames */
      }
    }
  }
  return accumulated;
}
