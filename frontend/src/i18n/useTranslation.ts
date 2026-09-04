import { useApp } from '../state/AppContext';
import { tArr, tStr } from './translations';

/** Hook mirroring the original `t()` helper, bound to the active language from
 *  context so components re-render on a language switch. */
export function useTranslation() {
  const { language } = useApp();
  return {
    language,
    /** string lookup (matches `t(key)` for scalar keys) */
    t: (key: string) => tStr(language, key),
    /** array lookup (for the *-labels / *-messages / compare-improved keys) */
    tArr: (key: string) => tArr(language, key),
  };
}
