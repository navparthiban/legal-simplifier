import { Screen } from '../components/Screen';
import { useApp } from '../state/AppContext';
import { useTranslation } from '../i18n/useTranslation';
import { comparison } from '../lib/scoreCopy';

/** Ported from index.html #compare-screen + `showComparison`. */
export function Compare() {
  const { showScreen, preQuizScore, quizScore } = useApp();
  const { t, language } = useTranslation();

  const { delta, tone, message } = comparison(language, preQuizScore, quizScore);

  return (
    <Screen id="compare-screen">
      <div className="compare-wrapper">
        <div className="compare-heading">
          <h2>{t('compare-h2')}</h2>
          <p>{t('compare-p')}</p>
        </div>

        <div className="compare-cards">
          <div className="compare-card">
            <p className="compare-card-label">{t('compare-pre-label')}</p>
            <p className="compare-score-num" id="comparePreNum">
              {preQuizScore}
            </p>
            <p className="compare-score-denom">{t('compare-denom')}</p>
          </div>
          <div className="compare-card">
            <p className="compare-card-label">{t('compare-post-label')}</p>
            <p className="compare-score-num" id="comparePostNum">
              {quizScore}
            </p>
            <p className="compare-score-denom">{t('compare-denom')}</p>
          </div>
        </div>

        <div className="compare-improvement">
          <p className={`compare-delta ${tone}`} id="compareDelta">
            {delta}
          </p>
          <p className="compare-msg" id="compareMsg">
            {message}
          </p>
        </div>

        <div className="compare-actions">
          <button className="btn-primary" onClick={() => showScreen('home')}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
              />
            </svg>
            <span>{t('compare-upload-btn')}</span>
          </button>
        </div>
      </div>
    </Screen>
  );
}
