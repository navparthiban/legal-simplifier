import { useEffect, useRef } from 'react';
import { useApp } from '../state/AppContext';
import { useTranslation } from '../i18n/useTranslation';

/** The app's in-page error box (the `.error-banner` style first used on the
 *  Upload screen). `error` in context is a translation key, so the message
 *  follows the language toggle. Renders nothing when there is no error. */
export function ErrorBanner() {
  const { error } = useApp();
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  // Bring it into view — on PreQuiz/Summary it sits next to the retry button.
  useEffect(() => {
    if (error) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

  if (!error) return null;
  return (
    <div ref={ref} id="errorBanner" className="error-banner visible" role="alert">
      {t(error)}
    </div>
  );
}
