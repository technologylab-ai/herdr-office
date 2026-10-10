import { useCallback, useEffect, useState } from 'react';

// The desk panel's width on desktop: dragged or keyed by the user, remembered in
// this browser, and always clamped so the panel fits the viewport.
const KEY = 'herdr-office:drawer-width';
export const DRAWER_MIN = 360;

/** Widest the panel may be: 85% of the viewport, and never closer than 48px to its left edge. */
export function drawerMax(viewport = window.innerWidth): number {
  return Math.max(DRAWER_MIN, Math.floor(Math.min(viewport * 0.85, viewport - 48)));
}

/** Matches the CSS defaults for --drawer-w. */
export function drawerDefault(viewport = window.innerWidth): number {
  return viewport <= 1180 ? 392 : 440;
}

export function clampDrawer(width: number, viewport = window.innerWidth): number {
  return Math.round(Math.min(drawerMax(viewport), Math.max(DRAWER_MIN, width)));
}

function readStored(): number | null {
  try {
    const n = Number(localStorage.getItem(KEY));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export interface DrawerWidth {
  /** Effective width in px, already clamped to the current viewport. */
  width: number;
  min: number;
  max: number;
  custom: boolean;
  set(width: number): void;
  reset(): void;
}

export function useDrawerWidth(): DrawerWidth {
  const [stored, setStored] = useState<number | null>(readStored);
  const [viewport, setViewport] = useState(() => window.innerWidth);

  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    try {
      if (stored === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, String(stored));
    } catch { /* private mode */ }
  }, [stored]);

  const set = useCallback((w: number) => setStored(clampDrawer(w, window.innerWidth)), []);
  const reset = useCallback(() => setStored(null), []);

  return {
    width: clampDrawer(stored ?? drawerDefault(viewport), viewport),
    min: DRAWER_MIN,
    max: drawerMax(viewport),
    custom: stored !== null,
    set,
    reset,
  };
}
