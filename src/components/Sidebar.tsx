import { useMemo, useState } from 'react';
import { ChevronRight, MapPin, Search, Star, Users, X } from 'lucide-react';
import type { AgentStatus, HerdrAgent, HerdrSnapshot, MainAgentRef } from '../types';
import { isMainAgent, type MainLookup } from '../hooks/useMainAgent';
import { useNow } from '../hooks/useMisc';
import { StatusDot } from './primitives';
import { IDLE_TICK_MS, IdleBadge, IdleKey, mainUnavailableReason } from './MainAgent';
import {
  STATUS_META, STATUS_ORDER, buildDirectory, countStatuses, distinctCaption, dominantStatus,
  floorName, labelTooltip, locate, normalizeStatus, paneCaption, plural, providerKey, providerName,
  shortPath, sortByNumber, taskLabel,
} from './model';

type View = 'directory' | 'roster';

interface Props {
  open: boolean;
  onClose(): void;
  snapshot: HerdrSnapshot | undefined;
  floorLabel: string | null;
  hereWorkspaceId: string | null;
  hereTabId: string | null;
  selectedPaneId: string | null;
  onTeleport(workspaceId: string, tabId?: string): void;
  onFocusAgent(paneId: string): void;
  /** Floor whose snapshot is shown; needed to match the main-agent bookmark. */
  connectionId?: string | null;
  mainAgent?: MainAgentRef | null;
  mainLookup?: MainLookup;
  onJumpToMain?(): void;
  onForgetMain?(): void;
}

export function Sidebar(p: Props) {
  const [view, setView] = useState<View>('directory');
  const agents = p.snapshot?.agents ?? [];

  return (
    <aside id="directory" className={`sidebar chrome${p.open ? ' is-open' : ''}`} aria-label="Office directory" aria-hidden={!p.open} inert={!p.open}>
      <div className="sidebar__head">
        <div className="seg" role="tablist" aria-label="Sidebar view">
          <button type="button" role="tab" aria-selected={view === 'directory'} className="seg__btn" onClick={() => setView('directory')}>
            Directory
          </button>
          <button type="button" role="tab" aria-selected={view === 'roster'} className="seg__btn" onClick={() => setView('roster')}>
            Roster <span className="seg__count">{agents.length}</span>
          </button>
        </div>
        <button type="button" className="icon-btn sidebar__close" onClick={p.onClose} aria-label="Close directory"><X size={16} /></button>
      </div>

      <div className="sidebar__body">
        {!p.snapshot ? (
          <p className="empty">{p.floorLabel ? `No Herdr data from ${p.floorLabel} yet.` : 'Pick a floor to see who is in.'}</p>
        ) : view === 'directory' ? (
          <Directory {...p} snapshot={p.snapshot} />
        ) : (
          <Roster
            snapshot={p.snapshot}
            selectedPaneId={p.selectedPaneId}
            onFocusAgent={p.onFocusAgent}
            connectionId={p.connectionId ?? null}
            mainAgent={p.mainAgent ?? null}
            mainLookup={p.mainLookup}
            onJumpToMain={p.onJumpToMain}
            onForgetMain={p.onForgetMain}
          />
        )}
      </div>
    </aside>
  );
}

function Directory({ snapshot, hereWorkspaceId, hereTabId, onTeleport }: Props & { snapshot: HerdrSnapshot }) {
  const companies = useMemo(() => buildDirectory(snapshot), [snapshot]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (companies.length === 0) return <p className="empty">Herdr reports no workspaces on this floor.</p>;

  return (
    <ol className="dir">
      {companies.map((co) => {
        const id = co.workspace.workspace_id;
        const isHere = id === hereWorkspaceId;
        const isOpen = !(collapsed[id] ?? false);
        return (
          <li key={id} className={`dir__co${isHere ? ' is-here' : ''}`}>
            <div className="dir__corow">
              <button
                type="button"
                className="dir__twisty"
                onClick={() => setCollapsed((c) => ({ ...c, [id]: isOpen }))}
                aria-expanded={isOpen}
                aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${co.name}`}
              >
                <ChevronRight size={14} />
              </button>
              <button type="button" className="dir__co-btn" onClick={() => onTeleport(id)} title={`Go to ${co.name}`}>
                <span className="dir__num">{String(co.workspace.number || '').padStart(2, '0')}</span>
                <span className="dir__coname">{co.name}</span>
                {isHere && <MapPin size={13} className="dir__here" aria-label="You are here" />}
                <span className="dir__meta">
                  <StatusDot status={dominantStatus(co.agents)} size="sm" />
                  {co.agents.length > 0 ? co.agents.length : ''}
                </span>
              </button>
            </div>
            {isOpen && co.departments.length > 0 && (
              <ul className="dir__depts">
                {co.departments.map((d) => {
                  const here = isHere && d.tab.tab_id === hereTabId;
                  return (
                    <li key={d.tab.tab_id}>
                      <button
                        type="button"
                        className={`dir__dept${here ? ' is-here' : ''}`}
                        onClick={() => onTeleport(id, d.tab.tab_id)}
                        aria-current={here ? 'location' : undefined}
                      >
                        <StatusDot status={dominantStatus(d.agents)} size="sm" />
                        <span className="dir__deptname">{d.name}</span>
                        <span className="dir__deptmeta">
                          {d.agents.length > 0 ? plural(d.agents.length, 'person', 'people') : plural(d.panes, 'desk')}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

interface RosterProps {
  snapshot: HerdrSnapshot; selectedPaneId: string | null; onFocusAgent(id: string): void;
  connectionId: string | null; mainAgent: MainAgentRef | null; mainLookup?: MainLookup;
  onJumpToMain?(): void; onForgetMain?(): void;
}

function Roster({ snapshot, selectedPaneId, onFocusAgent, connectionId, mainAgent, mainLookup, onJumpToMain, onForgetMain }: RosterProps) {
  const [filter, setFilter] = useState<AgentStatus | null>(null);
  const [query, setQuery] = useState('');
  const now = useNow(IDLE_TICK_MS);
  const agents = snapshot.agents ?? [];
  const counts = countStatuses(agents);
  const isMain = (a: HerdrAgent) => !!connectionId && isMainAgent(mainAgent, connectionId, a);

  const rows = useMemo(() => {
    const ws = sortByNumber(snapshot.workspaces ?? []).map((w) => w.workspace_id);
    const tabs = sortByNumber(snapshot.tabs ?? []).map((t) => t.tab_id);
    const q = query.trim().toLowerCase();
    return agents
      .map((a) => ({ a, status: normalizeStatus(a.agent_status), where: locate(snapshot, a.workspace_id, a.tab_id) }))
      .filter(({ a, status, where }) => {
        if (filter && status !== filter) return false;
        if (!q) return true;
        return [taskLabel(a), providerName(a), paneCaption(a), a.cwd, where?.company, where?.department]
          .some((v) => v?.toLowerCase().includes(q));
      })
      // The main agent is pinned first so it is always one glance away.
      .sort((x, y) =>
        Number(isMain(y.a)) - Number(isMain(x.a)) ||
        STATUS_ORDER.indexOf(x.status) - STATUS_ORDER.indexOf(y.status) ||
        ws.indexOf(x.a.workspace_id) - ws.indexOf(y.a.workspace_id) ||
        tabs.indexOf(x.a.tab_id) - tabs.indexOf(y.a.tab_id));
  }, [agents, snapshot, filter, query, connectionId, mainAgent]); // isMain reads only connectionId and mainAgent

  if (agents.length === 0) {
    return (
      <div className="empty">
        <Users size={18} />
        <p>Nobody is at a desk. Herdr reports no agents on this floor right now.</p>
      </div>
    );
  }

  return (
    <div className="roster">
      <div className="roster__filters" role="group" aria-label="Filter by status">
        {STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => (
          <button
            key={s}
            type="button"
            className={`chip${filter === s ? ' is-on' : ''}`}
            aria-pressed={filter === s}
            onClick={() => setFilter((f) => (f === s ? null : s))}
            title={STATUS_META[s].hint}
          >
            <StatusDot status={s} size="sm" />
            <span>{STATUS_META[s].label}</span>
            <span className="chip__n">{counts[s]}</span>
          </button>
        ))}
      </div>
      <IdleKey />
      <MainNote lookup={mainLookup} connectionId={connectionId} onJump={onJumpToMain} onForget={onForgetMain} />
      {agents.length > 5 && (
        <label className="search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            placeholder="Find by task, agent, folder, team"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search roster"
          />
        </label>
      )}
      <ul className="roster__list">
        {rows.map(({ a, status, where }) => (
          <li key={a.pane_id}>
            <RosterRow agent={a} status={status} where={where} now={now} main={isMain(a)} selected={a.pane_id === selectedPaneId} onClick={() => onFocusAgent(a.pane_id)} />
          </li>
        ))}
        {rows.length === 0 && <li className="empty empty--inline">No one matches.</li>}
      </ul>
    </div>
  );
}

/** Main agent on another floor, or bookmarked but not reachable: say so, with one plain action. */
function MainNote({ lookup, connectionId, onJump, onForget }: {
  lookup?: MainLookup; connectionId: string | null; onJump?(): void; onForget?(): void;
}) {
  if (!lookup || lookup.state === 'unset') return null;
  if (lookup.state === 'present') {
    if (lookup.connection.id === connectionId || !onJump) return null;
    return (
      <p className="main-note">
        <Star size={13} aria-hidden="true" fill="currentColor" />
        <span className="main-note__text">Main agent <strong>{taskLabel(lookup.agent)}</strong> is on {floorName(lookup.connection)}.</span>
        <button type="button" className="text-btn main-note__btn" onClick={onJump}>Go there</button>
      </p>
    );
  }
  return (
    <p className="main-note is-unavailable" role="status">
      <Star size={13} aria-hidden="true" />
      <span className="main-note__text">{mainUnavailableReason(lookup)}</span>
      {onForget && lookup.state !== 'waiting' && (
        <button type="button" className="text-btn main-note__btn" onClick={onForget}>Clear bookmark</button>
      )}
    </p>
  );
}

function RosterRow({ agent, status, where, now, main, selected, onClick }: {
  agent: HerdrAgent; status: AgentStatus; where: ReturnType<typeof locate>; now: number; main: boolean; selected: boolean; onClick(): void;
}) {
  const label = taskLabel(agent);
  const caption = distinctCaption(agent);
  const path = shortPath(agent.cwd);
  return (
    <button type="button" className={`person${selected ? ' is-selected' : ''}${main ? ' is-main' : ''} person--${status}`} onClick={onClick} aria-current={selected || undefined} title={labelTooltip(agent)}>
      <span className="person__avatar" aria-hidden="true">
        {label.slice(0, 1).toUpperCase()}
        <StatusDot status={status} size="sm" />
        {main && <Star size={11} className="person__star" fill="currentColor" />}
      </span>
      <span className="person__main">
        <span className="person__line">
          <span className="person__name">{label}</span>
          {status === 'idle'
            ? <IdleBadge agent={agent} now={now} className="person__status" />
            : <span className={`person__status tone--${status}`}>{STATUS_META[status].label}</span>}
        </span>
        <span className="person__tags">
          <span className={`pill pill--agent provider--${providerKey(agent)}`}>{providerName(agent)}</span>
          {main && <span className="person__main-tag">Main</span>}
          <span className="person__where">
            {where ? `${where.company}${where.department ? ` · ${where.department}` : ''}` : 'Unplaced'}
          </span>
        </span>
        {(caption || path) && <span className="person__detail" title={agent.cwd ?? undefined}>{caption ?? path}</span>}
      </span>
    </button>
  );
}
