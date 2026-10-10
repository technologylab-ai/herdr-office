import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import {
  ArrowDown, ArrowDownToLine, ArrowUp, Check, ChevronDown, Copy, CornerDownLeft, Keyboard,
  LocateFixed, OctagonX, Pause, Play, Send, SquareTerminal, Star, TextWrap, X,
} from 'lucide-react';
import type { AgentStatus, HerdrAgent, HerdrConnection, HerdrPane, MainAgentRef } from '../types';
import { isMainAgent } from '../hooks/useMainAgent';
import { describeError, sendKeys, sendPrompt, type PaneTarget, type TerminalKey, type TerminalSource } from '../hooks/api';
import { useTerminal } from '../hooks/useTerminal';
import { useNow, useStoredNumber } from '../hooks/useMisc';
import { clampDrawer, drawerDefault, type DrawerWidth } from '../hooks/useDrawerWidth';
import { StatusPill } from './primitives';
import { IDLE_TICK_MS, IdleBadge } from './MainAgent';
import { distinctCaption, floorName, labelTooltip, locate, normalizeStatus, paneCaption, providerKey, providerName, relativeTime, shortPath, taskLabel } from './model';

export interface SentEntry { id: number; text: string; at: number }
export interface DrawerMemory { drafts: Map<string, string>; sent: Map<string, SentEntry[]> }

interface Props {
  connection: HerdrConnection;
  paneId: string;
  memory: DrawerMemory;
  canGoToDesk: boolean;
  onGoToDesk(paneId: string): void;
  onClose(): void;
  /** Browser-only bookmark; toggling it never writes to Herdr. */
  mainAgent?: MainAgentRef | null;
  onToggleMain?(agent: MainAgentRef): void;
  /** Desktop width control; null on phones, where the panel is a full-width sheet. */
  size?: DrawerWidth | null;
}

export function PaneDrawer({ connection, paneId, memory, canGoToDesk, onGoToDesk, onClose, mainAgent, onToggleMain, size }: Props) {
  const snapshot = connection.snapshot;
  const paneRow = snapshot?.panes?.find((p) => p.pane_id === paneId);
  // An agent only counts if it belongs to the terminal that occupies the pane right now.
  const agent = snapshot?.agents?.find((a) => a.pane_id === paneId && (!paneRow || a.terminal_id === paneRow.terminal_id)) ?? null;
  const pane: HerdrPane | null = paneRow ?? agent;
  const terminalId = pane?.terminal_id || null;
  const status = agent ? normalizeStatus(agent.agent_status) : null;
  const where = pane ? locate(snapshot, pane.workspace_id, pane.tab_id) : null;
  // Mutations are addressed to this exact occupant; the bridge refuses them if it changed.
  const target: PaneTarget | null = pane && terminalId ? { paneId, connectionId: connection.id, terminalId } : null;
  const live = connection.online && !!target;
  // Drafts, sent history and component state belong to one occupant, never to the next one.
  const memoryKey = `${connection.id}\u0000${paneId}\u0000${terminalId ?? ''}`;
  const replaced = useReplacement(`${connection.id}\u0000${paneId}`, terminalId);

  const title = agent ? taskLabel(agent) : pane ? paneCaption(pane) ?? 'Terminal' : 'Desk cleared';
  const caption = agent ? distinctCaption(agent) : null;
  // Identity includes the terminal, so a replacement in this pane is never the main agent.
  const isMain = !!agent && isMainAgent(mainAgent, connection.id, agent);
  const path = shortPath(pane?.cwd);

  return (
    <>
      <aside className="drawer chrome" aria-label={`Desk: ${title}`}>
        <header className="drawer__head">
          <div className="drawer__where">
            <span className="eyebrow">
              {agent ? 'At the desk' : 'Empty desk'} · {floorName(connection)}
            </span>
            {where && <span className="drawer__crumb">{where.company}{where.department && <> <span aria-hidden="true">›</span> {where.department}</>}</span>}
          </div>
          <div className="drawer__actions">
            {agent && onToggleMain && (
              <button
                type="button"
                className={`icon-btn star-btn${isMain ? ' is-on' : ''}`}
                onClick={() => onToggleMain({ connectionId: connection.id, paneId: agent.pane_id, terminalId: agent.terminal_id })}
                aria-label={isMain ? 'Unmark main agent' : 'Mark as main agent'}
                title={isMain
                  ? 'Unmark main agent'
                  : 'Mark as main agent \u2014 a bookmark in this browser so you can find it from any floor. Nothing is sent to Herdr.'}
              >
                <Star size={17} fill={isMain ? 'currentColor' : 'none'} />
              </button>
            )}
            {canGoToDesk && pane && (
              <button type="button" className="icon-btn" onClick={() => onGoToDesk(paneId)} aria-label="Walk to this desk" title="Walk to this desk">
                <LocateFixed size={17} />
              </button>
            )}
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close desk panel" title="Close (Esc)">
              <X size={18} />
            </button>
          </div>
          <h2 className="drawer__title" title={agent ? labelTooltip(agent) : undefined}>{title}</h2>
          <div className="drawer__facts">
            {agent && <span className={`pill pill--agent provider--${providerKey(agent)}`} title={`Agent type reported by Herdr: ${providerName(agent)}`}>{providerName(agent)}</span>}
            {isMain && <span className="pill pill--main"><Star size={11} fill="currentColor" aria-hidden="true" />Main agent</span>}
            {agent && status && <AgentStatusPill agent={agent} status={status} />}
            {!agent && pane && <span className="pill pill--plain">No agent</span>}
            {path && <span className="drawer__path" title={pane?.cwd ?? undefined}>{path}</span>}
            {caption && <span className="drawer__caption" title={`Terminal title: ${caption}`}>{caption}</span>}
          </div>
        </header>

        {!pane && (
          <div className="notice notice--warn">
            Herdr no longer reports this pane. It was probably closed; nothing more can be sent to it.
          </div>
        )}
        {pane && replaced && (
          <div className="notice notice--info" role="status">
            A different terminal now occupies this desk. Nothing typed for the previous occupant carries over.
          </div>
        )}
        {pane && !connection.online && (
          <div className="notice notice--warn">
            This floor is offline{connection.error ? `: ${connection.error}` : '.'} Terminal reads and input are paused.
          </div>
        )}

        {pane && !agent && connection.online && (
          <div className="notice notice--info">
            Herdr reports this terminal, but no agent in it right now. Idle agents keep their people at their desks.
          </div>
        )}

        <TerminalView key={memoryKey} paneId={paneId} connectionId={connection.id} enabled={live} />

        {agent && status && target && (
          <Composer
            key={`c-${memoryKey}`}
            memoryKey={memoryKey}
            memory={memory}
            target={target}
            name={title}
            status={status}
            live={live}
            notReady={agent.interactive_ready === false}
          />
        )}

        {target && <KeyPad key={`k-${memoryKey}`} target={target} live={live} name={title} />}
      </aside>
      {size && <DrawerGrip size={size} />}
    </>
  );
}

/* ---------------------------------------------------------------- Resize */

const GRIP_STEP = 16;

/**
 * Vertical grip on the panel's left edge. Dragging writes the width straight to
 * the app's --drawer-w so the 3D view isn't re-rendered per pixel; the final
 * width is committed (and remembered) when the drag ends.
 */
function DrawerGrip({ size }: { size: DrawerWidth }) {
  const drag = useRef<{ x: number; from: number; to: number; app: HTMLElement | null } | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus({ preventScroll: true });
    const app = e.currentTarget.closest<HTMLElement>('.app');
    app?.classList.add('is-resizing');
    drag.current = { x: e.clientX, from: size.width, to: size.width, app };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    // The panel is anchored right, so moving left makes it wider.
    d.to = clampDrawer(d.from + d.x - e.clientX);
    d.app?.style.setProperty('--drawer-w', `${d.to}px`);
    e.currentTarget.setAttribute('aria-valuenow', String(d.to));
  };
  const endDrag = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    d.app?.classList.remove('is-resizing');
    if (d.to !== d.from) size.set(d.to);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? GRIP_STEP * 4 : GRIP_STEP;
    let next: number | null = null;
    if (e.key === 'ArrowLeft') next = size.width + step;
    else if (e.key === 'ArrowRight') next = size.width - step;
    else if (e.key === 'Home') next = size.min;
    else if (e.key === 'End') next = size.max;
    else if (e.key === 'Enter') { e.preventDefault(); size.reset(); return; }
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    size.set(next);
  };

  return (
    <div
      className="drawer-grip"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize desk panel"
      aria-valuemin={size.min}
      aria-valuemax={size.max}
      aria-valuenow={size.width}
      aria-valuetext={`${size.width} pixels wide`}
      aria-keyshortcuts="ArrowLeft ArrowRight Home End Enter"
      tabIndex={0}
      title={`Drag to resize (${size.width}px) · double-click or Enter to reset to ${drawerDefault()}px · ←/→ with the grip focused`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onDoubleClick={size.reset}
      onKeyDown={onKeyDown}
    >
      <span className="drawer-grip__handle" aria-hidden="true" />
    </div>
  );
}

/* ---------------------------------------------------------------- Font size */

const FONT_MIN = 12;
const FONT_MAX = 24;
const FONT_DEFAULT = 13;

function FontSize({ value, onChange }: { value: number; onChange(next: number): void }) {
  return (
    <div className="font-size" role="group" aria-label="Terminal text size">
      <button type="button" className="font-size__btn" onClick={() => onChange(value - 1)} disabled={value <= FONT_MIN} aria-label="Smaller terminal text" title="Smaller text">
        A<span aria-hidden="true">−</span>
      </button>
      <button
        type="button"
        className="font-size__value"
        onClick={() => onChange(FONT_DEFAULT)}
        disabled={value === FONT_DEFAULT}
        aria-label={`Terminal text ${value}px. Reset to ${FONT_DEFAULT}px`}
        title={value === FONT_DEFAULT ? `Default size (${FONT_DEFAULT}px)` : `Reset to ${FONT_DEFAULT}px`}
      >
        {value}
      </button>
      <button type="button" className="font-size__btn font-size__btn--up" onClick={() => onChange(value + 1)} disabled={value >= FONT_MAX} aria-label="Larger terminal text" title="Larger text">
        A<span aria-hidden="true">+</span>
      </button>
    </div>
  );
}

/** Idle agents show their observed idle age; every other status keeps the plain pill. */
function AgentStatusPill({ agent, status }: { agent: HerdrAgent; status: AgentStatus }) {
  const now = useNow(IDLE_TICK_MS);
  if (status === 'idle') return <IdleBadge agent={agent} now={now} />;
  return <StatusPill status={status} />;
}

/** True once the terminal in this pane differs from the one first shown for it. */
function useReplacement(slot: string, terminalId: string | null): boolean {
  const seen = useRef<{ slot: string; terminalId: string } | null>(null);
  const [replaced, setReplaced] = useState(false);
  useEffect(() => {
    const prev = seen.current;
    if (prev?.slot !== slot) setReplaced(false);
    else if (terminalId && prev.terminalId !== terminalId) setReplaced(true);
    if (terminalId) seen.current = { slot, terminalId };
  }, [slot, terminalId]);
  return replaced;
}

/* ---------------------------------------------------------------- Terminal */

function TerminalView({ paneId, connectionId, enabled }: { paneId: string; connectionId: string; enabled: boolean }) {
  const [source, setSource] = useState<TerminalSource>('recent-unwrapped');
  const [paused, setPaused] = useState(false);
  const [wrap, setWrap] = useState(true);
  const [fontSize, setFontSize] = useStoredNumber('herdr-office:term-font', FONT_DEFAULT, FONT_MIN, FONT_MAX);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [atBottom, setAtBottom] = useState(true);
  const feed = useTerminal(paneId, connectionId, source, enabled && !paused);
  const scroller = useRef<HTMLPreElement>(null);
  const now = useNow(1000);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && atBottom) el.scrollTop = el.scrollHeight;
  }, [feed.text, atBottom]);

  useEffect(() => {
    if (copied === 'idle') return;
    const t = setTimeout(() => setCopied('idle'), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const onScroll = () => {
    const el = scroller.current;
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
  };

  const copy = async () => {
    if (!feed.text) return;
    try { await navigator.clipboard.writeText(feed.text); setCopied('ok'); } catch { setCopied('fail'); }
  };

  const state = !enabled ? 'stopped' : paused ? 'paused' : feed.error ? 'error' : feed.updatedAt ? 'live' : 'loading';
  const stateLabel = {
    stopped: 'Not reading',
    paused: `Paused · ${relativeTime(feed.updatedAt, now)}`,
    error: 'Read failed',
    live: `Live · ${relativeTime(feed.updatedAt, now)}`,
    loading: 'Reading…',
  }[state];

  return (
    <section className="term" aria-label="Terminal output">
      <div className="term__bar">
        <span className="term__title"><SquareTerminal size={15} /> Terminal</span>
        <FontSize value={fontSize} onChange={setFontSize} />
        <div className="seg seg--small" role="tablist" aria-label="Terminal view">
          <button type="button" role="tab" className="seg__btn" aria-selected={source === 'recent-unwrapped'} onClick={() => { setSource('recent-unwrapped'); setAtBottom(true); }} title="Last 160 lines of scrollback">Recent</button>
          <button type="button" role="tab" className="seg__btn" aria-selected={source === 'visible'} onClick={() => { setSource('visible'); setAtBottom(true); }} title="Exactly what is on the pane's screen">Screen</button>
        </div>
      </div>

      <div className="term__screen">
        <pre
          ref={scroller}
          className={`term__pre${wrap ? ' is-wrapped' : ''}`}
          style={{ fontSize: `${fontSize}px` }}
          tabIndex={0}
          onScroll={onScroll}
          aria-live="off"
          aria-busy={state === 'loading'}
        >
          {feed.text !== null && feed.text.length > 0
            ? feed.text
            : <span className="term__empty">{feed.text === '' ? 'The terminal is empty.' : !enabled ? 'No terminal to read.' : feed.error ? '' : 'Reading the terminal…'}</span>}
        </pre>
        {!atBottom && feed.text && (
          <button type="button" className="term__jump" onClick={() => setAtBottom(true)}>
            <ArrowDownToLine size={14} /> Latest
          </button>
        )}
      </div>

      <div className="term__foot">
        <span className={`term__state term__state--${state}`} role="status">
          <span className="term__beacon" aria-hidden="true" />
          {stateLabel}
        </span>
        {feed.error && <span className="term__err" title={feed.error}>{feed.error}</span>}
        <span className="term__tools">
          <button type="button" className="text-btn" onClick={() => setWrap((v) => !v)} aria-pressed={wrap} title={wrap ? 'Long lines wrap. Turn off to pan sideways instead.' : 'Long lines scroll sideways. Turn on to wrap them.'}>
            <TextWrap size={13} /> Wrap
          </button>
          <button type="button" className="text-btn" onClick={() => setPaused((v) => !v)} disabled={!enabled} aria-pressed={paused}>
            {paused ? <><Play size={13} /> Resume</> : <><Pause size={13} /> Pause</>}
          </button>
          <button type="button" className="text-btn" onClick={copy} disabled={!feed.text}>
            {copied === 'ok' ? <><Check size={13} /> Copied</> : copied === 'fail' ? 'Copy blocked' : <><Copy size={13} /> Copy</>}
          </button>
        </span>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Composer */

/** Bridge messages may or may not end in a full stop; end them with exactly one. */
function sentence(text: string): string {
  return `${text.trim().replace(/[.\s]+$/, '')}.`;
}

const PROMPT_BLOCK: Partial<Record<AgentStatus, string>> = {
  working: 'Busy on a task. Prompts open again once it is idle or done. To stop it, use Interrupt below.',
  blocked: 'Waiting on you inside its terminal (a question or permission). Answer it with the terminal keys below or in Herdr.',
  unknown: "Herdr can't tell what this agent is doing, so prompting is off to avoid typing into the wrong place.",
};

function Composer({ memoryKey, memory, target, name, status, live, notReady }: {
  memoryKey: string; memory: DrawerMemory; target: PaneTarget;
  name: string; status: AgentStatus; live: boolean; notReady: boolean;
}) {
  const [draft, setDraftState] = useState(() => memory.drafts.get(memoryKey) ?? '');
  const [sent, setSent] = useState<SentEntry[]>(() => memory.sent.get(memoryKey) ?? []);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const now = useNow(15000);

  const setDraft = (v: string) => { setDraftState(v); memory.drafts.set(memoryKey, v); };

  const blockReason = !live ? 'Not reachable right now.' : PROMPT_BLOCK[status] ?? null;
  const canSend = !blockReason && !sending && draft.trim().length > 0;

  const submit = async () => {
    if (!canSend) return;
    const text = draft;
    setSending(true);
    setError(null);
    try {
      await sendPrompt(target, text);
      const entry: SentEntry = { id: Date.now(), text, at: Date.now() };
      setSent((prev) => {
        const next = [...prev, entry].slice(-6);
        memory.sent.set(memoryKey, next);
        return next;
      });
      setDraft('');
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit(); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); area.current?.blur(); }
  };

  return (
    <section className="composer" aria-label={`Prompt ${name}`}>
      {sent.length > 0 && (
        <ol className="sent" aria-label="Prompts you sent from this browser">
          {sent.map((s) => (
            <li key={s.id} className="sent__item">
              <span className="sent__meta"><Check size={12} /> Submitted {relativeTime(s.at, now)}</span>
              <span className="sent__text">{s.text}</span>
            </li>
          ))}
        </ol>
      )}

      {blockReason && <p className={`composer__reason tone-bg--${live ? status : 'unknown'}`}>{blockReason}</p>}
      {!blockReason && notReady && <p className="composer__hint">Herdr marks this pane as not ready for interactive input yet; the prompt may be rejected.</p>}

      <div className={`composer__box${blockReason ? ' is-disabled' : ''}`}>
        <textarea
          ref={area}
          className="composer__input"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={blockReason ? 'Prompting unavailable' : `Write to ${name}…`}
          disabled={!!blockReason || sending}
          aria-label={`Prompt for ${name}`}
          aria-describedby={error ? 'composer-error' : undefined}
        />
        <div className="composer__row">
          <span className="composer__tip">{draft.trim() ? <>Send with <kbd className="kbd">⌘</kbd><kbd className="kbd">↵</kbd></> : 'Typed text is sent as one prompt.'}</span>
          <button type="button" className="btn btn--copper" onClick={() => void submit()} disabled={!canSend}>
            <Send size={14} /> {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
      {error && <p id="composer-error" className="composer__error" role="alert">Not sent: {sentence(error)} Your text is still here.</p>}
    </section>
  );
}

/* ---------------------------------------------------------------- Keys */

interface KeyDef { key: TerminalKey; label: ReactNode; name: string; intent: string; confirm: boolean }

const KEYS: KeyDef[] = [
  { key: 'up', label: <ArrowUp size={15} />, name: '↑', intent: 'Previous', confirm: false },
  { key: 'down', label: <ArrowDown size={15} />, name: '↓', intent: 'Next', confirm: false },
  { key: 'tab', label: 'Tab', name: 'Tab', intent: 'Switch', confirm: false },
  { key: 'enter', label: <CornerDownLeft size={15} />, name: 'Enter', intent: 'Confirm', confirm: true },
  { key: 'esc', label: 'Esc', name: 'Esc', intent: 'Cancel', confirm: true },
  { key: 'ctrl+c', label: <OctagonX size={15} />, name: 'Ctrl‑C', intent: 'Interrupt', confirm: true },
];

function KeyPad({ target, live, name }: { target: PaneTarget; live: boolean; name: string }) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState<TerminalKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), 3500);
    return () => clearTimeout(t);
  }, [armed]);

  const press = async (def: KeyDef) => {
    if (!live || busy) return;
    if (def.confirm && armed !== def.key) { setArmed(def.key); setResult(null); return; }
    setArmed(null);
    setBusy(true);
    try {
      await sendKeys(target, [def.key]);
      setResult({ ok: true, text: `${def.name} sent to ${name}` });
    } catch (e) {
      setResult({ ok: false, text: `${def.name} not sent: ${sentence(describeError(e))}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`keys-panel${open ? ' is-open' : ''}`}>
      <button type="button" className="keys-panel__toggle" onClick={() => { setOpen((v) => !v); setArmed(null); }} aria-expanded={open}>
        <Keyboard size={15} />
        <span>Terminal keys</span>
        <span className="keys-panel__sub">sent to this pane only</span>
        <ChevronDown size={15} className="keys-panel__chev" />
      </button>
      {open && (
        <div className="keys-panel__body">
          <div className="keypad" role="group" aria-label="Send a key to the terminal">
            {KEYS.map((def) => {
              const isArmed = armed === def.key;
              return (
                <button
                  key={def.key}
                  type="button"
                  className={`keycap${def.confirm ? ' keycap--confirm' : ''}${def.key === 'ctrl+c' ? ' keycap--danger' : ''}${isArmed ? ' is-armed' : ''}`}
                  onClick={() => void press(def)}
                  disabled={!live || busy}
                  aria-label={isArmed ? `Press again to send ${def.name}` : `${def.intent}: send ${def.name}`}
                >
                  <span className="keycap__cap">{def.label}</span>
                  <span className="keycap__intent">{isArmed ? 'Again to send' : def.intent}</span>
                </button>
              );
            })}
          </div>
          <p className={`keys-panel__msg${result ? (result.ok ? ' is-ok' : ' is-err') : ''}`} role="status">
            {armed
              ? `Press ${KEYS.find((k) => k.key === armed)?.name} again to send it.`
              : result?.text ?? 'Arrows and Tab send at once. Enter, Esc and Interrupt ask twice.'}
          </p>
        </div>
      )}
    </section>
  );
}
