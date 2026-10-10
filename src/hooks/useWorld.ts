import { useCallback, useEffect, useState } from 'react';
import type { WorldState } from '../types';
import { describeError, getJSON, isAbort } from './api';

export type BridgeStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface WorldFeed {
  world: WorldState | null;
  status: BridgeStatus;
  error: string | null;
  /** Local time the last WorldState arrived (ms). */
  receivedAt: number | null;
  retry(): void;
}

function isWorldState(value: unknown): value is WorldState {
  return !!value && typeof value === 'object' && Array.isArray((value as WorldState).connections);
}

/**
 * Initial GET /api/world, then live 'world' events from /api/events.
 * When the stream closes (bridge stopped) we back off and reopen it, and
 * refetch the full world on every successful (re)open.
 */
export function useWorld(): WorldFeed {
  const [world, setWorld] = useState<WorldState | null>(null);
  const [status, setStatus] = useState<BridgeStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [receivedAt, setReceivedAt] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let disposed = false;
    let source: EventSource | null = null;
    let reopenTimer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const controller = new AbortController();

    const accept = (value: unknown) => {
      if (disposed || !isWorldState(value)) return;
      setWorld(value);
      setReceivedAt(Date.now());
    };

    const load = async () => {
      try {
        accept(await getJSON<unknown>('/api/world', controller.signal));
        if (!disposed) setError(null);
        return true;
      } catch (e) {
        if (!disposed && !isAbort(e)) setError(describeError(e));
        return false;
      }
    };

    const open = () => {
      if (disposed) return;
      const es = new EventSource('/api/events');
      source = es;
      es.addEventListener('open', () => {
        if (disposed) return;
        const wasDown = failures > 0;
        failures = 0;
        setStatus('live');
        setError(null);
        if (wasDown) void load();
      });
      es.addEventListener('world', (event) => {
        try {
          accept(JSON.parse((event as MessageEvent<string>).data));
          if (!disposed) setStatus('live');
        } catch {
          /* ignore malformed frame; next frame will replace it */
        }
      });
      es.addEventListener('error', () => {
        if (disposed) return;
        if (es.readyState === EventSource.CLOSED) {
          es.close();
          if (source === es) source = null;
          failures += 1;
          setStatus('offline');
          setError((prev) => prev ?? 'Lost the live connection to the Herdr Office bridge.');
          const delay = Math.min(15000, 1000 * 2 ** Math.min(failures, 4));
          reopenTimer = setTimeout(open, delay);
        } else {
          setStatus((s) => (s === 'live' ? 'reconnecting' : s));
        }
      });
    };

    setStatus('connecting');
    void load().then((ok) => {
      if (!ok && !disposed) setStatus((s) => (s === 'live' ? s : 'offline'));
    });
    open();

    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(reopenTimer);
      source?.close();
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return { world, status, error, receivedAt, retry };
}
