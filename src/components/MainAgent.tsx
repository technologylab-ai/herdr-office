// Idle-age and main-agent chrome. Colours and labels come from the shared
// world/agentIndicators helper so the desk panel, roster and 3D labels agree.
import type { CSSProperties } from 'react';
import { Star } from 'lucide-react';
import type { HerdrAgent } from '../types';
import type { MainLookup } from '../hooks/useMainAgent';
import { useNow } from '../hooks/useMisc';
import { IDLE_COLORS, MAIN_AGENT_COLOR, idleIndicator } from '../world/agentIndicators';
import { floorName, providerName, taskLabel } from './model';

/** How often idle ages refresh; the shared clock keeps every label in step. */
export const IDLE_TICK_MS = 5000;

export const IDLE_NOTE =
  'Idle times are observed by this office, not reported by Herdr. The clock starts when the office bridge first sees an agent idle (at the latest when the bridge connected), so each age is a lower bound (≥) and the real idle time may be longer.';

const tint = (color: string) => ({ '--c': color }) as CSSProperties;

/** Idle pill with its observed age, or null when the agent is not idle. */
export function IdleBadge({ agent, now, className = 'pill' }: { agent: HerdrAgent; now: number; className?: string }) {
  const idle = idleIndicator(agent, now);
  if (!idle) return null;
  return (
    <span className={`${className} idle-age idle-age--${idle.tier}`} style={tint(idle.color)} title={`${idle.detail} ${IDLE_NOTE}`}>
      <span className="idle-age__dot" aria-hidden="true" />
      {idle.label}
    </span>
  );
}

/** Concise key for the roster: what the idle colours and the star mean. */
export function IdleKey() {
  return (
    <div className="idle-key" title={IDLE_NOTE}>
      <span className="idle-key__lead">Idle ≥</span>
      <span className="idle-key__item" style={tint(IDLE_COLORS.fresh)} title="Pale periwinkle: seen idle for under 5 minutes"><i aria-hidden="true" />&lt;5m</span>
      <span className="idle-key__item" style={tint(IDLE_COLORS.waiting)} title="Iris: seen idle for 5 to 30 minutes"><i aria-hidden="true" />5–30m</span>
      <span className="idle-key__item idle-key__item--long" style={tint(IDLE_COLORS.long)} title="Orchid with a ring: seen idle for 30 minutes or more"><i aria-hidden="true" />30m+</span>
      <span className="idle-key__item idle-key__item--main" style={tint(MAIN_AGENT_COLOR)} title="Aqua star: your main agent, a bookmark in this browser"><Star size={11} aria-hidden="true" />Main</span>
      <span className="sr-only">{IDLE_NOTE}</span>
    </div>
  );
}

/** Plain-language reason the bookmarked main agent can't be reached right now. */
export function mainUnavailableReason(lookup: MainLookup): string | null {
  switch (lookup.state) {
    case 'unset':
    case 'present':
      return null;
    case 'waiting':
      return 'Waiting for the office bridge before looking for your main agent.';
    case 'stale':
      return 'The bridge is offline, so the main agent can’t be confirmed. The bookmark is kept.';
    case 'offline':
      return `${lookup.connection ? floorName(lookup.connection) : 'Its floor'} is offline. The bookmark is kept and isn’t moved to anyone else.`;
    case 'replaced':
      return 'A different terminal now sits at the main agent’s desk. The mark doesn’t carry over to it.';
    case 'missing':
      return lookup.connection
        ? `Herdr no longer reports the main agent on ${floorName(lookup.connection)}. The bookmark is kept unassigned.`
        : 'The main agent’s floor is no longer reported by the bridge. The bookmark is kept unassigned.';
  }
}

/** Masthead control: jump to the main agent from any floor, or say why that isn't possible. */
export function MainJump({ lookup, currentConnectionId, onJump }: { lookup: MainLookup; currentConnectionId: string | null; onJump(): void }) {
  const now = useNow(IDLE_TICK_MS);
  if (lookup.state === 'unset') return null;

  if (lookup.state !== 'present') {
    const reason = mainUnavailableReason(lookup) ?? '';
    return (
      <button type="button" className="main-jump is-unavailable" aria-disabled="true" title={reason} aria-label={`Main agent unavailable. ${reason}`}>
        <Star size={15} aria-hidden="true" />
        <span className="main-jump__text">Main unavailable</span>
      </button>
    );
  }

  const name = taskLabel(lookup.agent);
  const elsewhere = lookup.connection.id !== currentConnectionId ? floorName(lookup.connection) : null;
  const idle = idleIndicator(lookup.agent, now);
  const where = elsewhere ? ` on ${elsewhere}` : '';
  return (
    <button
      type="button"
      className="main-jump"
      onClick={onJump}
      aria-label={`Go to main agent ${name}${where}`}
      title={`Go to your main agent: ${name} (${providerName(lookup.agent)})${where}${idle ? ` · ${idle.label}` : ''}. A bookmark in this browser only.`}
    >
      <Star size={15} aria-hidden="true" fill="currentColor" />
      <span className="main-jump__text">
        <span className="main-jump__name">{name}</span>
        {elsewhere && <span className="main-jump__floor">{elsewhere}</span>}
      </span>
      {idle && <span className="main-jump__idle" style={tint(idle.color)} aria-hidden="true" />}
    </button>
  );
}
