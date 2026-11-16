import { describe, it, expect } from 'vitest';
import { parseJSON } from './parseJSON';

const UNEXPECTED = 'The AI returned an unexpected response. Please try again.';

describe('parseJSON', () => {
  it('parses a plain JSON object', () => {
    expect(parseJSON('{"title":"Lease","parties":"A and B"}')).toEqual({
      title: 'Lease',
      parties: 'A and B',
    });
  });

  it('strips ```json fences', () => {
    const raw = '```json\n{"title":"Lease"}\n```';
    expect(parseJSON(raw)).toEqual({ title: 'Lease' });
  });

  it('strips bare ``` fences', () => {
    expect(parseJSON('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('skips prose before the first brace', () => {
    expect(parseJSON('Sure! Here is the summary:\n{"title":"Lease"}')).toEqual({ title: 'Lease' });
  });

  it('ignores prose after the closing brace (via the outermost-block fallback)', () => {
    expect(parseJSON('{"title":"Lease"}\nHope this helps!')).toEqual({ title: 'Lease' });
  });

  it('tolerates trailing commas in objects and arrays', () => {
    const raw = '{"obligations":["Pay rent","Keep clean",],"title":"Lease",}';
    expect(parseJSON(raw)).toEqual({ obligations: ['Pay rent', 'Keep clean'], title: 'Lease' });
  });

  it('parses nested objects', () => {
    const raw = '{"risks":[{"title":"Fee","description":"You pay."}]}';
    expect(parseJSON(raw).risks[0]).toEqual({ title: 'Fee', description: 'You pay.' });
  });

  it('throws the friendly error on garbage input', () => {
    expect(() => parseJSON('this is not json at all')).toThrow(UNEXPECTED);
  });

  it('throws the friendly error on an empty string', () => {
    expect(() => parseJSON('')).toThrow(UNEXPECTED);
  });

  it('throws the friendly error on a truncated object', () => {
    expect(() => parseJSON('{"title":"Lease","parties":')).toThrow(UNEXPECTED);
  });
});
