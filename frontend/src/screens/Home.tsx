import { Screen } from '../components/Screen';
import { useApp } from '../state/AppContext';
import { useTranslation } from '../i18n/useTranslation';

/** Ported from index.html #home-screen (hero + feature cards). */
export function Home() {
  const { showScreen } = useApp();
  const { t } = useTranslation();
  return (
    <Screen id="home-screen">
      <section className="hero">
        <h1>{t('home-h1')}</h1>
        <p>{t('home-p')}</p>
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
      </section>

      <div className="divider"></div>

      <section className="features">
        <div className="card">
          <div className="card-label">{t('home-card1-label')}</div>
          <h3>{t('home-card1-h3')}</h3>
          <p>{t('home-card1-p')}</p>
        </div>
        <div className="card">
          <div className="card-label">{t('home-card2-label')}</div>
          <h3>{t('home-card2-h3')}</h3>
          <p>{t('home-card2-p')}</p>
        </div>
        <div className="card">
          <div className="card-label">{t('home-card3-label')}</div>
          <h3>{t('home-card3-h3')}</h3>
          <p>{t('home-card3-p')}</p>
        </div>
      </section>
    </Screen>
  );
}
