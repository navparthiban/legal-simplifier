import { Screen } from '../components/Screen';
import { useApp } from '../state/AppContext';
import { useTranslation } from '../i18n/useTranslation';

/**
 * Home — a hero statement, then the signature device: a quoted piece of
 * legalese resolving into plain language. The three capabilities are ledger
 * rows down a signature rule, not a card grid.
 */
export function Home() {
  const { showScreen, loadSampleContract } = useApp();
  const { t } = useTranslation();

  return (
    <Screen id="home-screen">
      <div className="home-doc">
        <section className="hero">
          <h1>{t('home-h1')}</h1>
          <p>{t('home-p')}</p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={() => showScreen('upload')}>
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
              <span>{t('home-upload-btn')}</span>
            </button>
            <button className="link-quiet" onClick={() => void loadSampleContract()}>
              {t('home-sample-link')}
            </button>
          </div>
        </section>

        <figure className="annotation reveal">
          <blockquote className="legalese">
            <span className="ann-label">{t('home-ann-legalese-label')}</span>
            <q>{t('home-ann-legalese')}</q>
          </blockquote>
          <div className="resolve-rule" />
          <figcaption className="plain">
            <span className="ann-label">{t('home-ann-label')}</span>
            <p>{t('home-ann-plain')}</p>
          </figcaption>
        </figure>

        <section className="ledger-section">
          <h2>{t('home-ledger-h2')}</h2>
          <div className="ledger">
            <div className="ledger-row">
              <h3>{t('home-card1-h3')}</h3>
              <p>{t('home-card1-p')}</p>
            </div>
            <div className="ledger-row">
              <h3>{t('home-card2-h3')}</h3>
              <p>{t('home-card2-p')}</p>
            </div>
            <div className="ledger-row">
              <h3>{t('home-card3-h3')}</h3>
              <p>{t('home-card3-p')}</p>
            </div>
          </div>
        </section>
      </div>
    </Screen>
  );
}
