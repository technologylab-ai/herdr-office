import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import type { HerdrSnapshot } from '../src/types.ts';
import { BridgeError, HerdrBridge, StatusTimeline, parseMachines, parseSessions, shellQuote, sshArguments, validateKeys, type Target, type Transport, type Machine } from './herdr.ts';
import { createBridgeServer, validateRequest } from './http.ts';

const agent = { pane_id: 'w1:pA', tab_id: 'w1:t1', workspace_id: 'w1', terminal_id: 'term_live', agent: 'codex', agent_status: 'idle' as const, revision: 1, focused: false };
function snapshot(): HerdrSnapshot { return { protocol: 22, version: '0.9.0', workspaces: [], tabs: [], panes: [{ ...agent }], agents: [{ ...agent }], layouts: [] }; }
class MockTransport implements Transport {
  state = snapshot();
  calls: { args: string[]; target?: Target }[] = [];
  failSnapshot = false;
  async run(args: string[], target?: Target): Promise<string> {
    this.calls.push({ args, target });
    if (args[0] === 'session') return JSON.stringify({ sessions: [{ name: 'default', running: true, socket_path: '/mock/socket' }] });
    if (args[0] === 'machine') return '[]';
    if (args[0] === 'api') { if (this.failSnapshot) throw new Error('socket disconnected'); return JSON.stringify({ result: { snapshot: this.state } }); }
    if (args[1] === 'read') return 'real terminal\n';
    return JSON.stringify({ result: { sent: true } });
  }
}
async function fixture() { const transport = new MockTransport(); const bridge = new HerdrBridge(transport, 'Test Mac'); await bridge.refresh(); return { transport, bridge }; }

test('session and machine discovery use actual JSON shapes and reject malformed data', () => {
  assert.equal(parseSessions('{"sessions":[{"name":"default","running":true,"socket_path":"/tmp/socket"}]}')[0]?.name, 'default');
  assert.deepEqual(parseMachines('[]'), []);
  assert.throws(() => parseSessions('[]'), /invalid session/);
  assert.throws(() => parseMachines('[{"id":"1"}]'), /invalid machine/);
});
test('world contains only reported state and removes snapshots on connection failure', async () => {
  const { bridge, transport } = await fixture();
  assert.equal(bridge.world.connections[0]?.id, 'local:default');
  assert.equal(bridge.world.connections[0]?.snapshot?.agents.length, 1);
  transport.failSnapshot = true;
  await bridge.refresh();
  assert.equal(bridge.world.connections[0]?.online, false);
  assert.equal(bridge.world.connections[0]?.snapshot, undefined);
  assert.equal(bridge.world.connections[0]?.error, 'socket disconnected');
  bridge.stop();
});
test('invalid pane and connection IDs cannot reach terminal input commands', async () => {
  const { bridge, transport } = await fixture();
  await assert.rejects(bridge.prompt('local:default', '--help', 'test', 'term_live'), /Invalid Herdr pane/);
  await assert.rejects(bridge.prompt('unknown', 'w1:pA', 'test', 'term_live'), /connection no longer/);
  await assert.rejects(bridge.prompt('local:default', 'w1:pMissing', 'test', 'term_live'), /no longer exists/);
  assert.equal(transport.calls.filter(c => c.args[0] === 'agent').length, 0);
  bridge.stop();
});
test('busy, blocked and unknown agents reject normal prompts without mutation', async () => {
  const { bridge, transport } = await fixture();
  for (const status of ['working', 'blocked', 'unknown'] as const) {
    transport.state.agents[0]!.agent_status = status;
    await assert.rejects(bridge.prompt('local:default', 'w1:pA', 'test', 'term_live'), (e: unknown) => e instanceof BridgeError && e.code === 'agent_not_ready');
  }
  assert.equal(transport.calls.filter(c => c.args[0] === 'agent').length, 0);
  bridge.stop();
});
test('fresh terminal identity prevents stale desk mutation and missing identity', async () => {
  const { bridge, transport } = await fixture();
  await assert.rejects(bridge.keys('local:default', 'w1:pA', ['enter'], undefined), /identity is required/);
  transport.state.panes[0]!.terminal_id = 'replacement';
  await assert.rejects(bridge.prompt('local:default', 'w1:pA', 'test', 'term_live'), /terminal occupying this desk changed/);
  assert.equal(transport.calls.filter(c => c.args[0] === 'agent').length, 0);
  bridge.stop();
});
test('prompt text remains one literal argument; targeted socket never uses focus', async () => {
  const { bridge, transport } = await fixture();
  const text = 'Review `$(whoami)`; "literal"\nsecond line';
  await bridge.prompt('local:default', 'w1:pA', text, 'term_live');
  const call = transport.calls.at(-1)!;
  assert.deepEqual(call.args, ['agent', 'prompt', 'w1:pA', text]);
  assert.equal(call.target?.socket, '/mock/socket');
  bridge.stop();
});
test('simultaneous desk input is serialized and duplicate request is rejected', async () => {
  const { bridge, transport } = await fixture();
  const first = bridge.prompt('local:default', 'w1:pA', 'first', 'term_live');
  await assert.rejects(bridge.prompt('local:default', 'w1:pA', 'duplicate', 'term_live'), /Input is already/);
  await first;
  assert.equal(transport.calls.filter(c => c.args[0] === 'agent').length, 1);
  bridge.stop();
});
test('overlapping refresh requests perform only one inventory and snapshot poll', async () => {
  const transport = new MockTransport();
  const bridge = new HerdrBridge(transport, 'Test Mac');
  await Promise.all([bridge.refresh(), bridge.refresh(), bridge.refresh()]);
  assert.equal(transport.calls.filter(c => c.args[0] === 'session').length, 1);
  assert.equal(transport.calls.filter(c => c.args[0] === 'api').length, 1);
  bridge.stop();
});
test('initial discovery failure returns no invented connections', async () => {
  const bridge = new HerdrBridge({ run: async () => { throw new Error('Herdr missing'); } });
  await bridge.refresh();
  assert.deepEqual(bridge.world.connections, []);
  assert.equal((bridge.world as typeof bridge.world & { error: string }).error, 'Herdr missing');
  bridge.stop();
});
test('logical key validation rejects raw escape bytes, shell strings, empty and excessive keys', () => {
  validateKeys(['esc', 'ctrl+c', 'enter', 'shift+tab']);
  for (const value of [[], ['\x1b[A'], ['hello; shutdown'], Array(17).fill('enter'), ['ctrl+$(id)']]) assert.throws(() => validateKeys(value), /supported logical/);
});
test('terminal read validates limits and requests unwrapped raw text', async () => {
  const { bridge, transport } = await fixture();
  assert.deepEqual(await bridge.terminal('local:default', 'w1:pA', 'visible', 20), { text: 'real terminal\n' });
  assert.deepEqual(transport.calls.at(-1)?.args, ['pane', 'read', 'w1:pA', '--source', 'visible', '--lines', '20', '--format', 'text', '--raw']);
  await assert.rejects(bridge.terminal('local:default', 'w1:pA', 'visible', 501), /Invalid terminal source/);
  bridge.stop();
});
test('saved SSH profile routing uses bounded noninteractive SSH with independent quoting', () => {
  const args = sshArguments({ id: 'saved1', label: 'Remote', target: 'ssh://demo@example.org:2222', session: 'agents', enabled: true }, ['agent', 'prompt', 'w1:pA', "a'; touch /tmp/bad"]);
  assert.ok(args.includes('BatchMode=yes'));
  assert.equal(args.at(-2), 'demo@example.org');
  assert.ok(args.at(-1)?.includes(shellQuote("a'; touch /tmp/bad")));
  assert.ok(args.includes('2222'));
  // The user-installed binary must take priority over an obsolete /usr/bin entry.
  assert.ok(args.at(-1)!.indexOf('$HOME/.local/bin/herdr') < args.at(-1)!.indexOf('command -v herdr'));
  assert.throws(() => sshArguments({ id: 'bad', label: '', target: '-oProxyCommand=touch', session: '', enabled: true }, []), /Invalid saved/);
});

class RemoteTransport extends MockTransport {
  machines: Machine[] = [{ id: 'omar', label: 'remote-lab', target: 'remote-lab', session: 'default', enabled: true }];
  sessions = [{ name: 'default', running: true, socket_path: '/remote/default.sock' }, { name: 'research', running: true, socket_path: '/remote/research.sock' }, { name: 'archived', running: false, socket_path: '/remote/archived.sock' }];
  failInventory = false;
  activeDiscovery = 0;
  maxDiscovery = 0;
  override async run(args: string[], target?: Target): Promise<string> {
    if (args[0] === 'machine') { this.calls.push({ args, target }); return JSON.stringify(this.machines); }
    if (args[0] === 'session' && target?.remote) {
      this.calls.push({ args, target });
      if (this.failInventory) throw new Error('Remote session discovery failed');
      this.activeDiscovery++; this.maxDiscovery = Math.max(this.maxDiscovery, this.activeDiscovery);
      await new Promise(resolve => setTimeout(resolve, 1));
      this.activeDiscovery--;
      return JSON.stringify({ sessions: this.sessions });
    }
    return super.run(args, target);
  }
}
test('remote inventory discovers every existing session and only reads running ones', async () => {
  const transport = new RemoteTransport();
  const bridge = new HerdrBridge(transport, 'Test Mac');
  await bridge.refresh();
  const remote = bridge.world.connections.filter(c => c.machineId === 'omar');
  assert.deepEqual(remote.map(c => c.sessionName), ['default', 'research', 'archived']);
  assert.equal(remote.filter(c => c.online).length, 2);
  assert.equal(remote.find(c => c.sessionName === 'archived')?.error, 'Herdr session is stopped.');
  const remoteSnapshots = transport.calls.filter(c => c.args[0] === 'api' && c.target?.remote);
  assert.deepEqual(remoteSnapshots.map(c => c.target!.remote!.session), ['default', 'research']);
  assert.equal(transport.calls.some(c => c.args.includes('attach') || c.args.includes('start')), false);
  bridge.stop();
});
test('multiple saved profiles for one SSH host do not duplicate sessions or discovery', async () => {
  const transport = new RemoteTransport();
  transport.machines.push({ ...transport.machines[0]!, id: 'duplicate', label: 'same host research', session: 'research' });
  const bridge = new HerdrBridge(transport, 'Test Mac');
  await bridge.refresh();
  assert.equal(bridge.world.connections.filter(c => c.machineId !== 'local').length, 3);
  assert.equal(transport.calls.filter(c => c.args[0] === 'session' && c.target?.remote).length, 1);
  bridge.stop();
});
test('remote discovery is cached between polls and refresh failure preserves only known sessions offline', async () => {
  let clock = 1_000;
  const transport = new RemoteTransport();
  const bridge = new HerdrBridge(transport, 'Test Mac', () => clock);
  await bridge.refresh(); clock += 2_000; await bridge.refresh();
  assert.equal(transport.calls.filter(c => c.args[0] === 'session' && c.target?.remote).length, 1);
  transport.failInventory = true; clock += 16_000; await bridge.refresh();
  const remote = bridge.world.connections.filter(c => c.machineId !== 'local');
  assert.deepEqual(remote.map(c => c.sessionName), ['default', 'research', 'archived']);
  assert.ok(remote.every(c => !c.online && c.snapshot === undefined && c.error === 'Remote session discovery failed'));
  assert.equal(bridge.world.connections.find(c => c.machineId === 'local')?.online, true);
  bridge.stop();
});
test('disabled remote profiles perform no SSH calls', async () => {
  const transport = new RemoteTransport(); transport.machines[0]!.enabled = false;
  const bridge = new HerdrBridge(transport, 'Test Mac'); await bridge.refresh();
  assert.equal(transport.calls.filter(c => c.target?.remote).length, 0);
  assert.equal(bridge.world.connections.find(c => c.machineId === 'omar')?.error, 'Saved machine is disabled in Herdr.');
  bridge.stop();
});
test('remote host inventory concurrency is bounded at four', async () => {
  const transport = new RemoteTransport();
  transport.machines = Array.from({ length: 9 }, (_, i) => ({ id: `host${i}`, label: `Host ${i}`, target: `host${i}`, session: 'default', enabled: true }));
  const bridge = new HerdrBridge(transport, 'Test Mac'); await bridge.refresh();
  assert.equal(transport.maxDiscovery, 4);
  bridge.stop();
});
test('observed status time persists across output revisions but resets on state sequence, status and terminal changes', () => {
  const timeline = new StatusTimeline();
  const state = snapshot(); state.agents[0]!.state_change_seq = 10;
  const stamp = (now: number) => timeline.observe('local:test', state, now).agents[0]!.status_since;
  assert.equal(stamp(1_000), new Date(1_000).toISOString());
  state.agents[0]!.revision++;
  assert.equal(stamp(5_000), new Date(1_000).toISOString());
  state.agents[0]!.state_change_seq = 11;
  assert.equal(stamp(6_000), new Date(6_000).toISOString());
  state.agents[0]!.agent_status = 'working';
  assert.equal(stamp(7_000), new Date(7_000).toISOString());
  state.agents[0]!.terminal_id = 'replacement';
  assert.equal(stamp(8_000), new Date(8_000).toISOString());
  assert.equal(timeline.observe('local:test', state, 9_000).agents[0]!.status_since_source, 'observed');
  assert.equal(state.agents[0]!.status_since, undefined, 'the raw Herdr object is not mutated');
});
test('status observations are independent by connection and do not survive disappeared agents or offline gaps', () => {
  const timeline = new StatusTimeline(); const state = snapshot();
  timeline.observe('local:a', state, 1_000); timeline.observe('remote:b', state, 2_000);
  assert.equal(timeline.observe('local:a', state, 3_000).agents[0]!.status_since, new Date(1_000).toISOString());
  timeline.offline('local:a');
  assert.equal(timeline.observe('local:a', state, 4_000).agents[0]!.status_since, new Date(4_000).toISOString());
  assert.equal(timeline.observe('remote:b', state, 5_000).agents[0]!.status_since, new Date(2_000).toISOString());
  timeline.observe('local:a', { ...state, agents: [] }, 6_000);
  assert.equal(timeline.observe('local:a', state, 7_000).agents[0]!.status_since, new Date(7_000).toISOString());
  timeline.retain(new Set(['local:a']));
  assert.equal(timeline.observe('remote:b', state, 8_000).agents[0]!.status_since, new Date(8_000).toISOString());
});
test('bridge restarts observation time after a real connection outage using a fake clock', async () => {
  let clock = 1_000; const transport = new MockTransport();
  const bridge = new HerdrBridge(transport, 'Test Mac', () => clock); await bridge.refresh();
  const original = bridge.world.connections[0]!.snapshot!.agents[0]!.status_since;
  clock += 2_000; await bridge.refresh();
  assert.equal(bridge.world.connections[0]!.snapshot!.agents[0]!.status_since, original);
  transport.failSnapshot = true; clock += 2_000; await bridge.refresh();
  transport.failSnapshot = false; clock += 2_000; await bridge.refresh();
  assert.equal(bridge.world.connections[0]!.snapshot!.agents[0]!.status_since, new Date(clock).toISOString());
  bridge.stop();
});
test('cache-only annotations publish with observed status metadata and preserve Herdr fields', async () => {
  const transport = new MockTransport();
  const bridge = new HerdrBridge(transport, 'Test Mac');
  bridge.setWorldAnnotator(world => ({ ...world, connections: world.connections.map(connection => ({ ...connection,
    snapshot: connection.snapshot && { ...connection.snapshot, agents: connection.snapshot.agents.map(agent => ({ ...agent, office_label: 'Reviewing a test change', office_label_source: 'title' as const })) },
  })) }));
  let published = '';
  bridge.subscribe(world => { published = world.connections[0]!.snapshot!.agents[0]!.office_label!; });
  await bridge.refresh();
  const observed = bridge.world.connections[0]!.snapshot!.agents[0]!;
  assert.equal(published, 'Reviewing a test change');
  assert.equal(observed.agent, 'codex');
  assert.equal(observed.terminal_id, 'term_live');
  assert.equal(observed.status_since_source, 'observed');
  assert.equal(transport.state.agents[0]!.office_label, undefined);
  bridge.stop();
});
test('local HTTP security blocks malicious hosts, cross-site origins and originless mutations', () => {
  validateRequest({ method: 'GET', headers: { host: '127.0.0.1:4318' } });
  validateRequest({ method: 'POST', headers: { host: 'localhost:5173', origin: 'http://localhost:5173' } });
  assert.throws(() => validateRequest({ method: 'GET', headers: { host: 'attacker.test:4318' } }), /local Herdr Office hosts/);
  assert.throws(() => validateRequest({ method: 'POST', headers: { host: 'localhost:4318', origin: 'https://attacker.test' } }), /local Herdr Office app/);
  assert.throws(() => validateRequest({ method: 'POST', headers: { host: 'localhost:4318' } }), /requires a local/);
});
test('HTTP exposes world and terminal and rejects malformed prompts without sending input', async t => {
  const { bridge, transport } = await fixture();
  const { server, closeStreams } = createBridgeServer(bridge);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { closeStreams(); server.close(); bridge.stop(); });
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const call = (path: string, method = 'GET', payload?: unknown, origin = 'http://127.0.0.1:5173') => new Promise<{ status: number; data: any }>((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: address.port, path, method, headers: { host: '127.0.0.1:4318', origin, 'content-type': 'application/json' } }, res => {
      let text = ''; res.on('data', chunk => { text += chunk; }); res.on('end', () => resolve({ status: res.statusCode!, data: JSON.parse(text) }));
    }); req.on('error', reject); req.end(payload === undefined ? undefined : JSON.stringify(payload));
  });
  assert.equal((await call('/api/world')).data.connections[0].id, 'local:default');
  const terminal = await call('/api/panes/w1%3ApA/terminal?connectionId=local%3Adefault&lines=10');
  assert.equal(terminal.data.text, 'real terminal\n');
  assert.equal((await call('/api/agents/w1%3ApA/prompt', 'POST', { connectionId: 'local:default', text: 'test' })).status, 400);
  assert.equal((await call('/api/agents/w1%3ApA/prompt', 'POST', { connectionId: 'local:default', text: 'test', terminalId: 'term_live' }, 'https://attacker.test')).status, 403);
  assert.equal(transport.calls.filter(c => c.args[0] === 'agent').length, 0);
});
test('SSE starts with the actual world as a named event and disconnects cleanly', async t => {
  const { bridge } = await fixture();
  const { server, closeStreams } = createBridgeServer(bridge);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { closeStreams(); server.close(); bridge.stop(); });
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const data = await new Promise<string>((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: address.port, path: '/api/events', headers: { host: '127.0.0.1:4318' } }, res => {
      assert.equal(res.headers['content-type'], 'text/event-stream');
      let text = ''; res.on('data', chunk => { text += chunk; if (text.includes('\n\n')) { resolve(text); req.destroy(); } });
    }); req.on('error', reject); req.end();
  });
  assert.match(data, /^event: world\ndata: /);
  const world = JSON.parse(data.split('data: ')[1]!.trim());
  assert.equal(world.connections[0].snapshot.agents[0].pane_id, 'w1:pA');
});
