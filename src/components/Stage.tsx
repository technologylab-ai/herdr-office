import type { ReactNode } from 'react';
import { Footprints, Hand, MonitorX, RefreshCw, X } from 'lucide-react';
import { Kbd } from './primitives';
import { wheelHint, type ViewMode } from './ViewControls';

export function Crosshair() {
  return (
    <div className="crosshair" aria-hidden="true">
      <span className="crosshair__ring" />
      <span className="crosshair__dot" />
    </div>
  );
}

export function LockedHint({ viewMode }: { viewMode: ViewMode }) {
  return (
    <div className="locked-hint" role="status">
      <span><Kbd>E</Kbd> use desk</span>
      <span><Kbd>Shift</Kbd> fast</span>
      <span>{wheelHint(viewMode)}</span>
      <span><Kbd>V</Kbd> {viewMode === 'overview' ? 'eye level' : 'overview'}</span>
      <span><Kbd>M</Kbd> map</span>
      <span><Kbd>Esc</Kbd> free cursor</span>
    </div>
  );
}

interface DockProps {
  eyebrow: string;
  heading: string;
  sub: string | null;
  canWalk: boolean;
  walkNote: string | null;
  touch: boolean;
  showHints: boolean;
  viewMode: ViewMode;
  /** Camera controls, shown between the plaque and the walk button. */
  nav: ReactNode;
  onWalk(): void;
  onDismissHints(): void;
  onHelp(): void;
}

export function EntryDock(p: DockProps) {
  return (
    <div className="dock chrome">
      <div className="plaque">
        <span className="eyebrow">{p.eyebrow}</span>
        <span className="plaque__heading">{p.heading}</span>
        {p.sub && <span className="plaque__sub">{p.sub}</span>}
      </div>

      {p.nav}

      {!p.touch && (
        <button type="button" className="btn btn--walk" aria-label="Walk in" aria-keyshortcuts="F" onClick={p.onWalk} disabled={!p.canWalk} title={p.walkNote ?? 'Walk in (F): drop to eye level and capture the mouse'}>
          <Footprints size={17} />
          <span>Walk in</span><span aria-hidden="true"><Kbd>F</Kbd></span>
        </button>
      )}

      {p.showHints && (
        <div className="hints">
          {p.touch ? (
            <span className="hints__item"><Hand size={14} /> Drag to look · tap a desk · walls don't block you</span>
          ) : (
            <>
              <span className="hints__item"><Kbd>W</Kbd><Kbd>A</Kbd><Kbd>S</Kbd><Kbd>D</Kbd> move</span>
              <span className="hints__item"><Kbd>Shift</Kbd> fast</span>
              <span className="hints__item">{wheelHint(p.viewMode)}</span>
              <span className="hints__item">drag to look</span>
              <span className="hints__item">walls don't block you</span>
              <span className="hints__item"><Kbd>E</Kbd> desk</span>
              <span className="hints__item"><Kbd>V</Kbd> view</span>
              <span className="hints__item"><Kbd>M</Kbd> map</span>
              <button type="button" className="text-btn" onClick={p.onHelp}>All controls</button>
            </>
          )}
          <button type="button" className="icon-btn icon-btn--tiny" onClick={p.onDismissHints} aria-label="Hide control hints"><X size={13} /></button>
        </div>
      )}
      {p.walkNote && !p.touch && <p className="dock__note">{p.walkNote}</p>}
    </div>
  );
}

export function SceneLoading({ slow }: { slow: boolean }) {
  return (
    <div className="scene-loading" role="status" aria-live="polite">
      <span className="scene-loading__bar" aria-hidden="true" />
      <span>{slow ? 'Still furnishing the office — large models take a moment the first time.' : 'Opening the office…'}</span>
    </div>
  );
}

export function SceneError({ message, onReload }: { message: string; onReload(): void }) {
  return (
    <div className="scene-error" role="alert">
      <MonitorX size={22} />
      <div>
        <strong>The 3D office can't be shown</strong>
        <p>{message}</p>
        <p className="scene-error__sub">The directory, roster and desks still work from the panels.</p>
      </div>
      <button type="button" className="btn btn--ghost" onClick={onReload}><RefreshCw size={14} /> Reload</button>
    </div>
  );
}

export function CenterCard({ icon, title, children, actions }: { icon: ReactNode; title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="center-card chrome" role="status">
      <div className="center-card__icon">{icon}</div>
      <h2 className="center-card__title">{title}</h2>
      <div className="center-card__body">{children}</div>
      {actions && <div className="center-card__actions">{actions}</div>}
    </div>
  );
}
