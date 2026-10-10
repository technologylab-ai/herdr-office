export type AgentStatus = 'idle' | 'working' | 'blocked' | 'done' | 'unknown';
export interface HerdrWorkspace {
  workspace_id: string; label: string; number: number; active_tab_id: string;
  agent_status: AgentStatus; tab_count: number; pane_count: number; focused: boolean;
}
export interface HerdrTab {
  tab_id: string; workspace_id: string; label: string; number: number;
  agent_status: AgentStatus; pane_count: number; focused: boolean;
}
export interface HerdrPane {
  pane_id: string; workspace_id: string; tab_id: string; terminal_id: string;
  agent?: string | null; display_agent?: string | null; name?: string | null;
  agent_status: AgentStatus; cwd?: string | null; title?: string | null;
  label?: string | null; terminal_title?: string | null; terminal_title_stripped?: string | null;
  revision: number; focused: boolean; interactive_ready?: boolean;
}
export interface HerdrAgent extends HerdrPane {
  state_change_seq?: number;
  status_since?: string;
  status_since_source?: 'observed';
  office_label?: string;
  office_label_source?: 'luna' | 'title';
}
export interface MainAgentRef { connectionId: string; paneId: string; terminalId: string }
export interface Rect { x: number; y: number; width: number; height: number }
export interface HerdrLayout {
  workspace_id: string; tab_id: string; area: Rect;
  panes: { pane_id: string; rect: Rect; focused: boolean }[];
  splits: { direction: 'right' | 'down'; id: string; ratio: number; rect: Rect }[];
  zoomed: boolean; focused_pane_id: string;
}
export interface HerdrSnapshot {
  version: string; protocol: number;
  workspaces: HerdrWorkspace[]; tabs: HerdrTab[]; panes: HerdrPane[];
  agents: HerdrAgent[]; layouts: HerdrLayout[];
  focused_workspace_id?: string; focused_tab_id?: string; focused_pane_id?: string;
}
export interface HerdrConnection {
  id: string; machineId: string; machineName: string; sessionName: string;
  online: boolean; error?: string; snapshot?: HerdrSnapshot;
}
export interface WorldState { connections: HerdrConnection[]; updatedAt: string; error?: string }
export interface SceneHandle {
  enter(): void; exit(): void;
  teleport(workspaceId: string, tabId?: string): void;
  focusPane(paneId: string): void;
  frameRow(): void;
  raiseView(delta: number): void;
}
export interface SceneProps {
  connection: HerdrConnection | null;
  selectedPaneId: string | null;
  mainAgent?: MainAgentRef | null;
  viewMode?: 'overview' | 'walk';
  onSelectPane(paneId: string): void;
  onLocation(workspaceId: string | null, tabId: string | null): void;
  onViewChange?(view: OfficeView): void;
  onLockChange(locked: boolean): void;
  onReady(): void;
  onError(message: string): void;
}
export interface OfficeView {
  x: number; z: number;
  height: number;
  /** Heading in radians: zero faces -Z; positive rotates toward -X. */
  yaw: number;
}
