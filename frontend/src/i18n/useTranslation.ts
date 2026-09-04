import { useApp } from '../state/AppContext';
import { translate, type Language } from './translations';

export function tStr(language: Language, key: string): string {
  const v = translate(language, key);
  return Array.isArray(v) ? key : v;
}

export function tArr(language: Language, key: string): string[] {
  const v = translate(language, key);
  return Array.isArray(v) ? v : [];
}

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
