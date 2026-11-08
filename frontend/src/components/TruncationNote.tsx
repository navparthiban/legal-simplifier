import { useApp } from '../state/AppContext';
import { useTranslation } from '../i18n/useTranslation';

/** Quiet note shown when a contract was too long (or a scan had too many pages)
 *  to analyze in full. Renders nothing otherwise. */
export function TruncationNote() {
  const { contract } = useApp();
  const { t } = useTranslation();
  const trunc = contract?.truncation;
  if (!trunc) return null;

  const text =
    trunc.kind === 'pages'
      ? t('truncated-pages').replace('{used}', String(trunc.used)).replace('{total}', String(trunc.total))
      : t('truncated-text');

  return (
    <p className="truncation-note" role="note">
      {text}
    </p>
  );
}
