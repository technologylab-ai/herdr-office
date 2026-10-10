// Same-origin client for the local Herdr bridge. No retries for mutations:
// a failed request surfaces its message and leaves the decision to the user.

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Normalize `{error:string}`, `{error:{message}}`, `{message}` or plain text bodies. */
export function errorMessageFrom(body: unknown, fallback: string): string {
  if (typeof body === 'string' && body.trim()) return body.trim().slice(0, 400);
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const err = b.error;
    if (typeof err === 'string' && err.trim()) return err;
    if (err && typeof err === 'object') {
      const m = (err as Record<string, unknown>).message;
      if (typeof m === 'string' && m.trim()) return m;
    }
    if (typeof b.message === 'string' && b.message.trim()) return b.message;
  }
  return fallback;
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return 'The Herdr Office bridge is not reachable. Is it running on this Mac?';
  if (error instanceof Error) return error.message;
  return String(error);
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });
  const raw = await response.text();
  let body: unknown = raw;
  if (raw) {
    try { body = JSON.parse(raw); } catch { /* keep text */ }
  }
  if (!response.ok) {
    const fallback = `${response.status} ${response.statusText || 'Request failed'}`.trim();
    throw new ApiError(errorMessageFrom(body, fallback), response.status);
  }
  return body as T;
}

export function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { method: 'GET', signal, cache: 'no-store' });
}

export function postJSON<T>(path: string, payload: unknown, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(payload), signal });
}

export type TerminalSource = 'recent-unwrapped' | 'visible';

export function terminalPath(paneId: string, connectionId: string, source: TerminalSource, lines = 160): string {
  const q = new URLSearchParams({ connectionId, source });
  if (source === 'recent-unwrapped') q.set('lines', String(lines));
  return `/api/panes/${encodeURIComponent(paneId)}/terminal?${q.toString()}`;
}

/**
 * The exact occupant a mutation is meant for. `terminalId` is the pane's
 * terminal_id as captured when the desk was shown; the bridge rejects the
 * request if a different terminal now sits in that pane.
 */
export interface PaneTarget { paneId: string; connectionId: string; terminalId: string }

export function sendPrompt({ paneId, connectionId, terminalId }: PaneTarget, text: string) {
  return postJSON<unknown>(`/api/agents/${encodeURIComponent(paneId)}/prompt`, { connectionId, terminalId, text });
}

export type TerminalKey = 'esc' | 'ctrl+c' | 'enter' | 'up' | 'down' | 'tab';

export function sendKeys({ paneId, connectionId, terminalId }: PaneTarget, keys: TerminalKey[]) {
  return postJSON<unknown>(`/api/panes/${encodeURIComponent(paneId)}/keys`, { connectionId, terminalId, keys });
}
