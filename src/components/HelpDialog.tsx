import { useEffect, useRef } from 'react';
import { Star, X } from 'lucide-react';
import { Kbd, StatusDot } from './primitives';
import { STATUS_META, STATUS_ORDER } from './model';
import { IDLE_NOTE, IdleKey } from './MainAgent';

export function HelpDialog({ open, onClose, touch }: { open: boolean; onClose(): void; touch: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  // Only a press that starts and ends on the backdrop closes; a text selection dragged out of the guide does not.
  const downOnBackdrop = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      const active = document.activeElement;
      returnTo.current = active instanceof HTMLElement && active !== document.body ? active : null;
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const handleClose = () => {
    const target = returnTo.current;
    returnTo.current = null;
    if (target?.isConnected) target.focus({ preventScroll: true });
    onClose();
  };

  return (
    <dialog
      ref={ref}
      className="help"
      aria-labelledby="help-title"
      aria-describedby="help-intro"
      onClose={handleClose}
      onPointerDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => {
        if (downOnBackdrop.current && e.target === e.currentTarget) ref.current?.close();
        downOnBackdrop.current = false;
      }}
    >
      <div className="help__inner">
        <header className="help__head">
          <div>
            <p className="eyebrow">Field guide</p>
            <h2 id="help-title" className="help__title">Finding your way around</h2>
            <p id="help-intro" className="help__intro">Everything in the office is read live from Herdr.{!touch && <> Press <Kbd>Esc</Kbd> to close this guide.</>}</p>
          </div>
          <button type="button" className="icon-btn" onClick={() => ref.current?.close()} aria-label="Close guide"><X size={18} /></button>
        </header>

        <div className="help__grid">
          <section>
            <h3 className="help__h">Moving</h3>
            <dl className="keys">
              {!touch && <><dt><Kbd>F</Kbd></dt><dd>Walk in and capture the mouse</dd></>}
              <dt>Overview</dt><dd>Looks down on the row of companies you are in, roof off. <em>See this row</em>{!touch && <> (<Kbd>R</Kbd>)</>} fits it on screen again; the arrows beside the height raise or lower the view</dd>
              <dt>Eye level</dt><dd>Stands you on the floor among the desks. Visiting a person or walking in drops you here{!touch && <>; <Kbd>V</Kbd> switches between the two</>}</dd>
              <dt>Walls</dt><dd>Walk straight through walls and furniture. At eye level, the floor edge stops you; overview can pull back beyond it</dd>
              {!touch && <><dt><Kbd>W</Kbd><Kbd>A</Kbd><Kbd>S</Kbd><Kbd>D</Kbd> <span className="keys__or">or</span> <Kbd>↑</Kbd><Kbd>←</Kbd><Kbd>↓</Kbd><Kbd>→</Kbd></dt><dd>Walk; in overview, slide across the floor at the same height</dd></>}
              {!touch && <><dt><Kbd>Shift</Kbd></dt><dd>Hold to move fast</dd></>}
              {!touch && <><dt>Scroll wheel</dt><dd>In overview, zoom: fly toward what you point the view at, closer and lower or farther and higher. At eye level, glide forward or back. Add <Kbd>Shift</Kbd> to cover ground faster</dd></>}
              <dt>{touch ? 'Drag' : 'Mouse'}</dt><dd>{touch ? 'Look around' : 'Look around after you walk in'}</dd>
              {!touch && <><dt>Drag</dt><dd>Look around without walking in</dd></>}
              {!touch && <><dt><Kbd>E</Kbd></dt><dd>Use the nearest desk</dd></>}
              <dt>{touch ? 'Tap' : 'Click'}</dt><dd>Select a desk {touch ? '' : 'while the cursor is free'}</dd>
              {!touch && <><dt><Kbd>M</Kbd></dt><dd>Show or hide the floor map; frees the cursor so you can use it</dd></>}
              <dt>Floor map</dt><dd>{touch ? 'Tap' : 'Click'} a room to go there (in overview you see its whole row), or a person to walk to their desk at eye level. The copper arrow is you</dd>
              {!touch && <><dt><Kbd>Esc</Kbd></dt><dd>Release the cursor</dd></>}
              {!touch && <><dt><Kbd>?</Kbd></dt><dd>Open this guide</dd></>}
            </dl>
          </section>

          <section>
            <h3 className="help__h">The map</h3>
            <dl className="legend">
              <dt>Building</dt><dd>A Herdr session</dd>
              <dt>Floor</dt><dd>The machine it runs on</dd>
              <dt>Company</dt><dd>A workspace in Herdr's sidebar</dd>
              <dt>Department</dt><dd>A tab inside that workspace</dd>
              <dt>Desk</dt><dd>A pane, placed by its real split layout</dd>
              <dt>Person</dt><dd>An agent Herdr reports in that pane</dd>
            </dl>
          </section>

          <section className="help__status">
            <h3 className="help__h">Status</h3>
            <ul className="status-key">
              {STATUS_ORDER.map((s) => (
                <li key={s}><StatusDot status={s} /><strong>{STATUS_META[s].label}</strong><span>{STATUS_META[s].hint}</span></li>
              ))}
            </ul>
            <div className="help__marks">
              <div className="help__row"><span><strong>Above each person</strong> a small sign shows their task, the agent type, and how long the office has seen them idle.</span><IdleKey /></div>
              <p className="help__fine">{IDLE_NOTE}</p>
              <p>
                <strong><Star size={12} fill="currentColor" aria-hidden="true" className="help__star" /> Main agent</strong>
                {' '}Open a desk and press the star to mark the agent you check most. It gets an aqua star in the office and the roster, and a button at the top right takes you to it from any floor. The mark is a bookmark kept in this browser only. Nothing is sent to Herdr, and a new terminal in the same pane does not inherit it.
              </p>
            </div>
            <p className="help__note">Prompts can be sent to idle or done agents. An agent waiting at a permission prompt is never answered for you: terminal keys go to the selected pane only when you press them, and Enter, Esc and Interrupt ask twice.</p>
          </section>
        </div>
      </div>
    </dialog>
  );
}
