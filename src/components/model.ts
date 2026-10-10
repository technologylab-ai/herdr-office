// Pure helpers that turn a raw Herdr snapshot into office vocabulary.
// Every name and count here comes from real snapshot data; fallbacks are only
// numbered labels for workspaces/tabs Herdr left unnamed.
import type { AgentStatus, HerdrAgent, HerdrConnection, HerdrPane, HerdrSnapshot, HerdrTab, HerdrWorkspace } from '../types';
import { agentTaskLabel, agentType } from '../world/taskLabel';

export const STATUS_ORDER: AgentStatus[] = ['blocked', 'working', 'done', 'idle', 'unknown'];

export const STATUS_META: Record<AgentStatus, { label: string; hint: string }> = {
  blocked: { label: 'Needs you', hint: 'Waiting on input in its terminal' },
  working: { label: 'Working', hint: 'Busy on a task' },
  done: { label: 'Done', hint: 'Finished its last task' },
  idle: { label: 'Idle', hint: 'Ready for a prompt' },
  unknown: { label: 'Unknown', hint: 'Herdr cannot tell what it is doing' },
};

export function normalizeStatus(s: string | null | undefined): AgentStatus {
  return s === 'idle' || s === 'working' || s === 'blocked' || s === 'done' ? s : 'unknown';
}

// Herdr's default labels are bare numbers; give those a noun so they read as places.
function named(label: string | null | undefined, noun: string, fallback: number): string {
  const text = label?.trim();
  if (!text) return `${noun} ${fallback}`;
  return /^\d+$/.test(text) ? `${noun} ${text}` : text;
}

export function workspaceName(ws: HerdrWorkspace | undefined, index = 0): string {
  if (!ws) return 'Unknown company';
  return named(ws.label, 'Company', ws.number || index + 1);
}

export function tabName(tab: HerdrTab | undefined, index = 0): string {
  if (!tab) return 'Unknown department';
  return named(tab.label, 'Department', tab.number || index + 1);
}

/** Herdr's own name for the agent first; the provider label (e.g. "codex") only as a last resort. */
export function agentName(agent: HerdrPane): string {
  return agent.name?.trim() || agent.display_agent?.trim() || agent.agent?.trim() || 'Agent';
}

/** Secondary line for a pane: a user label, then the terminal's own title. */
export function paneCaption(pane: HerdrPane): string | null {
  return (
    pane.label?.trim() ||
    pane.terminal_title_stripped?.trim() ||
    pane.title?.trim() ||
    pane.terminal_title?.trim() ||
    null
  );
}

/** What the agent is working on: Herdr's explicit name, the office label, or the task title. */
export const taskLabel = agentTaskLabel;
/** Provider display name ("Claude", "Codex"), always shown beside the task label. */
export const providerName = agentType;

/** Provider family for colouring its pill; anything unrecognised stays neutral. */
export function providerKey(agent: HerdrAgent): string {
  const raw = `${agent.agent ?? ''} ${agent.display_agent ?? ''}`.toLowerCase();
  return ['claude', 'codex', 'gemini', 'grok', 'opencode'].find((k) => raw.includes(k)) ?? 'other';
}

/** The terminal's own title, only when it adds something the task label doesn't already say. */
export function distinctCaption(agent: HerdrAgent): string | null {
  const caption = paneCaption(agent);
  return caption && caption !== agentTaskLabel(agent) ? caption : null;
}

/** Tooltip with the full task label, the original terminal title and where the label came from. */
export function labelTooltip(agent: HerdrAgent): string {
  const label = agentTaskLabel(agent);
  const caption = distinctCaption(agent);
  const source = agent.office_label && label === agent.office_label.trim()
    ? agent.office_label_source === 'luna' ? ' (office summary of the task title)' : ' (from the terminal title)'
    : '';
  return [`${label}${source}`, caption && `Terminal title: ${caption}`, `Agent: ${agentType(agent)}`].filter(Boolean).join('\n');
}

export function shortPath(cwd: string | null | undefined): string | null {
  if (!cwd) return null;
  const home = cwd.replace(/^\/(Users|home)\/[^/]+/, '~');
  const parts = home.split('/').filter(Boolean);
  if (parts.length <= 3) return home;
  return `${parts[0] === '~' ? '~/' : '/'}…/${parts.slice(-2).join('/')}`;
}

export function sortByNumber<T extends { number: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
}

export interface DepartmentEntry { tab: HerdrTab; name: string; agents: HerdrAgent[]; panes: number }
export interface CompanyEntry {
  workspace: HerdrWorkspace; name: string; departments: DepartmentEntry[]; agents: HerdrAgent[];
}

export function buildDirectory(snapshot: HerdrSnapshot | undefined): CompanyEntry[] {
  if (!snapshot) return [];
  const tabs = snapshot.tabs ?? [];
  const agents = snapshot.agents ?? [];
  const panes = snapshot.panes ?? [];
  return sortByNumber(snapshot.workspaces ?? []).map((ws, wi) => {
    const deptTabs = sortByNumber(tabs.filter((t) => t.workspace_id === ws.workspace_id));
    const departments = deptTabs.map((tab, ti) => ({
      tab,
      name: tabName(tab, ti),
      agents: agents.filter((a) => a.tab_id === tab.tab_id),
      panes: tab.pane_count ?? panes.filter((p) => p.tab_id === tab.tab_id).length,
    }));
    return {
      workspace: ws,
      name: workspaceName(ws, wi),
      departments,
      agents: agents.filter((a) => a.workspace_id === ws.workspace_id),
    };
  });
}

/** Most urgent status among agents, for a company/department dot. */
export function dominantStatus(agents: HerdrAgent[]): AgentStatus | null {
  if (agents.length === 0) return null;
  for (const s of STATUS_ORDER) if (agents.some((a) => normalizeStatus(a.agent_status) === s)) return s;
  return 'unknown';
}

export function countStatuses(agents: HerdrAgent[]): Record<AgentStatus, number> {
  const out: Record<AgentStatus, number> = { blocked: 0, working: 0, done: 0, idle: 0, unknown: 0 };
  for (const a of agents) out[normalizeStatus(a.agent_status)] += 1;
  return out;
}

export interface Locator { company: string; department: string }

export function locate(snapshot: HerdrSnapshot | undefined, workspaceId: string | null, tabId: string | null): Locator | null {
  if (!snapshot || !workspaceId) return null;
  const workspaces = sortByNumber(snapshot.workspaces ?? []);
  const wi = workspaces.findIndex((w) => w.workspace_id === workspaceId);
  if (wi < 0) return null;
  const tabs = sortByNumber((snapshot.tabs ?? []).filter((t) => t.workspace_id === workspaceId));
  const ti = tabId ? tabs.findIndex((t) => t.tab_id === tabId) : -1;
  return { company: workspaceName(workspaces[wi], wi), department: ti >= 0 ? tabName(tabs[ti], ti) : '' };
}

export interface Building { name: string; floors: HerdrConnection[] }

export function buildingName(c: HerdrConnection): string {
  return c.sessionName?.trim() || 'Unnamed session';
}
export function floorName(c: HerdrConnection): string {
  return c.machineName?.trim() || c.machineId || 'Unnamed machine';
}

export function groupBuildings(connections: HerdrConnection[]): Building[] {
  const map = new Map<string, HerdrConnection[]>();
  for (const c of connections) {
    const key = buildingName(c);
    map.set(key, [...(map.get(key) ?? []), c]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, floors]) => ({ name, floors: floors.sort((a, b) => floorName(a).localeCompare(floorName(b))) }));
}

export function relativeTime(then: number | null, now: number): string {
  if (then === null) return 'never';
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 3) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return new Date(then).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
