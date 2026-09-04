/**
 * `validateQuestions` and `escHtml` ported VERBATIM from index.html.
 *
 * Note on escHtml: in the original, quiz/summary strings from the model are
 * injected via innerHTML, so escHtml is a security necessity. In this React port
 * every model string is rendered as a JSX text child, which React escapes
 * automatically — behaviorally equivalent. escHtml is kept here for parity /
 * reference; it is not on the render path.
 */
import type { Question } from './types';

export function validateQuestions(questions: any[]): Question[] {
  const PLACEHOLDER = 'Not stated in the contract';
  return questions
    .filter(
      (q) =>
        q &&
        typeof q.question === 'string' &&
        Array.isArray(q.options) &&
        q.options.length >= 1,
    )
    .map((q) => {
      let opts = q.options.map(String);
      let correct = Number.isInteger(q.correct) ? q.correct : 0;

      // Pad to exactly 4
      while (opts.length < 4) opts.push(PLACEHOLDER);

      // Trim to exactly 4, keeping the correct answer
      if (opts.length > 4) {
        const correctOpt = opts[correct];
        const others = opts.filter((_: string, i: number) => i !== correct).slice(0, 3);
        opts = [correctOpt, ...others];
        correct = 0;
      }

      return { ...q, options: opts, correct };
    });
}

export function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
