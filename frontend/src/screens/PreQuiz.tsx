import { useEffect, useRef } from 'react';
import { Screen } from '../components/Screen';
import { QuizQuestion } from '../components/QuizQuestion';
import { useApp } from '../state/AppContext';
import { useTranslation } from '../i18n/useTranslation';
import { preQuizResult } from '../lib/scoreCopy';

/** Ported from index.html #prequiz-screen. */
export function PreQuiz() {
  const {
    showScreen,
    loadSummary,
    preQuizQuestions,
    preQuizPicks,
    answerPreQuiz,
    preQuizAnswered,
    preQuizScore,
  } = useApp();
  const { t, language } = useTranslation();

  const questions = preQuizQuestions;
  const total = questions?.length ?? 0;
  const complete = questions != null && preQuizAnswered === total && total > 0;

  const resultsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (complete) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [complete]);

  const { label, message } = preQuizResult(language, preQuizScore);

  return (
    <Screen id="prequiz-screen">
      <div className="quiz-wrapper">
        <button className="quiz-back" onClick={() => showScreen('upload')}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          <span>{t('nav-back')}</span>
        </button>

        {questions == null ? (
          <div id="prequizLoading" className="quiz-loading">
            <div className="spinner"></div>
            <p>{t('prequiz-loading-p')}</p>
          </div>
        ) : (
          <div id="prequizContent" className="quiz-content visible">
            <div className="quiz-heading">
              <h2>{t('prequiz-h2')}</h2>
              <p>{t('prequiz-p')}</p>
            </div>

            <div
              className="prequiz-intro"
              dangerouslySetInnerHTML={{ __html: t('prequiz-intro') }}
            />

            <div id="prequizQuestions">
              {questions.map((q, qIdx) => (
                <QuizQuestion
                  key={qIdx}
                  qIdx={qIdx}
                  total={total}
                  question={q}
                  pick={preQuizPicks[qIdx] ?? null}
                  onPick={(oIdx) => answerPreQuiz(qIdx, oIdx)}
                  idPrefix="preopt"
                  questionIdPrefix="prequestion"
                />
              ))}
            </div>

            <div
              id="prequizResults"
              className={`quiz-results${complete ? ' visible' : ''}`}
              ref={resultsRef}
            >
              <div className="score-ring">
                <span className="score-num" id="prequizScoreNum">
                  {preQuizScore}
                </span>
                <span className="score-denom" id="prequizScoreDenom">
                  / {total}
                </span>
              </div>
              <p className="score-label" id="prequizScoreLabel">
                {label}
              </p>
              <p className="score-message" id="prequizScoreMessage">
                {message}
              </p>
              <button className="btn-see-summary" onClick={() => void loadSummary()}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                  />
                </svg>
                <span>{t('prequiz-see-summary')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Screen>
  );
}
