import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import OfficeScene from './world/OfficeScene';
import type { HerdrConnection, MainAgentRef, OfficeView, SceneHandle } from './types';
import { useWorld } from './hooks/useWorld';
import { lookupMain, useMainAgent } from './hooks/useMainAgent';
import { detectWebGL, useMediaQuery, useNow, useStoredState } from './hooks/useMisc';
import { useDrawerWidth } from './hooks/useDrawerWidth';
import { Masthead } from './components/Masthead';
import { Sidebar } from './components/Sidebar';
import { PaneDrawer, type DrawerMemory } from './components/PaneDrawer';
import { HelpDialog } from './components/HelpDialog';
import { FloorMap, createViewStore } from './components/FloorMap';
import { DoorClosed, RefreshCw, SearchX, WifiOff, X } from 'lucide-react';
import { CenterCard, Crosshair, EntryDock, LockedHint, SceneError, SceneLoading } from './components/Stage';
import { SceneBoundary } from './components/primitives';
import { ViewControls, type ViewMode } from './components/ViewControls';
import { buildingName, floorName, locate, plural, relativeTime, sortByNumber } from './components/model';

const POINTER_LOCK = typeof document !== 'undefined' && 'requestPointerLock' in HTMLElement.prototype;

// The scene ignores walk keys while a control has focus; hand focus back after navigating.
function releaseFocus() {
  const el = document.activeElement;
  if (el instanceof HTMLElement && el !== document.body) el.blur();
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export default function App() {
  const feed = useWorld();
  const connections = feed.world?.connections ?? [];

  /* ---------- floor selection: keep the user's choice; never silently swap it */
  const [storedId, setStoredId] = useStoredState('herdr-office:connection', '');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const lastKnown = useRef<HerdrConnection | null>(null);

  useEffect(() => {
    if (connectionId || connections.length === 0) return;
    const pick = connections.find((c) => c.id === storedId) ?? connections.find((c) => c.online) ?? connections[0];
    setConnectionId(pick.id);
  }, [connections, connectionId, storedId]);

  const connection = connections.find((c) => c.id === connectionId) ?? null;
  if (connection) lastKnown.current = connection;
  const floorClosed = !!feed.world && !!connectionId && !connection;

  /* ---------- scene + view state */
  const scene = useRef<SceneHandle>(null);
  const [webglError] = useState(() => detectWebGL());
  const [sceneError, setSceneError] = useState<string | null>(webglError);
  const [sceneReady, setSceneReady] = useState(false);
  const readyRef = useRef(false);
  const [sceneNotice, setSceneNotice] = useState<string | null>(null);
  const [slowLoad, setSlowLoad] = useState(false);
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const unlockedAt = useRef(0);
  const [here, setHere] = useState<{ ws: string | null; tab: string | null }>({ ws: null, tab: null });
  const [selectedPaneId, setSelectedPaneId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [hintsHidden, setHintsHidden] = useStoredState('herdr-office:hints-hidden', false);
  const narrow = useMediaQuery('(max-width: 760px)');
  const compact = useMediaQuery('(max-width: 980px)');
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [sidebarOpen, setSidebarOpen] = useState(() => !window.matchMedia('(max-width: 760px)').matches);
  const memory = useRef<DrawerMemory>({ drafts: new Map(), sent: new Map() });
  // Desktop only: on phones the desk panel is a full-width sheet.
  const drawerSize = useDrawerWidth();
  const now = useNow(10000);

  // Walk (eye level) by default; overview is a toolbar/V away, and a choice is remembered in this browser.
  const [storedMode, setStoredMode] = useStoredState('herdr-office:view-mode', 'walk');
  const viewMode: ViewMode = storedMode === 'overview' ? 'overview' : 'walk';
  const setViewMode = useCallback((mode: ViewMode) => setStoredMode(mode), [setStoredMode]);

  const sceneUsable = !sceneError;
  const canWalk = sceneUsable && sceneReady && POINTER_LOCK;

  const sceneHasFloor = !!connection?.snapshot && !floorClosed;
  useEffect(() => {
    if (sceneReady || sceneError || !sceneHasFloor) return;
    const t = setTimeout(() => setSlowLoad(true), 8000);
    return () => clearTimeout(t);
  }, [sceneReady, sceneError, sceneHasFloor]);

  const releaseLock = useCallback(() => {
    if (lockedRef.current) scene.current?.exit();
  }, []);

  /* ---------- scene callbacks (stable identities) */
  // Opening a desk from afar keeps the current view; only walking to it changes height.
  const onSelectPane = useCallback((paneId: string) => {
    setSelectedPaneId(paneId);
    // Using a desk opens its panel; free the cursor so it can be used.
    if (lockedRef.current) scene.current?.exit();
  }, []);
  const onLocation = useCallback((ws: string | null, tab: string | null) => setHere({ ws, tab }), []);
  // Camera reports feed the map's marker directly; they never re-render the app.
  const [viewStore] = useState(createViewStore);
  const onViewChange = useCallback((view: OfficeView) => viewStore.set(view), [viewStore]);
  const onLockChange = useCallback((value: boolean) => {
    lockedRef.current = value;
    if (!value) unlockedAt.current = performance.now();
    setLocked(value);
  }, []);
  // The scene rebuilds (and reports ready) per floor; remember which floor the latest build is for.
  const sceneFloor = useRef<string | null>(null);
  sceneFloor.current = floorClosed ? null : connection?.id ?? null;
  const readyFloor = useRef<string | null>(null);
  const [readyGen, setReadyGen] = useState(0);
  const readyGenRef = useRef(0);
  const onReady = useCallback(() => {
    readyRef.current = true;
    readyFloor.current = sceneFloor.current;
    readyGenRef.current += 1;
    setReadyGen(readyGenRef.current);
    setSceneReady(true);
    setSlowLoad(false);
  }, []);
  // Before the first frame an error means there is no office to show; afterwards it is a passing problem.
  const onSceneError = useCallback((message: string) => {
    const text = message || 'The 3D renderer stopped unexpectedly.';
    if (readyRef.current) setSceneNotice(text);
    else setSceneError(text);
  }, []);
  const onSceneCrash = useCallback((message: string) => setSceneError(message || 'The 3D renderer stopped unexpectedly.'), []);

  useEffect(() => {
    if (!sceneNotice) return;
    const t = setTimeout(() => setSceneNotice(null), 6000);
    return () => clearTimeout(t);
  }, [sceneNotice]);

  /* ---------- navigation */
  // A desk to walk to once the floor it is on has finished building.
  const pendingFocus = useRef<{ connectionId: string; paneId: string; gen: number } | null>(null);

  const chooseFloor = useCallback((id: string) => {
    pendingFocus.current = null;
    releaseLock();
    setConnectionId(id);
    setStoredId(id);
    setSelectedPaneId(null);
    setHere({ ws: null, tab: null });
    viewStore.set(null);
  }, [releaseLock, setStoredId, viewStore]);

  const snapshot = connection?.snapshot;

  const teleport = useCallback((workspaceId: string, tabId?: string) => {
    if (narrow) setSidebarOpen(false);
    const s = scene.current;
    if (s && sceneUsable) {
      releaseLock();
      s.teleport(workspaceId, tabId);
      releaseFocus();
      return;
    }
    // Without a 3D view, "going" somewhere opens the first real desk there.
    const tabs = sortByNumber((snapshot?.tabs ?? []).filter((t) => t.workspace_id === workspaceId));
    const tab = tabId ?? tabs[0]?.tab_id;
    const target = snapshot?.agents?.find((a) => a.tab_id === tab) ?? snapshot?.panes?.find((p) => p.tab_id === tab);
    setHere({ ws: workspaceId, tab: tab ?? null });
    if (target) setSelectedPaneId(target.pane_id);
  }, [narrow, sceneUsable, releaseLock, snapshot]);

  const focusPane = useCallback((paneId: string) => {
    if (narrow) setSidebarOpen(false);
    setSelectedPaneId(paneId);
    if (scene.current && sceneUsable) {
      releaseLock();
      // The scene drops to eye level at the desk; keep the toolbar in step.
      scene.current.focusPane(paneId);
      setViewMode('walk');
    }
  }, [narrow, sceneUsable, releaseLock, setViewMode]);

  /* ---------- main agent: one browser bookmark, found from any floor */
  const [mainAgent, setMainAgent] = useMainAgent();
  const mainLookup = useMemo(
    () => lookupMain(mainAgent, feed.world, feed.status !== 'offline'),
    [mainAgent, feed.world, feed.status],
  );

  const toggleMain = useCallback((ref: MainAgentRef) => {
    const same = mainAgent && mainAgent.connectionId === ref.connectionId && mainAgent.paneId === ref.paneId && mainAgent.terminalId === ref.terminalId;
    setMainAgent(same ? null : ref);
  }, [mainAgent, setMainAgent]);

  const jumpToMain = useCallback(() => {
    if (mainLookup.state !== 'present') return;
    const { connectionId: target, paneId } = mainLookup.ref;
    const sameFloor = target === connection?.id && !floorClosed;
    if (sameFloor && (!sceneUsable || (sceneReady && readyFloor.current === target))) {
      focusPane(paneId);
      return;
    }
    if (!sameFloor) chooseFloor(target);
    if (narrow) setSidebarOpen(false);
    // Open the desk panel now; walk to the desk once that floor's scene reports ready.
    setSelectedPaneId(paneId);
    pendingFocus.current = sceneUsable ? { connectionId: target, paneId, gen: readyGenRef.current } : null;
  }, [mainLookup, connection?.id, floorClosed, sceneUsable, sceneReady, focusPane, chooseFloor, narrow]);

  useEffect(() => {
    const p = pendingFocus.current;
    if (!p) return;
    if (!sceneUsable || (selectedPaneId !== p.paneId)) { pendingFocus.current = null; return; }
    if (readyGen > p.gen && readyFloor.current === p.connectionId && connection?.id === p.connectionId) {
      pendingFocus.current = null;
      focusPane(p.paneId);
    }
  }, [readyGen, sceneUsable, selectedPaneId, connection?.id, focusPane]);

  // Walking in means standing on the floor; the cursor lock has to start inside this click.
  const walkIn = useCallback(() => {
    if (!canWalk) return;
    releaseFocus();
    setViewMode('walk');
    scene.current?.enter();
  }, [canWalk, setViewMode]);

  /* ---------- camera height: overview frames a row from above, eye level walks the floor */
  const viewReady = sceneUsable && sceneReady;
  const frameRow = useCallback(() => {
    if (viewMode === 'overview') scene.current?.frameRow();
    else setViewMode('overview'); // switching to overview frames the row
  }, [viewMode, setViewMode]);
  const raiseView = useCallback((delta: number) => scene.current?.raiseView(delta), []);
  const toggleView = useCallback(() => setViewMode(viewMode === 'overview' ? 'walk' : 'overview'), [viewMode, setViewMode]);

  const openHelp = useCallback(() => { releaseLock(); setHelpOpen(true); }, [releaseLock]);

  /* ---------- floor map: open by default on wide screens, folded away on phones */
  const [mapOpenWide, setMapOpenWide] = useStoredState('herdr-office:map-open', true);
  const [mapOpenNarrow, setMapOpenNarrow] = useState(false);
  const [mapLarge, setMapLarge] = useStoredState('herdr-office:map-large', false);
  const mapOpen = narrow ? mapOpenNarrow : mapOpenWide;
  const toggleMap = useCallback(() => {
    (narrow ? setMapOpenNarrow : setMapOpenWide)((v) => !v);
  }, [narrow, setMapOpenWide]);
  // M frees the cursor so the map can be clicked. Mid-walk it opens (or keeps) the map rather than hiding it.
  const mapKey = useCallback(() => {
    if (lockedRef.current) {
      scene.current?.exit();
      (narrow ? setMapOpenNarrow : setMapOpenWide)(true);
    } else toggleMap();
  }, [narrow, setMapOpenWide, toggleMap]);

  // The marker belongs to one floor's camera; drop it until the new floor reports.
  const mapFloorId = floorClosed ? null : connection?.id ?? null;
  useEffect(() => { viewStore.set(null); }, [mapFloorId, viewStore]);

  /* ---------- global keys: '?' guide, Esc closes the desk panel (never while typing) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (helpOpen || isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'KeyF' && !e.repeat && canWalk && !lockedRef.current) { e.preventDefault(); walkIn(); return; }
      if (e.key === '?') { e.preventDefault(); openHelp(); return; }
      if ((e.code === 'KeyM' || e.key.toLowerCase() === 'm') && !e.repeat) { e.preventDefault(); mapKey(); return; }
      if (e.code === 'KeyV' && !e.repeat && viewReady) { e.preventDefault(); toggleView(); return; }
      if (e.code === 'KeyR' && !e.repeat && viewReady) { e.preventDefault(); frameRow(); return; }
      if (e.key === 'Escape') {
        // The Esc that releases pointer lock should not also close the panel.
        if (lockedRef.current || performance.now() - unlockedAt.current < 400) return;
        if (selectedPaneId) setSelectedPaneId(null);
        else if (narrow && sidebarOpen) setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [helpOpen, openHelp, walkIn, canWalk, mapKey, viewReady, toggleView, frameRow, selectedPaneId, narrow, sidebarOpen]);

  // Keep keystrokes typed into form fields away from the walk controls.
  const shieldTyping = (e: ReactKeyboardEvent) => {
    if (isTypingTarget(e.target)) e.stopPropagation();
  };

  /* ---------- derived labels (all from real data) */
  const where = locate(snapshot, here.ws, here.tab);
  const deptStats = useMemo(() => {
    if (!snapshot || !here.tab) return null;
    const people = (snapshot.agents ?? []).filter((a) => a.tab_id === here.tab).length;
    const desks = (snapshot.panes ?? []).filter((p) => p.tab_id === here.tab).length;
    return `${plural(people, 'person', 'people')} at ${plural(desks, 'desk')}`;
  }, [snapshot, here.tab]);

  const floorLabel = connection ? floorName(connection) : null;
  const eyebrow = connection ? `${floorName(connection)} · ${buildingName(connection)}` : 'Herdr Office';
  const heading = where?.department || where?.company || (connection ? (snapshot ? 'The open floor' : 'Arriving…') : 'Front door');
  const sub = where
    ? [where.department ? where.company : null, deptStats].filter(Boolean).join(' · ') || null
    : snapshot ? `${plural(snapshot.workspaces?.length ?? 0, 'company', 'companies')} · ${plural(snapshot.agents?.length ?? 0, 'person', 'people')} on this floor` : null;

  const drawerOpen = !!(connection && selectedPaneId);
  const showMap = !!snapshot && !floorClosed && (snapshot.workspaces?.length ?? 0) > 0;
  useEffect(() => { if (drawerOpen && compact) setSidebarOpen(false); }, [drawerOpen, compact]);

  /* ---------- top-of-stage notices */
  const discoveryError = feed.world?.error?.trim().replace(/[.\s]+$/, '') || null;
  let ribbon: { tone: 'warn' | 'info'; text: string } | null = null;
  if (feed.world && feed.status === 'offline') {
    ribbon = { tone: 'warn', text: `Bridge offline — showing what it last reported ${relativeTime(feed.receivedAt, now)}. Nothing here is live until it reconnects.` };
  } else if (connection && !connection.online) {
    ribbon = { tone: 'warn', text: `${floorName(connection)} is offline${connection.error ? `: ${connection.error}` : '.'}` };
  } else if (connection && !snapshot) {
    ribbon = { tone: 'info', text: `Connected to ${floorName(connection)} — waiting for Herdr's first snapshot.` };
  } else if (feed.status === 'reconnecting') {
    ribbon = { tone: 'info', text: 'Live updates interrupted — reconnecting to the bridge.' };
  } else if (discoveryError && connections.length > 0) {
    ribbon = { tone: 'warn', text: `Looking for Herdr sessions failed: ${discoveryError}. Showing the sessions already found.` };
  }

  let center = null;
  if (!feed.world && feed.status === 'offline') {
    center = (
      <CenterCard
        icon={<WifiOff size={22} />}
        title="Can't reach the office bridge"
        actions={<button type="button" className="btn btn--copper" onClick={feed.retry}><RefreshCw size={14} /> Try again</button>}
      >
        <p>{feed.error ?? 'The local Herdr Office service is not answering.'}</p>
        <p className="muted">Start it with <code>npm run dev</code> in the project folder. This page reconnects by itself.</p>
      </CenterCard>
    );
  } else if (feed.world && connections.length === 0 && discoveryError) {
    center = (
      <CenterCard
        icon={<SearchX size={22} />}
        title="Couldn't look for Herdr sessions"
        actions={<button type="button" className="btn btn--copper" onClick={feed.retry}><RefreshCw size={14} /> Try again</button>}
      >
        <p>The bridge is running, but finding Herdr sessions on this Mac failed:</p>
        <p className="center-card__detail">{discoveryError}</p>
        <p className="muted">There may still be sessions running; they will appear here once discovery succeeds.</p>
      </CenterCard>
    );
  } else if (feed.world && connections.length === 0) {
    center = (
      <CenterCard icon={<DoorClosed size={22} />} title="No buildings yet">
        <p>The bridge is running but doesn't see any Herdr sessions on this Mac. Start Herdr and its session will appear here as a building.</p>
      </CenterCard>
    );
  } else if (floorClosed) {
    const gone = lastKnown.current;
    center = (
      <CenterCard
        icon={<DoorClosed size={22} />}
        title="This floor has closed"
        actions={connections.slice(0, 4).map((c) => (
          <button key={c.id} type="button" className="btn btn--ghost" onClick={() => chooseFloor(c.id)}>
            {floorName(c)} · {buildingName(c)}{!c.online && ' (offline)'}
          </button>
        ))}
      >
        <p>{gone ? `${floorName(gone)} in ${buildingName(gone)}` : 'The floor you picked'} is no longer reported by the bridge. Its session may have ended. Pick another floor:</p>
      </CenterCard>
    );
  }

  return (
    <div
      className={`app${locked ? ' is-locked' : ''}${drawerOpen ? ' has-drawer' : ''}${sidebarOpen ? ' has-sidebar' : ''}${showMap ? (mapOpen ? (mapLarge && !narrow ? ' has-map map-large' : ' has-map') : ' has-map map-folded') : ''}${ribbon ? ' has-ribbon' : ''}`}
      style={narrow ? undefined : ({ '--drawer-w': `${drawerSize.width}px` } as CSSProperties)}
    >
      <main className="stage" aria-label="3D office">
        {!webglError && (
          <SceneBoundary onError={onSceneCrash}>
            <OfficeScene
              ref={scene}
              connection={floorClosed ? null : connection}
              selectedPaneId={selectedPaneId}
              mainAgent={mainAgent}
              viewMode={viewMode}
              onSelectPane={onSelectPane}
              onLocation={onLocation}
              onViewChange={onViewChange}
              onLockChange={onLockChange}
              onReady={onReady}
              onError={onSceneError}
            />
          </SceneBoundary>
        )}
      </main>
      <div className="vignette" aria-hidden="true" />

      <div className="ui" onKeyDown={shieldTyping}>
        <Masthead
          connections={connections}
          selectedId={connection?.id ?? null}
          onSelect={chooseFloor}
          bridge={feed.status}
          bridgeError={feed.error}
          receivedAt={feed.receivedAt}
          onRetry={feed.retry}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          onHelp={openHelp}
          mainAgent={mainLookup.state === 'unset' ? null : { lookup: mainLookup, onJump: jumpToMain }}
        />

        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          snapshot={floorClosed ? undefined : snapshot}
          floorLabel={floorLabel}
          hereWorkspaceId={here.ws}
          hereTabId={here.tab}
          selectedPaneId={selectedPaneId}
          onTeleport={teleport}
          onFocusAgent={focusPane}
          connectionId={floorClosed ? null : connection?.id ?? null}
          mainAgent={mainAgent}
          mainLookup={mainLookup}
          onJumpToMain={jumpToMain}
          onForgetMain={() => setMainAgent(null)}
        />

        {ribbon && <div className={`ribbon ribbon--${ribbon.tone}`} role="status">{ribbon.text}</div>}
        {center}

        {showMap && connection && snapshot && (
          <FloorMap
            snapshot={snapshot}
            connectionId={connection.id}
            floorLabel={floorLabel}
            open={mapOpen}
            large={mapLarge}
            narrow={narrow}
            hereTabId={here.tab}
            selectedPaneId={selectedPaneId}
            mainAgent={mainAgent}
            now={now}
            view={viewStore}
            onToggle={toggleMap}
            onToggleLarge={() => setMapLarge((v) => !v)}
            onGoTo={teleport}
            onVisit={focusPane}
          />
        )}

        {sceneError && <SceneError message={sceneError} onReload={() => window.location.reload()} />}
        {!sceneError && !sceneReady && sceneHasFloor && <SceneLoading slow={slowLoad} />}
        {sceneNotice && (
          <div className="toast" role="alert">
            <span>{sceneNotice}</span>
            <button type="button" className="icon-btn icon-btn--tiny" onClick={() => setSceneNotice(null)} aria-label="Dismiss"><X size={13} /></button>
          </div>
        )}

        <EntryDock
          eyebrow={eyebrow}
          heading={heading}
          sub={sub}
          canWalk={canWalk}
          walkNote={sceneUsable && !POINTER_LOCK ? "This browser can't capture the cursor — drag to look around instead." : null}
          touch={touch}
          showHints={!hintsHidden && sceneUsable}
          viewMode={viewMode}
          onWalk={walkIn}
          onDismissHints={() => setHintsHidden(true)}
          onHelp={openHelp}
          nav={sceneUsable && sceneHasFloor ? (
            <ViewControls mode={viewMode} ready={viewReady} view={viewStore} onMode={setViewMode} onFrameRow={frameRow} onRaise={raiseView} />
          ) : null}
        />

        {drawerOpen && connection && selectedPaneId && (
          <PaneDrawer
            connection={connection}
            paneId={selectedPaneId}
            memory={memory.current}
            canGoToDesk={sceneUsable && sceneReady}
            onGoToDesk={focusPane}
            onClose={() => setSelectedPaneId(null)}
            mainAgent={mainAgent}
            onToggleMain={toggleMain}
            size={narrow ? null : drawerSize}
          />
        )}
      </div>

      {locked && <><Crosshair /><LockedHint viewMode={viewMode} /></>}
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} touch={touch} />
    </div>
  );
}
