/** One consistent huge campus, real interactions, and stable gameplay video beneath each HUD. */
import { openDemo, startRecording, encode, camera, turn, sleep } from '../recording.mjs';
import { sidebar, map, closeDesk, goCompany, openRelease, widen } from '../v2/navigation.mjs';
import { installAnnotations, setAnnotationMode } from './annotations.mjs';
import { moveAxis, settled, verticalDrag, lockedLook } from './navigation.mjs';
import { deriveFloor } from '../../../src/world/layout.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const directory = path.resolve('artifacts/marketing/v4');
const mode = process.argv[2] || 'all';
await mkdir(directory, { recursive: true });
const { page, browser, cdp, gpu, external } = await openDemo('http://127.0.0.1:5186');
page.setDefaultTimeout(8000);
const report = { gpu, external, campus: null, shots: {}, interactions: [] };
let plan;
page.on('request', request => {
  const url = new URL(request.url()); const target = url.pathname.match(/^\/api\/(panes|agents)\/([^/]+)\/(terminal|prompt)$/);
  if (target) (report.requests ??= []).push({ at: Date.now(), method: request.method(), operation: target[3],
    paneId: decodeURIComponent(target[2]), connectionId: url.searchParams.get('connectionId') });
});

async function writeReport() { await writeFile(path.join(directory, 'capture-report.json'), JSON.stringify(report, null, 2)); }

async function assertCampus() {
  const info = await page.evaluate(async () => ({ info: await fetch('/api/demo/info').then(r => r.json()), world: await fetch('/api/world').then(r => r.json()) }));
  const studio = info.world.connections.find(c => c.id === 'demo:studio').snapshot;
  if (info.info.layout !== 'campus' || studio.workspaces.length !== 18 || studio.agents.length !== 72) throw new Error('A shot lost the consistent huge campus.');
  return { layout: info.info.layout, companies: studio.workspaces.length, agents: studio.agents.length, panes: studio.panes.length,
    visibleFloor: await page.getByRole('combobox', { name: 'Floor', exact: true }).inputValue() };
}

async function beginTrace(id, started) {
  await page.evaluate(({ id, started }) => {
    window.__v4Traces ??= {}; const values = []; window.__v4Traces[id] = values;
    window.__v4TraceTimer = setInterval(() => {
      const canvas = document.querySelector('.stage canvas');
      if (!canvas?.dataset.officeView) return;
      const value = { seconds: (Date.now() - started) / 1000, view: JSON.parse(canvas.dataset.officeView),
        timing: JSON.parse(canvas.dataset.officeTiming), drawer: document.querySelector('.drawer__title')?.textContent ?? null,
        locked: document.pointerLockElement?.tagName === 'CANVAS' };
      if (!values.length || JSON.stringify(values.at(-1).view) !== JSON.stringify(value.view) || values.at(-1).drawer !== value.drawer) values.push(value);
    }, 40);
  }, { id, started });
}

async function shot(id, duration, action = async () => {}) {
  const campus = await assertCampus();
  console.log(`START ${id}`);
  const recorder = await startRecording(cdp, path.join(directory, 'takes', id));
  await beginTrace(id, recorder.started);
  const events = [];
  const at = async (seconds, name, callback) => {
    await recorder.at(seconds); events.push({ seconds: (Date.now() - recorder.started) / 1000, name });
    if (callback) await callback();
  };
  await action(at, recorder);
  await recorder.at(duration);
  const trace = await page.evaluate(id => { clearInterval(window.__v4TraceTimer); return window.__v4Traces[id]; }, id);
  const stopRequestedAt = Date.now();
  const frames = await recorder.finish(duration);
  const stopConfirmedAt = Date.now();
  await encode(frames.concat, path.join(directory, `${id}.mp4`), 1920, 1080, duration, false);
  report.shots[id] = { duration, campus, events, frames: frames.frames, trace, startedAt: recorder.started, stopRequestedAt, stopConfirmedAt };
  await writeReport();
  console.log(`DONE ${id}`);
}

async function macro() {
  await closeDesk(page); await sidebar(page, false); await map(page, false);
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'See this row', exact: true }).click(); await sleep(250);
  const before = await camera(page), row = plan.companies.filter(c => c.z === 14);
  const pitch = -Math.atan2(before.height, 14 + Math.max(...row.map(c => c.depth)) * .42 - before.z);
  while (await page.getByRole('button', { name: 'Raise view 5 metres', exact: true }).isEnabled()) {
    await page.getByRole('button', { name: 'Raise view 5 metres', exact: true }).click(); await sleep(120);
  }
  await verticalDrag(page, (pitch + 49 * Math.PI / 180) / .003);
  await page.locator('.stage canvas').focus();
  await moveAxis(page, 'z', -20, 's', true);
  const x = (await camera(page)).x; await moveAxis(page, 'x', 0, x < 0 ? 'a' : 'd', false);
  await page.mouse.move(1850, 70); await sleep(250);
  await setAnnotationMode(page);
  await page.screenshot({ path: path.join(directory, 'campus-production-proof.png') });
  await shot('cover-bg', 4);
  await shot('campus', 9, async at => {
    await at(3, 'gentle real overview glide', async () => { await page.mouse.move(850, 650); await page.mouse.wheel(0, -35); });
  });
}

async function seedRun() {
  await goCompany(page, 'Bramble Pay'); await sidebar(page, false); await map(page, false);
  await turn(page, Math.PI / 2); await page.locator('.stage canvas').focus();
  await moveAxis(page, 'x', -13.333333333333, 'w', false);
  await turn(page, Math.PI);
  await moveAxis(page, 'z', 31, 's', false);
  await page.mouse.move(960, 540); await page.evaluate(() => { window.__v4Mouse = { x: 960, y: 540 }; });
  await setAnnotationMode(page);
  await page.screenshot({ path: path.join(directory, 'run-start-production-proof.png') });
}

async function run() {
  await seedRun(); await shot('walk-card-bg', 3);
  const basalt = plan.companies.find(c => c.name === 'Basalt Ledger');
  const desk = plan.desks.find(d => d.workspaceId === basalt.id);
  await shot('run', 18, async (at, recorder) => {
    await at(0, 'F enters actual first person', async () => {
      await page.locator('.stage canvas').focus(); await page.keyboard.press('f');
      await page.waitForFunction(() => document.pointerLockElement?.tagName === 'CANVAS');
    });
    await at(.2, 'look around the occupied inner aisle', async () => {
      await lockedLook(page, Math.PI + .12, .45); await lockedLook(page, Math.PI - .12, .6); await lockedLook(page, Math.PI, .45);
    });
    const motions = [];
    motions.push(await moveAxis(page, 'z', 69.1, 'w', true, .15, 4.5));
    await lockedLook(page, -Math.PI / 2, 1.2);
    motions.push(await moveAxis(page, 'x', desk.x - 1, 'w', false));
    await lockedLook(page, Math.PI, 1.2);
    motions.push(await moveAxis(page, 'z', desk.z - 2.9, 'w', false));
    await sleep(1100); // Read the office and its person at the doorway.
    motions.push(await moveAxis(page, 'z', desk.z - 1.2, 'w', false));
    const final = await camera(page), headYaw = Math.atan2(-(desk.x - final.x), -(desk.z + .82 - final.z));
    await lockedLook(page, headYaw - .55, .4);
    const arrival = (Date.now() - recorder.started) / 1000;
    report.interactions.push({ type: 'run', motions, destination: basalt.name, paneId: desk.pane.pane_id, arrival,
      finalHold: 18 - arrival, finalView: await camera(page) });
    if (18 - arrival < 2) throw new Error('The run leaves too little time to recognize the reached agent.');
    await page.screenshot({ path: path.join(directory, 'run-arrival-production-proof.png') });
  });
  await page.keyboard.press('Escape');
  await sleep(250); await setAnnotationMode(page);
  await shot('talk-card-bg', 3);
  const before = await camera(page);
  await shot('talk', 6, async at => {
    await at(1, 'click the Basalt human reached by the run', async () => {
      await page.mouse.move(470, 625, { steps: 10 }); await page.mouse.click(470, 625);
      await page.getByRole('complementary', { name: new RegExp(`^Desk: ${desk.pane.terminal_title_stripped}`) }).waitFor({ state: 'visible' });
      await setAnnotationMode(page, { terminal: true });
      const after = await camera(page), delta = Math.hypot(after.x - before.x, after.z - before.z);
      report.interactions.push({ type: 'Basalt direct-human click', paneId: desk.pane.pane_id, before, after, delta });
      if (delta > .02) throw new Error('The direct Basalt human click moved the camera.');
    });
  });
}

async function frontDesk(desk, standing = false, left = false) {
  await sleep(250); await sidebar(page, false); await map(page, false);
  const current = await camera(page), target = { x: desk.x + (standing ? .2 : -1), z: desk.z + (standing ? -1.3 : -1.2) };
  const dx = target.x - current.x, dz = target.z - current.z;
  await turn(page, Math.atan2(-dx, -dz));
  await page.mouse.move(680, 540); await page.mouse.wheel(0, -Math.hypot(dx, dz) / .025);
  await page.waitForFunction(target => {
    const value = document.querySelector('.stage canvas')?.dataset.officeView;
    return value && Math.hypot(JSON.parse(value).x - target.x, JSON.parse(value).z - target.z) < .08;
  }, target, { polling: 30, timeout: 8000 });
  await settled(page);
  const position = await camera(page);
  const headYaw = Math.atan2(-(desk.x + (standing ? 1.2 : 0) - position.x), -(desk.z + .82 - position.z));
  await turn(page, headYaw - (left ? .55 : 0));
  await sleep(200);
}

async function selectAfterCut(id, duration, target, action, expectedPaneId = null) {
  const before = await camera(page);
  let pointerDownAt;
  await shot(id, duration, async at => {
    await action(at);
    await at(duration - .35, 'actual pointer-down selection; navigation waits until the clip ends', async () => {
      const box = await target.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
      pointerDownAt = Date.now(); await page.mouse.down();
    });
  });
  const boundary = await camera(page);
  const mouseUpAt = Date.now(); await page.mouse.up();
  report.interactions.push({ type: id + ' selection', before, recordedBoundary: boundary,
    boundaryDelta: Math.hypot(boundary.x - before.x, boundary.z - before.z), navigationAfterRecording: true,
    expectedPaneId, pointerDownAt, stopRequestedAt: report.shots[id].stopRequestedAt,
    stopConfirmedAt: report.shots[id].stopConfirmedAt, mouseUpAt });
  if (report.shots[id].stopConfirmedAt >= mouseUpAt) throw new Error('Selection navigation was not safely after the recording stop.');
  await sleep(250);
}

async function find() {
  await closeDesk(page); await sidebar(page, false); await map(page, true);
  const enlarge = page.getByRole('button', { name: 'Enlarge floor map', exact: true });
  if (await enlarge.isVisible()) await enlarge.click();
  await setAnnotationMode(page);
  await shot('find-card-bg', 3);
  const mapAgent = page.getByRole('link', { name: /^Map: visit Migrate orders schema/ });
  await selectAfterCut('map', 5, mapAgent.locator('.mm-person__dot'), async at => {
    await at(.3, 'hover the blocked agent in the large campus map', () => mapAgent.hover());
  }, 'demo-w2:p2');
  const blocked = plan.desks.find(d => d.pane.pane_id === 'demo-w2:p2');
  await frontDesk(blocked, true); await setAnnotationMode(page, { terminal: true });
  await page.mouse.move(1850, 70); await shot('needs-card-bg', 2); await shot('blocked', 5);
  await sidebar(page, true); await page.getByRole('tab', { name: /^Roster/ }).click();
  await setAnnotationMode(page, { terminal: true });
  const result = page.locator('.roster__list .person').filter({ hasText: 'Check release notes' });
  await selectAfterCut('roster', 6, result, async at => {
    await at(.5, 'search the current floor by task', async () => {
      const search = page.getByRole('searchbox', { name: 'Search roster' }); await search.click(); await page.keyboard.type('release', { delay: 110 });
    });
  }, 'demo-w1:p1');
}

async function terminalTrace(id, started) {
  await page.evaluate(({ id, started }) => {
    window.__v4Terminal ??= {}; const entries = []; window.__v4Terminal[id] = entries;
    window.__v4TerminalTimer = setInterval(() => {
      const output = document.querySelector('[aria-label="Terminal output"] pre');
      if (!output) return;
      const value = { seconds: (Date.now() - started) / 1000, text: output.textContent, status: document.querySelector('.drawer__facts')?.textContent,
        font: getComputedStyle(output).fontSize, width: document.querySelector('.drawer').getBoundingClientRect().width,
        scrollHeight: output.parentElement.scrollHeight, clientHeight: output.parentElement.clientHeight };
      if (!entries.length || entries.at(-1).text !== value.text || entries.at(-1).status !== value.status) entries.push(value);
    }, 100);
  }, { id, started });
}

async function saveTerminal(id, duration) {
  const values = await page.evaluate(id => { clearInterval(window.__v4TerminalTimer); return window.__v4Terminal[id]; }, id);
  values.forEach((value, index) => { value.hold = (values[index + 1]?.seconds ?? duration) - value.seconds; });
  await writeFile(path.join(directory, `${id}-dom-proof.json`), JSON.stringify(values, null, 2));
  if (values.some(v => v.font === '24px' && v.scrollHeight > v.clientHeight + 1)) throw new Error('The actual large terminal text overflowed.');
  return values;
}

async function work() {
  const release = plan.desks.find(d => d.pane.pane_id === 'demo-w1:p1');
  if (!await page.getByRole('complementary', { name: 'Desk: Check release notes', exact: true }).isVisible()) await openRelease(page);
  await frontDesk(release, false, true); await closeDesk(page); await setAnnotationMode(page);
  await page.mouse.move(1850, 70); await shot('work-card-bg', 3);
  await page.evaluate(() => fetch('/api/demo/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectionId: 'demo:studio', paneId: 'demo-w1:p1', scenario: 'release-review' }) }));
  await sleep(2500);
  await shot('watch', 12.5, async (at, recorder) => {
    const before = await camera(page);
    await at(.3, 'actual human click opens the working terminal without camera motion', async () => {
      await page.mouse.move(470, 465, { steps: 8 }); await page.mouse.click(470, 465);
      await page.getByRole('complementary', { name: 'Desk: Check release notes', exact: true }).waitFor({ state: 'visible' });
      await setAnnotationMode(page, { terminal: true }); await terminalTrace('watch', recorder.started);
      const after = await camera(page), delta = Math.hypot(after.x - before.x, after.z - before.z);
      report.interactions.push({ type: 'working human click', before, after, delta });
      if (delta > .02) throw new Error('Opening the working terminal moved the camera.');
    });
    await at(.9, 'resize actual terminal to 960 pixels', () => widen(page, 960));
    await at(1.6, 'raise actual text to 24 pixels', () => page.getByRole('button', { name: 'Larger terminal text', exact: true }).click({ clickCount: 11, delay: 60 }));
    await at(8, 'save visible incremental work', () => page.screenshot({ path: path.join(directory, 'working-terminal-proof.png') }));
  });
  await saveTerminal('watch', 12.5);
  await page.waitForFunction(() => document.querySelector('.drawer__facts')?.textContent.includes('Done'), null, { timeout: 3000 });
  await shot('steer', 16.5, async (at, recorder) => {
    await terminalTrace('steer', recorder.started);
    await at(.3, 'type the next instruction while ready', async () => {
      await page.getByRole('textbox', { name: /^Prompt for/ }).click(); await page.keyboard.type('Add migration and rollback notes first.', { delay: 115 });
    });
    await at(6, 'click Send', () => page.getByRole('button', { name: 'Send', exact: true }).click());
    await at(15.5, 'hold the completed result', () => page.screenshot({ path: path.join(directory, 'completed-terminal-proof.png') }));
  });
  await saveTerminal('steer', 16.5);
}

async function concatenate(inputs, output, duration) {
  const args = ['-y', '-hide_banner', '-loglevel', 'error', ...inputs.flatMap(file => ['-i', file]), '-filter_complex',
    '[0:v][1:v]xfade=transition=fade:duration=0.2:offset=2.4[ab];[ab][2:v]xfade=transition=fade:duration=0.2:offset=6.4,format=yuv420p[v]', '-map', '[v]', '-an',
    '-t', String(duration), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-color_range', 'tv', '-colorspace', 'bt709',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart', output];
  await new Promise((resolve, reject) => { const child = spawn('ffmpeg', args, { stdio: 'inherit' }); child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))); });
}

async function bookmark() {
  await setAnnotationMode(page, { terminal: true }); await page.mouse.move(1850, 70); await shot('bookmark-card-bg', 2);
  await shot('bookmark-star', 2.6, async at => {
    await at(.3, 'bookmark the selected main agent', () => page.getByRole('button', { name: 'Mark as main agent', exact: true }).click());
    await at(2.1, 'point at the floor selector', () => page.getByRole('combobox', { name: 'Floor', exact: true }).hover());
  });
  await page.getByRole('combobox', { name: 'Floor', exact: true }).selectOption('demo:build');
  await page.waitForFunction(() => JSON.parse(document.querySelector('.stage canvas')?.dataset.agentPresence || '[]').length === 4, null, { timeout: 20_000 });
  await sidebar(page, false); await map(page, false); await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await settled(page); await setAnnotationMode(page);
  const jump = page.getByRole('button', { name: /^Go to main agent Check release notes/ });
  await selectAfterCut('bookmark-floor', 4.2, jump, async () => {}, 'demo-w1:p1');
  await page.waitForFunction(() => JSON.parse(document.querySelector('.stage canvas')?.dataset.agentPresence || '[]').length === 72, null, { timeout: 30_000 });
  await page.getByRole('complementary', { name: 'Desk: Check release notes', exact: true }).waitFor({ state: 'visible' });
  await frontDesk(plan.desks.find(d => d.pane.pane_id === 'demo-w1:p1'), false, true);
  await setAnnotationMode(page, { terminal: true }); await page.mouse.move(1850, 70);
  await shot('bookmark-return', 2.6);
  await concatenate(['bookmark-star', 'bookmark-floor', 'bookmark-return'].map(id => path.join(directory, `${id}.mp4`)), path.join(directory, 'bookmark.mp4'), 9);
  await shot('end-bg', 6);
}

try {
  await page.evaluate(() => fetch('/api/demo/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout: 'campus' }) }));
  await page.waitForFunction(() => JSON.parse(document.querySelector('.stage canvas')?.dataset.agentPresence || '[]').length === 72, null, { timeout: 60_000 });
  const world = await page.evaluate(() => fetch('/api/world').then(r => r.json()));
  plan = deriveFloor(world.connections.find(c => c.id === 'demo:studio').snapshot);
  report.campus = { companies: plan.companies.length, rows: new Set(plan.companies.map(c => c.z)).size, agents: 72, width: plan.width, depth: plan.depth };
  await installAnnotations(page);
  if (mode === 'all' || mode === 'campus') await macro();
  if (mode === 'all' || mode === 'run-talk') await run();
  if (mode === 'all' || mode === 'find') await find();
  if (mode === 'all' || mode === 'work') await work();
  if (mode === 'all' || mode === 'bookmark') {
    if (mode === 'bookmark') {
      await openRelease(page); await frontDesk(plan.desks.find(d => d.pane.pane_id === 'demo-w1:p1'), false, true);
      await widen(page, 960);
      await page.getByRole('button', { name: 'Larger terminal text', exact: true }).click({ clickCount: 11, delay: 60 });
      await page.getByRole('textbox', { name: /^Prompt for/ }).fill('Add migration and rollback notes first.');
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[aria-label="Terminal output"] pre')?.textContent.includes('Updated release notes. Checks passed.'), null, { timeout: 12_000 });
    }
    await bookmark();
  }
  await writeReport();
} catch (error) {
  await page.screenshot({ path: path.join(directory, 'capture-error.png') }); await writeReport(); throw error;
} finally { await browser.close(); }
