import { execFile } from 'node:child_process';
import { hostname } from 'node:os';
import type { HerdrConnection, HerdrPane, HerdrSnapshot, WorldState } from '../src/types.ts';

export class BridgeError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export interface Session { name: string; running: boolean; socket_path: string }
export interface Machine { id: string; label: string; target: string; session: string; enabled: boolean }
export interface Target { id: string; machineId: string; machineName: string; sessionName: string; socket?: string; remote?: Machine; running: boolean; discoveryError?: string }
export interface Transport { run(args: string[], target?: Target): Promise<string> }

export function parseJson(text: string): any {
  try { return JSON.parse(text); } catch { throw new BridgeError(502, 'invalid_response', 'Herdr returned an invalid JSON response.'); }
}
export function parseSessions(text: string): Session[] {
  const value = parseJson(text);
  if (!Array.isArray(value.sessions) || value.sessions.some((s: any) => !s || typeof s.name !== 'string' || typeof s.running !== 'boolean' || typeof s.socket_path !== 'string'))
    throw new BridgeError(502, 'invalid_sessions', 'Herdr returned an invalid session list.');
  return value.sessions;
}
export function parseMachines(text: string): Machine[] {
  const value = parseJson(text);
  if (!Array.isArray(value) || value.some((m: any) => !m || ['id', 'label', 'target', 'session'].some(k => typeof m[k] !== 'string') || typeof m.enabled !== 'boolean'))
    throw new BridgeError(502, 'invalid_machines', 'Herdr returned an invalid machine list.');
  return value;
}
export function parseSnapshot(text: string): HerdrSnapshot {
  const value = parseJson(text);
  if (value.error) throw new BridgeError(502, value.error.code || 'herdr_error', value.error.message || 'Herdr request failed.');
  const snapshot = value.result?.snapshot;
  if (!snapshot || ['workspaces', 'tabs', 'panes', 'agents', 'layouts'].some(k => !Array.isArray(snapshot[k])))
    throw new BridgeError(502, 'invalid_snapshot', 'Herdr returned an invalid session snapshot.');
  return snapshot;
}

// SSH always invokes a remote shell; quote each argument independently. Never use a local shell.
export function shellQuote(value: string): string { return "'" + value.replaceAll("'", "'\\''") + "'"; }
export function sshArguments(machine: Machine, args: string[]): string[] {
  let destination = machine.target;
  const options = ['-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=4', '-o', 'ConnectionAttempts=1', '-o', 'ServerAliveInterval=3', '-o', 'ServerAliveCountMax=1'];
  if (destination.startsWith('ssh://')) {
    const url = new URL(destination);
    if (url.password || url.pathname && url.pathname !== '/' || url.search || url.hash) throw new BridgeError(502, 'invalid_ssh_target', 'Unsupported saved SSH target.');
    destination = (url.username ? decodeURIComponent(url.username) + '@' : '') + url.hostname;
    if (url.port) options.push('-p', url.port);
  }
  if (!/^[a-zA-Z0-9_.@:[\]-]+$/.test(destination) || destination.startsWith('-')) throw new BridgeError(502, 'invalid_ssh_target', 'Invalid saved SSH destination.');
  // A noninteractive SSH login may omit ~/.local/bin from PATH. These are the
  // documented standard install locations; do not install or start anything.
  const locateHerdr = 'if [ -x "$HOME/.local/bin/herdr" ]; then exec "$HOME/.local/bin/herdr" "$@"; elif [ -x "$HOME/.cargo/bin/herdr" ]; then exec "$HOME/.cargo/bin/herdr" "$@"; elif command -v herdr >/dev/null 2>&1; then exec herdr "$@"; else echo "Herdr is not installed or available in the remote PATH" >&2; exit 127; fi';
  const remoteArgs = ['sh', '-c', locateHerdr, 'herdr-office', '--session', machine.session, ...args];
  return [...options, '--', destination, remoteArgs.map(shellQuote).join(' ')];
}

export class CliTransport implements Transport {
  constructor(private binary = process.env.HERDR_BIN_PATH || 'herdr') {}
  async run(args: string[], target?: Target): Promise<string> {
    const env = { ...process.env };
    // Inherited caller IDs are scoped to one session and must never retarget commands.
    delete env.HERDR_PANE_ID; delete env.HERDR_TAB_ID; delete env.HERDR_WORKSPACE_ID;
    if (target?.socket) env.HERDR_SOCKET_PATH = target.socket;
    const command = target?.remote ? 'ssh' : this.binary;
    const argv = target?.remote ? sshArguments(target.remote, args) : args;
    return new Promise((resolve, reject) => {
      execFile(command, argv, { env, timeout: target?.remote ? 12_000 : 8_000, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8', shell: false }, (error, stdout, stderr) => {
        if (error) {
          let message = stderr.trim() || error.message;
          let code = 'herdr_unavailable';
          try { const response = JSON.parse(stderr); code = response.error?.code || code; message = response.error?.message || message; } catch { /* plain CLI/SSH error */ }
          reject(new BridgeError(502, code, message.slice(0, 1500)));
        } else resolve(stdout);
      });
    });
  }
}

export const PANE_ID = /^w[a-zA-Z0-9]+:p[a-zA-Z0-9]+$/;
export function validatePaneId(id: string): void {
  if (!PANE_ID.test(id)) throw new BridgeError(400, 'invalid_pane_id', 'Invalid Herdr pane ID.');
}
export function validateKeys(keys: unknown): asserts keys is string[] {
  const accepted = /^(enter|tab|esc|escape|backspace|delete|up|down|left|right|home|end|pageup|pagedown|space|ctrl\+[a-z]|shift\+tab|f(?:[1-9]|1[0-2]))$/;
  if (!Array.isArray(keys) || keys.length < 1 || keys.length > 16 || keys.some(k => typeof k !== 'string' || !accepted.test(k)))
    throw new BridgeError(400, 'invalid_keys', 'Supply 1–16 supported logical terminal keys.');
}

export function remoteHostKey(machine: Machine): string {
  // Keep SSH aliases intact: separate aliases may have different users or routing.
  // Normalize only explicit URI notation whose complete destination is known.
  if (!machine.target.startsWith('ssh://')) return machine.target;
  const url = new URL(machine.target);
  return `${url.username ? decodeURIComponent(url.username) + '@' : ''}${url.hostname}${url.port && url.port !== '22' ? ':' + url.port : ''}`;
}

interface Observation { connectionId: string; signature: string; since: string }
/** Office observation metadata, never a reconstruction of past Herdr activity. */
export class StatusTimeline {
  private observations = new Map<string, Observation>();
  observe(connectionId: string, snapshot: HerdrSnapshot, now: number): HerdrSnapshot {
    const live = new Set<string>();
    const agents = snapshot.agents.map(agent => {
      const key = JSON.stringify([connectionId, agent.pane_id]);
      live.add(key);
      const signature = JSON.stringify([agent.terminal_id, agent.agent, agent.agent_status, agent.state_change_seq ?? null]);
      const previous = this.observations.get(key);
      const observation = previous?.signature === signature ? previous : { connectionId, signature, since: new Date(now).toISOString() };
      this.observations.set(key, observation);
      return { ...agent, status_since: observation.since, status_since_source: 'observed' as const };
    });
    for (const [key, value] of this.observations) if (value.connectionId === connectionId && !live.has(key)) this.observations.delete(key);
    return { ...snapshot, agents };
  }
  offline(connectionId: string): void {
    for (const [key, value] of this.observations) if (value.connectionId === connectionId) this.observations.delete(key);
  }
  retain(connectionIds: Set<string>): void {
    for (const [key, value] of this.observations) if (!connectionIds.has(value.connectionId)) this.observations.delete(key);
  }
  clear(): void { this.observations.clear(); }
}

export class HerdrBridge {
  world: WorldState = { connections: [], updatedAt: new Date().toISOString() };
  private targets = new Map<string, Target>();
  private listeners = new Set<(world: WorldState) => void>();
  private polling?: Promise<void>;
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = true;
  private lastDiscovery = 0;
  private mutationLocks = new Set<string>();
  private remoteSessionCache = new Map<string, Session[]>();
  private timeline = new StatusTimeline();
  private worldAnnotator?: (world: WorldState) => WorldState;
  constructor(private transport: Transport = new CliTransport(), private localName = hostname(), private now = Date.now) {}
  /** Synchronous cache-only decoration; slow model work must run outside polling. */
  setWorldAnnotator(annotate: (world: WorldState) => WorldState): void { this.worldAnnotator = annotate; }
  subscribe(listener: (world: WorldState) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  async refresh(): Promise<void> {
    if (this.polling) return this.polling;
    this.polling = this.refreshOnce().finally(() => { this.polling = undefined; });
    return this.polling;
  }
  private async refreshOnce(): Promise<void> {
    try {
      if (!this.lastDiscovery || this.now() - this.lastDiscovery > 15_000) {
        const [sessions, machines] = await Promise.all([
          this.transport.run(['session', 'list', '--json']).then(parseSessions),
          this.transport.run(['machine', 'list', '--json']).then(parseMachines),
        ]);
        const targets = sessions.map(s => ({ id: `local:${s.name}`, machineId: 'local', machineName: this.localName, sessionName: s.name, socket: s.socket_path, running: s.running } as Target));
        const groups = new Map<string, Machine[]>();
        for (const machine of machines) {
          const key = remoteHostKey(machine);
          groups.set(key, [...(groups.get(key) || []), machine]);
        }
        const hosts = [...groups.entries()];
        // Discover every existing remote session once per SSH destination, with
        // the same bounded concurrency as snapshots. Never start a session.
        for (let start = 0; start < hosts.length; start += 4) {
          const remoteTargets = await Promise.all(hosts.slice(start, start + 4).map(async ([host, profiles]) => {
            const machine = profiles.find(m => m.enabled) || profiles[0]!;
            const configured: Target = { id: `ssh:${machine.id}:${machine.session}`, machineId: machine.id, machineName: machine.label, sessionName: machine.session, remote: machine, running: machine.enabled };
            let sessions = this.remoteSessionCache.get(host);
            let discoveryError: string | undefined;
            if (machine.enabled) {
              try { sessions = parseSessions(await this.transport.run(['session', 'list', '--json'], configured)); this.remoteSessionCache.set(host, sessions); }
              catch (error) { discoveryError = error instanceof Error ? error.message : String(error); }
            }
            // A saved profile is an explicitly configured target, not a demo.
            // Preserve it offline when its inventory cannot yet be read.
            if (!sessions) return [{ ...configured, discoveryError }];
            return sessions.map(session => ({ ...configured, id: `ssh:${machine.id}:${session.name}`, sessionName: session.name,
              remote: { ...machine, session: session.name }, running: machine.enabled && session.running, discoveryError }));
          }));
          targets.push(...remoteTargets.flat());
        }
        for (const host of this.remoteSessionCache.keys()) if (!groups.has(host)) this.remoteSessionCache.delete(host);
        this.targets = new Map(targets.map(t => [t.id, t]));
        this.timeline.retain(new Set(this.targets.keys()));
        this.lastDiscovery = this.now();
      }
      const targets = [...this.targets.values()];
      const connections: HerdrConnection[] = [];
      // Bound concurrent CLI/SSH processes when many floors are connected.
      for (let start = 0; start < targets.length; start += 4) {
        connections.push(...await Promise.all(targets.slice(start, start + 4).map(async t => {
          const base: HerdrConnection = { id: t.id, machineId: t.machineId, machineName: t.machineName, sessionName: t.sessionName, online: false };
          if (!t.running || t.discoveryError) {
            this.timeline.offline(t.id);
            return { ...base, error: t.discoveryError || (t.remote && !t.remote.enabled ? 'Saved machine is disabled in Herdr.' : 'Herdr session is stopped.') };
          }
          try { return { ...base, online: true, snapshot: this.timeline.observe(t.id, parseSnapshot(await this.transport.run(['api', 'snapshot'], t)), this.now()) }; }
          catch (error) { this.timeline.offline(t.id); return { ...base, error: error instanceof Error ? error.message : String(error) }; }
        })));
      }
      this.world = { connections, updatedAt: new Date(this.now()).toISOString() };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const existing = this.world.connections;
      this.timeline.clear();
      this.world = { updatedAt: new Date(this.now()).toISOString(), connections: existing.map(({ snapshot: _snapshot, ...c }) => ({ ...c, online: false, error: message })), ...{ error: message } };
    }
    if (this.worldAnnotator) {
      try { this.world = this.worldAnnotator(this.world); }
      catch { console.warn('Herdr Office label annotation failed; publishing the live Herdr inventory.'); }
    }
    for (const listener of this.listeners) listener(this.world);
  }
  async start(): Promise<void> {
    this.stopped = false;
    const tick = async () => { await this.refresh(); if (!this.stopped) this.timer = setTimeout(tick, 2_000); };
    await tick();
  }
  stop(): void { this.stopped = true; if (this.timer) clearTimeout(this.timer); this.listeners.clear(); }
  private target(id: unknown): Target {
    if (typeof id !== 'string' || !this.targets.has(id)) throw new BridgeError(404, 'connection_not_found', 'Herdr connection no longer exists.');
    const target = this.targets.get(id)!;
    if (!target.running || target.discoveryError) throw new BridgeError(409, 'connection_offline', target.discoveryError || 'Herdr connection is offline.');
    return target;
  }
  private async pane(connectionId: unknown, paneId: string, terminalId?: unknown): Promise<{ target: Target; pane: HerdrPane; snapshot: HerdrSnapshot }> {
    validatePaneId(paneId);
    const target = this.target(connectionId);
    const snapshot = parseSnapshot(await this.transport.run(['api', 'snapshot'], target));
    const pane = snapshot.panes.find(p => p.pane_id === paneId);
    if (!pane) throw new BridgeError(404, 'pane_not_found', 'Pane no longer exists in the selected Herdr connection.');
    if (terminalId !== undefined && pane.terminal_id !== terminalId) throw new BridgeError(409, 'target_changed', 'The terminal occupying this desk changed. Select it again.');
    return { target, pane, snapshot };
  }
  async terminal(connectionId: unknown, paneId: string, source: string, lines: number): Promise<{ text: string }> {
    if (!['visible', 'recent-unwrapped'].includes(source) || !Number.isInteger(lines) || lines < 1 || lines > 500) throw new BridgeError(400, 'invalid_read_options', 'Invalid terminal source or line count (1–500).');
    const { target } = await this.pane(connectionId, paneId);
    return { text: await this.transport.run(['pane', 'read', paneId, '--source', source, '--lines', String(lines), '--format', 'text', '--raw'], target) };
  }
  private async mutate(connectionId: unknown, paneId: string, terminalId: unknown, operation: (resolved: { target: Target; pane: HerdrPane; snapshot: HerdrSnapshot }) => Promise<unknown>): Promise<unknown> {
    validatePaneId(paneId);
    if (typeof terminalId !== 'string' || !terminalId) throw new BridgeError(400, 'missing_terminal_id', 'The current terminal identity is required. Select a desk first.');
    const key = `${connectionId}/${paneId}`;
    if (this.mutationLocks.has(key)) throw new BridgeError(409, 'input_in_progress', 'Input is already being sent to this desk.');
    this.mutationLocks.add(key);
    try { return await operation(await this.pane(connectionId, paneId, terminalId)); }
    finally { this.mutationLocks.delete(key); }
  }
  async prompt(connectionId: unknown, paneId: string, text: unknown, terminalId: unknown): Promise<unknown> {
    if (typeof text !== 'string' || !text.trim() || Buffer.byteLength(text) > 32_768 || text.includes('\0')) throw new BridgeError(400, 'invalid_prompt', 'Prompt must contain 1–32768 bytes of text.');
    return this.mutate(connectionId, paneId, terminalId, async ({ target, pane, snapshot }) => {
      const agent = snapshot.agents.find(a => a.pane_id === paneId && a.terminal_id === pane.terminal_id);
      if (!agent) throw new BridgeError(409, 'agent_not_found', 'Herdr does not recognize an agent at this desk.');
      if (!['idle', 'done'].includes(agent.agent_status)) throw new BridgeError(409, 'agent_not_ready', `Agent is ${agent.agent_status}. Normal prompts require an idle or done agent.`);
      const result = parseJson(await this.transport.run(['agent', 'prompt', paneId, text], target));
      if (result.error) throw new BridgeError(409, result.error.code || 'prompt_failed', result.error.message || 'Herdr rejected the prompt.');
      return result.result ?? result;
    });
  }
  async keys(connectionId: unknown, paneId: string, keys: unknown, terminalId: unknown): Promise<unknown> {
    validateKeys(keys);
    return this.mutate(connectionId, paneId, terminalId, async ({ target, pane, snapshot }) => {
      const agent = snapshot.agents.some(a => a.pane_id === paneId && a.terminal_id === pane.terminal_id);
      const result = parseJson(await this.transport.run([agent ? 'agent' : 'pane', 'send-keys', paneId, ...keys], target));
      if (result.error) throw new BridgeError(409, result.error.code || 'keys_failed', result.error.message || 'Herdr rejected the keys.');
      return result.result ?? result;
    });
  }
}
