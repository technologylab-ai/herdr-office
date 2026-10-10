/** Actual bookmark → floor selector → shortcut interactions for the V6 edit.
 * Only the isolated synthetic server is accessible. Intermediate navigation is
 * retained in raw proofs so assembly can make explicit settled editorial cuts.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { openDemo, startRecording, encode, camera, turn, sleep } from '../recording.mjs';
import { sidebar, map, closeDesk, openRelease, widen } from '../v2/navigation.mjs';
import { moveAxis, settled, verticalDrag } from '../v5/navigation.mjs';
import { installAnnotations, setAnnotationMode } from '../v5/annotations.mjs';
import { deriveFloor } from '../../../src/world/layout.ts';

const directory = path.resolve('artifacts/marketing/v6');
const floorOnly = process.argv[2] === 'floor-jump-only';
const reportFile = floorOnly ? 'bookmark-floor-retake-report.json' : 'bookmark-capture-report.json';
await mkdir(directory, { recursive: true });
const { page, browser, cdp, gpu, external } = await openDemo('http://127.0.0.1:5186');
page.setDefaultTimeout(8000);
const report = { gpu, external, shots: {}, interactions: [] };
const floor = page.getByRole('combobox', { name: 'Floor', exact: true });
async function proof() {
  const world = await page.evaluate(() => fetch('/api/world').then(r => r.json()));
  const floors = world.connections.map(c => ({ id: c.id, companies: c.snapshot.workspaces.length,
    agents: c.snapshot.agents.length, rows: new Set(deriveFloor(c.snapshot).companies.map(company => company.z)).size }));
  const selected = await floor.inputValue();
  const renderedAgents = await page.evaluate(() => JSON.parse(document.querySelector('.stage canvas')?.dataset.agentPresence || '[]').length);
  if (floors.some(f => f.companies !== 18 || f.agents !== 72 || f.rows !== 6) || renderedAgents !== 72) throw new Error('Bookmark capture requires two large synthetic floors.');
  return { selected, renderedAgents, floors, camera: await camera(page) };
}
async function traceStart(started) {
  await page.evaluate(started => {
    window.__bookmarkTrace = [];
    window.__bookmarkTimer = setInterval(() => {
      const canvas = document.querySelector('.stage canvas');
      if (!canvas?.dataset.officeView) return;
      window.__bookmarkTrace.push({ seconds: (Date.now() - started) / 1000,
        floor: document.querySelector('[aria-label="Floor"]')?.value,
        camera: JSON.parse(canvas.dataset.officeView),
        drawer: document.querySelector('.drawer__title')?.textContent ?? null,
        mainShortcut: document.querySelector('.main-jump')?.getAttribute('aria-label') ?? null,
        terminal: document.querySelector('[aria-label="Terminal output"] pre')?.textContent ?? null });
    }, 40);
  }, started);
}
async function shot(id, duration, action = async () => {}) {
  const campus = await proof();
  const recorder = await startRecording(cdp, path.join(directory, 'takes', id));
  await traceStart(recorder.started);
  const events = [];
  const at = async (seconds, name, callback) => {
    await recorder.at(seconds);
    const start = (Date.now() - recorder.started) / 1000;
    if (callback) await callback();
    events.push({ seconds: start, completed: (Date.now() - recorder.started) / 1000, name });
  };
  await action(at);
  await recorder.at(duration);
  const trace = await page.evaluate(() => { clearInterval(window.__bookmarkTimer); return window.__bookmarkTrace; });
  const frames = await recorder.finish(duration);
  await encode(frames.concat, path.join(directory, `${id}.mp4`), 1920, 1080, duration, false);
  report.shots[id] = { duration, campus, events, trace, frames: frames.frames };
  await writeFile(path.join(directory, reportFile), JSON.stringify(report, null, 2));
  console.log(`DONE ${id}`);
}
async function frontDesk(desk) {
  await sidebar(page, false); await map(page, false); await sleep(250);
  const current = await camera(page), target = { x: desk.x - 1, z: desk.z - 1.2 };
  const dx = target.x - current.x, dz = target.z - current.z;
  await turn(page, Math.atan2(-dx, -dz));
  await page.mouse.move(680, 540); await page.mouse.wheel(0, -Math.hypot(dx, dz) / .025);
  await page.waitForFunction(target => {
    const view = JSON.parse(document.querySelector('.stage canvas').dataset.officeView);
    return Math.hypot(view.x - target.x, view.z - target.z) < .08;
  }, target, { polling: 30, timeout: 8000 });
  await settled(page);
  const position = await camera(page);
  await turn(page, Math.atan2(-(desk.x - position.x), -(desk.z + .82 - position.z)) - .55);
  await sleep(200);
}
async function macro() {
  const world = await page.evaluate(() => fetch('/api/world').then(r => r.json()));
  const layout = deriveFloor(world.connections.find(c => c.id === 'demo:build').snapshot);
  await closeDesk(page); await sidebar(page, false); await map(page, false);
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'See this row', exact: true }).click(); await sleep(250);
  const before = await camera(page), row = layout.companies.filter(c => c.z === 14);
  const pitch = -Math.atan2(before.height, 14 + Math.max(...row.map(c => c.depth)) * .42 - before.z);
  while (await page.getByRole('button', { name: 'Raise view 5 metres', exact: true }).isEnabled()) {
    await page.getByRole('button', { name: 'Raise view 5 metres', exact: true }).click(); await sleep(120);
  }
  await verticalDrag(page, (pitch + 49 * Math.PI / 180) / .003);
  await page.locator('.stage canvas').focus(); await moveAxis(page, 'z', -20, 's', true);
  const x = (await camera(page)).x; await moveAxis(page, 'x', 0, x < 0 ? 'a' : 'd');
  await settled(page); await page.mouse.move(1850, 70); await sleep(250);
}
try {
  await page.evaluate(() => fetch('/api/demo/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout: 'showcase' }) }));
  await page.waitForFunction(() => JSON.parse(document.querySelector('.stage canvas')?.dataset.agentPresence || '[]').length === 72, null, { timeout: 60000 });
  const world = await page.evaluate(() => fetch('/api/world').then(r => r.json()));
  const release = deriveFloor(world.connections.find(c => c.id === 'demo:studio').snapshot).desks.find(d => d.pane.pane_id === 'demo-w1:p1');
  await installAnnotations(page);
  await openRelease(page); await frontDesk(release); await widen(page, 960);
  await page.getByRole('button', { name: 'Larger terminal text', exact: true }).click({ clickCount: 11, delay: 60 });
  await page.getByRole('textbox', { name: /^Prompt for/ }).fill('Add migration and rollback notes first.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Terminal output"] pre')?.textContent.includes('Updated release notes. Checks passed.'), null, { timeout: 12000 });
  await setAnnotationMode(page, { terminal: true }); await page.mouse.move(1850, 70);
  if (floorOnly) {
    await page.getByRole('button', { name: 'Mark as main agent', exact: true }).click();
    await floor.selectOption('demo:build'); await page.keyboard.press('Escape');
    await page.waitForFunction(() => JSON.parse(document.querySelector('.stage canvas')?.dataset.agentPresence || '[]').length === 72, null, { timeout: 30000 });
    await macro(); await setAnnotationMode(page);
    const before = await camera(page);
    let downAt;
    await shot('bookmark-floor-jump-v2', 3.2, async at => {
      await at(.4, 'move to the real cross-floor main-agent shortcut', async () => {
        const box = await page.getByRole('button', { name: /^Go to main agent Check release notes/ }).boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
      });
      await at(2.8, 'press the actual main-agent shortcut and hold through the recorded cut', async () => {
        downAt = Date.now(); await page.mouse.down();
      });
    });
    const recordedBoundary = await camera(page);
    const mouseUpAt = Date.now(); await page.mouse.up();
    await page.waitForFunction(() => document.querySelector('[aria-label="Floor"]')?.value === 'demo:studio' && JSON.parse(document.querySelector('.stage canvas')?.dataset.agentPresence || '[]').length === 72, null, { timeout: 30000 });
    await page.getByRole('complementary', { name: 'Desk: Check release notes', exact: true }).waitFor({ state: 'visible' });
    report.interactions.push({ type: 'real main-agent shortcut activation after visible held press',
      before, recordedBoundary, boundaryDelta: Math.hypot(recordedBoundary.x - before.x, recordedBoundary.z - before.z),
      downAt, mouseUpAt, mouseUpAfterRecording: true, returned: await proof(),
      returnedPane: 'demo-w1:p1', completedOutputRetained: await page.locator('[aria-label="Terminal output"] pre').textContent() });
    if (report.interactions.at(-1).boundaryDelta > .001 || !report.interactions.at(-1).completedOutputRetained.includes('Updated release notes. Checks passed.')) throw new Error('Held press changed the filmed camera or real shortcut failed to return to the completed agent.');
    await writeFile(path.join(directory, reportFile), JSON.stringify(report, null, 2));
  } else {
  await shot('bookmark-card-bg', 2.5);
  await shot('bookmark-star-switch', 3.4, async at => {
    await at(.3, 'real main-agent star click', () => page.getByRole('button', { name: 'Mark as main agent', exact: true }).click());
    await at(1.3, 'open the real Floor selector', () => floor.click());
    await at(1.8, 'choose Build Node through the actual HTML Floor selector', async () => {
      // macOS native select popovers do not accept remote keys in headless
      // Chrome. Select the actual DOM control; its normal input/change events
      // invoke the application handler and update the visible floor label.
      await floor.selectOption('demo:build');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.querySelector('[aria-label="Floor"]')?.value === 'demo:build');
    });
  });
  await page.waitForFunction(() => JSON.parse(document.querySelector('.stage canvas')?.dataset.agentPresence || '[]').length === 72, null, { timeout: 30000 });
  await page.keyboard.press('Escape'); await macro(); await setAnnotationMode(page);
  await page.screenshot({ path: path.join(directory, 'bookmark-build-campus.png') });
  await shot('bookmark-floor-jump', 3.2, async at => {
    await at(.6, 'move to the actual cross-floor main-agent shortcut', async () => {
      const box = await page.getByRole('button', { name: /^Go to main agent Check release notes/ }).boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
    });
    await at(2.1, 'real main-agent shortcut click returns to Studio Mac', () => page.getByRole('button', { name: /^Go to main agent Check release notes/ }).click());
  });
  await page.waitForFunction(() => document.querySelector('[aria-label="Floor"]')?.value === 'demo:studio' && JSON.parse(document.querySelector('.stage canvas')?.dataset.agentPresence || '[]').length === 72, null, { timeout: 30000 });
  await page.getByRole('complementary', { name: 'Desk: Check release notes', exact: true }).waitFor({ state: 'visible' });
  await frontDesk(release); await setAnnotationMode(page, { terminal: true }); await page.mouse.move(1850, 70);
  const terminal = await page.locator('[aria-label="Terminal output"] pre').evaluate(el => ({ text: el.textContent, font: getComputedStyle(el).fontSize, width: document.querySelector('.drawer').getBoundingClientRect().width }));
  if (!terminal.text.includes('Updated release notes. Checks passed.') || terminal.font !== '24px' || Math.abs(terminal.width - 960) > 1) throw new Error('Return must retain the same completed 24px/960px terminal.');
  report.interactions.push({ type: 'same completed main agent returned', paneId: 'demo-w1:p1', terminal, campus: await proof() });
  await page.screenshot({ path: path.join(directory, 'bookmark-main-return.png') });
  await shot('bookmark-return', 2.6);
  await shot('end-bg', 4);
  await writeFile(path.join(directory, reportFile), JSON.stringify(report, null, 2));
  }
} catch (error) {
  await page.screenshot({ path: path.join(directory, 'bookmark-capture-error.png') });
  await writeFile(path.join(directory, reportFile), JSON.stringify(report, null, 2));
  throw error;
} finally { await browser.close(); }
