import type { ReactNode } from 'react';
import { useApp } from '../state/AppContext';

/**
 * Wrapper for a screen `<main>`. Always carries `screen active`; toggles
 * `screen-visible` from context to drive the 0.18s opacity fade, matching
 * index.html's `.screen` / `.screen.active` / `.screen.active.screen-visible`.
 */
export function Screen({ id, children }: { id: string; children: ReactNode }) {
  const { screenVisible } = useApp();
  return (
    <main id={id} className={`screen active${screenVisible ? ' screen-visible' : ''}`}>
      {children}
    </main>
  );
}
