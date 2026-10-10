// The user's "main agent" is a browser bookmark, not a Herdr role: one
// connection + pane + terminal identity kept in localStorage. Nothing here
// writes to Herdr. A new terminal in the same pane never inherits the mark.
import { useCallback, useMemo } from 'react';
import type { HerdrAgent, HerdrConnection, MainAgentRef, WorldState } from '../types';
import { useStoredState } from './useMisc';

const KEY = 'herdr-office:main-agent';

function parseRef(raw: string): MainAgentRef | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== 'object') return null;
    const { connectionId, paneId, terminalId } = v as Record<string, unknown>;
    if (typeof connectionId !== 'string' || typeof paneId !== 'string' || typeof terminalId !== 'string') return null;
    if (!connectionId || !paneId || !terminalId) return null;
    return { connectionId, paneId, terminalId };
  } catch {
    return null;
  }
}

export function useMainAgent(): [MainAgentRef | null, (next: MainAgentRef | null) => void] {
  const [raw, setRaw] = useStoredState(KEY, '');
  const ref = useMemo(() => parseRef(raw), [raw]);
  const set = useCallback((next: MainAgentRef | null) => {
    setRaw(next ? JSON.stringify({ connectionId: next.connectionId, paneId: next.paneId, terminalId: next.terminalId }) : '');
  }, [setRaw]);
  return [ref, set];
}

export function isMainAgent(ref: MainAgentRef | null | undefined, connectionId: string, agent: Pick<HerdrAgent, 'pane_id' | 'terminal_id'>): boolean {
  return !!ref && ref.connectionId === connectionId && ref.paneId === agent.pane_id && ref.terminalId === agent.terminal_id;
}

export type MainLookup =
  | { state: 'unset' }
  | { state: 'waiting'; ref: MainAgentRef }
  | { state: 'present'; ref: MainAgentRef; connection: HerdrConnection; agent: HerdrAgent }
  | { state: 'stale' | 'offline' | 'replaced' | 'missing'; ref: MainAgentRef; connection: HerdrConnection | null };

/** Where the bookmarked agent is right now, judged only from what the bridge currently reports. */
export function lookupMain(ref: MainAgentRef | null, world: WorldState | null, bridgeLive: boolean): MainLookup {
  if (!ref) return { state: 'unset' };
  if (!world) return { state: 'waiting', ref };
  const connection = world.connections.find((c) => c.id === ref.connectionId) ?? null;
  if (!connection) return { state: 'missing', ref, connection };
  if (!bridgeLive) return { state: 'stale', ref, connection };
  if (!connection.online) return { state: 'offline', ref, connection };
  const snapshot = connection.snapshot;
  const pane = snapshot?.panes?.find((p) => p.pane_id === ref.paneId);
  if (pane && pane.terminal_id !== ref.terminalId) return { state: 'replaced', ref, connection };
  // Only a real snapshot.agents entry counts; a pane field alone never makes a person.
  const agent = snapshot?.agents?.find((a) => a.pane_id === ref.paneId && a.terminal_id === ref.terminalId);
  if (!agent) return { state: 'missing', ref, connection };
  return { state: 'present', ref, connection, agent };
}
