import { useTranslation } from '../i18n/useTranslation';

/** Ported from index.html <footer>. */
export function Footer() {
  const { t } = useTranslation();
  return (
    <footer>
      &copy; 2026 ClearSign &mdash; <span>{t('footer-disclaimer')}</span>
    </footer>
  );
}
