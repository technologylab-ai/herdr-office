import { Building2, ChevronDown, CircleHelp, Layers, PanelLeftClose, PanelLeftOpen, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import type { HerdrConnection } from '../types';
import type { BridgeStatus } from '../hooks/useWorld';
import type { MainLookup } from '../hooks/useMainAgent';
import { useNow } from '../hooks/useMisc';
import { Mark } from './primitives';
import { MainJump } from './MainAgent';
import { buildingName, floorName, groupBuildings, relativeTime } from './model';

interface Props {
  connections: HerdrConnection[];
  selectedId: string | null;
  onSelect(connectionId: string): void;
  bridge: BridgeStatus;
  bridgeError: string | null;
  receivedAt: number | null;
  onRetry(): void;
  sidebarOpen: boolean;
  onToggleSidebar(): void;
  onHelp(): void;
  /** The bookmarked main agent, reachable from any floor. */
  mainAgent?: { lookup: MainLookup; onJump(): void } | null;
}

export function Masthead(p: Props) {
  const buildings = groupBuildings(p.connections);
  const current = p.connections.find((c) => c.id === p.selectedId) ?? null;
  const currentBuilding = current ? buildingName(current) : null;
  const floors = buildings.find((b) => b.name === currentBuilding)?.floors ?? [];

  const pickBuilding = (name: string) => {
    const b = buildings.find((x) => x.name === name);
    const next = b?.floors.find((f) => f.online) ?? b?.floors[0];
    if (next) p.onSelect(next.id);
  };

  return (
    <header className="masthead chrome">
      <div className="masthead__brand">
        <button
          type="button"
          className="icon-btn masthead__toggle"
          onClick={p.onToggleSidebar}
          aria-label={p.sidebarOpen ? 'Hide directory' : 'Show directory'}
          aria-expanded={p.sidebarOpen}
          aria-controls="directory"
        >
          {p.sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
        <Mark />
        <p className="masthead__word">
          <span className="masthead__name">technologylab</span>
          <span className="masthead__tag">Herdr Office</span>
        </p>
      </div>

      <nav className="masthead__where" aria-label="Building and floor">
        <Picker
          icon={<Building2 size={15} />}
          label="Building"
          value={currentBuilding ?? ''}
          placeholder={p.connections.length ? 'Choose building' : 'No buildings'}
          options={buildings.map((b) => ({ value: b.name, label: b.name, note: b.floors.every((f) => !f.online) ? 'closed' : undefined }))}
          onChange={pickBuilding}
        />
        <span className="masthead__sep" aria-hidden="true">/</span>
        <Picker
          icon={<Layers size={15} />}
          label="Floor"
          value={current?.id ?? ''}
          placeholder={current ? '' : '—'}
          options={floors.map((f) => ({ value: f.id, label: floorName(f), note: f.online ? undefined : 'offline' }))}
          onChange={p.onSelect}
        />
      </nav>

      <div className="masthead__end">
        {p.mainAgent && <MainJump lookup={p.mainAgent.lookup} currentConnectionId={p.selectedId} onJump={p.mainAgent.onJump} />}
        <BridgeHealth status={p.bridge} error={p.bridgeError} receivedAt={p.receivedAt} onRetry={p.onRetry} />
        <button type="button" className="icon-btn" onClick={p.onHelp} aria-label="Controls and map guide" title="Guide (?)">
          <CircleHelp size={18} />
        </button>
      </div>
    </header>
  );
}

interface PickerProps {
  icon: ReactNode; label: string; value: string; placeholder: string;
  options: { value: string; label: string; note?: string }[];
  onChange(value: string): void;
}

function Picker({ icon, label, value, placeholder, options, onChange }: PickerProps) {
  const selected = options.find((o) => o.value === value);
  const single = options.length <= 1;
  return (
    <label className={`picker${single ? ' picker--static' : ''}`}>
      <span className="picker__label">{icon}<span>{label}</span></span>
      <span className="picker__value">
        {selected ? selected.label : placeholder}
        {selected?.note && <em className="picker__note">{selected.note}</em>}
        {!single && <ChevronDown size={14} className="picker__chev" />}
      </span>
      <select
        className="picker__select"
        value={value}
        disabled={single}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      >
        {!selected && <option value="" disabled>{placeholder || label}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}{o.note ? ` (${o.note})` : ''}</option>
        ))}
      </select>
    </label>
  );
}

const BRIDGE_LABEL: Record<BridgeStatus, string> = {
  connecting: 'Connecting',
  live: 'Live',
  reconnecting: 'Reconnecting',
  offline: 'Bridge offline',
};

function BridgeHealth({ status, error, receivedAt, onRetry }: { status: BridgeStatus; error: string | null; receivedAt: number | null; onRetry(): void }) {
  const now = useNow(5000);
  const title = status === 'live'
    ? `Streaming from the local bridge · last update ${relativeTime(receivedAt, now)}`
    : error ?? BRIDGE_LABEL[status];
  return (
    <div className={`health health--${status}`} title={title} role="status" aria-live="polite">
      <span className="health__beacon" aria-hidden="true" />
      <span className="health__label">{BRIDGE_LABEL[status]}</span>
      {status === 'offline' && (
        <button type="button" className="health__retry" onClick={onRetry} aria-label="Reconnect to the bridge now">
          <RefreshCw size={13} />
        </button>
      )}
    </div>
  );
}
