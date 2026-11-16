import { describe, it, expect } from 'vitest';
import { preQuizResult, quizResult, comparison } from './scoreCopy';
import type { Language } from '../i18n/translations';

const LANGS: Language[] = ['en', 'es'];
const SCORES = [0, 1, 2, 3, 4, 5];

describe('preQuizResult', () => {
  it.each(LANGS)('returns a non-empty label and message for every score 0-5 (%s)', (lang) => {
    for (const score of SCORES) {
      const r = preQuizResult(lang, score);
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.message.length).toBeGreaterThan(0);
    }
  });

  it('gives a different label for the lowest and highest score', () => {
    for (const lang of LANGS) {
      expect(preQuizResult(lang, 0).label).not.toBe(preQuizResult(lang, 5).label);
    }
  });

  it('differs between English and Spanish', () => {
    for (const score of SCORES) {
      const en = preQuizResult('en', score);
      const es = preQuizResult('es', score);
      expect(en.label).not.toBe(es.label);
      expect(en.message).not.toBe(es.message);
    }
  });

  it('falls back to empty strings for an out-of-range score', () => {
    expect(preQuizResult('en', 6)).toEqual({ label: '', message: '' });
    expect(preQuizResult('en', -1)).toEqual({ label: '', message: '' });
  });
});

describe('quizResult', () => {
  it.each(LANGS)('returns a non-empty label and message for every score 0-5 (%s)', (lang) => {
    for (const score of SCORES) {
      const r = quizResult(lang, score);
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.message.length).toBeGreaterThan(0);
    }
  });

  it('uses different copy from the pre-quiz', () => {
    expect(quizResult('en', 0).label).not.toBe(preQuizResult('en', 0).label);
  });

  it('differs between English and Spanish', () => {
    for (const score of SCORES) {
      expect(quizResult('en', score).label).not.toBe(quizResult('es', score).label);
      expect(quizResult('en', score).message).not.toBe(quizResult('es', score).message);
    }
  });

  it('falls back to empty strings for an out-of-range score', () => {
    expect(quizResult('es', 6)).toEqual({ label: '', message: '' });
  });
});

describe('comparison', () => {
  it('improved by 1 point: positive tone, singular word', () => {
    const r = comparison('en', 2, 3);
    expect(r.tone).toBe('positive');
    expect(r.delta).toBe('+1 point');
    expect(r.message.length).toBeGreaterThan(0);
  });

  it('improved by several points: positive tone, plural word', () => {
    const r = comparison('en', 0, 5);
    expect(r.tone).toBe('positive');
    expect(r.delta).toBe('+5 points');
    expect(r.message.length).toBeGreaterThan(0);
  });

  it('every possible improvement (1-5) has a message', () => {
    for (const lang of LANGS) {
      for (let diff = 1; diff <= 5; diff++) {
        const r = comparison(lang, 0, diff);
        expect(r.tone).toBe('positive');
        expect(r.delta.startsWith(`+${diff} `)).toBe(true);
        expect(r.message.length).toBeGreaterThan(0);
      }
    }
  });

  it('same score: neutral tone', () => {
    const r = comparison('en', 3, 3);
    expect(r.tone).toBe('neutral');
    expect(r.delta.length).toBeGreaterThan(0);
    expect(r.delta).not.toMatch(/^[+-]/);
  });

  it('same score of 5 gets a different message than other same scores', () => {
    expect(comparison('en', 5, 5).message).not.toBe(comparison('en', 3, 3).message);
    expect(comparison('en', 0, 0).message).toBe(comparison('en', 3, 3).message);
  });

  it('worse by 1 point: negative tone, singular word', () => {
    const r = comparison('en', 4, 3);
    expect(r.tone).toBe('negative');
    expect(r.delta).toBe('-1 point');
    expect(r.message.length).toBeGreaterThan(0);
  });

  it('worse by several points: negative tone, plural word', () => {
    const r = comparison('en', 5, 0);
    expect(r.tone).toBe('negative');
    expect(r.delta).toBe('-5 points');
  });

  it('uses the same negative message regardless of how much worse', () => {
    expect(comparison('en', 5, 4).message).toBe(comparison('en', 5, 0).message);
  });

  it('Spanish copy differs from English and is non-empty for every case', () => {
    const cases: [number, number][] = [
      [0, 1],
      [0, 5],
      [3, 3],
      [5, 5],
      [4, 3],
      [5, 0],
    ];
    for (const [pre, post] of cases) {
      const en = comparison('en', pre, post);
      const es = comparison('es', pre, post);
      expect(es.tone).toBe(en.tone);
      expect(es.message.length).toBeGreaterThan(0);
      expect(es.delta.length).toBeGreaterThan(0);
      expect(es.message).not.toBe(en.message);
      expect(es.delta).not.toBe(en.delta);
    }
  });
});
