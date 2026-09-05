import { useApp } from '../state/AppContext';

/** Nav: wordmark with a signature underline on "Sign" + a hairline EN/ES toggle. */
export function Nav() {
  const { language, setLanguage, showScreen } = useApp();
  return (
    <nav>
      <a
        className="nav-brand"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          showScreen('home');
        }}
      >
        Clear<span className="brand-mark">Sign</span>
      </a>

      <div className="lang-toggle" id="langToggle">
        <button
          className={`lang-btn${language === 'en' ? ' active' : ''}`}
          id="btnEn"
          onClick={() => setLanguage('en')}
        >
          EN
        </button>
        <span aria-hidden="true">·</span>
        <button
          className={`lang-btn${language === 'es' ? ' active' : ''}`}
          id="btnEs"
          onClick={() => setLanguage('es')}
        >
          ES
        </button>
      </div>
    </nav>
  );
}
