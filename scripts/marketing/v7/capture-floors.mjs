/** Cold machine/floor chapter. Real selector presses and settled floor cuts;
 * intermediate application camera resets are excluded from recorded plates.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { openDemo, startRecording, encode, camera, sleep } from '../recording.mjs';
import { sidebar, map, closeDesk } from '../v2/navigation.mjs';
import { moveAxis, settled, verticalDrag } from '../v5/navigation.mjs';
import { installAnnotations, setAnnotationMode } from '../v5/annotations.mjs';
import { deriveFloor } from '../../../src/world/layout.ts';

const directory = path.resolve('artifacts/marketing/v7');
const raw = path.join(directory, 'raw');
await mkdir(raw, { recursive: true });
const { page, browser, cdp, gpu, external } = await openDemo('http://127.0.0.1:5186');
page.setDefaultTimeout(8000);
const floor = page.getByRole('combobox', { name: 'Floor', exact: true });
const report = { gpu, external, shots: {}, selections: [], terminalRequests: [] };
page.on('request', request => {
  if (/\/api\/(panes|agents)\/.*\/(terminal|prompt)/.test(request.url())) report.terminalRequests.push(request.url());
});
const save = () => writeFile(path.join(directory, 'floors-capture-report.json'), JSON.stringify(report, null, 2));
async function inventory() {
  const world = await page.evaluate(() => fetch('/api/world').then(r => r.json()));
  const floors = world.connections.map(c => ({ id: c.id, companies: c.snapshot.workspaces.length,
    agents: c.snapshot.agents.length, rows: new Set(deriveFloor(c.snapshot).companies.map(company => company.z)).size }));
  const selected = await floor.inputValue();
  const rendered = await page.evaluate(() => JSON.parse(document.querySelector('.stage canvas')?.dataset.agentPresence || '[]').length);
  if (floors.some(f => f.companies !== 18 || f.agents !== 72 || f.rows !== 6) || rendered !== 72) throw new Error('Both machines must have huge showcase floors.');
  if (await page.locator('.main-jump').count() || await page.locator('.drawer').count()) throw new Error('Early floor chapter must not contain a starred agent or terminal panel.');
  return { selected, rendered, floors, camera: await camera(page) };
}
async function macro() {
  const world = await page.evaluate(() => fetch('/api/world').then(r => r.json()));
  const selected = await floor.inputValue();
  const layout = deriveFloor(world.connections.find(c => c.id === selected).snapshot);
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
  await settled(page); await setAnnotationMode(page); await page.mouse.move(1850, 70); await sleep(250);
}
async function shot(id, duration, pressAt = null) {
  const before = await inventory();
  const recorder = await startRecording(cdp, path.join(directory, 'takes', id));
  await page.evaluate(started => {
    window.__floorTrace = [];
    window.__floorTimer = setInterval(() => {
      const canvas = document.querySelector('.stage canvas');
      if (!canvas?.dataset.officeView) return;
      window.__floorTrace.push({ seconds: (Date.now() - started) / 1000,
        floor: document.querySelector('[aria-label="Floor"]')?.value,
        camera: JSON.parse(canvas.dataset.officeView),
        cueOpacity: Number(getComputedStyle(document.querySelector('#v5-clickcue')).opacity) });
    }, 20);
  }, recorder.started);
  let press = null;
  if (pressAt !== null) {
    await recorder.at(Math.max(.1, pressAt - .5));
    const box = await floor.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
    await recorder.at(pressAt);
    press = { seconds: (Date.now() - recorder.started) / 1000, at: Date.now() };
    await page.mouse.down();
  }
  await recorder.at(duration);
  const trace = await page.evaluate(() => { clearInterval(window.__floorTimer); return window.__floorTrace; });
  const stopRequestedAt = Date.now();
  const frames = await recorder.finish(duration), stopConfirmedAt = Date.now();
  await encode(frames.concat, path.join(raw, `${id}.mp4`), 1920, 1080, duration, false);
  const boundary = await inventory();
  if (JSON.stringify(boundary.camera) !== JSON.stringify(before.camera) || boundary.selected !== before.selected) throw new Error('A filmed floor plate changed camera or machine before its edited cut.');
  report.shots[id] = { duration, before, boundary, press, startedAt: recorder.started, stopRequestedAt, stopConfirmedAt, nativeFrames: frames.frames, trace };
  await save(); console.log(`DONE ${id}`);
}
async function chooseMachine(id, fromShot) {
  const mouseUpAt = Date.now(); await page.mouse.up();
  await floor.selectOption(id); await page.keyboard.press('Escape');
  await page.waitForFunction(expected => document.querySelector('[aria-label="Floor"]')?.value === expected && JSON.parse(document.querySelector('.stage canvas')?.dataset.agentPresence || '[]').length === 72, id, { timeout: 30000 });
  report.selections.push({ fromShot, selected: id, mouseUpAt, selectionAfterRecordedCut: mouseUpAt > report.shots[fromShot].stopConfirmedAt,
    at: Date.now(), actualControlValue: await floor.inputValue(), applicationResetCamera: await camera(page) });
  await macro(); await save();
}
try {
  await page.evaluate(() => fetch('/api/demo/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout: 'showcase' }) }));
  await page.waitForFunction(() => JSON.parse(document.querySelector('.stage canvas')?.dataset.agentPresence || '[]').length === 72, null, { timeout: 60000 });
  await installAnnotations(page); await macro();
  await page.screenshot({ path: path.join(directory, 'floors-studio-proof.png') });
  await shot('floors-card', 2.5);
  await shot('floors-select', 2.5, 2.1);
  await chooseMachine('demo:build', 'floors-select');
  await page.screenshot({ path: path.join(directory, 'floors-buildnode-proof.png') });
  await shot('floors-buildnode', 2.5);
  await shot('floors-return-select', 1, .6);
  await chooseMachine('demo:studio', 'floors-return-select');
  await page.screenshot({ path: path.join(directory, 'floors-return-studio-proof.png') });
  await shot('floors-return-studio', .7);
  await new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error',
      '-i', path.join(raw, 'floors-return-select.mp4'), '-i', path.join(raw, 'floors-return-studio.mp4'),
      '-filter_complex', '[0:v]settb=AVTB,fps=30[a];[1:v]settb=AVTB,fps=30[b];[a][b]xfade=transition=fade:duration=0.2:offset=0.8,format=yuv420p[v]',
      '-map', '[v]', '-an', '-t', '1.5', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
      '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
      '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart', path.join(raw, 'floors-return.mp4')], { stdio: 'inherit' });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Return plate assembly failed (${code}).`)));
  });
  report.returnEditorial = { sources: ['floors-return-select', 'floors-return-studio'], overlap: .2, duration: 1.5,
    actualControlSelectionBetweenRecordedPlates: true, intermediateCameraResetExcluded: true };
  if (external.length || report.terminalRequests.length) throw new Error('Cold chapter requested a remote service or an agent terminal.');
  await save();
} catch (error) {
  await page.screenshot({ path: path.join(directory, 'floors-capture-error.png') }); await save(); throw error;
} finally { await browser.close(); }
