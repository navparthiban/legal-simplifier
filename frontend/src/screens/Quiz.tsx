import { useEffect, useRef } from 'react';
import { Screen } from '../components/Screen';
import { QuizQuestion } from '../components/QuizQuestion';
import { useApp } from '../state/AppContext';
import { useTranslation } from '../i18n/useTranslation';
import { quizResult } from '../lib/scoreCopy';

/** Ported from index.html #quiz-screen. */
export function Quiz() {
  const {
    showScreen,
    startQuiz,
    quizQuestions,
    quizPicks,
    answerQuiz,
    quizAnswered,
    quizScore,
  } = useApp();
  const { t, language } = useTranslation();

  const questions = quizQuestions;
  const total = questions?.length ?? 0;
  const complete = questions != null && quizAnswered === total && total > 0;

  const resultsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (complete) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [complete]);

  const { label, message } = quizResult(language, quizScore);

  return (
    <Screen id="quiz-screen">
      <div className="quiz-wrapper">
        <button className="quiz-back" onClick={() => showScreen('summary')}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          <span>{t('quiz-back')}</span>
        </button>

        {questions == null ? (
          <div id="quizLoading" className="quiz-loading">
            <div className="spinner"></div>
            <p>{t('quiz-loading-p')}</p>
          </div>
        ) : (
          <div id="quizContent" className="quiz-content visible">
            <div className="quiz-heading">
              <h2>{t('quiz-h2')}</h2>
              <p>{t('quiz-p')}</p>
            </div>

            <div id="quizQuestions">
              {questions.map((q, qIdx) => (
                <QuizQuestion
                  key={qIdx}
                  qIdx={qIdx}
                  total={total}
                  question={q}
                  pick={quizPicks[qIdx] ?? null}
                  onPick={(oIdx) => answerQuiz(qIdx, oIdx)}
                  idPrefix="opt"
                  questionIdPrefix="question"
                />
              ))}
            </div>

            <div
              id="quizResults"
              className={`quiz-results${complete ? ' visible' : ''}`}
              ref={resultsRef}
            >
              <div className="score-ring">
                <span className="score-num" id="scoreNum">
                  {quizScore}
                </span>
                <span className="score-denom" id="scoreDenom">
                  / {total}
                </span>
              </div>
              <p className="score-label" id="scoreLabel">
                {label}
              </p>
              <p className="score-message" id="scoreMessage">
                {message}
              </p>
              <button className="btn-retry" onClick={() => void startQuiz()}>
                {t('quiz-retry')}
              </button>
              <button className="btn-back-summary" onClick={() => showScreen('summary')}>
                {t('quiz-back-summary')}
              </button>
              <button
                className="btn-primary"
                style={{ marginTop: '.75rem', width: '100%', justifyContent: 'center' }}
                onClick={() => showScreen('compare')}
              >
                <span>{t('quiz-progress')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Screen>
  );
}
