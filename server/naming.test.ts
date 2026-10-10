import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { HerdrAgent, WorldState } from '../src/types.ts';
import { AgentLabelService, labelCandidate, labelFailureCode, type LabelInput, type LabelServiceOptions } from './naming.ts';

function world(title = 'Sandbox retention baseline review', terminalId = 'terminal-one'): WorldState {
  const agent: HerdrAgent = { pane_id: 'w1:p1', terminal_id: terminalId, tab_id: 'w1:t1', workspace_id: 'w1', agent: 'claude', agent_status: 'idle', cwd: '/private/secret/sandbox', terminal_title_stripped: title, revision: 1, focused: false };
  return { updatedAt: '2026-01-01T00:00:00Z', connections: [{ id: 'local:main', machineId: 'local', machineName: 'local', sessionName: 'main', online: true, snapshot: { version: '1', protocol: 1, workspaces: [], tabs: [], layouts: [], panes: [{ ...agent }], agents: [agent] } }] };
}
function avatar(value: WorldState): HerdrAgent & { office_label?: string; office_label_source?: string } { return value.connections[0]!.snapshot!.agents[0]!; }
function harness(options: LabelServiceOptions = {}) {
  let time = 1_000;
  let sequence = 0;
  const timers = new Map<number, { due: number; callback: () => void }>();
  const calls: LabelInput[][] = [];
  let updates = 0;
  const errors: Error[] = [];
  const service = new AgentLabelService({
    debounceMs: 10, now: () => time,
    schedule: (callback, delay) => { const id = ++sequence; timers.set(id, { due: time + delay, callback }); return id; },
    cancel: id => { timers.delete(id as number); },
    executor: async inputs => { calls.push(inputs); return { labels: inputs.map(input => ({ key: input.key, label: 'Retention Baseline Review' })) }; },
    onUpdate: () => { updates++; }, onError: error => { errors.push(error); }, ...options,
  });
  async function advance(milliseconds: number) {
    time += milliseconds;
    for (const [id, timer] of [...timers]) if (timer.due <= time) { timers.delete(id); timer.callback(); }
    await new Promise<void>(resolve => setImmediate(resolve));
  }
  return { service, calls, timers, advance, errors, updates: () => updates };
}

test('label inputs contain only bounded metadata and opaque identities, with no absolute paths', () => {
  const snapshot = world().connections[0]!.snapshot!;
  const candidate = labelCandidate('local:main', snapshot.panes[0]!, snapshot.agents[0]!);
  assert.equal(candidate.input.directory, 'sandbox');
  assert.match(candidate.input.key, /^[0-9a-f]{24}$/);
  assert.deepEqual(Object.keys(candidate.input), ['key', 'title', 'label', 'directory']);
  assert.ok(!JSON.stringify(candidate.input).includes('/private'));
});

test('polling batches once, immediately falls back to title, and reuses cached labels', async () => {
  const h = harness();
  const first = h.service.annotate(world());
  assert.equal(avatar(first).office_label_source, 'title');
  assert.equal(avatar(first).agent, 'claude');
  for (let i = 0; i < 10; i++) h.service.annotate(world());
  assert.equal(h.timers.size, 1);
  assert.equal(h.calls.length, 0);
  await h.advance(10);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0]!.length, 1);
  assert.equal(h.updates(), 1);
  for (let i = 0; i < 10; i++) assert.equal(avatar(h.service.annotate(world())).office_label, 'Retention Baseline Review');
  assert.equal(h.timers.size, 0);
  assert.equal(avatar(first).office_label_source, 'title', 'previous snapshots are never mutated');
});

test('explicit pane labels stay intact and labeling can be disabled', async () => {
  const h = harness();
  const named = world();
  named.connections[0]!.snapshot!.panes[0]!.label = 'API Migration Reviewer';
  assert.equal(avatar(h.service.annotate(named)).office_label, 'API Migration Reviewer');
  await h.advance(20);
  assert.equal(h.calls.length, 0);
  const disabled = harness({ enabled: false });
  assert.equal(avatar(disabled.service.annotate(world())).office_label_source, 'title');
  assert.equal(disabled.timers.size, 0);
});

test('changed titles and replacement terminals never receive stale inference', async () => {
  let complete!: (value: unknown) => void;
  let requested: LabelInput[] = [];
  const h = harness({ executor: inputs => { requested = inputs; return new Promise(resolve => { complete = resolve; }); } });
  h.service.annotate(world());
  await h.advance(10);
  const changed = world('NATS credential configuration', 'terminal-two');
  h.service.annotate(changed);
  complete({ labels: [{ key: requested[0]!.key, label: 'Retention Baseline Review' }] });
  await h.advance(0);
  const annotated = avatar(h.service.annotate(changed));
  assert.equal(annotated.office_label, 'NATS credential configuration');
  assert.equal(annotated.office_label_source, 'title');
  assert.equal(h.updates(), 0);
  assert.equal(h.timers.size, 1);
  assert.equal(avatar(h.service.annotate(world('Different task', 'terminal-one'))).office_label, 'Different task');
});

test('metadata changes coalesce and request cadence is limited to once per minute', async () => {
  const h = harness();
  h.service.annotate(world());
  await h.advance(10);
  h.service.annotate(world('First new title'));
  h.service.annotate(world('Latest new title'));
  await h.advance(59_999);
  assert.equal(h.calls.length, 1);
  await h.advance(1);
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1]![0]!.title, 'Latest new title');
});

test('partial batches accept valid identities only, ignore invalid labels, and retry missing rows', async () => {
  const h = harness({ executor: async inputs => ({ labels: [
    { key: 'unknown-identity', label: 'Made Up Task' },
    { key: inputs[0]!.key, label: 'Retention Baseline Review' },
    { key: inputs[0]!.key, label: 'Duplicate Should Not Win' },
    { key: inputs[1]!.key, label: 'x'.repeat(51) },
  ] }) });
  const batch = world();
  const snapshot = batch.connections[0]!.snapshot!;
  const second = { ...snapshot.agents[0]!, pane_id: 'w1:p2', terminal_id: 'terminal-two' };
  snapshot.panes.push(second); snapshot.agents.push(second);
  h.service.annotate(batch);
  await h.advance(10);
  const result = h.service.annotate(batch).connections[0]!.snapshot!.agents as (HerdrAgent & { office_label?: string; office_label_source?: string })[];
  assert.equal(result[0]!.office_label, 'Retention Baseline Review');
  assert.equal(result[1]!.office_label_source, 'title');
  assert.equal(h.timers.size, 1);
  assert.equal(h.errors.length, 0);
});

test('failed or wholly malformed requests retain titles and cool down for five minutes', async () => {
  for (const executor of [async () => { throw new Error('offline'); }, async () => ({ labels: [{ key: 'bad', label: 'invalid' }] })]) {
    const h = harness({ executor });
    h.service.annotate(world());
    await h.advance(10);
    assert.equal(h.errors.length, 1);
    assert.equal(avatar(h.service.annotate(world())).office_label_source, 'title');
    await h.advance(299_999);
    assert.equal(h.errors.length, 1);
    await h.advance(1);
    assert.equal(h.errors.length, 2);
    h.service.stop();
    assert.equal(h.timers.size, 0);
  }
});

test('cached labels have bounded storage and missing agents cancel pending work', async () => {
  const h = harness({ cacheSize: 1 });
  h.service.annotate(world()); await h.advance(10);
  h.service.annotate(world('Different Task')); await h.advance(60_000);
  assert.equal(avatar(h.service.annotate(world())).office_label_source, 'title', 'first cache entry was evicted');
  h.service.annotate({ connections: [], updatedAt: '' });
  await h.advance(60_000);
  assert.equal(h.calls.length, 2);
  h.service.stop();
});

test('one inference runs at a time and shutdown aborts it without publishing late results', async () => {
  let complete!: (value: unknown) => void;
  let signal!: AbortSignal;
  let requested: LabelInput[] = [];
  let calls = 0;
  const h = harness({ executor: (inputs, cancellation) => {
    calls++; requested = inputs; signal = cancellation!;
    return new Promise(resolve => { complete = resolve; });
  } });
  h.service.annotate(world()); await h.advance(10);
  h.service.annotate(world('Different Task')); await h.advance(60_000);
  assert.equal(calls, 1);
  assert.equal(signal.aborted, false);
  h.service.stop();
  assert.equal(signal.aborted, true);
  complete({ labels: [{ key: requested[0]!.key, label: 'Retention Baseline Review' }] });
  await h.advance(0);
  assert.equal(h.updates(), 0);
  assert.equal(h.timers.size, 0);
});

test('CLI failures are categorized without retaining private stderr in user-facing errors', () => {
  assert.equal(labelFailureCode('401: authentication failed'), 'authentication');
  assert.equal(labelFailureCode('stream disconnected after 503'), 'network');
  assert.equal(labelFailureCode('429 rate limit exceeded'), 'rate_limit');
  assert.equal(labelFailureCode('unexpected argument --test'), 'cli_configuration');
  assert.equal(labelFailureCode('misc failure with private title text'), 'process_failed');
});
