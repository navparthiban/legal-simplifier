import { describe, it, expect } from 'vitest';
import { TRANSLATIONS, tStr, tArr } from './translations';

const en = TRANSLATIONS.en;
const es = TRANSLATIONS.es;
const enKeys = Object.keys(en);
const esKeys = Object.keys(es);

describe('TRANSLATIONS', () => {
  it('has the same set of keys in EN and ES', () => {
    const missingInEs = enKeys.filter((k) => !(k in es));
    const missingInEn = esKeys.filter((k) => !(k in en));
    expect({ missingInEs, missingInEn }).toEqual({ missingInEs: [], missingInEn: [] });
  });

  it('has no empty string values', () => {
    const empty: string[] = [];
    for (const lang of ['en', 'es'] as const) {
      for (const [key, value] of Object.entries(TRANSLATIONS[lang])) {
        if (typeof value === 'string' && value.trim() === '') empty.push(`${lang}.${key}`);
        if (Array.isArray(value) && value.length === 0) empty.push(`${lang}.${key} (empty array)`);
      }
    }
    expect(empty).toEqual([]);
  });

  it('has no empty entries in arrays, except the intentional blank at index 0 of compare-improved', () => {
    const empty: string[] = [];
    for (const lang of ['en', 'es'] as const) {
      for (const [key, value] of Object.entries(TRANSLATIONS[lang])) {
        if (!Array.isArray(value)) continue;
        value.forEach((item, i) => {
          if (item.trim() === '' && !(key === 'compare-improved' && i === 0)) {
            empty.push(`${lang}.${key}[${i}]`);
          }
        });
      }
    }
    expect(empty).toEqual([]);
  });

  it('uses the same value type (string vs array) for each key in both languages', () => {
    const mismatched = enKeys.filter(
      (k) => k in es && Array.isArray(en[k]) !== Array.isArray(es[k]),
    );
    expect(mismatched).toEqual([]);
  });

  it('has array-valued keys of the same length in both languages', () => {
    const mismatched = enKeys
      .filter((k) => Array.isArray(en[k]) && Array.isArray(es[k]))
      .filter((k) => (en[k] as string[]).length !== (es[k] as string[]).length)
      .map((k) => `${k}: en=${(en[k] as string[]).length} es=${(es[k] as string[]).length}`);
    expect(mismatched).toEqual([]);
  });

  it('has 6 entries (scores 0-5) in each score-indexed array', () => {
    for (const key of ['prequiz-labels', 'prequiz-messages', 'quiz-labels', 'quiz-messages', 'compare-improved']) {
      expect((en[key] as string[]).length).toBe(6);
      expect((es[key] as string[]).length).toBe(6);
    }
  });
});

describe('tStr / tArr', () => {
  it('return the active language value', () => {
    expect(tStr('en', 'home-h1')).toBe(en['home-h1']);
    expect(tStr('es', 'home-h1')).toBe(es['home-h1']);
    expect(tArr('es', 'quiz-labels')).toEqual(es['quiz-labels']);
  });

  it('fall back to the key itself for an unknown key', () => {
    expect(tStr('en', 'no-such-key')).toBe('no-such-key');
    expect(tStr('es', 'no-such-key')).toBe('no-such-key');
  });

  it('tStr returns the key for an array value and tArr returns [] for a string value', () => {
    expect(tStr('en', 'quiz-labels')).toBe('quiz-labels');
    expect(tArr('en', 'home-h1')).toEqual([]);
  });
});
