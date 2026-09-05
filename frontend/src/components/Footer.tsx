import { useTranslation } from '../i18n/useTranslation';

/** Ported from index.html <footer>. */
export function Footer() {
  const { t } = useTranslation();
  return (
    <footer>
      <span className="foot-mark">ClearSign</span>
      <span>&copy; 2026</span>
      <span>{t('footer-disclaimer')}</span>
    </footer>
  );
}
