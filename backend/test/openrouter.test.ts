import { describe, it, expect } from 'vitest';
import {
  parsePreQuizJSON,
  parseQuizJSON,
  requireQuestions,
  buildSummaryMessages,
  buildPreQuizMessages,
  buildQuizMessages,
  type SummaryData,
} from '../src/services/openrouter.js';

const UNEXPECTED = 'The AI returned an unexpected response. Please try again.';
const QUIZ = [
  { question: 'Q1?', options: ['a', 'b', 'c', 'd'], correct: 0 },
  { question: 'Q2?', options: ['a', 'b', 'c', 'd'], correct: 3 },
];
const QUIZ_JSON = JSON.stringify(QUIZ);

describe.each([
  ['parsePreQuizJSON', parsePreQuizJSON],
  ['parseQuizJSON', parseQuizJSON],
])('%s', (_name, parse) => {
  it('parses a plain array', () => {
    expect(parse(QUIZ_JSON)).toEqual(QUIZ);
  });

  it('strips ```json fences', () => {
    expect(parse('```json\n' + QUIZ_JSON + '\n```')).toEqual(QUIZ);
  });

  it('ignores prose before and after the array', () => {
    expect(parse('Here are your questions:\n' + QUIZ_JSON + '\nEnjoy!')).toEqual(QUIZ);
  });

  it('tolerates trailing commas', () => {
    const raw = '[{"question":"Q?","options":["a","b",],"correct":0,},]';
    expect(parse(raw)).toEqual([{ question: 'Q?', options: ['a', 'b'], correct: 0 }]);
  });

  it('throws the friendly error on garbage', () => {
    expect(() => parse('definitely not json')).toThrow(UNEXPECTED);
  });

  it('throws the friendly error on an empty string', () => {
    expect(() => parse('')).toThrow(UNEXPECTED);
  });

  it('throws the friendly error on a truncated array', () => {
    expect(() => parse('[{"question":"Q?","options":["a","b"')).toThrow(UNEXPECTED);
  });
});

describe('requireQuestions', () => {
  it('accepts a non-empty array and returns it', () => {
    expect(requireQuestions(QUIZ)).toBe(QUIZ);
  });

  it.each([
    ['an object', {}],
    ['an empty array', []],
    ['null', null],
    ['a string', 'abc'],
    ['undefined', undefined],
  ])('throws on %s', (_label, value) => {
    expect(() => requireQuestions(value)).toThrow(UNEXPECTED);
  });

  const q = (over: Record<string, unknown> = {}) => ({
    question: 'Q?',
    options: ['a', 'b', 'c', 'd'],
    correct: 1,
    ...over,
  });

  it('passes a valid 5-question array and returns it', () => {
    const five = [q(), q(), q(), q(), q()];
    expect(requireQuestions(five)).toBe(five);
  });

  it.each([
    ['correct out of range', q({ correct: 4 })],
    ['correct negative', q({ correct: -1 })],
    ['correct non-integer', q({ correct: 1.5 })],
    ['correct a string', q({ correct: '2' })],
    ['correct missing', q({ correct: undefined })],
    ['options missing', q({ options: undefined })],
    ['options not an array', q({ options: 'abcd' })],
    ['a null element', null],
    ['a string element', 'text'],
  ])('throws for %s', (_label, bad) => {
    expect(() => requireQuestions([bad])).toThrow(UNEXPECTED);
  });

  it('rejects the whole array when one of five questions is bad', () => {
    expect(() => requireQuestions([q(), q(), q({ correct: 9 }), q(), q()])).toThrow(UNEXPECTED);
  });

  it('passes 5 options with correct: 4', () => {
    const five = [q({ options: ['a', 'b', 'c', 'd', 'e'], correct: 4 })];
    expect(requireQuestions(five)).toBe(five);
  });
});

const SUMMARY: SummaryData = {
  title: 'Residential Lease',
  parties: 'Acme and Jane',
  obligations: ['Pay rent', 'Keep clean'],
  deadlines: ['Rent due on the 1st'],
  rights: ['Quiet enjoyment'],
  risks: [{ title: 'Late fee', description: 'A $50 fee applies.' }],
};

const IMG1 = 'data:image/jpeg;base64,AAAA';
const IMG2 = 'data:image/jpeg;base64,BBBB';
const IMG3 = 'data:image/jpeg;base64,CCCC';

describe.each([
  ['buildSummaryMessages', buildSummaryMessages],
  ['buildPreQuizMessages', buildPreQuizMessages],
])('%s', (_name, build) => {
  it('text: system message first, then a user message containing the contract', () => {
    const msgs = build('RENT IS DUE MONTHLY', false, 'en');
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(typeof msgs[0].content).toBe('string');
    expect(msgs[1].role).toBe('user');
    expect(msgs[1].content).toBe('Here is the contract text:\n\nRENT IS DUE MONTHLY');
  });

  it('single image: one text block then one image_url block', () => {
    const msgs = build(IMG1, true, 'en');
    expect(msgs[0].role).toBe('system');
    const user = msgs[1].content;
    expect(Array.isArray(user)).toBe(true);
    const blocks = user as { type: string; image_url?: { url: string } }[];
    expect(blocks.map((b) => b.type)).toEqual(['text', 'image_url']);
    expect(blocks[1].image_url?.url).toBe(IMG1);
  });

  it('multi-page scan: text block then one image_url block per page, in order', () => {
    const msgs = build([IMG1, IMG2, IMG3], true, 'en');
    expect(msgs[0].role).toBe('system');
    const blocks = msgs[1].content as { type: string; image_url?: { url: string } }[];
    expect(blocks.map((b) => b.type)).toEqual(['text', 'image_url', 'image_url', 'image_url']);
    expect(blocks.slice(1).map((b) => b.image_url?.url)).toEqual([IMG1, IMG2, IMG3]);
  });

  it('text mode with an array joins the entries with a blank line', () => {
    const msgs = build(['page one', 'page two'], false, 'en');
    expect(msgs[1].content).toBe('Here is the contract text:\n\npage one\n\npage two');
  });

  it("'es' prompts contain the Spanish instruction and 'en' ones do not", () => {
    const es = build('x', false, 'es')[0].content as string;
    const en = build('x', false, 'en')[0].content as string;
    expect(es).toMatch(/in Spanish/);
    expect(en).not.toMatch(/Spanish/);
    expect(en).toMatch(/in English/);
  });
});

describe('buildQuizMessages', () => {
  it('has the system prompt first and the summary text in the user message', () => {
    const msgs = buildQuizMessages(SUMMARY, 'en');
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[1].role).toBe('user');
    const text = msgs[1].content as string;
    expect(text).toContain('Here is the contract summary:');
    expect(text).toContain('Title: Residential Lease');
    expect(text).toContain('Parties: Acme and Jane');
    expect(text).toContain('Obligations: Pay rent | Keep clean');
    expect(text).toContain('Deadlines: Rent due on the 1st');
    expect(text).toContain('Rights: Quiet enjoyment');
    expect(text).toContain('Risks: Late fee: A $50 fee applies.');
  });

  it('copes with a summary that has only some fields', () => {
    const text = buildQuizMessages({ title: 'Only title' }, 'en')[1].content as string;
    expect(text).toContain('Title: Only title');
    expect(text).toContain('Obligations: ');
    expect(text).not.toContain('undefined');
  });

  it("'es' prompt contains the Spanish instruction and 'en' does not", () => {
    const es = buildQuizMessages(SUMMARY, 'es')[0].content as string;
    const en = buildQuizMessages(SUMMARY, 'en')[0].content as string;
    expect(es).toMatch(/in Spanish/);
    expect(en).not.toMatch(/Spanish/);
  });
});
