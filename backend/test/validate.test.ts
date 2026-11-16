import { describe, it, expect } from 'vitest';
import {
  checkContent,
  cleanSummaryData,
  MAX_TEXT_CHARS,
  MAX_IMAGE_PAGES,
} from '../src/services/validate.js';

const IMG = 'data:image/png;base64,AAAA';

describe('checkContent (text)', () => {
  it('accepts a valid string', () => {
    expect(checkContent('RENT IS DUE', false)).toEqual({ ok: true, content: 'RENT IS DUE' });
  });

  it.each([
    ['an empty string', ''],
    ['a number', 42],
    ['null', null],
    ['undefined', undefined],
    ['an array', ['a']],
    ['an object', {}],
  ])('rejects %s', (_label, value) => {
    expect(checkContent(value, false)).toEqual({ ok: false, error: 'Missing contract content.' });
  });

  it('rejects text over the limit', () => {
    expect(checkContent('a'.repeat(MAX_TEXT_CHARS + 1), false)).toEqual({
      ok: false,
      error: 'Contract text is too long.',
    });
  });

  it('accepts text exactly at the limit', () => {
    const text = 'a'.repeat(MAX_TEXT_CHARS);
    expect(checkContent(text, false)).toEqual({ ok: true, content: text });
  });
});

describe('checkContent (image)', () => {
  it('accepts a single image data URL', () => {
    expect(checkContent(IMG, true)).toEqual({ ok: true, content: IMG });
  });

  it('accepts an array of image data URLs', () => {
    expect(checkContent([IMG, IMG], true)).toEqual({ ok: true, content: [IMG, IMG] });
  });

  it.each([
    ['a non-image data URL', 'data:text/plain;base64,AAAA'],
    ['a plain https URL', 'https://example.com/a.png'],
    ['plain text', 'hello'],
    ['an empty string', ''],
    ['an empty array', []],
    ['an array with a non-image entry', [IMG, 'data:application/pdf;base64,AAAA']],
    ['an array with a non-string entry', [IMG, 5]],
    ['null', null],
  ])('rejects %s', (_label, value) => {
    expect(checkContent(value, true)).toEqual({ ok: false, error: 'Missing contract content.' });
  });

  it('rejects more than the maximum number of pages', () => {
    const pages = Array.from({ length: MAX_IMAGE_PAGES + 1 }, () => IMG);
    expect(checkContent(pages, true)).toEqual({ ok: false, error: 'Too many contract pages.' });
  });

  it('accepts exactly the maximum number of pages', () => {
    const pages = Array.from({ length: MAX_IMAGE_PAGES }, () => IMG);
    expect(checkContent(pages, true)).toEqual({ ok: true, content: pages });
  });
});

describe('cleanSummaryData', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'text'],
    ['a number', 7],
    ['an array', [{ title: 'x' }]],
  ])('returns null for %s', (_label, value) => {
    expect(cleanSummaryData(value)).toBeNull();
  });

  it('returns null for an object with nothing usable', () => {
    expect(cleanSummaryData({})).toBeNull();
    expect(cleanSummaryData({ title: '', obligations: [], risks: [], other: 'x' })).toBeNull();
  });

  it('keeps a full valid summary', () => {
    const data = {
      title: 'Lease',
      parties: 'A and B',
      obligations: ['one', 'two'],
      deadlines: ['d'],
      rights: ['r'],
      risks: [{ title: 'Fee', description: 'Pay' }],
    };
    expect(cleanSummaryData(data)).toEqual(data);
  });

  it('drops unknown fields and wrong-typed fields', () => {
    const out = cleanSummaryData({
      title: 'Lease',
      parties: 123,
      obligations: 'not a list',
      deadlines: { a: 1 },
      evil: '<script>',
    });
    expect(out).toEqual({ title: 'Lease' });
  });

  it('drops non-string and empty items from lists', () => {
    const out = cleanSummaryData({ obligations: ['ok', 5, null, '', 'also ok'] });
    expect(out).toEqual({ obligations: ['ok', 'also ok'] });
  });

  it('caps title and parties at 500 characters', () => {
    const out = cleanSummaryData({ title: 't'.repeat(600), parties: 'p'.repeat(501) });
    expect(out?.title).toHaveLength(500);
    expect(out?.parties).toHaveLength(500);
  });

  it('caps list items at 1000 characters and lists at 10 items', () => {
    const out = cleanSummaryData({
      obligations: Array.from({ length: 15 }, (_, i) => `${i}`.padEnd(1200, 'x')),
    });
    expect(out?.obligations).toHaveLength(10);
    expect(out?.obligations?.every((s) => s.length === 1000)).toBe(true);
  });

  it('cleans risks: caps size and count, fills a missing half with an empty string', () => {
    const out = cleanSummaryData({
      risks: [
        { title: 'Only title' },
        { description: 'Only description' },
        { title: '', description: '' },
        'not an object',
        null,
        { title: 'x'.repeat(1500), description: 'y' },
      ],
    });
    expect(out?.risks).toEqual([
      { title: 'Only title', description: '' },
      { title: '', description: 'Only description' },
      { title: 'x'.repeat(1000), description: 'y' },
    ]);
  });

  it('limits risks to 10 entries', () => {
    const risks = Array.from({ length: 12 }, (_, i) => ({ title: `r${i}`, description: 'd' }));
    expect(cleanSummaryData({ risks })?.risks).toHaveLength(10);
  });

  it('does not mutate its input', () => {
    const raw = { title: 'Lease', extra: 1 };
    cleanSummaryData(raw);
    expect(raw).toEqual({ title: 'Lease', extra: 1 });
  });
});
