import { useCallback, useEffect, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';

// One timer per interval, shared by every subscriber, so labels that tick at
// the same rate (roster, drawer, masthead) always agree on the time.
interface Clock { now: number; listeners: Set<() => void>; timer: ReturnType<typeof setInterval> | null }
const clocks = new Map<number, Clock>();

function clockFor(intervalMs: number): Clock {
  let clock = clocks.get(intervalMs);
  if (!clock) clocks.set(intervalMs, clock = { now: Date.now(), listeners: new Set(), timer: null });
  return clock;
}

/** Re-renders on an interval; for "updated 4s ago" style labels. */
export function useNow(intervalMs = 1000): number {
  const clock = clockFor(intervalMs);
  const subscribe = useCallback((notify: () => void) => {
    clock.listeners.add(notify);
    if (!clock.timer) {
      // The shared reading may be stale after an idle stretch; refresh it at once.
      clock.now = Date.now();
      clock.timer = setInterval(() => {
        clock.now = Date.now();
        clock.listeners.forEach((l) => l());
      }, intervalMs);
      notify();
    }
    return () => {
      clock.listeners.delete(notify);
      if (clock.listeners.size === 0 && clock.timer) { clearInterval(clock.timer); clock.timer = null; }
    };
  }, [clock, intervalMs]);
  return useSyncExternalStore(subscribe, () => clock.now);
}

export function useStoredState(key: string, initial: string): [string, Dispatch<SetStateAction<string>>];
export function useStoredState(key: string, initial: boolean): [boolean, Dispatch<SetStateAction<boolean>>];
export function useStoredState<T extends string | boolean>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      return (typeof initial === 'boolean' ? raw === 'true' : raw) as T;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, String(value)); } catch { /* private mode */ }
  }, [key, value]);
  return [value, setValue];
}

/** A whole number remembered in this browser, kept within [min, max]. */
export function useStoredNumber(key: string, initial: number, min: number, max: number): [number, (next: number) => void] {
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const [value, setValue] = useState(() => {
    try {
      const n = Number(localStorage.getItem(key) ?? NaN);
      return Number.isFinite(n) ? clamp(n) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, String(value)); } catch { /* private mode */ }
  }, [key, value]);
  return [value, (next: number) => setValue(clamp(next))];
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);
  return matches;
}

export function detectWebGL(): string | null {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return 'This browser could not create a WebGL context, so the 3D office cannot be drawn. Check that hardware acceleration is enabled.';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  } catch {
    return 'WebGL is unavailable in this browser, so the 3D office cannot be drawn.';
  }
}
