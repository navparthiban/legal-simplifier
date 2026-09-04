/**
 * Score → label/message copy, ported VERBATIM from index.html
 * (`showPreQuizResults`, `showResults`, `showComparison`). Kept as pure
 * functions of the active language + scores.
 */
import { tArr, tStr } from '../i18n/useTranslation';
import type { Language } from '../i18n/translations';

export function preQuizResult(language: Language, score: number) {
  const labels = tArr(language, 'prequiz-labels');
  const messages = tArr(language, 'prequiz-messages');
  return { label: labels[score] || '', message: messages[score] || '' };
}

export function quizResult(language: Language, score: number) {
  const labels = tArr(language, 'quiz-labels');
  const messages = tArr(language, 'quiz-messages');
  return { label: labels[score] || '', message: messages[score] || '' };
}

export type CompareTone = 'positive' | 'neutral' | 'negative';

export function comparison(language: Language, pre: number, post: number) {
  const diff = post - pre;

  if (diff > 0) {
    const word = diff === 1 ? tStr(language, 'compare-point') : tStr(language, 'compare-points');
    const improved = tArr(language, 'compare-improved');
    return {
      delta: `+${diff} ${word}`,
      tone: 'positive' as CompareTone,
      message:
        improved[diff] ||
        tStr(language, 'compare-improved-generic').replace('{diff}', String(diff)),
    };
  }

  if (diff === 0) {
    return {
      delta: tStr(language, 'compare-same-score'),
      tone: 'neutral' as CompareTone,
      message:
        pre === 5 ? tStr(language, 'compare-neutral-5') : tStr(language, 'compare-neutral-other'),
    };
  }

  const word = diff === -1 ? tStr(language, 'compare-point') : tStr(language, 'compare-points');
  return {
    delta: `${diff} ${word}`,
    tone: 'negative' as CompareTone,
    message: tStr(language, 'compare-negative'),
  };
}
