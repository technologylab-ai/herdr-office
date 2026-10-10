import type { HerdrAgent } from '../types';
import { visualTheme } from './visualTheme';

export const MAIN_AGENT_COLOR = visualTheme.mainAgent;
export const IDLE_COLORS = visualTheme.idleColors;
export function idleIndicator(agent: HerdrAgent, now = Date.now()) {
  if (agent.agent_status !== 'idle') return null;
  const since = agent.status_since ? Date.parse(agent.status_since) : NaN;
  if (!Number.isFinite(since)) return {
    label: 'Idle', color: IDLE_COLORS.fresh, tier: 'fresh' as const,
    detail: 'Herdr reports this agent as idle. Its idle duration is not available yet.',
  };
  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  const duration = seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m` : `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
  const tier = seconds < 300 ? 'fresh' : seconds < 1800 ? 'waiting' : 'long';
  return {
    label: `Idle ≥ ${duration}`, color: IDLE_COLORS[tier], tier,
    detail: `Observed idle since ${new Date(since).toLocaleTimeString()}. It may have been idle longer before the office connected.`,
  };
}
export function agentIndicator(agent: HerdrAgent, main: boolean, now = Date.now()) {
  const idle = idleIndicator(agent, now);
  const statusLabel = idle?.label ?? ({idle:'Idle',working:'Working',done:'Done',blocked:'Needs you',unknown:'Unknown'}[agent.agent_status] || 'Idle');
  const statusColor = idle?.color ?? ({idle:IDLE_COLORS.fresh,working:'#ebb45e',done:'#92c78c',blocked:'#ee6c55',unknown:'#7f8d87'}[agent.agent_status] || IDLE_COLORS.fresh);
  return { label: main ? `★ Main · ${statusLabel}` : statusLabel, color: main ? MAIN_AGENT_COLOR : statusColor };
}
