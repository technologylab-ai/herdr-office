import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Map as MapIcon, Maximize2, Minimize2, X } from 'lucide-react';
import type { HerdrAgent, HerdrSnapshot, MainAgentRef, OfficeView } from '../types';
import { deriveFloor, type Company, type FloorPlan } from '../world/layout';
import { departmentScheme } from '../world/departmentArt';
import { agentIndicator } from '../world/agentIndicators';
import { isMainAgent } from '../hooks/useMainAgent';
import { Kbd } from './primitives';
import { plural, providerName, tabName, taskLabel, workspaceName } from './model';

/* ---------------------------------------------------------------- view store
 * The scene reports the camera ~10×/s. Only the player marker subscribes, so
 * walking never re-renders the app, the directory or the map's floor art. */

export interface ViewStore {
  get(): OfficeView | null;
  set(view: OfficeView | null): void;
  subscribe(listener: () => void): () => void;
}

export function createViewStore(): ViewStore {
  let view: OfficeView | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => view,
    set(next) {
      if (next === view) return;
      view = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

/* ---------------------------------------------------------------- geometry
 * Map space is the scene's own metres, turned half a turn so "deeper into the
 * floor" (+Z, the way you face on arrival or after a jump) points up:
 *   screen x = -world x,  screen y = -world z. */

const PAD = 2.5;

// Only what changes the floor's shape; statuses and titles update without re-deriving it.
function topologyKey(s: HerdrSnapshot): string {
  return JSON.stringify([
    s.workspaces.map((w) => [w.workspace_id, w.label, w.number]),
    s.tabs.map((t) => [t.tab_id, t.workspace_id, t.label, t.number]),
    s.panes.map((p) => [p.pane_id, p.tab_id]),
    s.layouts.map((l) => [l.tab_id, l.area, l.panes.map((p) => [p.pane_id, p.rect])]),
  ]);
}

function useFloorPlan(snapshot: HerdrSnapshot): FloorPlan {
  const latest = useRef(snapshot);
  latest.current = snapshot;
  const key = useMemo(() => topologyKey(snapshot), [snapshot]);
  // Re-derive on shape changes only; `key` stands in for the snapshot.
  return useMemo(() => deriveFloor(latest.current), [key]);
}

function useViewportHeight(): number {
  const [h, setH] = useState(() => window.innerHeight);
  useEffect(() => {
    const onResize = () => setH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return h;
}

function fit(text: string, widthM: number, fontM: number, em = 0.58): string | null {
  const max = Math.floor(widthM / (fontM * em));
  if (max < 3) return null;
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Up to `lines` lines, breaking at spaces or after - / _ . ; the last line is clipped with an ellipsis. */
function wrap(text: string, widthM: number, fontM: number, lines: number, em = 0.58): string[] {
  const max = Math.floor(widthM / (fontM * em));
  if (max < 3 || lines < 1) return [];
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > max && out.length < lines - 1) {
    let cut = 0;
    for (let i = max; i > 0 && !cut; i--) if (rest[i] === ' ' || '-/_.'.includes(rest[i - 1])) cut = i;
    if (!cut) break;
    out.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(fit(rest, widthM, fontM, em)!);
  return out;
}

/** The company to this one's right on the map: same row, next column towards -x. */
function rightNeighbour(plan: FloorPlan, company: Company): Company | null {
  let best: Company | null = null;
  for (const o of plan.companies) if (o.z === company.z && o.x < company.x && (!best || o.x > best.x)) best = o;
  return best;
}

interface KeyEntry { id: string; mark: string; name: string; deptId: string | null; shown: boolean }

/* ---------------------------------------------------------------- component */

interface FloorMapProps {
  snapshot: HerdrSnapshot;
  connectionId: string;
  floorLabel: string | null;
  open: boolean;
  large: boolean;
  narrow: boolean;
  hereTabId: string | null;
  selectedPaneId: string | null;
  mainAgent: MainAgentRef | null;
  now: number;
  view: ViewStore;
  onToggle(): void;
  onToggleLarge(): void;
  onGoTo(workspaceId: string, tabId: string): void;
  onVisit(paneId: string): void;
}

export function FloorMap(p: FloorMapProps) {
  if (!p.open) {
    return (
      <button type="button" className="minimap-chip" onClick={p.onToggle} aria-label="Show floor map" aria-keyshortcuts="M" aria-expanded="false">
        <MapIcon size={15} aria-hidden="true" />
        <span>Floor map</span>
        <Kbd>M</Kbd>
      </button>
    );
  }
  return <OpenMap {...p} />;
}

function OpenMap(p: FloorMapProps) {
  const { snapshot, connectionId, hereTabId, selectedPaneId, mainAgent, now, onGoTo, onVisit } = p;
  const plan = useFloorPlan(snapshot);
  const vh = useViewportHeight();
  const [hint, setHint] = useState<string | null>(null);
  // The company under the pointer, lit both on the plan and in the key.
  const [hot, setHot] = useState<string | null>(null);

  // Lay the whole floor out at a fixed pixel budget, then size labels and marks in real pixels.
  const vbW = plan.width + PAD * 2;
  const vbH = plan.depth + PAD * 2;
  // Inner widths of the panel (see --map-w): less its padding, frame and border.
  const maxW = p.narrow ? Math.min(window.innerWidth - 52, 388) : p.large ? 424 : 256;
  const maxH = p.narrow ? Math.min(260, vh * 0.34) : p.large ? Math.min(600, vh * 0.62) : Math.min(320, vh * 0.4);
  const scale = Math.min(maxW / vbW, maxH / vbH);
  const px = (n: number) => n / scale;

  const art = useMemo(() => {
    const agents = new Map((snapshot.agents ?? []).map((a) => [a.pane_id, a]));
    const workspaces = [...snapshot.workspaces].sort((a, b) => a.number - b.number);
    const tabs = new Map(snapshot.tabs.map((t) => [t.tab_id, t]));
    const roomy = p.large || p.narrow;
    const deptFont = px(roomy ? 10.5 : 9.5);
    const coFont = px(roomy ? 9.5 : 9);
    const key: KeyEntry[] = [];

    const activate = (e: ReactKeyboardEvent, run: () => void) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); run(); }
    };

    const nodes = plan.companies.map((company) => {
      const wsIndex = workspaces.findIndex((w) => w.workspace_id === company.id);
      const coName = workspaceName(workspaces[wsIndex], wsIndex);
      // Every company wears its number, so a name too long for the plan is still matched in the key.
      const mark = String(workspaces[wsIndex]?.number || wsIndex + 1);
      const left = -(company.x + company.width);
      const base = -company.z - Math.max(1, (4 - coFont) / 2);
      const bh = px(12), bw = Math.max(bh, px(4 + 6 * mark.length));
      const bx = left + 0.7, by = base - coFont * 0.36 - bh / 2;
      const tx = bx + bw + px(4);
      // The name may run on across the aisle and any empty column space, up to the next plate.
      const right = rightNeighbour(plan, company);
      const bound = right ? -(right.x + right.width) - px(6) : plan.width / 2 - 0.6;
      // A second line may hang into the aisle in front, if it clears the row beyond it.
      const ahead = Math.max(0, ...plan.companies.filter((o) => o.z < company.z).map((o) => o.z + o.depth));
      const twoLines = roomy && base + coFont * 1.45 <= -ahead - 0.6;
      const coLines = wrap(coName.toUpperCase(), bound - tx, coFont, twoLines ? 2 : 1, 0.78);
      const shown = coLines.length > 0 && !(coLines[coLines.length - 1].endsWith('…') && !coName.endsWith('…'));
      key.push({ id: company.id, mark, name: coName, deptId: company.departments[0]?.id ?? null, shown });
      return (
        <g key={company.id} className={`mm-co${hot === company.id ? ' is-hot' : ''}`}>
          <title>{coName}</title>
          <rect className="mm-co__plate" x={left} y={-(company.z + company.depth)} width={company.width} height={company.depth} rx={1.4} />

          {company.departments.map((dept, tabIndex) => {
            const tab = tabs.get(dept.id);
            const deptName = tabName(tab, tabIndex);
            const desks = plan.desks.filter((d) => d.tabId === dept.id);
            const people = desks.filter((d) => agents.has(d.pane.pane_id));
            const here = dept.id === hereTabId;
            const scheme = departmentScheme(`${connectionId}/${dept.id}`);
            const x = -(dept.x + dept.width), y = -(dept.z + dept.depth);
            // Labels live in the band between the feature wall and the nearest person, never over them.
            const labelTop = y + 0.9;
            const clear = Math.min(y + dept.depth, ...desks.map((d) => -(d.z + 0.82) - px(5))) - labelTop;
            const lines = clear < deptFont * 0.95 ? 0 : Math.min(2, 1 + Math.floor((clear - deptFont * 0.95) / (deptFont * 1.12)));
            const label = lines ? wrap(deptName, dept.width - 1.6, deptFont, lines) : [];
            const go = () => onGoTo(company.id, dept.id);
            const describe = `${coName} / ${deptName} · ${plural(people.length, 'person', 'people')} at ${plural(desks.length, 'desk')}`;
            const point = (on: boolean) => { setHint(on ? describe : null); setHot(on ? company.id : null); };

            return (
              <g key={dept.id} className={`mm-dept${here ? ' is-here' : ''}`}>
                <g
                  className="mm-room"
                  role="link"
                  tabIndex={0}
                  aria-label={`Map: go to ${coName} / ${deptName}`}
                  aria-current={here ? 'location' : undefined}
                  onClick={go}
                  onKeyDown={(e) => activate(e, go)}
                  onPointerEnter={() => point(true)}
                  onPointerLeave={() => point(false)}
                  onFocus={() => point(true)}
                  onBlur={() => point(false)}
                >
                  <title>{`${coName} / ${deptName}`}</title>
                  <rect className="mm-room__shape" x={x} y={y} width={dept.width} height={dept.depth} rx={0.8} />
                  {/* The feature wall and its poster colours, where they hang in the office. */}
                  <rect className="mm-room__wall" x={x + 0.6} y={y + 0.35} width={Math.max(0, dept.width - 1.2)} height={0.5} rx={0.25} fill={scheme.accent} />
                  {desks.map((d) => (
                    <g key={d.pane.pane_id} aria-hidden="true">
                      <rect className="mm-desk__area" x={-(d.area.x + d.area.width) + 0.35} y={-(d.area.z + d.area.depth) + 0.35} width={Math.max(0, d.area.width - 0.7)} height={Math.max(0, d.area.depth - 0.7)} rx={0.5} />
                      <rect className="mm-desk" x={-d.x - 0.9} y={-d.z - 0.1} width={1.8} height={0.7} rx={0.15} />
                    </g>
                  ))}
                  {label.length > 0 && (
                    <text className="mm-room__label" x={x + 0.8} y={labelTop + deptFont * 0.8} fontSize={deptFont} aria-hidden="true">
                      {label.map((line, i) => <tspan key={i} x={x + 0.8} dy={i ? deptFont * 1.12 : 0}>{line}</tspan>)}
                    </text>
                  )}
                </g>

                {people.map((d) => {
                  const agent = agents.get(d.pane.pane_id) as HerdrAgent;
                  const main = isMainAgent(mainAgent, connectionId, agent);
                  const ind = agentIndicator(agent, main, now);
                  const task = taskLabel(agent);
                  const provider = providerName(agent);
                  const cx = -d.x, cy = -(d.z + 0.82);
                  const selected = agent.pane_id === selectedPaneId;
                  const visit = () => onVisit(agent.pane_id);
                  const describeAgent = `${task} · ${provider} · ${ind.label}`;
                  return (
                    <g
                      key={agent.pane_id}
                      className={`mm-person mm-person--${agent.agent_status}${main ? ' is-main' : ''}${selected ? ' is-selected' : ''}`}
                      role="link"
                      tabIndex={0}
                      aria-label={`Map: visit ${task} (${provider}) · ${ind.label}`}
                      aria-current={selected ? 'true' : undefined}
                      style={{ '--c': ind.color } as CSSProperties}
                      onClick={(e) => { e.stopPropagation(); visit(); }}
                      onKeyDown={(e) => activate(e, visit)}
                      onPointerEnter={() => setHint(describeAgent)}
                      onPointerLeave={() => setHint(null)}
                      onFocus={() => setHint(describeAgent)}
                      onBlur={() => setHint(null)}
                    >
                      <title>{describeAgent}</title>
                      <circle className="mm-person__hit" cx={cx} cy={cy} r={px(8)} />
                      {(main || selected || agent.agent_status === 'blocked') && <circle className="mm-person__halo" cx={cx} cy={cy} r={px(6.5)} />}
                      <circle className="mm-person__dot" cx={cx} cy={cy} r={px(main ? 3.8 : 3.2)} />
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Drawn over the rooms so nothing can hide which company this is. */}
          <g className="mm-co__badge" aria-hidden="true">
            <rect x={bx} y={by} width={bw} height={bh} rx={px(3.5)} />
            <text x={bx + bw / 2} y={by + bh / 2} fontSize={px(8.5)} textAnchor="middle" dominantBaseline="central">{mark}</text>
          </g>
          {coLines.length > 0 && (
            <text className="mm-co__label" x={tx} y={base} fontSize={coFont} aria-hidden="true">
              {coLines.map((line, i) => <tspan key={i} x={tx} dy={i ? coFont * 1.18 : 0}>{line}</tspan>)}
            </text>
          )}
        </g>
      );
    });
    return { nodes, key };
    // px depends only on scale.
  }, [plan, snapshot.agents, snapshot.workspaces, snapshot.tabs, connectionId, hereTabId, selectedPaneId, mainAgent, now, scale, p.large, p.narrow, hot, onGoTo, onVisit]);

  return (
    <section id="floor-map" className={`minimap${p.large && !p.narrow ? ' is-large' : ''}`} aria-label="Floor map">
      <header className="minimap__head">
        <span className="eyebrow">Floor map</span>
        {p.floorLabel && <span className="minimap__floor">{p.floorLabel}</span>}
        <span className="minimap__tools">
          {!p.narrow && (
            <button type="button" className="icon-btn icon-btn--tiny" onClick={p.onToggleLarge} aria-label={p.large ? 'Shrink floor map' : 'Enlarge floor map'} title={p.large ? 'Shrink' : 'Enlarge'}>
              {p.large ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          )}
          <button type="button" className="icon-btn icon-btn--tiny" onClick={p.onToggle} aria-label="Hide floor map" aria-keyshortcuts="M" aria-expanded="true" aria-controls="floor-map" title="Hide (M)">
            <X size={13} />
          </button>
        </span>
      </header>

      <div className="minimap__body">
        <svg
          className="minimap__svg"
          viewBox={`${-plan.width / 2 - PAD} ${-plan.depth - PAD} ${vbW} ${vbH}`}
          width={Math.round(vbW * scale)}
          height={Math.round(vbH * scale)}
          role="group"
          aria-label={`Plan of ${p.floorLabel ?? 'this floor'}: rooms and people`}
        >
          <rect className="mm-floor" x={-plan.width / 2} y={-plan.depth} width={plan.width} height={plan.depth} rx={1.6} />
          <line className="mm-backwall" x1={-plan.width / 2 + 0.8} x2={plan.width / 2 - 0.8} y1={-plan.depth} y2={-plan.depth} />
          {art.nodes}
          <Player store={p.view} plan={plan} size={px(1)} />
        </svg>
      </div>

      {/* Whenever a name doesn't fit on the plan, every company is listed in full by its number. */}
      {art.key.some((k) => !k.shown) && (
        <ol className="minimap__key" aria-label="Companies on this floor">
          {art.key.map((k) => (
            <li key={k.id}>
              <button
                type="button"
                className={`mm-key${hot === k.id ? ' is-hot' : ''}`}
                disabled={!k.deptId}
                title={`Go to ${k.name}`}
                onClick={() => k.deptId && onGoTo(k.id, k.deptId)}
                onPointerEnter={() => { setHint(k.name); setHot(k.id); }}
                onPointerLeave={() => { setHint(null); setHot(null); }}
                onFocus={() => { setHint(k.name); setHot(k.id); }}
                onBlur={() => { setHint(null); setHot(null); }}
              >
                <span className="mm-key__mark" aria-hidden="true">{k.mark}</span>
                <span className="mm-key__name">{k.name}</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <footer className="minimap__foot" aria-live="off">
        <span className="minimap__hint">{hint ?? (p.narrow ? 'Tap a room to go there, a person to walk to their desk' : 'Click a room to go there, a person to walk to their desk')}</span>
        <span className="minimap__lockhint"><Kbd>M</Kbd> use the map</span>
      </footer>
    </section>
  );
}

/* ---------------------------------------------------------------- you are here */

const Player = memo(function Player({ store, plan, size }: { store: ViewStore; plan: FloorPlan; size: number }) {
  const subscribe = useCallback((l: () => void) => store.subscribe(l), [store]);
  const view = useSyncExternalStore(subscribe, store.get);
  // Keep the heading continuous so the eased turn never spins the long way round.
  const lastDeg = useRef<number | null>(null);
  if (!view) { lastDeg.current = null; return null; }
  const x = -Math.min(plan.width / 2, Math.max(-plan.width / 2, view.x));
  const y = -Math.min(plan.depth, Math.max(0, view.z));
  // Yaw 0 faces -Z (map down); the marker is drawn pointing up, so turn it by π − yaw.
  let deg = ((Math.PI - view.yaw) * 180) / Math.PI;
  if (lastDeg.current !== null) deg += Math.round((lastDeg.current - deg) / 360) * 360;
  lastDeg.current = deg;
  const s = size; // metres per pixel
  return (
    <g className="mm-player" style={{ transform: `translate(${x}px, ${y}px) rotate(${deg}deg)` }} aria-hidden="true">
      <path className="mm-player__cone" d={`M0 0 L${-26 * s} ${-44 * s} A${51 * s} ${51 * s} 0 0 1 ${26 * s} ${-44 * s} Z`} />
      <circle className="mm-player__ring" r={7 * s} />
      <path className="mm-player__arrow" d={`M0 ${-6.5 * s} L${4.6 * s} ${4.5 * s} L0 ${2.4 * s} L${-4.6 * s} ${4.5 * s} Z`} />
    </g>
  );
});
