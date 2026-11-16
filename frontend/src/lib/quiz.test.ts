import { describe, it, expect } from 'vitest';
import { validateQuestions, escHtml } from './quiz';

const PH = '(n/a)';

describe('validateQuestions', () => {
  it('leaves a well-formed 4-option question unchanged', () => {
    const q = { question: 'Q?', options: ['a', 'b', 'c', 'd'], correct: 2 };
    expect(validateQuestions([q], PH)).toEqual([q]);
  });

  it('pads short option lists to 4 with the placeholder', () => {
    const [out] = validateQuestions([{ question: 'Q?', options: ['a', 'b'], correct: 1 }], PH);
    expect(out.options).toEqual(['a', 'b', PH, PH]);
    expect(out.correct).toBe(1);
  });

  it('accepts a single option and pads it', () => {
    const [out] = validateQuestions([{ question: 'Q?', options: ['a'], correct: 0 }], PH);
    expect(out.options).toEqual(['a', PH, PH, PH]);
  });

  it('trims extra options to 4, moving the correct answer to index 0', () => {
    const [out] = validateQuestions(
      [{ question: 'Q?', options: ['a', 'b', 'c', 'd', 'e', 'f'], correct: 4 }],
      PH,
    );
    expect(out.options).toEqual(['e', 'a', 'b', 'c']);
    expect(out.correct).toBe(0);
  });

  it('coerces option values to strings', () => {
    const [out] = validateQuestions([{ question: 'Q?', options: [1, 2, 3, 4], correct: 0 }], PH);
    expect(out.options).toEqual(['1', '2', '3', '4']);
  });

  it('drops malformed questions', () => {
    const good = { question: 'Q?', options: ['a', 'b', 'c', 'd'], correct: 0 };
    const out = validateQuestions(
      [
        null,
        'text',
        { options: ['a'], correct: 0 },
        { question: 5, options: ['a'], correct: 0 },
        { question: 'no options' },
        { question: 'empty options', options: [], correct: 0 },
        { question: 'bad options', options: 'abcd', correct: 0 },
        good,
      ],
      PH,
    );
    expect(out).toEqual([good]);
  });

  it('drops a question whose correct is a non-integer or missing', () => {
    const base = { question: 'Q?', options: ['a', 'b', 'c', 'd'] };
    const out = validateQuestions(
      [{ ...base, correct: '2' }, { ...base, correct: 1.5 }, { ...base }],
      PH,
    );
    expect(out).toEqual([]);
  });

  it('drops a question whose correct is out of range', () => {
    const base = { question: 'Q?', options: ['a', 'b', 'c', 'd'] };
    expect(validateQuestions([{ ...base, correct: 4 }, { ...base, correct: 9 }], PH)).toEqual([]);
  });

  it('drops a question whose correct is negative', () => {
    const base = { question: 'Q?', options: ['a', 'b', 'c', 'd'] };
    expect(validateQuestions([{ ...base, correct: -1 }], PH)).toEqual([]);
  });

  it('drops an out-of-range correct when there are more than 4 options', () => {
    const out = validateQuestions(
      [{ question: 'Q?', options: ['a', 'b', 'c', 'd', 'e'], correct: 9 }],
      PH,
    );
    expect(out).toEqual([]);
  });

  it('keeps a valid question next to bad ones, unchanged', () => {
    const good = { question: 'Q?', options: ['a', 'b', 'c', 'd'], correct: 1 };
    const out = validateQuestions(
      [
        { question: 'bad', options: ['a', 'b', 'c', 'd'], correct: 9 },
        good,
        { question: 'bad', options: ['a', 'b', 'c', 'd'], correct: -1 },
      ],
      PH,
    );
    expect(out).toEqual([good]);
  });

  it('keeps correct: 3 with 4 options', () => {
    const q = { question: 'Q?', options: ['a', 'b', 'c', 'd'], correct: 3 };
    expect(validateQuestions([q], PH)).toEqual([q]);
  });

  it('checks correct against the original option count, before padding', () => {
    const dropped = validateQuestions([{ question: 'Q?', options: ['a', 'b'], correct: 2 }], PH);
    expect(dropped).toEqual([]);
    const [kept] = validateQuestions([{ question: 'Q?', options: ['a', 'b'], correct: 1 }], PH);
    expect(kept.options).toEqual(['a', 'b', PH, PH]);
    expect(kept.correct).toBe(1);
  });

  it('keeps 5 options with correct: 4, trimmed to 4 with the answer at index 0', () => {
    const [out] = validateQuestions(
      [{ question: 'Q?', options: ['a', 'b', 'c', 'd', 'e'], correct: 4 }],
      PH,
    );
    expect(out.options).toEqual(['e', 'a', 'b', 'c']);
    expect(out.correct).toBe(0);
  });

  it('keeps extra fields on the question', () => {
    const [out] = validateQuestions(
      [{ question: 'Q?', options: ['a', 'b', 'c', 'd'], correct: 0, why: 'because' }],
      PH,
    );
    expect((out as unknown as { why: string }).why).toBe('because');
  });

  it('returns an empty array for an empty array', () => {
    expect(validateQuestions([], PH)).toEqual([]);
  });

  it('throws a TypeError for non-array input (no guard)', () => {
    expect(() => validateQuestions(null as unknown as any[], PH)).toThrow(TypeError);
    expect(() => validateQuestions({} as unknown as any[], PH)).toThrow(TypeError);
  });
});

describe('escHtml', () => {
  it('escapes &, < and >', () => {
    expect(escHtml('<b>Tom & Jerry</b>')).toBe('&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;');
  });

  it('escapes & first so entities are not double-handled wrongly', () => {
    expect(escHtml('&lt;')).toBe('&amp;lt;');
  });

  it('does not escape double or single quotes (current behavior)', () => {
    expect(escHtml(`"quoted" and 'single'`)).toBe(`"quoted" and 'single'`);
  });

  it('returns plain text unchanged', () => {
    expect(escHtml('Rent is due on the 1st.')).toBe('Rent is due on the 1st.');
  });
});
