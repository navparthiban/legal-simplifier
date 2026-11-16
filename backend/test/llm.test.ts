import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  chatCompletion,
  cooldownMs,
  parseDurationMs,
  resetQuotaCooldowns,
  HttpError,
} from '../src/services/llm.js';
import { parseQuizJSON, requireQuestions, type ChatMessage } from '../src/services/openrouter.js';

const UNEXPECTED = 'The AI returned an unexpected response. Please try again.';

const FAST = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'nvidia/nemotron-3.5-super-vl:free',
  'dots-studio/dots-3-note-preview:free',
];
const QUALITY = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', ...FAST.slice(2)];

const MESSAGES: ChatMessage[] = [{ role: 'user', content: 'hello' }];

// ── fake provider responses ───────────────────────────────────────────────────

const ok = (text: string | null) =>
  new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });

const fail = (status: number, message = `error ${status}`) =>
  new Response(JSON.stringify({ error: { message } }), { status });

interface Sent {
  model: string;
  reasoning_effort?: string;
}

/**
 * Replaces globalThis.fetch. Each call takes the next queued Response; once the
 * queue is empty, `fallback` (if given) answers, else the test fails loudly.
 */
function installFetch(queue: Response[] = [], fallback?: () => Response) {
  const sent: Sent[] = [];
  const fake = vi.fn(async (_url: unknown, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)) as Sent);
    const next = queue.shift();
    if (next) return next;
    if (fallback) return fallback();
    throw new Error('fake fetch: no response queued');
  });
  vi.stubGlobal('fetch', fake);
  return { sent, fake, models: () => sent.map((s) => s.model) };
}

const fast = { chain: 'fast', isImage: false, label: 'test' } as const;
const quality = { chain: 'quality', isImage: false, label: 'test' } as const;

let savedGemini: string | undefined;
let savedOpenRouter: string | undefined;

beforeEach(() => {
  savedGemini = process.env.GEMINI_API_KEY;
  savedOpenRouter = process.env.OPENROUTER_KEY;
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.OPENROUTER_KEY = 'test-openrouter-key';
  resetQuotaCooldowns();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (savedGemini === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = savedGemini;
  if (savedOpenRouter === undefined) delete process.env.OPENROUTER_KEY;
  else process.env.OPENROUTER_KEY = savedOpenRouter;
});

// ── parseDurationMs ───────────────────────────────────────────────────────────

describe('parseDurationMs', () => {
  it.each([
    ['7432s', 7_432_000],
    ['7.5s', 7_500],
    ['2h4m8.8s', 7_448_800],
    ['3m', 180_000],
    ['2h', 7_200_000],
    ['1h30m', 5_400_000],
    [' 45s ', 45_000],
  ])('parses %s', (text, ms) => {
    expect(parseDurationMs(text)).toBe(ms);
  });

  it.each([['banana'], ['5ms'], ['12'], ['s'], ['1d'], ['-3s']])('returns undefined for %s', (text) => {
    expect(parseDurationMs(text)).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    expect(parseDurationMs('')).toBeUndefined();
  });
});

// ── cooldownMs ────────────────────────────────────────────────────────────────

describe('cooldownMs', () => {
  const MIN = 15_000;
  const MAX = 6 * 60 * 60_000;

  it('uses retryAfterMs when in range', () => {
    expect(cooldownMs(new HttpError('quota', 429, 120_000))).toBe(120_000);
  });

  it('clamps retryAfterMs up to 15 s', () => {
    expect(cooldownMs(new HttpError('quota', 429, 1_000))).toBe(MIN);
  });

  it('clamps retryAfterMs down to 6 h', () => {
    expect(cooldownMs(new HttpError('quota', 429, 24 * 60 * 60_000))).toBe(MAX);
  });

  it('parses "retry in 2h4m8.8s." from the message', () => {
    const err = new HttpError('Quota exceeded. Please retry in 2h4m8.8s.', 429);
    expect(cooldownMs(err)).toBe(7_448_800);
  });

  it('clamps a duration parsed from the message', () => {
    expect(cooldownMs(new HttpError('Please retry in 2s.', 429))).toBe(MIN);
  });

  it('prefers retryAfterMs over the message', () => {
    expect(cooldownMs(new HttpError('Please retry in 2h.', 429, 30_000))).toBe(30_000);
  });

  it('uses 1 hour for a "per day" message with no retry time', () => {
    expect(cooldownMs(new HttpError('Quota exceeded: 20 requests per day', 429))).toBe(3_600_000);
  });

  it('uses 60 seconds otherwise', () => {
    expect(cooldownMs(new HttpError('Too many requests', 429))).toBe(60_000);
  });
});

// ── chatCompletion: the fallback chain ────────────────────────────────────────

describe('chatCompletion chain', () => {
  it('returns the first model\'s answer with one fetch call', async () => {
    const f = installFetch([ok('first answer')]);
    await expect(chatCompletion(MESSAGES, fast)).resolves.toBe('first answer');
    expect(f.fake).toHaveBeenCalledTimes(1);
    expect(f.models()).toEqual([FAST[0]]);
  });

  it('sends the messages and the right auth header', async () => {
    const f = installFetch([ok('hi')]);
    await chatCompletion(MESSAGES, fast);
    const [url, init] = f.fake.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('generativelanguage.googleapis.com');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-gemini-key');
    expect(JSON.parse(String(init.body)).messages).toEqual(MESSAGES);
  });

  it('falls through to the second model on an HTTP 500', async () => {
    const f = installFetch([fail(500), ok('second answer')]);
    await expect(chatCompletion(MESSAGES, fast)).resolves.toBe('second answer');
    expect(f.models()).toEqual([FAST[0], FAST[1]]);
  });

  it('falls through on empty content', async () => {
    const f = installFetch([ok('   '), ok(null), ok('third answer')]);
    await expect(chatCompletion(MESSAGES, fast)).resolves.toBe('third answer');
    expect(f.models()).toEqual([FAST[0], FAST[1], FAST[2]]);
  });

  it('reaches the OpenRouter fallbacks (with the OpenRouter key) when Gemini models all fail', async () => {
    const f = installFetch([fail(500), fail(500), fail(500), fail(500), ok('from openrouter')]);
    await expect(chatCompletion(MESSAGES, fast)).resolves.toBe('from openrouter');
    expect(f.models()[4]).toBe('nvidia/nemotron-3.5-super-vl:free');
    const [url, init] = f.fake.mock.calls[4] as [string, RequestInit];
    expect(url).toContain('openrouter.ai');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-openrouter-key');
  });

  it('rejects with the last error when every model fails', async () => {
    const f = installFetch([], () => fail(500, 'boom'));
    await expect(chatCompletion(MESSAGES, fast)).rejects.toThrow('boom');
    expect(f.fake).toHaveBeenCalledTimes(6);
  });

  it('uses the quality order for the quality chain', async () => {
    const f = installFetch([], () => fail(500));
    await chatCompletion(MESSAGES, quality).catch(() => {});
    expect(f.models()).toEqual(QUALITY);
  });

  it('uses the fast order for the fast chain', async () => {
    const f = installFetch([], () => fail(500));
    await chatCompletion(MESSAGES, fast).catch(() => {});
    expect(f.models()).toEqual(FAST);
  });
});

describe('chatCompletion with a parse function', () => {
  const GOOD = '[{"question":"Q?","options":["a","b","c","d"],"correct":0}]';

  it('returns the parsed value when the first answer parses (1 call)', async () => {
    const f = installFetch([ok(GOOD)]);
    const out = await chatCompletion(MESSAGES, fast, parseQuizJSON);
    expect(out).toEqual([{ question: 'Q?', options: ['a', 'b', 'c', 'd'], correct: 0 }]);
    expect(f.fake).toHaveBeenCalledTimes(1);
  });

  it('falls through to the next model when the first answer is garbage', async () => {
    const f = installFetch([ok('this is not json'), ok(GOOD)]);
    const out = await chatCompletion(MESSAGES, fast, parseQuizJSON);
    expect(Array.isArray(out)).toBe(true);
    expect(f.models()).toEqual([FAST[0], FAST[1]]);
  });

  it('falls through to the next model when the first answer has an out-of-range correct', async () => {
    const f = installFetch([
      ok('[{"question":"Q?","options":["a","b","c","d"],"correct":9}]'),
      ok(GOOD),
    ]);
    const out = await chatCompletion(MESSAGES, fast, (raw) => requireQuestions(parseQuizJSON(raw)));
    expect(out).toEqual([{ question: 'Q?', options: ['a', 'b', 'c', 'd'], correct: 0 }]);
    expect(f.models()).toEqual([FAST[0], FAST[1]]);
  });

  it('rejects with the "unexpected response" message after trying all 6 models', async () => {
    const f = installFetch([], () => ok('garbage'));
    await expect(chatCompletion(MESSAGES, fast, parseQuizJSON)).rejects.toThrow(UNEXPECTED);
    expect(f.fake).toHaveBeenCalledTimes(6);
  });

  it('a parse failure does not put the model in cooldown', async () => {
    const f = installFetch([ok('garbage'), ok(GOOD), ok(GOOD)]);
    await chatCompletion(MESSAGES, quality, parseQuizJSON);
    await chatCompletion(MESSAGES, quality, parseQuizJSON);
    // call 1: model 0 (garbage) then model 1; call 2 starts at model 0 again
    expect(f.models()).toEqual([QUALITY[0], QUALITY[1], QUALITY[0]]);
  });
});

describe('quota cooldown', () => {
  it('skips a model that returned 429 on the next call', async () => {
    const f = installFetch([fail(429, 'Quota exceeded'), ok('one'), ok('two')]);
    await expect(chatCompletion(MESSAGES, quality)).resolves.toBe('one');
    await expect(chatCompletion(MESSAGES, quality)).resolves.toBe('two');
    // call 1: model 0 (429) -> model 1 answers; call 2 starts at model 1
    expect(f.models()).toEqual([QUALITY[0], QUALITY[1], QUALITY[1]]);
  });

  it('does not skip a model that returned 503', async () => {
    const f = installFetch([fail(503, 'This model is currently experiencing high demand'), ok('one'), ok('two')]);
    await chatCompletion(MESSAGES, quality);
    await chatCompletion(MESSAGES, quality);
    expect(f.models()).toEqual([QUALITY[0], QUALITY[1], QUALITY[0]]);
  });

  it('skips a model whose error message talks about quota, even without a 429', async () => {
    const f = installFetch([fail(403, 'You exceeded your current quota'), ok('one'), ok('two')]);
    await chatCompletion(MESSAGES, quality);
    await chatCompletion(MESSAGES, quality);
    expect(f.models()).toEqual([QUALITY[0], QUALITY[1], QUALITY[1]]);
  });

  it('tries every model anyway when all of them are cooling down', async () => {
    installFetch([], () => fail(429, 'Quota exceeded'));
    await chatCompletion(MESSAGES, quality).catch(() => {});
    const f2 = installFetch([ok('recovered')]);
    await expect(chatCompletion(MESSAGES, quality)).resolves.toBe('recovered');
    expect(f2.models()).toEqual([QUALITY[0]]);
  });

  it('resetQuotaCooldowns forgets cooldowns', async () => {
    installFetch([fail(429), ok('one')]);
    await chatCompletion(MESSAGES, quality);
    resetQuotaCooldowns();
    const f = installFetch([ok('two')]);
    await chatCompletion(MESSAGES, quality);
    expect(f.models()).toEqual([QUALITY[0]]);
  });
});

describe('image requests', () => {
  it('never request the text-only dots model, even when everything fails', async () => {
    const f = installFetch([], () => fail(500));
    await expect(
      chatCompletion(MESSAGES, { chain: 'fast', isImage: true, label: 'test' }),
    ).rejects.toThrow();
    expect(f.fake).toHaveBeenCalledTimes(5);
    expect(f.models()).not.toContain('dots-studio/dots-3-note-preview:free');
  });
});

describe('reasoning_effort', () => {
  it('fast chain sends minimal to the first model', async () => {
    const f = installFetch([ok('hi')]);
    await chatCompletion(MESSAGES, fast);
    expect(f.sent[0]).toMatchObject({ model: 'gemini-3.5-flash-lite', reasoning_effort: 'minimal' });
  });

  it('retries the same model with low when it rejects the thinking level (400)', async () => {
    const f = installFetch([fail(400, 'Thinking level minimal is not supported by this model'), ok('hi')]);
    await expect(chatCompletion(MESSAGES, fast)).resolves.toBe('hi');
    expect(f.sent).toEqual([
      { model: 'gemini-3.5-flash-lite', messages: MESSAGES, reasoning_effort: 'minimal' },
      { model: 'gemini-3.5-flash-lite', messages: MESSAGES, reasoning_effort: 'low' },
    ]);
  });

  it('also retries when the 400 mentions "reasoning"', async () => {
    const f = installFetch([fail(400, 'Unsupported reasoning_effort value'), ok('hi')]);
    await chatCompletion(MESSAGES, fast);
    expect(f.sent.map((s) => s.reasoning_effort)).toEqual(['minimal', 'low']);
    expect(f.models()).toEqual([FAST[0], FAST[0]]);
  });

  it('moves to the next model on a 400 that is not about thinking', async () => {
    const f = installFetch([fail(400, 'Bad request'), ok('hi')]);
    await chatCompletion(MESSAGES, fast);
    expect(f.models()).toEqual([FAST[0], FAST[1]]);
  });

  it('starts the 3.7 and 3.8 models at low', async () => {
    const f = installFetch([fail(500), fail(500), ok('hi')]);
    await chatCompletion(MESSAGES, fast);
    expect(f.sent[2]).toMatchObject({ model: 'gemini-3.7-flash', reasoning_effort: 'low' });
  });

  it('quality chain sends no reasoning_effort', async () => {
    const f = installFetch([], () => fail(500));
    await chatCompletion(MESSAGES, quality).catch(() => {});
    expect(f.sent).toHaveLength(6);
    for (const body of f.sent) expect(body).not.toHaveProperty('reasoning_effort');
  });

  it('fast chain sends no reasoning_effort to OpenRouter models', async () => {
    const f = installFetch([], () => fail(500));
    await chatCompletion(MESSAGES, fast).catch(() => {});
    const openrouter = f.sent.filter((s) => s.model.includes(':free'));
    expect(openrouter).toHaveLength(2);
    for (const body of openrouter) expect(body).not.toHaveProperty('reasoning_effort');
  });
});

describe('missing API keys', () => {
  it('rejects with "No AI models are available" and makes no fetch calls', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENROUTER_KEY;
    const f = installFetch([ok('should not be used')]);
    await expect(chatCompletion(MESSAGES, fast)).rejects.toThrow(/No AI models are available/);
    expect(f.fake).toHaveBeenCalledTimes(0);
  });

  it('with only an OpenRouter key, uses only the OpenRouter models', async () => {
    delete process.env.GEMINI_API_KEY;
    const f = installFetch([ok('hi')]);
    await chatCompletion(MESSAGES, fast);
    expect(f.models()).toEqual(['nvidia/nemotron-3.5-super-vl:free']);
  });
});
