import { useEffect, useState } from 'react';
import { describeError, getJSON, isAbort, terminalPath, type TerminalSource } from './api';

export interface TerminalFeed {
  text: string | null;
  error: string | null;
  updatedAt: number | null;
  loading: boolean;
}

const EMPTY: TerminalFeed = { text: null, error: null, updatedAt: null, loading: false };

// Strip ANSI/OSC control sequences in case the bridge passes raw bytes through.
const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)|\u001b[@-Z\\-_]/g;
export function plainText(text: string): string {
  return text.replace(ANSI, '').replace(/\r(?!\n)/g, '');
}

/**
 * Polls a pane's terminal text while `enabled`. Requests never overlap: the next
 * read is scheduled only after the previous one settles. Switching pane/source or
 * unmounting aborts the in-flight read.
 */
export function useTerminal(
  paneId: string | null,
  connectionId: string | null,
  source: TerminalSource,
  enabled: boolean,
  intervalMs = 1500,
): TerminalFeed {
  const [feed, setFeed] = useState<TerminalFeed>(EMPTY);

  useEffect(() => {
    setFeed({ ...EMPTY, loading: enabled && !!paneId && !!connectionId });
  }, [paneId, connectionId, source]);

  useEffect(() => {
    if (!enabled || !paneId || !connectionId) {
      setFeed((f) => ({ ...f, loading: false }));
      return;
    }
    let disposed = false;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const path = terminalPath(paneId, connectionId, source);

    const tick = async () => {
      controller = new AbortController();
      try {
        const body = await getJSON<{ text?: unknown }>(path, controller.signal);
        if (disposed) return;
        const text = typeof body?.text === 'string' ? plainText(body.text) : '';
        setFeed({ text, error: null, updatedAt: Date.now(), loading: false });
      } catch (e) {
        if (disposed || isAbort(e)) return;
        setFeed((f) => ({ ...f, error: describeError(e), loading: false }));
      }
      if (!disposed) timer = setTimeout(tick, document.hidden ? Math.max(intervalMs, 5000) : intervalMs);
    };
    void tick();

    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [paneId, connectionId, source, enabled, intervalMs]);

  return feed;
}
