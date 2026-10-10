import { useCallback, useSyncExternalStore, type MouseEvent } from 'react';
import { ArrowDown, ArrowUp, Binoculars, Eye, Scan } from 'lucide-react';
import type { ViewStore } from './FloorMap';

export type ViewMode = 'overview' | 'walk';

/** The scene clamps overview height to this range. */
export const MIN_HEIGHT = 3;
export const MAX_HEIGHT = 65;
const STEP = 5;

interface ViewControlsProps {
  mode: ViewMode;
  ready: boolean;
  view: ViewStore;
  onMode(mode: ViewMode): void;
  onFrameRow(): void;
  onRaise(delta: number): void;
}

// The scene ignores walk keys while a button has focus; a mouse click hands focus back, a keyboard press keeps it.
const after = (run: () => void) => (e: MouseEvent<HTMLButtonElement>) => {
  run();
  if (e.detail > 0) e.currentTarget.blur();
};

export function ViewControls({ mode, ready, view, onMode, onFrameRow, onRaise }: ViewControlsProps) {
  const overview = mode === 'overview';
  return (
    <div className="viewnav" role="group" aria-label="Camera">
      <div className="viewnav__modes" role="group" aria-label="Camera height">
        <button type="button" className="viewnav__mode" aria-pressed={overview} disabled={!ready} onClick={after(() => onMode('overview'))} title="Look down over a whole row of companies (V)">
          <Binoculars size={14} aria-hidden="true" /><span>Overview</span>
        </button>
        <button type="button" className="viewnav__mode" aria-pressed={!overview} disabled={!ready} onClick={after(() => onMode('walk'))} title="Stand on the floor and walk between desks (V)">
          <Eye size={14} aria-hidden="true" /><span>Eye level</span>
        </button>
      </div>

      <button type="button" className="viewnav__btn" aria-label="See this row" disabled={!ready} onClick={after(onFrameRow)} title="Rise above the row you are in and fit it on screen (R)">
        <Scan size={14} aria-hidden="true" /><span>See this row</span>
      </button>

      {overview && <Elevation view={view} ready={ready} onRaise={onRaise} />}
    </div>
  );
}

function Elevation({ view, ready, onRaise }: { view: ViewStore; ready: boolean; onRaise(delta: number): void }) {
  const subscribe = useCallback((l: () => void) => view.subscribe(l), [view]);
  // Whole metres only, so the 10 Hz camera reports re-render this when the number actually changes.
  const height = useSyncExternalStore(subscribe, () => {
    const h = view.get()?.height;
    return h === undefined || !Number.isFinite(h) ? null : Math.round(h);
  });
  return (
    <div className="viewnav__elev" role="group" aria-label="Elevation">
      <button type="button" className="viewnav__icon" disabled={!ready || (height !== null && height <= MIN_HEIGHT)} onClick={after(() => onRaise(-STEP))} aria-label={`Lower view ${STEP} metres`} title={`Lower ${STEP} m`}>
        <ArrowDown size={14} />
      </button>
      <span className="viewnav__height" title="Camera height">
        <span aria-hidden="true">{height === null ? '—' : height}<small>m</small></span>
        {height !== null && <span className="sr-only">Camera height {height} metres</span>}
      </span>
      <button type="button" className="viewnav__icon" disabled={!ready || (height !== null && height >= MAX_HEIGHT)} onClick={after(() => onRaise(STEP))} aria-label={`Raise view ${STEP} metres`} title={`Raise ${STEP} m`}>
        <ArrowUp size={14} />
      </button>
    </div>
  );
}

/** The wheel zooms from above and glides at eye level. */
export function wheelHint(mode: ViewMode) {
  return mode === 'overview' ? 'wheel zoom' : 'wheel glide';
}
