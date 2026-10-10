/** Opus-approved compact secondary machine. Every Studio Mac source is reused. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { openDemo, startRecording, encode, camera, sleep } from '../recording.mjs';
import { sidebar, map, closeDesk, openRelease, widen } from '../v2/navigation.mjs';
import { settled } from '../v5/navigation.mjs';
import { installAnnotations, setAnnotationMode } from '../v5/annotations.mjs';
import { deriveFloor } from '../../../src/world/layout.ts';

const directory = path.resolve('artifacts/marketing/v8'), raw = path.join(directory, 'raw');
const preflight = process.argv[2] === 'preflight';
await mkdir(raw, { recursive: true });
const { page, browser, cdp, gpu, external } = await openDemo('http://127.0.0.1:5186');
page.setDefaultTimeout(8000);
const floor = page.getByRole('combobox', { name: 'Floor', exact: true });
const report = { gpu, external, fixture: 'campus', shots: {}, selections: [], interactions: [] };
const save = () => writeFile(path.join(directory, preflight ? 'compact-preflight.json' : 'compact-capture-report.json'), JSON.stringify(report, null, 2));
async function inventory() {
  const world = await page.evaluate(() => fetch('/api/world').then(r => r.json()));
  const floors = world.connections.map(c => {
    const plan = deriveFloor(c.snapshot);
    return { id: c.id, companies: c.snapshot.workspaces.length, departments: c.snapshot.tabs.length,
      agents: c.snapshot.agents.length, rows: new Set(plan.companies.map(company => company.z)).size,
      width: plan.width, depth: plan.depth };
  });
  const studio = floors.find(f => f.id === 'demo:studio'), build = floors.find(f => f.id === 'demo:build');
  if (studio.companies !== 18 || studio.departments !== 30 || studio.agents !== 72 || studio.rows !== 6 ||
      build.companies !== 1 || build.departments !== 2 || build.agents !== 4 || build.rows !== 1) throw new Error('Compact campus inventory changed.');
  const selected = await floor.inputValue();
  const rendered = await page.evaluate(() => JSON.parse(document.querySelector('.stage canvas')?.dataset.agentPresence || '[]').length);
  if (rendered !== floors.find(f => f.id === selected).agents) throw new Error('Rendered humans do not match the selected machine.');
  const shortcut = page.locator('.main-jump');
  return { selected, rendered, floors, camera: await camera(page), mainShortcut: await shortcut.count() ? await shortcut.getAttribute('aria-label') : null };
}
async function choose(id, recordedShot = null) {
  const mouseUpAt = Date.now(); await page.mouse.up();
  await floor.selectOption(id); await page.keyboard.press('Escape');
  await page.waitForFunction(expected => document.querySelector('[aria-label="Floor"]')?.value === expected && JSON.parse(document.querySelector('.stage canvas')?.dataset.agentPresence || '[]').length === (expected === 'demo:build' ? 4 : 72), id, { timeout: 30000 });
  report.selections.push({ id, recordedShot, mouseUpAt, actualControlValue: await floor.inputValue(),
    selectionAfterRecordedCut: recordedShot ? mouseUpAt > report.shots[recordedShot].stopConfirmedAt : null });
}
async function compact() {
  await closeDesk(page); await sidebar(page, false); await map(page, false);
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'See this row', exact: true }).click();
  await settled(page); await sleep(250); await setAnnotationMode(page); await page.mouse.move(1650, 720);
  const view = await camera(page);
  if (Math.abs(view.height - 18) > .01) throw new Error('Expected the native compact 18-metre row overview.');
  return view;
}
async function shot(id, duration, pressAt = null, target = floor) {
  const before = await inventory();
  const recorder = await startRecording(cdp, path.join(directory, 'takes', id));
  await page.evaluate(started => {
    window.__compactTrace = [];
    window.__compactTimer = setInterval(() => {
      const canvas = document.querySelector('.stage canvas');
      if (!canvas?.dataset.officeView) return;
      window.__compactTrace.push({ seconds: (Date.now() - started) / 1000,
        floor: document.querySelector('[aria-label="Floor"]')?.value,
        camera: JSON.parse(canvas.dataset.officeView), cueOpacity: Number(getComputedStyle(document.querySelector('#v5-clickcue')).opacity) });
    }, 20);
  }, recorder.started);
  let press = null;
  if (pressAt !== null) {
    await recorder.at(Math.max(.1, pressAt - .5));
    const box = await target.boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
    await recorder.at(pressAt); press = { seconds: (Date.now() - recorder.started) / 1000, at: Date.now() }; await page.mouse.down();
  }
  await recorder.at(duration);
  const trace = await page.evaluate(() => { clearInterval(window.__compactTimer); return window.__compactTrace; });
  const stopRequestedAt = Date.now(), frames = await recorder.finish(duration), stopConfirmedAt = Date.now();
  await encode(frames.concat, path.join(raw, `${id}.mp4`), 1920, 1080, duration, false);
  const boundary = await inventory();
  if (JSON.stringify(boundary.camera) !== JSON.stringify(before.camera) || boundary.selected !== before.selected) throw new Error('Build plate changed camera or machine before its edited cut.');
  report.shots[id] = { duration, before, boundary, press, startedAt: recorder.started, stopRequestedAt, stopConfirmedAt, nativeFrames: frames.frames, trace };
  await save(); console.log(`DONE ${id}`);
}
async function combineReturn() {
  await new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error',
      '-i', path.join(raw, 'floors-return-select.mp4'), '-i', path.resolve('artifacts/marketing/v7/raw/floors-return-studio.mp4'),
      '-filter_complex', '[0:v]settb=AVTB,fps=30[a];[1:v]settb=AVTB,fps=30[b];[a][b]xfade=transition=fade:duration=0.2:offset=0.8,format=yuv420p[v]',
      '-map', '[v]', '-an', '-t', '1.5', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
      '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
      '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart', path.join(raw, 'floors-return.mp4')], { stdio: 'inherit' });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Return plate assembly failed (${code}).`)));
  });
  report.returnEditorial = { compactBuildSource: 'raw/floors-return-select.mp4', preservedStudioSource: 'artifacts/marketing/v7/raw/floors-return-studio.mp4',
    overlap: .2, duration: 1.5, noStudioRecapture: true };
}
try {
  await page.evaluate(() => fetch('/api/demo/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout: 'campus' }) }));
  await page.waitForFunction(() => JSON.parse(document.querySelector('.stage canvas')?.dataset.agentPresence || '[]').length === 72, null, { timeout: 60000 });
  await installAnnotations(page); await choose('demo:build'); await compact();
  report.preflight = await inventory();
  await page.screenshot({ path: path.join(directory, 'compact-build-overview.png') });
  if (!preflight) {
    await shot('floors-buildnode', 2.5);
    await shot('floors-return-select', 1, .6);
    await choose('demo:studio', 'floors-return-select'); await combineReturn();
    // Establish the same real completed main-agent context as the accepted
    // bookmark chapter; no new Studio Mac footage is recorded.
    await openRelease(page); await widen(page, 960);
    await page.getByRole('button', { name: 'Larger terminal text', exact: true }).click({ clickCount: 11, delay: 60 });
    await page.getByRole('textbox', { name: /^Prompt for/ }).fill('Add migration and rollback notes first.');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[aria-label="Terminal output"] pre')?.textContent.includes('Updated release notes. Checks passed.'), null, { timeout: 12000 });
    await page.getByRole('button', { name: 'Mark as main agent', exact: true }).click();
    await choose('demo:build'); await compact();
    const early = report.shots['floors-buildnode'].before.camera, later = await camera(page);
    if (JSON.stringify(early) !== JSON.stringify(later)) throw new Error('Early compact floor and later bookmark floor framing differ.');
    await page.screenshot({ path: path.join(directory, 'compact-bookmark-build.png') });
    await shot('bookmark-floor-jump', 3.2, 2.8, page.getByRole('button', { name: /^Go to main agent Check release notes/ }));
    const mouseUpAt = Date.now(); await page.mouse.up();
    await page.waitForFunction(() => document.querySelector('[aria-label="Floor"]')?.value === 'demo:studio' && JSON.parse(document.querySelector('.stage canvas')?.dataset.agentPresence || '[]').length === 72, null, { timeout: 30000 });
    await page.getByRole('complementary', { name: 'Desk: Check release notes', exact: true }).waitFor({ state: 'visible' });
    const terminal = await page.locator('[aria-label="Terminal output"] pre').evaluate(el => ({ text: el.textContent,
      font: getComputedStyle(el).fontSize, width: document.querySelector('.drawer').getBoundingClientRect().width }));
    if (!terminal.text.includes('Updated release notes. Checks passed.') || terminal.font !== '24px' || terminal.width !== 960) throw new Error('Actual main shortcut failed to restore the completed 24px/960px terminal.');
    report.interactions.push({ type: 'real completed main-agent return after recorded shortcut press', mouseUpAt,
      mouseUpAfterRecordedCut: mouseUpAt > report.shots['bookmark-floor-jump'].stopConfirmedAt, terminal, returned: await inventory(),
      noStudioRecapture: true });
  }
  if (external.length) throw new Error('Capture requested an external service.');
  await save();
} catch (error) {
  await page.screenshot({ path: path.join(directory, 'compact-capture-error.png') }); await save(); throw error;
} finally { await browser.close(); }
