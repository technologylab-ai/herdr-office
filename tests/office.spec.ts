import { test, expect, type Page } from '@playwright/test';
import type { HerdrPane, HerdrSnapshot, WorldState } from '../src/types';
import { deriveFloor } from '../src/world/layout';

// Explicit test-only inventory. Every API request is intercepted below;
// these tests must never send input to any actual Herdr pane on this Mac.
const panes: HerdrPane[] = [
  { pane_id: 'w1:p1', workspace_id: 'w1', tab_id: 'w1:t1', terminal_id: 'test_terminal_idle', agent: 'codex', name: 'Aster', agent_status: 'idle', revision: 1, focused: true, cwd: '/test/company-one', terminal_title_stripped: 'Test idle coder' },
  { pane_id: 'w1:p2', workspace_id: 'w1', tab_id: 'w1:t2', terminal_id: 'test_terminal_working', agent: 'claude', name: 'Birch', agent_status: 'working', revision: 2, focused: false, cwd: '/test/company-one', terminal_title_stripped: 'Test busy reviewer' },
  { pane_id: 'w2:p1', workspace_id: 'w2', tab_id: 'w2:t1', terminal_id: 'test_terminal_blocked', agent: 'grok', name: 'Cedar', agent_status: 'blocked', revision: 3, focused: false, cwd: '/test/company-two', terminal_title_stripped: 'Test waiting agent' },
  // A pane field alone must never invent a human not present in snapshot.agents.
  { pane_id: 'w1:p3', workspace_id: 'w1', tab_id: 'w1:t1', terminal_id: 'test_terminal_shell', agent: 'opencode', name: 'Invisible impostor', agent_status: 'unknown', revision: 4, focused: false, terminal_title_stripped: 'Test shell pane' },
];
const snapshot: HerdrSnapshot = {
  version: '0.9.0', protocol: 22,
  workspaces: [
    { workspace_id: 'w1', label: 'Test Company One', number: 1, active_tab_id: 'w1:t1', agent_status: 'working', tab_count: 2, pane_count: 3, focused: true },
    { workspace_id: 'w2', label: 'Test Company Two', number: 2, active_tab_id: 'w2:t1', agent_status: 'blocked', tab_count: 1, pane_count: 1, focused: false },
  ],
  tabs: [
    { tab_id: 'w1:t1', workspace_id: 'w1', label: 'Test Engineering', number: 1, agent_status: 'idle', pane_count: 2, focused: true },
    { tab_id: 'w1:t2', workspace_id: 'w1', label: 'Test Review', number: 2, agent_status: 'working', pane_count: 1, focused: false },
    { tab_id: 'w2:t1', workspace_id: 'w2', label: 'Test Research', number: 1, agent_status: 'blocked', pane_count: 1, focused: false },
  ],
  panes,
  agents: panes.slice(0, 3),
  layouts: [
    { workspace_id: 'w1', tab_id: 'w1:t1', area: { x: 0, y: 0, width: 100, height: 40 }, panes: [{ pane_id: 'w1:p1', rect: { x: 0, y: 0, width: 60, height: 40 }, focused: true }, { pane_id: 'w1:p3', rect: { x: 60, y: 0, width: 40, height: 40 }, focused: false }], splits: [{ direction: 'right', id: 'test_split', ratio: 0.6, rect: { x: 0, y: 0, width: 100, height: 40 } }], zoomed: false, focused_pane_id: 'w1:p1' },
    { workspace_id: 'w1', tab_id: 'w1:t2', area: { x: 0, y: 0, width: 100, height: 40 }, panes: [{ pane_id: 'w1:p2', rect: { x: 0, y: 0, width: 100, height: 40 }, focused: true }], splits: [], zoomed: false, focused_pane_id: 'w1:p2' },
    { workspace_id: 'w2', tab_id: 'w2:t1', area: { x: 0, y: 0, width: 100, height: 40 }, panes: [{ pane_id: 'w2:p1', rect: { x: 0, y: 0, width: 100, height: 40 }, focused: true }], splits: [], zoomed: false, focused_pane_id: 'w2:p1' },
  ],
};
function fixture(): WorldState {
  return structuredClone({ connections: [{ id: 'local:test-only', machineId: 'local', machineName: 'Test Mac', sessionName: 'test-only', online: true, snapshot }], updatedAt: '2026-10-02T12:00:00.000Z' });
}
interface Input { path: string; body: Record<string, unknown> }
async function mockOffice(page: Page, world = fixture(), mutationError?: string, terminalContent?: string) {
  await page.addInitScript(() => localStorage.setItem('herdr-office:view-mode', 'walk'));
  const inputs: Input[] = [];
  const reads: URL[] = [];
  const unexpected: string[] = [];
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/world' && request.method() === 'GET') return route.fulfill({ json: world });
    if (url.pathname === '/api/events' && request.method() === 'GET') return route.fulfill({ status: 200, contentType: 'text/event-stream', body: `event: world\ndata: ${JSON.stringify(world)}\n\n` });
    if (/^\/api\/panes\/[^/]+\/terminal$/.test(url.pathname) && request.method() === 'GET') {
      reads.push(url);
      const paneId = decodeURIComponent(url.pathname.split('/')[3]!);
      const source = url.searchParams.get('source');
      return route.fulfill({ json: { text: terminalContent ?? `TEST TERMINAL ${paneId}\n${source === 'visible' ? 'VISIBLE SCREEN CONTENT' : 'UNWRAPPED RECENT CONTENT'}\nThis output came from an isolated API test fixture.` } });
    }
    if (/^\/api\/(agents\/[^/]+\/prompt|panes\/[^/]+\/keys)$/.test(url.pathname) && request.method() === 'POST') {
      inputs.push({ path: decodeURIComponent(url.pathname), body: request.postDataJSON() });
      if (mutationError) return route.fulfill({ status: 409, json: { error: mutationError, code: 'target_changed' } });
      return route.fulfill({ json: { ok: true, result: { sent: true } } });
    }
    unexpected.push(`${request.method()} ${url.pathname}`);
    return route.fulfill({ status: 501, json: { error: 'Unexpected test API route; live requests are forbidden.' } });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /^(Show|Hide) directory$/ })).toBeVisible();
  if (await page.getByRole('button', { name: 'Show directory', exact: true }).isVisible()) await page.getByRole('button', { name: 'Show directory', exact: true }).click();
  await expect(page.locator('#directory').getByTitle('Go to Test Company One', { exact: true })).toBeVisible();
  return { inputs, reads, unexpected };
}
async function openAgent(page: Page, caption: string) {
  await page.getByRole('tab', { name: /^Roster/ }).click();
  await page.locator('.roster__list').getByRole('button', { name: new RegExp(caption) }).click();
  await expect(page.getByRole('complementary', { name: /^Desk:/ })).toBeVisible();
}

test('roster mirrors only snapshot.agents, including exact live statuses', async ({ page }) => {
  const mock = await mockOffice(page);
  await page.getByRole('tab', { name: /^Roster/ }).click();
  const rows = page.locator('.roster__list .person');
  await expect(rows).toHaveCount(3);
  await expect(rows.filter({ hasText: 'Test idle coder' })).toContainText('Idle');
  await expect(rows.filter({ hasText: 'Test busy reviewer' })).toContainText('Working');
  await expect(rows.filter({ hasText: 'Test waiting agent' })).toContainText('Needs you');
  await expect(page.getByText('Invisible impostor')).toHaveCount(0);
  await expect(page.getByText('Test shell pane')).toHaveCount(0);
  expect(mock.inputs).toEqual([]);
  expect(mock.unexpected).toEqual([]);
});

test('company and department jumps update the actual 3D location', async ({ page }) => {
  const mock = await mockOffice(page);
  await expect(page.getByRole('button', { name: 'Walk in', exact: true })).toBeEnabled();
  await expect(page.getByRole('main', { name: '3D office' }).locator('canvas')).toBeVisible();
  await page.locator('#directory').getByTitle('Go to Test Company Two', { exact: true }).click();
  await expect(page.locator('.dir__co.is-here')).toContainText('Test Company Two');
  await page.locator('#directory').getByRole('button', { name: /Test Review/ }).click();
  await expect(page.locator('#directory').getByRole('button', { name: /Test Review/ })).toHaveAttribute('aria-current', 'location');
  await expect(page.locator('.plaque__heading')).toHaveText('Test Review');
  expect(mock.inputs).toEqual([]);
  expect(mock.unexpected).toEqual([]);
});

test('terminal drawer reads the selected pane and switches recent/screen sources', async ({ page }) => {
  const mock = await mockOffice(page);
  await openAgent(page, 'Test idle coder');
  const terminal = page.getByRole('region', { name: 'Terminal output' });
  await expect(terminal).toContainText('TEST TERMINAL w1:p1');
  await expect(terminal).toContainText('UNWRAPPED RECENT CONTENT');
  await page.getByRole('tab', { name: 'Screen', exact: true }).click();
  await expect(terminal).toContainText('VISIBLE SCREEN CONTENT');
  await expect(page.getByRole('tab', { name: 'Screen', exact: true })).toHaveAttribute('aria-selected', 'true');
  expect(mock.reads.some(url => url.searchParams.get('connectionId') === 'local:test-only' && url.searchParams.get('source') === 'visible')).toBe(true);
  expect(mock.inputs).toEqual([]);
  expect(mock.unexpected).toEqual([]);
});

test('idle agent prompt carries selected connection, pane and terminal identity', async ({ page }) => {
  const mock = await mockOffice(page);
  await openAgent(page, 'Test idle coder');
  const message = 'Review the test-only change.\nKeep the literal `$(example)` text.';
  await page.getByRole('textbox', { name: /^Prompt for/ }).fill(message);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect.poll(() => mock.inputs.length).toBe(1);
  expect(mock.inputs[0]).toEqual({ path: '/api/agents/w1:p1/prompt', body: { connectionId: 'local:test-only', terminalId: 'test_terminal_idle', text: message } });
  await expect(page.getByRole('textbox', { name: /^Prompt for/ })).toHaveValue('');
  await expect(page.getByRole('list', { name: 'Prompts you sent from this browser' })).toContainText('Review the test-only change.');
  expect(mock.unexpected).toEqual([]);
});

test('rejected prompt preserves the draft and reports the real bridge error', async ({ page }) => {
  const mock = await mockOffice(page, fixture(), 'The terminal occupying this desk changed. Select it again.');
  await openAgent(page, 'Test idle coder');
  const draft = 'Keep this test-only draft if delivery is rejected.';
  await page.getByRole('textbox', { name: /^Prompt for/ }).fill(draft);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('The terminal occupying this desk changed.');
  await expect(page.getByRole('textbox', { name: /^Prompt for/ })).toHaveValue(draft);
  await expect(page.getByRole('list', { name: 'Prompts you sent from this browser' })).toHaveCount(0);
  expect(mock.inputs).toHaveLength(1);
  expect(mock.unexpected).toEqual([]);
});

test('a replaced terminal clears its predecessor draft and interrupt confirmation', async ({ page }) => {
  const world = fixture();
  const mock = await mockOffice(page, world);
  await openAgent(page, 'Test idle coder');
  await page.getByRole('textbox', { name: /^Prompt for/ }).fill('Draft for the old terminal only.');
  await page.getByRole('button', { name: /Terminal keys/ }).click();
  await page.getByRole('button', { name: /Interrupt: send Ctrl/ }).click();
  await expect(page.getByRole('button', { name: /Press again to send Ctrl/ })).toBeVisible();
  const fresh = world.connections[0]!.snapshot!;
  fresh.panes[0]!.terminal_id = 'test_replacement_terminal';
  fresh.agents[0]!.terminal_id = 'test_replacement_terminal';
  fresh.agents[0]!.terminal_title_stripped = 'Test replacement coder';
  // Finite fixture SSE reconnects automatically and reads the updated test world.
  await expect(page.locator('.drawer__caption')).toContainText('Test replacement coder');
  await expect(page.getByRole('textbox', { name: /^Prompt for/ })).toHaveValue('');
  await expect(page.getByRole('button', { name: /Press again to send Ctrl/ })).toHaveCount(0);
  expect(mock.inputs).toEqual([]);
  expect(mock.unexpected).toEqual([]);
});

for (const [caption, reason] of [['Test busy reviewer', 'Busy on a task.'], ['Test waiting agent', 'Waiting on you inside its terminal']] as const) {
  test(`${caption}: normal prompts are disabled without submitting input`, async ({ page }) => {
    const mock = await mockOffice(page);
    await openAgent(page, caption);
    await expect(page.getByRole('textbox', { name: /^Prompt for/ })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
    await expect(page.getByText(reason, { exact: false })).toBeVisible();
    expect(mock.inputs).toEqual([]);
    expect(mock.unexpected).toEqual([]);
  });
}

test('Interrupt requires two presses and routes Ctrl+C only to the selected terminal', async ({ page }) => {
  const mock = await mockOffice(page);
  await openAgent(page, 'Test busy reviewer');
  await page.getByRole('button', { name: /Terminal keys/ }).click();
  await page.getByRole('button', { name: /Interrupt: send Ctrl/ }).click();
  expect(mock.inputs).toEqual([]);
  const confirmation = page.getByRole('button', { name: /Press again to send Ctrl/ });
  await expect(confirmation).toBeVisible();
  // A focused keyboard activation reaches the same protected action without
  // waiting for two animation frames of mouse actionability during its 5s window.
  await confirmation.focus(); await confirmation.press('Enter');
  await expect.poll(() => mock.inputs.length).toBe(1);
  expect(mock.inputs[0]).toEqual({ path: '/api/panes/w1:p2/keys', body: { connectionId: 'local:test-only', terminalId: 'test_terminal_working', keys: ['ctrl+c'] } });
  expect(mock.unexpected).toEqual([]);
});

test('mobile directory can open, choose a real agent and yield to its terminal drawer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Directory starts closed on a mobile viewport, so install interception before navigation.
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/world') return route.fulfill({ json: fixture() });
    if (url.pathname === '/api/events') return route.fulfill({ contentType: 'text/event-stream', body: `event: world\ndata: ${JSON.stringify(fixture())}\n\n` });
    if (url.pathname.endsWith('/terminal')) return route.fulfill({ json: { text: 'TEST MOBILE TERMINAL' } });
    // No live API request is allowed through, including unexpected input.
    return route.fulfill({ status: 501, json: { error: 'Unexpected mobile fixture route' } });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Show directory', exact: true })).toBeVisible();
  await expect(page.locator('#directory')).toHaveAttribute('aria-hidden', 'true');
  await page.getByRole('button', { name: 'Show directory', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Office directory' })).toBeVisible();
  await openAgent(page, 'Test idle coder');
  await expect(page.locator('#directory')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByRole('region', { name: 'Terminal output' })).toContainText('TEST MOBILE TERMINAL');
  const drawer = page.getByRole('complementary', { name: /^Desk:/ });
  const box = await drawer.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(391);
});

test('idle and done agents remain seated in the 3D scene through live status changes', async ({ page }) => {
  const world = fixture();
  const mock = await mockOffice(page, world);
  const canvas = page.getByRole('main', { name: '3D office' }).locator('canvas');
  async function presence() {
    return JSON.parse(await canvas.getAttribute('data-agent-presence') || '[]') as {paneId:string;status:string;pose:string}[];
  }
  await expect.poll(async () => (await presence()).find(p => p.paneId === 'w1:p1')).toEqual({ paneId: 'w1:p1', status: 'idle', pose: 'seated' });
  await expect.poll(async () => (await presence()).find(p => p.paneId === 'w2:p1')?.pose).toBe('standing');
  expect((await presence()).some(p => p.paneId === 'w1:p3')).toBe(false);
  const agent = world.connections[0]!.snapshot!.agents[0]!;
  for (const status of ['working', 'done', 'idle'] as const) {
    agent.agent_status = status;
    await expect.poll(async () => (await presence()).find(p => p.paneId === 'w1:p1')).toEqual({ paneId: 'w1:p1', status, pose: 'seated' });
  }
  expect(mock.inputs).toEqual([]);
  expect(mock.unexpected).toEqual([]);
});

test('avatar artwork: four visible agents are evenly balanced and keep their styles through reorder and pose changes', async ({ page }) => {
  const world = fixture(), live = world.connections[0]!.snapshot!;
  // This local fixture explicitly reports its fourth pane as an agent. The
  // global fixture still proves shell panes never invent office occupants.
  const shell = live.panes.find(p => p.pane_id === 'w1:p3')!;
  live.agents.push({ ...shell, agent: 'claude', name: 'Test fourth agent', agent_status: 'idle' });
  const mock = await mockOffice(page, world);
  const canvas = page.getByRole('main', { name: '3D office' }).locator('canvas');
  interface Assignment { paneId: string; style: number }
  interface Presence { paneId: string; status: string; pose: string }
  const byPane = <T extends { paneId: string }>(items: T[]) => items.sort((a, b) => a.paneId.localeCompare(b.paneId));
  async function assignments(): Promise<Assignment[]> {
    return byPane(JSON.parse(await canvas.getAttribute('data-avatar-styles') || '[]'));
  }
  async function presence(): Promise<Presence[]> {
    return byPane(JSON.parse(await canvas.getAttribute('data-agent-presence') || '[]'));
  }
  const expectedIds = live.agents.map(a => a.pane_id).sort();
  await expect.poll(async () => (await assignments()).map(a => a.paneId)).toEqual(expectedIds);
  const original = await assignments();
  expect(original).toHaveLength(4);
  for (const assignment of original) expect([0, 1, 2, 3]).toContain(assignment.style);
  expect(original.filter(a => a.style >= 2)).toHaveLength(2);
  expect(original.filter(a => a.style < 2)).toHaveLength(2);
  const expectedBefore = byPane(live.agents.map(a => ({ paneId: a.pane_id, status: a.agent_status,
    pose: a.agent_status === 'blocked' ? 'standing' : 'seated' })));
  await expect.poll(presence).toEqual(expectedBefore);

  live.agents.reverse();
  for (const agent of live.agents) agent.agent_status = agent.agent_status === 'blocked' ? 'idle' : 'blocked';
  const expectedAfter = byPane(live.agents.map(a => ({ paneId: a.pane_id, status: a.agent_status,
    pose: a.agent_status === 'blocked' ? 'standing' : 'seated' })));
  // The finite SSE fixture reconnects with the changed roster. Waiting for
  // every changed pose proves a new snapshot reached the actual scene.
  await expect.poll(presence).toEqual(expectedAfter);
  await expect.poll(assignments).toEqual(original);
  expect(mock.inputs).toEqual([]); expect(mock.unexpected).toEqual([]);
});

test('desk drawer drag changes actual width, persists and remains inside a narrower viewport', async ({ page }) => {
  const mock = await mockOffice(page);
  await openAgent(page, 'Test idle coder');
  const drawer = page.getByRole('complementary', { name: /^Desk:/ });
  const grip = page.getByRole('separator', { name: 'Resize desk panel' });
  await expect(grip).toHaveAttribute('aria-valuenow', '440');
  await expect.poll(async () => {
    const box = (await drawer.boundingBox())!;
    const rightInset = await drawer.evaluate(el => parseFloat(getComputedStyle(el).right));
    return Math.abs(box.x + box.width - (page.viewportSize()!.width - rightInset));
  }).toBeLessThan(1);
  const before = await drawer.boundingBox();
  const handle = await grip.boundingBox();
  expect(before).not.toBeNull(); expect(handle).not.toBeNull();
  expect(Math.round(before!.width)).toBe(440);
  const x = handle!.x + handle!.width / 2;
  const y = handle!.y + Math.min(handle!.height / 2, 250);
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x - 230, y, { steps: 2 }); await page.mouse.up();
  await expect(grip).toHaveAttribute('aria-valuenow', '670');
  await expect.poll(async () => Math.round((await drawer.boundingBox())!.width)).toBe(670);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('herdr-office:drawer-width'))).toBe('670');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openAgent(page, 'Test idle coder');
  await expect.poll(async () => Math.round((await drawer.boundingBox())!.width)).toBe(670);
  await page.setViewportSize({ width: 780, height: 1000 });
  await expect.poll(async () => Math.round((await drawer.boundingBox())!.width)).toBeLessThanOrEqual(663);
  // The drawer entrance animates its horizontal position independently of width.
  await expect.poll(async () => { const box = (await drawer.boundingBox())!; return box.x + box.width; }).toBeLessThanOrEqual(780);
  const narrowed = await drawer.boundingBox();
  expect(narrowed!.x).toBeGreaterThanOrEqual(0);
  expect(narrowed!.x + narrowed!.width).toBeLessThanOrEqual(780);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect.poll(async () => Math.round((await drawer.boundingBox())!.width)).toBe(670);
  expect(mock.inputs).toEqual([]); expect(mock.unexpected).toEqual([]);
});

test('desk drawer keyboard grip changes rendered width and can reset its saved preference', async ({ page }) => {
  const mock = await mockOffice(page);
  await openAgent(page, 'Test idle coder');
  const grip = page.getByRole('separator', { name: 'Resize desk panel' });
  const drawer = page.getByRole('complementary', { name: /^Desk:/ });
  await grip.focus(); await grip.press('ArrowLeft');
  await expect(grip).toHaveAttribute('aria-valuenow', '456');
  await expect.poll(async () => Math.round((await drawer.boundingBox())!.width)).toBe(456);
  await grip.press('Shift+ArrowLeft');
  await expect(grip).toHaveAttribute('aria-valuenow', '520');
  await grip.press('Home'); await expect(grip).toHaveAttribute('aria-valuenow', '360');
  await grip.press('ArrowRight'); await expect(grip).toHaveAttribute('aria-valuenow', '360');
  await grip.press('Enter'); await expect(grip).toHaveAttribute('aria-valuenow', '440');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('herdr-office:drawer-width'))).toBeNull();
  expect(mock.inputs).toEqual([]); expect(mock.unexpected).toEqual([]);
});

test('terminal text controls change actual font size and persist after reloading', async ({ page }) => {
  const mock = await mockOffice(page);
  await openAgent(page, 'Test idle coder');
  const output = page.getByRole('region', { name: 'Terminal output' }).locator('pre');
  await expect(output).toHaveCSS('font-size', '13px');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Larger terminal text', exact: true }).click();
  await expect(output).toHaveCSS('font-size', '16px');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('herdr-office:term-font'))).toBe('16');
  await page.reload({ waitUntil: 'domcontentloaded' }); await openAgent(page, 'Test idle coder');
  await expect(output).toHaveCSS('font-size', '16px');
  await page.getByRole('button', { name: 'Smaller terminal text', exact: true }).click();
  await expect(output).toHaveCSS('font-size', '15px');
  await page.getByRole('button', { name: 'Terminal text 15px. Reset to 13px', exact: true }).click();
  await expect(output).toHaveCSS('font-size', '13px');
  expect(mock.inputs).toEqual([]); expect(mock.unexpected).toEqual([]);
});

test('mobile terminal text controls remain reachable and change the displayed font', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const mock = await mockOffice(page); await openAgent(page, 'Test idle coder');
  await expect(page.getByRole('separator', { name: 'Resize desk panel' })).not.toBeVisible();
  const increase = page.getByRole('button', { name: 'Larger terminal text', exact: true });
  await expect(increase).toBeVisible(); await increase.click();
  await expect(page.getByRole('region', { name: 'Terminal output' }).locator('pre')).toHaveCSS('font-size', '14px');
  const box = await increase.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(mock.inputs).toEqual([]); expect(mock.unexpected).toEqual([]);
});

test('main agent bookmark persists with exact identity and never transfers to a replacement terminal', async ({ page }) => {
  const world = fixture(); const mock = await mockOffice(page, world);
  await openAgent(page, 'Test idle coder');
  await page.getByRole('button', { name: 'Mark as main agent', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unmark main agent', exact: true })).toBeVisible();
  await expect(page.locator('.roster__list .person.is-main')).toHaveCount(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('herdr-office:main-agent') || 'null'))).toEqual({ connectionId: 'local:test-only', paneId: 'w1:p1', terminalId: 'test_terminal_idle' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const jump = page.getByRole('button', { name: /^Go to main agent / });
  await expect(jump).toBeVisible(); await jump.click();
  await expect(page.getByRole('button', { name: 'Unmark main agent', exact: true })).toBeVisible();
  const fresh = world.connections[0]!.snapshot!;
  fresh.panes[0]!.terminal_id = 'test_main_replacement'; fresh.agents[0]!.terminal_id = 'test_main_replacement';
  fresh.agents[0]!.terminal_title_stripped = 'Test new occupant at the old main desk';
  await expect(page.locator('.drawer__caption')).toContainText('Test new occupant');
  await expect(page.getByRole('button', { name: 'Mark as main agent', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Main agent unavailable/ })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('.roster__list .person.is-main')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('herdr-office:main-agent') || 'null'))).toEqual({ connectionId: 'local:test-only', paneId: 'w1:p1', terminalId: 'test_terminal_idle' });
  expect(mock.inputs).toEqual([]); expect(mock.unexpected).toEqual([]);
});

test('main agent jump crosses floors, waits for the scene and reaches the bookmarked department', async ({ page }) => {
  const world = fixture();
  const remote = structuredClone(world.connections[0]!);
  remote.id = 'ssh:test-remote:test-only'; remote.machineId = 'test-remote'; remote.machineName = 'Test Remote';
  for (const pane of remote.snapshot!.panes) pane.terminal_id = `remote_${pane.terminal_id}`;
  for (const agent of remote.snapshot!.agents) {
    // structuredClone preserves pane/agent object aliases in the real-shape fixture.
    if (!agent.terminal_id.startsWith('remote_')) agent.terminal_id = `remote_${agent.terminal_id}`;
    agent.terminal_title_stripped = `Remote ${agent.terminal_title_stripped}`;
  }
  for (const ws of remote.snapshot!.workspaces) ws.label = `Remote ${ws.label}`;
  for (const tab of remote.snapshot!.tabs) tab.label = `Remote ${tab.label}`;
  world.connections.push(remote);
  const mock = await mockOffice(page, world);
  await openAgent(page, 'Test busy reviewer');
  await page.getByRole('button', { name: 'Mark as main agent', exact: true }).click();
  await page.getByRole('combobox', { name: 'Floor', exact: true }).selectOption(remote.id);
  await expect(page.getByRole('combobox', { name: 'Floor', exact: true })).toHaveValue(remote.id);
  await expect(page.locator('.roster__list .person.is-main')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Walk in', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: /^Go to main agent / }).click();
  await expect(page.getByRole('combobox', { name: 'Floor', exact: true })).toHaveValue('local:test-only');
  await expect(page.locator('.drawer__caption')).toContainText('Test busy reviewer');
  await expect(page.getByRole('button', { name: 'Walk in', exact: true })).toBeEnabled();
  // The target is the second department, so the initial floor arrival is insufficient.
  await expect(page.locator('.plaque__heading')).toHaveText('Test Review');
  await expect(page.locator('.drawer__crumb')).toContainText('Test Company One');
  const selectedReads = mock.reads.filter(url => url.pathname.includes('w1%3Ap2'));
  expect(selectedReads.some(url => url.searchParams.get('connectionId') === 'local:test-only')).toBe(true);
  expect(mock.inputs).toEqual([]); expect(mock.unexpected).toEqual([]);
});

test('idle labels show the backend observation lower bound consistently in roster and drawer', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-02T12:07:30.000Z'));
  const world = fixture();
  const idle = world.connections[0]!.snapshot!.agents[0]!;
  idle.status_since = '2026-10-02T12:00:00.000Z'; idle.status_since_source = 'observed';
  const mock = await mockOffice(page, world);
  await openAgent(page, 'Test idle coder');
  await expect(page.locator('.drawer__facts .idle-age')).toHaveText('Idle ≥ 7m');
  await expect(page.locator('.drawer__facts .idle-age')).toHaveClass(/idle-age--waiting/);
  await expect(page.locator('.drawer__facts .idle-age')).toHaveAttribute('title', /lower bound/);
  await expect(page.locator('.roster__list .person').filter({ hasText: 'Test idle coder' }).locator('.idle-age')).toHaveText('Idle ≥ 7m');
  await expect(page.locator('.roster__list .person').filter({ hasText: 'Test busy reviewer' }).locator('.idle-age')).toHaveCount(0);
  expect(mock.inputs).toEqual([]); expect(mock.unexpected).toEqual([]);
});

interface OfficeView { x: number; z: number; yaw: number; height: number }
interface OfficeTiming { simulationSeconds: number; frames: number; moving: boolean; renderMode: 'idle' | 'interactive' }
async function officeSample(page: Page): Promise<{ view: OfficeView; timing: OfficeTiming }> {
  return page.getByRole('main', { name: '3D office' }).locator('canvas').evaluate(el => {
    const data = (el as HTMLCanvasElement).dataset;
    if (!data.officeView || !data.officeTiming) throw new Error('The actual camera has not published its simulation sample yet.');
    return { view: JSON.parse(data.officeView), timing: JSON.parse(data.officeTiming) };
  });
}
async function officeView(page: Page): Promise<OfficeView> {
  const raw = await page.getByRole('main', { name: '3D office' }).locator('canvas').getAttribute('data-office-view');
  if (!raw) throw new Error('The actual camera has not published its office position yet.');
  return JSON.parse(raw) as OfficeView;
}
const groundDistance = (a: OfficeView, b: OfficeView) => Math.hypot(a.x - b.x, a.z - b.z);
async function settledOfficeView(page: Page): Promise<OfficeView> {
  await expect(page.getByRole('main', { name: '3D office' }).locator('canvas')).toHaveAttribute('data-office-view', /"x"/);
  await expect(page.getByRole('main', { name: '3D office' }).locator('canvas')).toHaveAttribute('data-office-timing', /"frames"/);
  let previous = await officeSample(page);
  let steady = 0;
  await expect.poll(async () => {
    const current = await officeSample(page);
    // Repeated reads of one stale RAF sample are not evidence that an action finished.
    if (current.timing.frames === previous.timing.frames) return steady;
    steady = !current.timing.moving && groundDistance(previous.view, current.view) < .025 && Math.abs(previous.view.height - current.view.height) < .025 ? steady + 1 : 0;
    previous = current;
    return steady;
  }, { intervals: [100, 100, 100] }).toBeGreaterThanOrEqual(3);
  return previous.view;
}
async function goToEngineering(page: Page) {
  await expect(page.getByRole('button', { name: 'Walk in', exact: true })).toBeEnabled();
  await page.locator('#directory').getByRole('button', { name: /Test Engineering/ }).click();
  await expect(page.locator('.plaque__heading')).toHaveText('Test Engineering');
  const department = deriveFloor(snapshot).departments.find(d => d.id === 'w1:t1')!;
  await expect.poll(async () => {
    const view = await officeView(page);
    return Math.hypot(view.x - (department.x + department.width / 2), view.z - (department.z + .6));
  }).toBeLessThan(.01);
  return settledOfficeView(page);
}

test('navigation: canvas wheel approaches and retreats by moving the actual camera on the floor', async ({ page }) => {
  const mock = await mockOffice(page);
  const before = await goToEngineering(page);
  const canvas = page.getByRole('main', { name: '3D office' }).locator('canvas');
  await canvas.hover(); await page.mouse.wheel(0, -120);
  await expect.poll(async () => groundDistance(before, await officeView(page))).toBeGreaterThan(1);
  const approached = await settledOfficeView(page);
  const forwardDot = (approached.x - before.x) * -Math.sin(before.yaw) + (approached.z - before.z) * -Math.cos(before.yaw);
  expect(forwardDot).toBeGreaterThan(1);
  await page.mouse.wheel(0, 120);
  await expect.poll(async () => groundDistance(approached, await officeView(page))).toBeGreaterThan(1);
  const retreated = await settledOfficeView(page);
  const backwardDot = (retreated.x - approached.x) * -Math.sin(approached.yaw) + (retreated.z - approached.z) * -Math.cos(approached.yaw);
  expect(backwardDot).toBeLessThan(-1);
  expect(mock.inputs).toEqual([]); expect(mock.unexpected).toEqual([]);
});

test('navigation: scrolling terminal output scrolls its real viewport without moving the office camera', async ({ page }) => {
  const transcript = Array.from({ length: 220 }, (_, i) => `TEST SCROLL LINE ${String(i).padStart(3, '0')}`).join('\n');
  const mock = await mockOffice(page, fixture(), undefined, transcript);
  await expect(page.getByRole('button', { name: 'Walk in', exact: true })).toBeEnabled();
  await openAgent(page, 'Test idle coder');
  const pre = page.getByRole('region', { name: 'Terminal output' }).locator('pre');
  await expect(pre).toContainText('TEST SCROLL LINE 219');
  await expect.poll(() => pre.evaluate(el => el.scrollTop)).toBeGreaterThan(100);
  const camera = await settledOfficeView(page);
  const oldScroll = await pre.evaluate(el => el.scrollTop);
  await pre.hover(); await page.mouse.wheel(0, -300);
  await expect.poll(() => pre.evaluate(el => el.scrollTop)).toBeLessThan(oldScroll - 100);
  const after = await settledOfficeView(page);
  expect(groundDistance(camera, after)).toBeLessThan(.025);
  expect(mock.inputs).toEqual([]); expect(mock.unexpected).toEqual([]);
});

test('navigation: Shift running covers more actual ground than walking in the same clear aisle', async ({ page }) => {
  const mock = await mockOffice(page);
  const canvas = page.getByRole('main', { name: '3D office' }).locator('canvas');
  async function measureSpeed(running: boolean) {
    await goToEngineering(page);
    await canvas.focus();
    if (running) await page.keyboard.down('Shift');
    await page.keyboard.down('a');
    try {
      await expect.poll(async () => (await officeSample(page)).timing.moving).toBe(true);
      const initial = await officeSample(page);
      // Acceleration and sample duration use the scene's capped simulation dt,
      // so a CPU renderer and a GPU renderer measure the same physical motion.
      await expect.poll(async () => (await officeSample(page)).timing.simulationSeconds - initial.timing.simulationSeconds).toBeGreaterThan(.4);
      const start = await officeSample(page);
      await expect.poll(async () => (await officeSample(page)).timing.simulationSeconds - start.timing.simulationSeconds).toBeGreaterThan(.4);
      const end = await officeSample(page);
      const distance = groundDistance(start.view, end.view);
      expect(distance).toBeGreaterThan(1);
      return distance / (end.timing.simulationSeconds - start.timing.simulationSeconds);
    } finally {
      await page.keyboard.up('a');
      if (running) await page.keyboard.up('Shift');
    }
  }
  const walkSpeed = await measureSpeed(false), runSpeed = await measureSpeed(true);
  expect(walkSpeed).toBeGreaterThan(5.5); expect(walkSpeed).toBeLessThan(6.5);
  expect(runSpeed).toBeGreaterThan(12.8); expect(runSpeed).toBeLessThan(14.5);
  expect(runSpeed).toBeGreaterThan(walkSpeed * 1.8);
  expect(mock.inputs).toEqual([]); expect(mock.unexpected).toEqual([]);
});

test('navigation: taking prompt focus clears held walking input and typing cannot move the camera', async ({ page }) => {
  const mock = await mockOffice(page);
  await expect(page.getByRole('button', { name: 'Walk in', exact: true })).toBeEnabled();
  await openAgent(page, 'Test idle coder');
  const canvas = page.getByRole('main', { name: '3D office' }).locator('canvas');
  const before = await settledOfficeView(page);
  await canvas.focus(); await page.keyboard.down('a');
  await expect.poll(async () => groundDistance(before, await officeView(page))).toBeGreaterThan(.3);
  const prompt = page.getByRole('textbox', { name: /^Prompt for/ });
  await prompt.focus();
  const focusSnapshot = await officeView(page);
  const focused = await settledOfficeView(page);
  // Allow the 10 Hz telemetry to catch the final pre-focus frame, but no continued walk.
  expect(groundDistance(focusSnapshot, focused)).toBeLessThan(.7);
  await page.keyboard.type('wasd M keyboard input belongs to the draft');
  await page.keyboard.up('a');
  const typed = await settledOfficeView(page);
  expect(groundDistance(focused, typed)).toBeLessThan(.025);
  await expect(prompt).toHaveValue('wasd M keyboard input belongs to the draft');
  expect(mock.inputs).toEqual([]); expect(mock.unexpected).toEqual([]);
});

test('overview: row framing, elevation controls and wheel dolly change actual camera height', async ({ page }) => {
  const mock = await mockOffice(page);
  await goToEngineering(page);
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Overview', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await officeView(page)).height).toBeGreaterThanOrEqual(18);
  const raised = await settledOfficeView(page);
  expect(raised.height).toBeGreaterThanOrEqual(18);
  await page.getByRole('button', { name: 'Raise view 5 metres', exact: true }).click();
  await expect.poll(async () => (await officeView(page)).height - raised.height).toBeCloseTo(5, 1);
  const higher = await settledOfficeView(page);
  expect(higher.height - raised.height).toBeCloseTo(5, 1);
  await page.getByRole('button', { name: 'Lower view 5 metres', exact: true }).click();
  await expect.poll(async () => higher.height - (await officeView(page)).height).toBeCloseTo(5, 1);
  const lower = await settledOfficeView(page);
  expect(higher.height - lower.height).toBeCloseTo(5, 1);
  const canvas = page.getByRole('main', { name: '3D office' }).locator('canvas');
  await canvas.hover(); await page.mouse.wheel(0, -120);
  await expect.poll(async () => (await officeView(page)).height).toBeLessThan(lower.height - .5);
  const approached = await settledOfficeView(page);
  await page.mouse.wheel(0, 120);
  await expect.poll(async () => (await officeView(page)).height).toBeGreaterThan(approached.height + .5);
  await settledOfficeView(page);
  await page.getByRole('button', { name: 'Eye level', exact: true }).click();
  await expect.poll(async () => (await officeView(page)).height).toBeCloseTo(1.68, 2);
  expect((await settledOfficeView(page)).height).toBeCloseTo(1.68, 2);
  await page.getByRole('button', { name: 'See this row', exact: true }).click();
  await expect.poll(async () => (await officeView(page)).height).toBeGreaterThanOrEqual(18);
  expect((await settledOfficeView(page)).height).toBeGreaterThanOrEqual(18);
  await expect(page.getByRole('button', { name: 'Overview', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(mock.inputs).toEqual([]); expect(mock.unexpected).toEqual([]);
});

test('map: links reflect real agents and jump to actual departments and eye-level desks', async ({ page }) => {
  const mock = await mockOffice(page);
  const before = await goToEngineering(page);
  const map = page.getByRole('region', { name: 'Floor map', exact: true });
  await expect(map.getByRole('link', { name: /^Map: visit / })).toHaveCount(3);
  await expect(map.getByRole('link', { name: /^Map: go to / })).toHaveCount(3);
  await expect(map.getByRole('button', { name: 'Test Company One', exact: true })).toBeVisible();
  await expect(map.getByRole('button', { name: 'Test Company Two', exact: true })).toBeVisible();
  await expect(map.getByRole('link', { name: /Invisible impostor|opencode|Test shell pane/i })).toHaveCount(0);
  await expect(map.getByRole('link', { name: /^Map: visit Aster \(codex\)/ })).toBeVisible();
  const department = map.getByRole('link', { name: 'Map: go to Test Company Two / Test Research', exact: true });
  await department.focus(); await department.press('Enter');
  await expect(page.locator('.plaque__heading')).toHaveText('Test Research');
  await expect(department).toHaveAttribute('aria-current', 'location');
  expect(groundDistance(before, await settledOfficeView(page))).toBeGreaterThan(5);
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect.poll(async () => (await officeView(page)).height).toBeGreaterThanOrEqual(18);
  expect((await settledOfficeView(page)).height).toBeGreaterThanOrEqual(18);
  const agent = map.getByRole('link', { name: /^Map: visit Aster \(codex\)/ });
  await agent.focus(); await agent.press('Enter');
  await expect(page.locator('.drawer__caption')).toContainText('Test idle coder');
  await expect(page.locator('.plaque__heading')).toHaveText('Test Engineering');
  await expect(agent).toHaveAttribute('aria-current', 'true');
  await expect.poll(async () => (await officeView(page)).height).toBeCloseTo(1.55, 2);
  // Visiting a seated agent uses the slightly lower desk interaction viewpoint.
  expect((await settledOfficeView(page)).height).toBeCloseTo(1.55, 2);
  await expect(page.getByRole('button', { name: 'Eye level', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(mock.reads.some(url => decodeURIComponent(url.pathname).includes('/w1:p1/terminal') && url.searchParams.get('connectionId') === 'local:test-only')).toBe(true);
  expect(mock.inputs).toEqual([]); expect(mock.unexpected).toEqual([]);
});

test('map: player marker follows the real camera and M toggles only outside a draft', async ({ page }) => {
  const mock = await mockOffice(page);
  const before = await goToEngineering(page);
  const marker = page.locator('#floor-map .mm-player');
  const markerPosition = async () => marker.evaluate(el => {
    const raw = (el as SVGElement).style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    if (!raw) throw new Error('Floor map player has no actual position transform.');
    return { x: Number(raw[1]), z: Number(raw[2]) };
  });
  await expect.poll(async () => {
    const actual = await officeView(page), position = await markerPosition();
    return Math.hypot(position.x + actual.x, position.z + actual.z);
  }).toBeLessThan(.05);
  const canvas = page.getByRole('main', { name: '3D office' }).locator('canvas');
  await canvas.hover(); await page.mouse.wheel(0, -120);
  await expect.poll(async () => groundDistance(before, await officeView(page))).toBeGreaterThan(1);
  const moved = await settledOfficeView(page);
  await expect.poll(async () => {
    const position = await markerPosition();
    return Math.hypot(position.x + moved.x, position.z + moved.z);
  }).toBeLessThan(.05);
  await canvas.focus(); await page.keyboard.press('m');
  await expect(page.getByRole('region', { name: 'Floor map', exact: true })).toHaveCount(0);
  await page.keyboard.press('m');
  await expect(page.getByRole('region', { name: 'Floor map', exact: true })).toBeVisible();
  await openAgent(page, 'Test idle coder');
  const prompt = page.getByRole('textbox', { name: /^Prompt for/ });
  await prompt.focus(); await page.keyboard.type('mM');
  await expect(prompt).toHaveValue('mM');
  await expect(page.getByRole('region', { name: 'Floor map', exact: true })).toBeVisible();
  expect(mock.inputs).toEqual([]); expect(mock.unexpected).toEqual([]);
});

test('navigation: wheel travel crosses the department back wall while retaining outer floor bounds', async ({ page }) => {
  const world = fixture(), mock = await mockOffice(page, world);
  const plan = deriveFloor(world.connections[0]!.snapshot!);
  const department = plan.departments.find(d => d.id === 'w1:t1')!;
  await goToEngineering(page);
  const canvas = page.getByRole('main', { name: '3D office' }).locator('canvas');
  await canvas.hover(); await page.mouse.wheel(0, -240);
  const firstTravel = await settledOfficeView(page);
  expect(firstTravel.z).toBeGreaterThan(department.z + 5);
  // Consume the first dolly before sending another; Chromium may coalesce two
  // same-frame wheel events into one event, which intentionally has a 6m cap.
  await page.mouse.wheel(0, -240);
  await expect.poll(async () => (await officeView(page)).z).toBeGreaterThan(department.z + department.depth + .5);
  const crossed = await settledOfficeView(page);
  expect(crossed.z).toBeLessThanOrEqual(plan.depth - .7);
  expect(crossed.x).toBeGreaterThanOrEqual(-plan.width / 2 + .5);
  expect(crossed.x).toBeLessThanOrEqual(plan.width / 2 - .5);
  expect(mock.inputs).toEqual([]); expect(mock.unexpected).toEqual([]);
});

test('navigation: F captures the real office pointer, Escape releases it and draft typing cannot capture', async ({ page }) => {
  const mock = await mockOffice(page);
  await goToEngineering(page);
  const walk = page.getByRole('button', { name: 'Walk in', exact: true });
  await expect(walk).toHaveAttribute('aria-keyshortcuts', 'F');
  const canvas = page.getByRole('main', { name: '3D office' }).locator('canvas');
  await canvas.focus(); await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName ?? null)).toBe('CANVAS');
  await expect(page.locator('.app')).toHaveClass(/is-locked/);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await expect(page.locator('.app')).not.toHaveClass(/is-locked/);
  await openAgent(page, 'Test idle coder');
  const prompt = page.getByRole('textbox', { name: /^Prompt for/ });
  await prompt.focus(); await page.keyboard.type('fF');
  await expect(prompt).toHaveValue('fF');
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  await expect(page.locator('.app')).not.toHaveClass(/is-locked/);
  expect(mock.inputs).toEqual([]); expect(mock.unexpected).toEqual([]);
});

test('interaction: gaze hint and E choose the viewed agent over a closer neighbour, and looking away clears both', async ({ page }) => {
  const world = fixture(), live = world.connections[0]!.snapshot!;
  // Put a second real fixture agent in the adjacent pane of the same department.
  const adjacent = { ...live.panes.find(p => p.pane_id === 'w1:p3')!, agent: 'claude',
    name: 'Gaze neighbour', agent_status: 'idle' as const, terminal_title_stripped: 'Test gaze neighbour' };
  live.agents.push(adjacent);
  const mock = await mockOffice(page, world);
  const plan = deriveFloor(live), near = plan.desks.find(d => d.pane.pane_id === 'w1:p1')!,
    viewed = plan.desks.find(d => d.pane.pane_id === 'w1:p3')!;
  await goToEngineering(page);
  const canvas = page.getByRole('main', { name: '3D office' }).locator('canvas');
  const hint = page.locator('.scene-interaction');
  // Use the real drag controller, not a test-only camera setter. Keep both
  // endpoints inside the viewport and away from the left-hand UI chrome.
  async function turnTo(yaw: number) {
    const before = await officeView(page);
    const angle = Math.atan2(Math.sin(yaw - before.yaw), Math.cos(yaw - before.yaw));
    const dx = -angle / .003;
    const width = page.viewportSize()!.width;
    const startX = dx < 0 ? width - 35 : 360;
    const y = 410;
    await page.mouse.move(startX, y); await page.mouse.down();
    await page.mouse.move(startX + dx, y, { steps: 6 }); await page.mouse.up();
    await expect.poll(async () => {
      const actual = (await officeView(page)).yaw;
      return Math.abs(Math.atan2(Math.sin(actual - yaw), Math.cos(actual - yaw)));
    }).toBeLessThan(.008);
  }
  // Stand between the two seated agents, deliberately closer to the left
  // desk, while looking directly at the farther agent's head to the right.
  const destination = { x: (near.x + viewed.x) / 2 - .3, z: viewed.z + .82 };
  const arrival = await settledOfficeView(page);
  const dx = destination.x - arrival.x, dz = destination.z - arrival.z;
  await turnTo(Math.atan2(-dx, -dz));
  await canvas.hover(); await page.mouse.wheel(0, -Math.hypot(dx, dz) / .025);
  const position = await settledOfficeView(page);
  expect(Math.hypot(position.x - destination.x, position.z - destination.z)).toBeLessThan(.08);
  expect(Math.hypot(position.x - near.x, position.z - near.z))
    .toBeLessThan(Math.hypot(position.x - viewed.x, position.z - viewed.z));
  await turnTo(Math.atan2(-(viewed.x - position.x), -(viewed.z + .82 - position.z)));
  await expect(hint).toBeVisible();
  await expect(hint).toContainText('Talk to Gaze neighbour');
  await expect(hint).toContainText('w1:p3');
  await expect.poll(async () => (await officeSample(page)).timing.renderMode).toBe('idle');
  await canvas.focus(); await page.keyboard.press('e');
  await expect(page.locator('.drawer__caption')).toContainText('Test gaze neighbour');
  await expect(page.getByRole('region', { name: 'Terminal output' })).toContainText('TEST TERMINAL w1:p3');
  await page.getByRole('button', { name: 'Close desk panel', exact: true }).click();
  // Facing the empty front aisle still leaves the nearer agent within reach.
  await turnTo(0);
  await expect(hint).toBeHidden();
  await canvas.focus(); await page.keyboard.press('e');
  await expect(page.getByRole('complementary', { name: /^Desk:/ })).toHaveCount(0);
  await expect(hint).toBeHidden();
  expect(mock.inputs).toEqual([]); expect(mock.unexpected).toEqual([]);
});

test('rendering: idle frames are capped, movement wakes rendering, and idle navigation controls stay responsive', async ({ page }) => {
  const mock = await mockOffice(page);
  const responseTimeout = process.env.CI ? 30_000 : 1500;
  await goToEngineering(page);
  const canvas = page.getByRole('main', { name: '3D office' }).locator('canvas');
  // The finite fixture SSE intentionally reconnects. An agent's reported
  // working status stays stable independently of that transport lifecycle.
  const app = page.locator('.app'), workingDot = page.locator('.dot--working').first();
  const indicatorStyle = () => workingDot.evaluate(el => ({ animation: getComputedStyle(el).animationName,
    color: getComputedStyle(el).backgroundColor }));
  await expect.poll(async () => (await officeSample(page)).timing.renderMode).toBe('idle');
  await expect(app).toHaveAttribute('data-render-mode', 'idle');
  await expect(workingDot).toBeVisible();
  await expect.poll(async () => (await indicatorStyle()).animation).toBe('none');
  const indicatorColor = (await indicatorStyle()).color;
  // Measure actual rendered frames against monotonic wall time. A completely
  // frozen scene must fail too; continuing status/pose updates need frames.
  const rate = await canvas.evaluate(async el => {
    const sample = () => JSON.parse((el as HTMLCanvasElement).dataset.officeTiming!);
    const before = sample(), start = performance.now();
    await new Promise(resolve => setTimeout(resolve, 2000));
    const after = sample();
    return { fps: (after.frames - before.frames) / ((performance.now() - start) / 1000),
      beforeMode: before.renderMode, afterMode: after.renderMode };
  });
  expect(rate.beforeMode).toBe('idle'); expect(rate.afterMode).toBe('idle');
  expect(rate.fps).toBeGreaterThan(0); expect(rate.fps).toBeLessThanOrEqual(6);

  const beforeMove = await officeSample(page);
  await canvas.focus(); await page.keyboard.down('a');
  try {
    await expect.poll(async () => {
      const sample = await officeSample(page);
      return { mode: sample.timing.renderMode, moving: sample.timing.moving };
    }).toEqual({ mode: 'interactive', moving: true });
    await expect(app).toHaveAttribute('data-render-mode', 'interactive');
    await expect.poll(indicatorStyle).toEqual({ animation: 'breathe', color: indicatorColor });
    await expect.poll(async () => groundDistance(beforeMove.view, (await officeSample(page)).view)).toBeGreaterThan(.6);
    expect((await officeSample(page)).timing.frames).toBeGreaterThan(beforeMove.timing.frames);
  } finally { await page.keyboard.up('a'); }
  await expect.poll(async () => {
    const sample = await officeSample(page);
    return { mode: sample.timing.renderMode, moving: sample.timing.moving };
  }).toEqual({ mode: 'idle', moving: false });
  await expect(app).toHaveAttribute('data-render-mode', 'idle');
  await expect.poll(indicatorStyle).toEqual({ animation: 'none', color: indicatorColor });
  await settledOfficeView(page);

  // Teleports and view controls must invalidate the stationary scene without
  // requiring another movement key or an externally forced animation frame.
  const destination = deriveFloor(snapshot).departments.find(d => d.id === 'w2:t1')!;
  await page.locator('#directory').getByRole('button', { name: /Test Research/ }).click();
  await expect.poll(async () => {
    const view = await officeView(page);
    return Math.hypot(view.x - destination.x - destination.width / 2, view.z - destination.z - .6);
  }, { timeout: responseTimeout }).toBeLessThan(.02);
  await expect.poll(async () => (await officeSample(page)).timing.renderMode).toBe('idle');
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect.poll(async () => (await officeView(page)).height, { timeout: responseTimeout }).toBeGreaterThanOrEqual(18);
  await expect.poll(async () => (await officeSample(page)).timing.renderMode).toBe('idle');
  await page.getByRole('button', { name: 'Eye level', exact: true }).click();
  await expect.poll(async () => (await officeView(page)).height, { timeout: responseTimeout }).toBeCloseTo(1.68, 2);
  expect(mock.inputs).toEqual([]); expect(mock.unexpected).toEqual([]);
});
