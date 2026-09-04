import { useTranslation } from '../i18n/useTranslation';
import type { Question } from '../lib/types';

/**
 * One question card — shared by the pre-quiz and the post-summary quiz.
 * Locking / colouring logic ported from index.html `selectAnswer` /
 * `selectPreAnswer`: once answered, every option is disabled, the correct one
 * gets `opt-correct`, the picked wrong one gets `opt-wrong`, the rest
 * `opt-dimmed`.
 */
export function QuizQuestion({
  qIdx,
  total,
  question,
  pick,
  onPick,
  idPrefix,
  questionIdPrefix,
}: {
  qIdx: number;
  total: number;
  question: Question;
  pick: number | null;
  onPick: (oIdx: number) => void;
  idPrefix: string;
  questionIdPrefix: string;
}) {
  const { t } = useTranslation();
  const answered = pick != null;
  const number = t('quiz-question-of')
    .replace('{n}', String(qIdx + 1))
    .replace('{total}', String(total));

  const optionClass = (i: number) => {
    if (!answered) return 'q-option';
    if (i === question.correct) return 'q-option opt-correct';
    if (i === pick && pick !== question.correct) return 'q-option opt-wrong';
    return 'q-option opt-dimmed';
  };

  return (
    <div className="quiz-question" id={`${questionIdPrefix}-${qIdx}`}>
      <p className="q-number">{number}</p>
      <p className="q-text">{question.question}</p>
      <div className="q-options">
        {question.options.map((opt, oIdx) => (
          <button
            key={oIdx}
            className={optionClass(oIdx)}
            id={`${idPrefix}-${qIdx}-${oIdx}`}
            disabled={answered}
            onClick={() => {
              if (!answered) onPick(oIdx);
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
