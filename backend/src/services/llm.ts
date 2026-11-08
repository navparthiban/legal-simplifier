/**
 * LLM client with a model fallback chain. This is the ONLY place API keys are
 * read or sent.
 *
 * Every request walks a list of models in order and moves to the next one if
 * the current one errors, times out, or returns nothing. Gemini models come
 * first (via Google's OpenAI-compatible endpoint, so the message shape and the
 * SSE stream format match OpenRouter's exactly); OpenRouter `:free` models are
 * the last resort. `openrouter/free` is intentionally never used.
 *
 * Prompts and JSON parsers live in ./openrouter.ts and are unchanged.
 */
import { Readable } from 'node:stream';
import type { ChatMessage } from './openrouter.js';

type Provider = 'gemini' | 'openrouter';

interface ModelSpec {
  provider: Provider;
  id: string;
  /** Can this model read image_url content blocks? */
  vision: boolean;
}

const gemini = (id: string): ModelSpec => ({ provider: 'gemini', id, vision: true });

const OPENROUTER_FALLBACKS: ModelSpec[] = [
  { provider: 'openrouter', id: 'nvidia/nemotron-3.5-super-vl:free', vision: true },
  { provider: 'openrouter', id: 'nvidia/nemotron-3-super-120b-a12b:free', vision: false },
  { provider: 'openrouter', id: 'dots-studio/dots-3-note-preview:free', vision: false },
];

export type ChainName = 'fast' | 'quality';

interface Chain {
  timeoutMs: number;
  models: ModelSpec[];
  /** Ask Gemini for the lowest thinking level (latency matters most). */
  lowReasoning: boolean;
}

const CHAINS: Record<ChainName, Chain> = {
  // Pre-quiz: the user is waiting.
  fast: {
    timeoutMs: 15_000,
    lowReasoning: true,
    models: [
      gemini('gemini-3.5-flash-lite'),
      gemini('gemini-3.5-flash'),
      gemini('gemini-3.7-flash'),
      gemini('gemini-3.8-flash'),
      ...OPENROUTER_FALLBACKS,
    ],
  },
  // Summary + post-reading quiz: run in the background.
  quality: {
    timeoutMs: 25_000,
    lowReasoning: false,
    models: [
      gemini('gemini-3.5-flash'),
      gemini('gemini-3.7-flash'),
      gemini('gemini-3.5-flash-lite'),
      gemini('gemini-3.8-flash'),
      ...OPENROUTER_FALLBACKS,
    ],
  },
};

const ENDPOINTS: Record<Provider, string> = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
};

export interface CallOptions {
  chain: ChainName;
  isImage: boolean;
  /** Shown in the backend log, e.g. "prequiz". */
  label: string;
}

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function keyFor(provider: Provider): string | undefined {
  return provider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENROUTER_KEY;
}

function headersFor(provider: Provider, key: string) {
  const h: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  if (provider === 'openrouter') {
    h['HTTP-Referer'] = process.env.APP_URL || 'http://localhost:5173';
    h['X-Title'] = 'ClearSign';
  }
  return h;
}

/** Same message as the old client for non-OK responses. */
async function errorFromResponse(res: Response): Promise<HttpError> {
  const raw = (await res.json().catch(() => ({}))) as
    | { error?: { message?: string } }
    | { error?: { message?: string } }[];
  const err = Array.isArray(raw) ? raw[0] : raw;
  return new HttpError(err?.error?.message || `API error (${res.status}). Please try again.`, res.status);
}

const describe = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Models usable for this request, logging every skip. */
function usableModels(chain: Chain, opts: CallOptions): ModelSpec[] {
  const out: ModelSpec[] = [];
  for (const m of chain.models) {
    if (!keyFor(m.provider)) {
      console.log(`[ai] ${opts.label}: skipping ${m.id} (no ${m.provider} API key set)`);
    } else if (opts.isImage && !m.vision) {
      console.log(`[ai] ${opts.label}: skipping ${m.id} (can't read images)`);
    } else {
      out.push(m);
    }
  }
  return out;
}

/**
 * reasoning_effort values to try for a model, lowest first. A 400 means the
 * model rejected that value, so we step up (and finally omit it).
 */
function effortLadder(model: ModelSpec, chain: Chain): (string | undefined)[] {
  return chain.lowReasoning && model.provider === 'gemini' ? ['minimal', 'low', undefined] : [undefined];
}

/**
 * Runs `attempt` for each model in order. Returns the first success.
 * `attempt` must throw to signal "try the next model"; a 400 that complains
 * about the thinking level retries the same model with a higher/no effort.
 */
async function walkChain<T>(
  opts: CallOptions,
  attempt: (model: ModelSpec, timeoutMs: number, effort: string | undefined) => Promise<T>,
): Promise<{ result: T; model: ModelSpec; effort: string | undefined; ms: number }> {
  const chain = CHAINS[opts.chain];
  const models = usableModels(chain, opts);
  if (models.length === 0) {
    throw new Error(
      'No AI models are available. Set GEMINI_API_KEY and/or OPENROUTER_KEY in backend/.env.',
    );
  }

  let lastError: unknown = new Error('All AI models failed. Please try again.');
  for (const model of models) {
    for (const effort of effortLadder(model, chain)) {
      const started = Date.now();
      try {
        const result = await attempt(model, chain.timeoutMs, effort);
        return { result, model, effort, ms: Date.now() - started };
      } catch (err) {
        lastError = err;
        const timedOut = err instanceof Error && err.name === 'TimeoutError';
        console.log(
          `[ai] ${opts.label}: ${model.id} failed` +
            (effort ? ` (reasoning_effort=${effort})` : '') +
            ` — ${timedOut ? `timeout ${chain.timeoutMs / 1000}s` : describe(err)}`,
        );
        // Only a 400 on a request that carried reasoning_effort means "try a higher setting".
        const rejectedEffort =
          err instanceof HttpError &&
          err.status === 400 &&
          effort !== undefined &&
          /think|reasoning/i.test(err.message);
        if (!rejectedEffort) break;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All AI models failed. Please try again.');
}

function timeoutError() {
  const e = new Error('The AI took too long to respond. Please try again.');
  e.name = 'TimeoutError';
  return e;
}

function requestBody(
  model: ModelSpec,
  messages: ChatMessage[],
  effort: string | undefined,
  stream: boolean,
) {
  return JSON.stringify({
    model: model.id,
    messages,
    ...(stream ? { stream: true } : {}),
    ...(effort ? { reasoning_effort: effort } : {}),
  });
}

// ── non-streaming ─────────────────────────────────────────────────────────────

/** Returns the assistant's text from the first model in the chain that answers. */
export async function chatCompletion(messages: ChatMessage[], opts: CallOptions): Promise<string> {
  const { result, model, effort, ms } = await walkChain(opts, async (model, timeoutMs, effort) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(timeoutError()), timeoutMs);
    try {
      const res = await fetch(ENDPOINTS[model.provider], {
        method: 'POST',
        headers: headersFor(model.provider, keyFor(model.provider)!),
        body: requestBody(model, messages, effort, false),
        signal: controller.signal,
      });
      if (!res.ok) throw await errorFromResponse(res);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) throw new Error('empty response');
      return content;
    } catch (err) {
      if (controller.signal.aborted) throw timeoutError();
      throw err;
    } finally {
      clearTimeout(timer);
    }
  });
  console.log(
    `[ai] ${opts.label} answered by ${model.id}${effort ? ` (reasoning_effort=${effort})` : ''} (${(ms / 1000).toFixed(1)}s)`,
  );
  return result;
}

// ── streaming ─────────────────────────────────────────────────────────────────

/** True once an SSE text block contains a delta with real text. */
function hasText(sse: string): boolean {
  for (const line of sse.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('data:')) continue;
    const payload = t.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      if (JSON.parse(payload)?.choices?.[0]?.delta?.content) return true;
    } catch {
      /* partial frame */
    }
  }
  return false;
}

/**
 * Opens an SSE stream from the first model that starts producing text within
 * the timeout (time to first chunk). Once text starts, that model is committed
 * to. Returns a Node Readable of the raw SSE bytes, unchanged from upstream.
 */
export async function chatCompletionStream(
  messages: ChatMessage[],
  opts: CallOptions,
): Promise<Readable> {
  const started = Date.now();
  const { result, model, effort } = await walkChain(opts, async (model, timeoutMs, effort) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(timeoutError()), timeoutMs);
    try {
      const res = await fetch(ENDPOINTS[model.provider], {
        method: 'POST',
        headers: headersFor(model.provider, keyFor(model.provider)!),
        body: requestBody(model, messages, effort, true),
        signal: controller.signal,
      });
      if (!res.ok) throw await errorFromResponse(res);
      if (!res.body) throw new Error('empty response');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const buffered: Uint8Array[] = [];
      let seen = '';
      let gotText = false;
      while (!gotText) {
        const { done, value } = await reader.read();
        if (done) throw new Error('stream ended with no text');
        buffered.push(value);
        seen += decoder.decode(value, { stream: true });
        gotText = hasText(seen);
        // keep only the (possibly partial) last line to stay cheap
        if (!gotText) seen = seen.slice(seen.lastIndexOf('\n') + 1);
      }

      // First text arrived — commit. The timeout no longer applies.
      clearTimeout(timer);
      async function* relay() {
        try {
          for (const chunk of buffered) yield chunk;
          while (true) {
            const { done, value } = await reader.read();
            if (done) return;
            yield value;
          }
        } finally {
          reader.cancel().catch(() => {});
        }
      }
      return Readable.from(relay(), { objectMode: false });
    } catch (err) {
      if (controller.signal.aborted) throw timeoutError();
      throw err;
    } finally {
      clearTimeout(timer);
    }
  });
  console.log(
    `[ai] ${opts.label} answered by ${model.id}${effort ? ` (reasoning_effort=${effort})` : ''} (first text in ${((Date.now() - started) / 1000).toFixed(1)}s, streaming)`,
  );
  return result;
}
