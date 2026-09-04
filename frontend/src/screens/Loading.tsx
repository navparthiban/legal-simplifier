import { Screen } from '../components/Screen';
import { useApp } from '../state/AppContext';
import { useTranslation } from '../i18n/useTranslation';

/** Ported from index.html #loading-screen. */
export function Loading() {
  const { loadingLabel } = useApp();
  const { t } = useTranslation();
  return (
    <Screen id="loading-screen">
      <div className="loading-body">
        <div className="spinner"></div>
        <p className="loading-label" id="loadingLabel">
          {loadingLabel}
        </p>
        <p className="loading-sub">{t('loading-sub')}</p>
      </div>
    </Screen>
  );
}
