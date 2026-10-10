import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { request } from 'node:http';
import { createDemoServer } from './demo.ts';
import { createDemoFixture } from './demo-world.ts';
import { socialDemo } from './demo-social.ts';
import { deriveFloor } from '../src/world/layout.ts';
import { departmentScheme } from '../src/world/departmentArt.ts';

async function setup(t: { after(callback: () => Promise<void>): void }, activityScale = 1) {
  const staticDir = await mkdtemp(join(tmpdir(), 'herdr-office-demo-test-'));
  await writeFile(join(staticDir, 'index.html'), '<title>Fictional demo</title>');
  const { server, close } = createDemoServer({ staticDir, completionDelay: 20, activityScale });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => { close(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); await rm(staticDir, { recursive: true, force: true }); });
  const post = (path: string, body: unknown, origin = url) => fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) });
  return { url, post };
}

test('demo serves only fictional inventories and assets, with no live-target fallback', async t => {
  const { url, post } = await setup(t);
  const info = await (await fetch(url + '/api/demo/info')).json();
  assert.equal(info.demo, true); assert.equal(info.isolated, true);
  const world = await (await fetch(url + '/api/world')).json();
  assert.deepEqual(world.connections.map((c: any) => c.snapshot.agents.length), [12, 4]);
  assert.ok(world.connections.every((c: any) => c.id.startsWith('demo:') && c.snapshot.panes.every((p: any) => p.terminal_id.startsWith('demo-terminal-') && p.cwd.startsWith('/demo/'))));
  assert.match(await (await fetch(url)).text(), /Fictional demo/);
  assert.equal((await fetch(url + '/api/panes/real-pane/terminal?connectionId=local')).status, 404);
  assert.equal((await post('/api/agents/real-pane/prompt', { connectionId: 'local', terminalId: 'real-terminal', text: 'Must not reach a real agent' })).status, 404);
});

test('multi-lane demo adds a second row without moving existing companies or inventing non-reported occupants', async t => {
  const base = deriveFloor(createDemoFixture().world.connections[0].snapshot!);
  const larger = createDemoFixture(Date.now(), 'multi-lane');
  const plan = deriveFloor(larger.world.connections[0].snapshot!);
  assert.equal(plan.companies.length, 6);
  assert.deepEqual(plan.companies.slice(0, 3), base.companies);
  assert.equal(new Set(plan.companies.map(company => company.z)).size, 2);
  assert.deepEqual(plan.companies.slice(3).map(company => company.name), ['Kestrel Forge', 'Bramble Pay', 'Tidewell Docs']);
  assert.equal(plan.desks.filter(desk => desk.agent).length, 24);
  assert.ok(larger.world.connections[0].snapshot!.agents.every(agent => agent.cwd!.startsWith('/demo/')));
  const { url, post } = await setup(t);
  assert.equal((await post('/api/demo/reset', { layout: 'multi-lane' })).status, 200);
  assert.equal((await (await fetch(url + '/api/demo/info')).json()).layout, 'multi-lane');
  assert.equal((await (await fetch(url + '/api/world')).json()).connections[0].snapshot.workspaces.length, 6);
  assert.equal((await post('/api/demo/reset', { layout: 'unknown' })).status, 400);
  await post('/api/demo/reset', {});
  assert.equal((await (await fetch(url + '/api/world')).json()).connections[0].snapshot.workspaces.length, 3);
});

test('campus demo consistently exposes six rows and preserves the smaller demo layouts', async t => {
  const smaller = deriveFloor(createDemoFixture(0, 'multi-lane').world.connections[0].snapshot!);
  const fixture = createDemoFixture(0, 'campus');
  const floor = deriveFloor(fixture.world.connections[0].snapshot!);
  assert.equal(floor.companies.length, 18);
  assert.equal(new Set(floor.companies.map(company => company.z)).size, 6);
  assert.deepEqual(floor.companies.slice(0, 6), smaller.companies);
  assert.equal(floor.desks.filter(desk => desk.agent).length, 72);
  assert.equal(new Set(floor.companies.map(company => company.name)).size, 18);
  assert.equal(fixture.world.connections[1].snapshot!.agents.length, 4);
  assert.ok(fixture.world.connections.every(connection => connection.snapshot!.panes.every(pane => pane.cwd!.startsWith('/demo/'))));
  assert.ok(fixture.world.connections[0].snapshot!.panes.every(pane => !!pane.terminal_title_stripped));
  const { url, post } = await setup(t);
  assert.equal((await post('/api/demo/reset', { layout: 'campus' })).status, 200);
  assert.equal((await (await fetch(url + '/api/demo/info')).json()).layout, 'campus');
  assert.equal((await (await fetch(url + '/api/world')).json()).connections[0].snapshot.workspaces.length, 18);
  await post('/api/demo/reset', {});
  assert.equal((await (await fetch(url + '/api/world')).json()).connections[0].snapshot.workspaces.length, 3);
});

test('showcase demo has two large floors with isolated terminal identities and unchanged primary campus', async t => {
  const campus = createDemoFixture(0, 'campus');
  const showcase = createDemoFixture(0, 'showcase');
  assert.deepEqual(showcase.world.connections[0], campus.world.connections[0]);
  for (const connection of showcase.world.connections) {
    const plan = deriveFloor(connection.snapshot!);
    assert.equal(plan.companies.length, 18);
    assert.equal(new Set(plan.companies.map(company => company.z)).size, 6);
    assert.equal(connection.snapshot!.agents.length, 72);
    assert.equal(new Set(plan.companies.map(company => company.name)).size, 18);
  }
  const terminals = showcase.world.connections.flatMap(connection => connection.snapshot!.panes.map(pane => pane.terminal_id));
  assert.equal(new Set(terminals).size, terminals.length);
  assert.equal(showcase.world.connections[1].snapshot!.workspaces[0].label, 'Northstar API');
  const { url, post } = await setup(t);
  assert.equal((await post('/api/demo/reset', { layout: 'showcase' })).status, 200);
  const world = await (await fetch(url + '/api/world')).json();
  assert.ok(world.connections.every((connection: { snapshot: { workspaces: unknown[] } }) => connection.snapshot.workspaces.length === 18));
  await post('/api/demo/reset', {});
  assert.equal((await (await fetch(url + '/api/world')).json()).connections[1].snapshot.workspaces.length, 1);
});

test('social demo preserves Studio and gives the compact build floor a distinct identity', async t => {
  const campus = createDemoFixture(0, 'campus');
  const social = createDemoFixture(0, 'social');
  assert.deepEqual(social.world.connections[0], campus.world.connections[0]);
  const build = social.world.connections[1];
  assert.equal(build.snapshot!.workspaces.length, 1);
  assert.equal(build.snapshot!.workspaces[0].label, 'Cinder CI');
  assert.equal(build.snapshot!.tabs.length, 2);
  assert.equal(build.snapshot!.agents.length, 4);
  assert.deepEqual(build.snapshot!.agents.map(a => [a.terminal_title_stripped, a.agent, a.agent_status]),
    campus.world.connections[1].snapshot!.agents.map(a => [a.terminal_title_stripped, a.agent, a.agent_status]));
  assert.deepEqual(build.snapshot!.tabs.map(tab => departmentScheme(build.id + '/' + tab.tab_id).key),
    ['ochre-hour', 'slate-blocks']);
  assert.ok(build.snapshot!.panes.every(p => p.cwd === '/demo/cinder-ci'));
  assert.ok(build.snapshot!.workspaces.every(w => build.snapshot!.tabs.some(tab => tab.tab_id === w.active_tab_id)));
  const { url, post } = await setup(t);
  assert.equal((await post('/api/demo/reset', { layout: 'social' })).status, 200);
  assert.equal((await (await fetch(url + '/api/demo/info')).json()).layout, 'social');
  assert.equal((await (await fetch(url + '/api/world')).json()).connections[1].snapshot.workspaces[0].label, 'Cinder CI');
});

test('social hero streams its own work, accepts steering when ready, and reset cancels that work', async t => {
  const { url, post } = await setup(t, .05);
  const target = { connectionId: 'demo:studio', paneId: 'demo-w11:p1', scenario: socialDemo.terminal.scenario };
  await post('/api/demo/reset', { layout: 'campus' });
  assert.equal((await post('/api/demo/activity', target)).status, 400);
  await post('/api/demo/reset', { layout: 'social' });
  assert.equal((await post('/api/demo/activity', { ...target, paneId: 'demo-w1:p1' })).status, 400);
  assert.equal((await post('/api/demo/activity', target)).status, 200);
  const terminal = async () => (await (await fetch(url + '/api/panes/demo-w11%3Ap1/terminal?connectionId=demo%3Astudio')).json()).text as string;
  const instruction = { connectionId: 'demo:studio', terminalId: 'demo-terminal-demo-studio-demo-w11:p1', text: socialDemo.terminal.prompt };
  assert.equal((await post('/api/agents/demo-w11%3Ap1/prompt', instruction)).status, 409);
  await new Promise(resolve => setTimeout(resolve, 140));
  assert.match(await terminal(), /FICTIONAL DEMO OUTPUT[\s\S]*1,204 rows matched[\s\S]*Ready for your next instruction/);
  assert.equal((await post('/api/agents/demo-w11%3Ap1/prompt', instruction)).status, 200);
  await new Promise(resolve => setTimeout(resolve, 120));
  assert.match(await terminal(), /Check for duplicate IDs first[\s\S]*3 duplicate IDs found[\s\S]*nothing overwritten[\s\S]*reports\/nightly-demo\.md/);
  await post('/api/demo/activity', target);
  await post('/api/demo/reset', { layout: 'social' });
  await new Promise(resolve => setTimeout(resolve, 140));
  assert.doesNotMatch(await terminal(), /demo-batch-a|duplicates|reports\/nightly-demo/);
});

test('demo rejects cross-origin input and stale terminal identities', async t => {
  const { post } = await setup(t);
  const target = { connectionId: 'demo:studio', terminalId: 'demo-terminal-demo-studio-demo-w1:p1', text: 'Review the fictional checklist' };
  assert.equal((await post('/api/agents/demo-w1%3Ap1/prompt', target, 'https://example.invalid')).status, 403);
  assert.equal((await post('/api/agents/demo-w1%3Ap1/prompt', { ...target, terminalId: 'replaced-demo-terminal' })).status, 409);
  assert.equal((await post('/api/agents/demo-w1%3Ap2/prompt', { ...target, terminalId: 'demo-terminal-demo-studio-demo-w1:p2' })).status, 409);
});

test('demo rejects untrusted hosts, missing input origins and cross-site reads', async t => {
  const { url } = await setup(t);
  const maliciousHost = 'attacker.example';
  // Fetch normalizes Host; raw HTTP exercises a real DNS-rebinding request.
  const maliciousRequest = (method: string, path: string) => new Promise<number | undefined>((resolve, reject) => {
    const req = request(url + path, { method, headers: { Host: maliciousHost, Origin: `http://${maliciousHost}`, 'Content-Type': 'application/json' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end(method === 'POST' ? '{}' : undefined);
  });
  assert.equal(await maliciousRequest('GET', '/api/world'), 403);
  assert.equal(await maliciousRequest('POST', '/api/demo/reset'), 403);
  assert.equal((await fetch(url + '/api/demo/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await fetch(url + '/api/world', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await fetch(url + '/api/world', { headers: { Origin: 'http://127.0.0.1:4318' } })).status, 403);
  const local = await fetch(url + '/api/world');
  assert.equal(local.status, 200); assert.equal(local.headers.get('x-content-type-options'), 'nosniff');
});

test('demo bounds UTF-8 request bytes and rejects encoded static-path escapes', async t => {
  const { url, post } = await setup(t);
  const tooManyBytes = { text: '界'.repeat(6000) };
  assert.ok(JSON.stringify(tooManyBytes).length < 16_384);
  assert.equal((await post('/api/demo/reset', tooManyBytes)).status, 413);
  assert.equal((await fetch(url + '/%2e%2e%2foutside-secret.txt')).status, 403);
});

test('demo caps event streams and frees the slot when a client disconnects', async t => {
  const { url } = await setup(t);
  const controllers: AbortController[] = [];
  const readers: ReadableStreamDefaultReader<Uint8Array>[] = [];
  const retainStream = async (response: Response) => {
    assert.equal(response.status, 200);
    const reader = response.body!.getReader(); readers.push(reader);
    const initial = await reader.read();
    assert.equal(initial.done, false);
    assert.match(new TextDecoder().decode(initial.value), /^event: world\n/);
  };
  try {
    for (let index = 0; index < 32; index++) {
      const controller = new AbortController(); controllers.push(controller);
      // Hold and consume each body: an abandoned Fetch response can be closed
      // by garbage collection and would no longer occupy a server stream slot.
      await retainStream(await fetch(url + '/api/events', { signal: controller.signal }));
    }
    const excess = await fetch(url + '/api/events');
    assert.equal(excess.status, 429); await excess.text();
    await readers[0].cancel(); controllers[0].abort();
    await new Promise(resolve => setTimeout(resolve, 50));
    const replacement = new AbortController(); controllers.push(replacement);
    await retainStream(await fetch(url + '/api/events', { signal: replacement.signal }));
  } finally {
    await Promise.allSettled(readers.map(reader => reader.cancel()));
    for (const controller of controllers) controller.abort();
  }
});

test('demo prompt delivery updates a reported agent and labeled scripted output, then reset restores the fixture', async t => {
  const { url, post } = await setup(t);
  const body = { connectionId: 'demo:studio', terminalId: 'demo-terminal-demo-studio-demo-w1:p1', text: 'List gaps in the 2.4 release notes.' };
  assert.equal((await post('/api/agents/demo-w1%3Ap1/prompt', body)).status, 200);
  await new Promise(resolve => setTimeout(resolve, 40));
  const world = await (await fetch(url + '/api/world')).json();
  assert.equal(world.connections[0].snapshot.agents[0].agent_status, 'done');
  const terminal = await (await fetch(url + '/api/panes/demo-w1%3Ap1/terminal?connectionId=demo%3Astudio')).json();
  assert.match(terminal.text, /FICTIONAL DEMO RESPONSE/); assert.match(terminal.text, /Migration and rollback notes/);
  assert.equal((await post('/api/demo/reset', {})).status, 200);
  const reset = await (await fetch(url + '/api/world')).json();
  assert.equal(reset.connections[0].snapshot.agents[0].agent_status, 'idle');
  assert.equal(reset.connections[0].snapshot.agents.length, 12);
});

test('reset cancels pending scripted completions instead of mutating the fresh demo', async t => {
  const { url, post } = await setup(t);
  await post('/api/agents/demo-w1%3Ap1/prompt', { connectionId: 'demo:studio', terminalId: 'demo-terminal-demo-studio-demo-w1:p1', text: 'A temporary demo instruction' });
  await post('/api/demo/reset', {});
  await new Promise(resolve => setTimeout(resolve, 40));
  const world = await (await fetch(url + '/api/world')).json();
  assert.equal(world.connections[0].snapshot.agents[0].agent_status, 'idle');
  const terminal = await (await fetch(url + '/api/panes/demo-w1%3Ap1/terminal?connectionId=demo%3Astudio')).json();
  assert.doesNotMatch(terminal.text, /temporary demo instruction|FICTIONAL DEMO RESPONSE/);
});

test('live demo activity advances terminal output and allows the next instruction only after completion', async t => {
  const { url, post } = await setup(t, .01);
  const target = { connectionId: 'demo:studio', paneId: 'demo-w1:p1', scenario: 'release-review' };
  const terminal = async () => (await (await fetch(url + '/api/panes/demo-w1%3Ap1/terminal?connectionId=demo%3Astudio')).json()).text as string;
  assert.equal((await post('/api/demo/activity', { ...target, connectionId: 'local' })).status, 404);
  assert.equal((await post('/api/demo/activity', { ...target, scenario: 'unknown' })).status, 400);
  assert.equal((await post('/api/demo/activity', target)).status, 200);
  assert.match(await terminal(), /Reading CHANGELOG/);
  const instruction = { connectionId: target.connectionId, terminalId: 'demo-terminal-demo-studio-demo-w1:p1', text: 'Add migration and rollback notes first.' };
  assert.equal((await post('/api/agents/demo-w1%3Ap1/prompt', instruction)).status, 409);
  await new Promise(resolve => setTimeout(resolve, 160));
  assert.match(await terminal(), /Comparing merged changes[\s\S]*Migration and rollback notes are missing[\s\S]*Review complete/);
  const reviewed = await (await fetch(url + '/api/world')).json();
  assert.equal(reviewed.connections[0].snapshot.agents[0].agent_status, 'done');
  assert.equal((await post('/api/agents/demo-w1%3Ap1/prompt', instruction)).status, 200);
  assert.match(await terminal(), /Instruction received/);
  await new Promise(resolve => setTimeout(resolve, 90));
  const steered = await terminal();
  assert.match(steered, /Prioritizing migration and rollback[\s\S]*Writing docs\/releases\/2\.4\.md[\s\S]*Checks passed/);
  assert.match(steered, /FICTIONAL DEMO OUTPUT/);
});

test('reset cancels a live demonstration without old output or status appearing in the new fixture', async t => {
  const { url, post } = await setup(t, .01);
  await post('/api/demo/activity', { connectionId: 'demo:studio', paneId: 'demo-w1:p1', scenario: 'release-review' });
  await post('/api/demo/reset', {});
  await new Promise(resolve => setTimeout(resolve, 160));
  const world = await (await fetch(url + '/api/world')).json();
  assert.equal(world.connections[0].snapshot.agents[0].agent_status, 'idle');
  const terminal = await (await fetch(url + '/api/panes/demo-w1%3Ap1/terminal?connectionId=demo%3Astudio')).json();
  assert.doesNotMatch(terminal.text, /Reading CHANGELOG|Comparing merged changes|Review complete/);
});
