import { describe, it, expect } from 'vitest';
import { _sumPartialStr, _sumCompleteArr, _sumExtractPartial } from './summaryStream';

const FULL = `{
  "title": "Residential Lease",
  "parties": "Acme Landlord and Jane Tenant, effective Jan 1.",
  "obligations": ["Pay rent monthly", "Keep the unit clean"],
  "deadlines": ["Rent due on the 1st"],
  "rights": ["Quiet enjoyment"],
  "risks": [
    { "title": "Late fee", "description": "A $50 fee applies after 3 days." },
    { "title": "Entry", "description": "Landlord may enter with 24h notice." }
  ]
}`;

/** The first `n` characters of FULL, to simulate a stream cut off part-way. */
const cut = (marker: string, extra = 0) => FULL.slice(0, FULL.indexOf(marker) + extra);

describe('_sumPartialStr', () => {
  it('returns null when the field has not started', () => {
    expect(_sumPartialStr('{"tit', 'title')).toBeNull();
    expect(_sumPartialStr('{', 'title')).toBeNull();
  });

  it('returns null when there is no colon or opening quote yet', () => {
    expect(_sumPartialStr('{"title"', 'title')).toBeNull();
    expect(_sumPartialStr('{"title":', 'title')).toBeNull();
    expect(_sumPartialStr('{"title": ', 'title')).toBeNull();
  });

  it('returns null for an opened string with no characters yet', () => {
    expect(_sumPartialStr('{"title": "', 'title')).toBeNull();
  });

  it('returns an incomplete value mid-string', () => {
    expect(_sumPartialStr('{"title": "Resident', 'title')).toEqual({
      value: 'Resident',
      complete: false,
    });
  });

  it('returns a complete value once the closing quote arrives', () => {
    expect(_sumPartialStr('{"title": "Residential Lease", "par', 'title')).toEqual({
      value: 'Residential Lease',
      complete: true,
    });
  });

  it('unescapes quotes, newlines and tabs', () => {
    const text = '{"title": "The \\"Big\\" Deal\\nLine2\\tTabbed"}';
    expect(_sumPartialStr(text, 'title')).toEqual({
      value: 'The "Big" Deal\nLine2\tTabbed',
      complete: true,
    });
  });

  it('does not stop at an escaped quote when the string is still open', () => {
    expect(_sumPartialStr('{"title": "Say \\"hi', 'title')).toEqual({
      value: 'Say "hi',
      complete: false,
    });
  });

  it('returns null if the value is not a string', () => {
    expect(_sumPartialStr('{"title": 42}', 'title')).toBeNull();
  });
});

describe('_sumCompleteArr', () => {
  it('returns null when the field is missing or has no bracket yet', () => {
    expect(_sumCompleteArr('{"title": "x"}', 'obligations')).toBeNull();
    expect(_sumCompleteArr('{"obligations": ', 'obligations')).toBeNull();
  });

  it('returns null while the array is still open', () => {
    expect(_sumCompleteArr('{"obligations": ["Pay rent", "Keep cl', 'obligations')).toBeNull();
  });

  it('returns the array once the closing bracket is present', () => {
    expect(_sumCompleteArr('{"obligations": ["Pay rent", "Clean"], "dead', 'obligations')).toEqual([
      'Pay rent',
      'Clean',
    ]);
  });

  it('handles brackets and escaped quotes inside strings', () => {
    const text = '{"rights": ["Use of [the] unit", "The \\"quiet\\" clause ]"], "risks": [';
    expect(_sumCompleteArr(text, 'rights')).toEqual(['Use of [the] unit', 'The "quiet" clause ]']);
  });

  it('returns an array of objects once its final bracket arrives', () => {
    const text = '{"risks": [{"title": "Fee", "description": "Pay"}]}';
    expect(_sumCompleteArr(text, 'risks')).toEqual([{ title: 'Fee', description: 'Pay' }]);
  });

  it('returns null if the bracketed text is not valid JSON', () => {
    expect(_sumCompleteArr('{"rights": [oops]}', 'rights')).toBeNull();
  });
});

describe('_sumExtractPartial', () => {
  it('returns all nulls for an empty stream', () => {
    expect(_sumExtractPartial('')).toEqual({
      title: null,
      parties: null,
      obligations: null,
      deadlines: null,
      rights: null,
      risks: null,
    });
  });

  it('mid-title: only an incomplete title', () => {
    const p = _sumExtractPartial(cut('Lease', 2));
    expect(p.title).toEqual({ value: 'Residential Le', complete: false });
    expect(p.parties).toBeNull();
    expect(p.obligations).toBeNull();
  });

  it('after the title: complete title, parties not started', () => {
    const p = _sumExtractPartial(cut('"parties"'));
    expect(p.title).toEqual({ value: 'Residential Lease', complete: true });
    expect(p.parties).toBeNull();
  });

  it('mid-array: earlier fields are filled, the open array stays null', () => {
    const p = _sumExtractPartial(cut('"Keep the unit'));
    expect(p.title?.complete).toBe(true);
    expect(p.parties?.complete).toBe(true);
    expect(p.obligations).toBeNull();
    expect(p.deadlines).toBeNull();
  });

  it('mid-risk-object: lists before risks are complete, risks is null', () => {
    const p = _sumExtractPartial(cut('"Entry"', 3));
    expect(p.obligations).toEqual(['Pay rent monthly', 'Keep the unit clean']);
    expect(p.deadlines).toEqual(['Rent due on the 1st']);
    expect(p.rights).toEqual(['Quiet enjoyment']);
    expect(p.risks).toBeNull();
  });

  it('complete stream: every field filled', () => {
    const p = _sumExtractPartial(FULL);
    expect(p.title).toEqual({ value: 'Residential Lease', complete: true });
    expect(p.parties).toEqual({
      value: 'Acme Landlord and Jane Tenant, effective Jan 1.',
      complete: true,
    });
    expect(p.obligations).toHaveLength(2);
    expect(p.deadlines).toEqual(['Rent due on the 1st']);
    expect(p.rights).toEqual(['Quiet enjoyment']);
    expect(p.risks).toEqual([
      { title: 'Late fee', description: 'A $50 fee applies after 3 days.' },
      { title: 'Entry', description: 'Landlord may enter with 24h notice.' },
    ]);
  });

  it('handles an escaped quote inside a string value', () => {
    const text =
      '{"title": "The \\"Master\\" Agreement", "obligations": ["Honor the \\"deal\\"", "Pay"], "dea';
    const p = _sumExtractPartial(text);
    expect(p.title).toEqual({ value: 'The "Master" Agreement', complete: true });
    expect(p.obligations).toEqual(['Honor the "deal"', 'Pay']);
    expect(p.deadlines).toBeNull();
  });
});
