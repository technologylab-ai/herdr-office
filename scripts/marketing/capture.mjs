/** Real app interaction capture from Claude Opus 5.5's 40-second launch storyboard. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { openDemo, startRecording, encode, holdEndCard, sleep, camera, turn, click, outputRoot } from './recording.mjs';
import { installOverlays, caption, show, removeOverlays } from './overlays.mjs';

const url = 'http://127.0.0.1:5186';
const mode = process.argv[2] || 'all';
const events = [];

async function ready(page) {
  await page.waitForFunction(() => !document.querySelector('button[aria-label="Walk in"]')?.disabled, null, { timeout: 60000 });
  await sleep(700);
}

async function floor(page, value) {
  await page.getByRole('combobox', { name: 'Floor', exact: true }).selectOption(value);
  await ready(page);
}

async function sidebar(page, open) {
  const button = page.getByRole('button', { name: open ? 'Show directory' : 'Hide directory', exact: true });
  if (await button.isVisible()) await click(page, button);
}

async function map(page, open) {
  const hide = page.getByRole('button', { name: 'Hide floor map', exact: true });
  const shown = await hide.isVisible();
  if (shown !== open) {
    await page.locator('.stage canvas').focus();
    await page.keyboard.press('m');
  }
}

async function releaseDesk(page) {
  const close = page.getByRole('button', { name: 'Close desk panel', exact: true });
  if (await close.isVisible()) await click(page, close);
}

async function openRelease(page) {
  await sidebar(page, true);
  await click(page, page.getByRole('tab', { name: /^Roster/ }));
  const search = page.getByRole('searchbox', { name: 'Search roster' });
  await search.fill('release');
  await click(page, page.locator('.roster__list .person').filter({ hasText: 'Check release notes' }));
  await sleep(600);
}

async function widen(page, width) {
  const grip = page.getByRole('separator', { name: 'Resize desk panel' });
  const box = await grip.boundingBox();
  const current = Number(await grip.getAttribute('aria-valuenow'));
  const x = box.x + box.width / 2, y = box.y + 230;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - (width - current), y, { steps: 30 });
  await page.mouse.up();
}

/** Go around the desk with the real drag controller and wheel, never a camera setter. */
async function frontOfDesk(page, standing = false) {
  // Scene telemetry publishes at 10 Hz; let the UI visit publish its new camera before reading it.
  await sleep(220);
  const arrival = await camera(page);
  const desk = { x: arrival.x - 1.35, z: arrival.z - 1.7 };
  const target = { x: desk.x + (standing ? .2 : -1), z: desk.z + (standing ? -1.3 : -1.2) };
  const dx = target.x - arrival.x, dz = target.z - arrival.z;
  await turn(page, Math.atan2(-dx, -dz));
  await page.mouse.move(600, 510);
  // CDP wheel deltas are device pixels; the demo navigation consumes CSS pixels.
  const pixelRatio = await page.evaluate(() => devicePixelRatio);
  await page.mouse.wheel(0, -Math.hypot(dx, dz) / .025 * pixelRatio);
  try { await page.waitForFunction(target => {
    const canvas = document.querySelector('.stage canvas');
    if (!canvas?.dataset.officeTiming || !canvas.dataset.officeView) return false;
    const view = JSON.parse(canvas.dataset.officeView);
    return Math.hypot(view.x - target.x, view.z - target.z) < .06 && !JSON.parse(canvas.dataset.officeTiming).moving;
  }, target, { polling: 50, timeout: 5000 }); } catch (error) {
    console.log(JSON.stringify({ event: 'camera-miss', target, actual: await camera(page), timing: await page.locator('.stage canvas').getAttribute('data-office-timing'), hit: await page.evaluate(() => document.elementFromPoint(600,510)?.outerHTML.slice(0,300)) }));
    await page.screenshot({ path: path.join(outputRoot, 'camera-miss.png') });
    throw error;
  }
  const position = await camera(page);
  console.log(JSON.stringify({ event: 'front-camera', arrival, target, position, desk }));
  await turn(page, Math.atan2(-(desk.x + (standing ? 1.2 : 0) - position.x), -(desk.z + .6 - position.z)), standing ? -50 : 0);
  await sleep(50);
}

async function prepare(page) {
  await page.evaluate(() => fetch('/api/demo/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }));
  await floor(page, 'demo:build');
  await floor(page, 'demo:studio');
  await sidebar(page, true);
  await click(page, page.getByRole('tab', { name: 'Directory', exact: true }));
  await click(page, page.getByRole('button', { name: 'Eye level', exact: true }));
  await click(page, page.locator('#directory').getByTitle('Go to Orbit Studio', { exact: true }));
  await sidebar(page, false);
  await map(page, false);
  await sleep(700);
}

async function video() {
  const session = await openDemo(url);
  const { page, cdp, browser, gpu, external } = session;
  try {
    await prepare(page);
    await installOverlays(page);
    const takeDirectory = path.join(outputRoot, 'take');
    const recorder = await startRecording(cdp, takeDirectory);
    const at = async (time, name, run) => {
      await recorder.at(time);
      events.push({ time: Number(((Date.now() - recorder.started) / 1000).toFixed(3)), name });
      console.log(JSON.stringify(events.at(-1)));
      if (run) await run();
    };

    await at(.15, 'real wheel glide', async () => {
      await page.mouse.move(960, 580);
      await page.mouse.wheel(0, -55);
    });
    await at(1.3, 'product reveal', () => show(page, 'marketing-title'));
    await at(2.5, 'real drag look', async () => {
      const view = await camera(page);
      await turn(page, view.yaw + .18);
    });
    await at(4.4, 'title out', () => show(page, 'marketing-title', false));
    await at(5, 'overview', () => click(page, page.getByRole('button', { name: 'Overview', exact: true })));
    await at(5.6, 'workspace mapping caption', () => caption(page, 'Workspaces become companies, tabs become departments.', { tag: 'Each pane is a desk, laid out like your splits.', maxWidth: 900 }));
    await at(6.3, 'frame the row', () => click(page, page.getByRole('button', { name: 'See this row', exact: true })));
    await at(8, 'show directory', () => sidebar(page, true));
    await at(9, 'show floor map', () => map(page, true));
    await at(10, 'hover department', async () => {
      const room = page.getByRole('link', { name: 'Map: go to Signal Lab / Experiments', exact: true });
      const box = await room.locator('.mm-room__shape').boundingBox();
      await page.mouse.move(box.x + box.width - 2, box.y + 2, { steps: 12 });
    });
    await at(12.2, 'mapping caption out', () => show(page, 'marketing-caption', false));
    await at(12.5, 'hover blocked agent', () => page.getByRole('link', { name: /^Map: visit Migrate orders schema/ }).hover());
    await at(12.8, 'blocked-agent caption', () => caption(page, 'Agents that need you stand beside their desks.', { maxWidth: 800 }));
    await at(13.1, 'map jump to blocked agent', () => click(page, page.getByRole('link', { name: /^Map: visit Migrate orders schema/ })));
    await at(13.4, 'front view of waiting agent', () => frontOfDesk(page, true));
    await at(14.7, 'blocked caption out', () => show(page, 'marketing-caption', false));
    await at(15.2, 'open roster', () => click(page, page.getByRole('tab', { name: /^Roster/ })));
    await at(15.6, 'roster caption', () => caption(page, 'Find any agent by task, folder or team.', { maxWidth: 760 }));
    await at(15.8, 'search task', async () => {
      const search = page.getByRole('searchbox', { name: 'Search roster' });
      await click(page, search);
      await page.keyboard.type('release', { delay: 110 });
    });
    await at(17.2, 'visit release agent', () => click(page, page.locator('.roster__list .person').filter({ hasText: 'Check release notes' })));
    await at(17.7, 'walk around to the agent face', () => frontOfDesk(page));
    await at(19.5, 'roster caption out', () => show(page, 'marketing-caption', false));
    await at(20, 'terminal caption and sidebar close', async () => {
      await sidebar(page, false);
      await map(page, false);
      await caption(page, 'Widen its terminal. Prompt it when idle.', { left: 48, maxWidth: 700, tag: 'Fictional demo · simulated terminal' });
    });
    await at(20.8, 'increase terminal text', async () => {
      const increase = page.getByRole('button', { name: 'Larger terminal text', exact: true });
      await click(page, increase);
      await click(page, increase);
    });
    await at(22.5, 'resize terminal to 760 pixels', () => widen(page, 760));
    await at(23, 'type a real demo prompt', async () => {
      await click(page, page.getByRole('textbox', { name: /^Prompt for/ }));
      await page.keyboard.type('List gaps in the 2.4 release notes.', { delay: 105 });
    });
    await at(27.5, 'send prompt into synthetic terminal', () => page.keyboard.press('Meta+Enter'));
    await at(32.2, 'terminal caption out', () => show(page, 'marketing-caption', false));
    await at(32.6, 'bookmark main agent', () => click(page, page.getByRole('button', { name: 'Mark as main agent', exact: true })));
    await at(33, 'main-agent caption', () => caption(page, 'Star a main agent. Each machine is a floor.', { tag: 'Jump back to it from any floor.', maxWidth: 760 }));
    await at(33.2, 'close terminal', () => releaseDesk(page));
    await at(33.7, 'switch to Build Node', async () => {
      const picker = page.getByRole('combobox', { name: 'Floor', exact: true });
      await click(page, picker);
      await picker.selectOption('demo:build');
      await ready(page);
    });
    await at(35, 'Build Node overview', () => click(page, page.getByRole('button', { name: 'Overview', exact: true })));
    await at(36.2, 'return via main-agent bookmark', () => click(page, page.getByRole('button', { name: /^Go to main agent Check release notes/ })));
    await at(37.2, 'main caption out', () => show(page, 'marketing-caption', false));
    await at(37.5, 'final live overview', async () => {
      const close = page.getByRole('button', { name: 'Close desk panel', exact: true });
      if (await close.isVisible()) await close.click();
      await map(page, false);
      await page.getByRole('button', { name: 'Overview', exact: true }).click();
      await page.mouse.move(1000, 650);
      await page.mouse.wheel(0, 65);
    });
    await at(38.1, 'end card', () => show(page, 'marketing-end'));
    await recorder.at(40);
    const recording = await recorder.finish(40);
    const output = path.join(outputRoot, 'herdr-office-teaser-1080p.mp4');
    await writeFile(path.join(outputRoot, 'capture-report.json'), JSON.stringify({ gpu, external, events, ...recording }, null, 2));
    await encode(recording.concat, output);
    await holdEndCard(output, path.join(outputRoot, 'herdr-office-picture-final.mp4'));
    console.log(`VIDEO ${output}`);
  } catch (error) {
    await page.screenshot({ path: path.join(outputRoot, 'capture-error.png') });
    throw error;
  } finally { await browser.close(); }
}

async function screenshots() {
  const { page, browser } = await openDemo(url, { width: 1600, height: 900 }, 2);
  try {
    await prepare(page);
    await sidebar(page, true);
    await map(page, false);
    await click(page, page.getByRole('button', { name: 'Overview', exact: true }));
    await click(page, page.getByRole('button', { name: 'See this row', exact: true }));
    await click(page, page.getByRole('button', { name: 'Raise view 5 metres', exact: true }));
    await page.locator('.stage canvas').focus();
    await page.keyboard.down('a'); await sleep(750); await page.keyboard.up('a');
    await page.keyboard.down('w'); await sleep(400); await page.keyboard.up('w');
    await sleep(800);
    await page.mouse.move(790, 75);
    await page.screenshot({ path: path.join(outputRoot, 'demo-overview.png') });

    await openRelease(page);
    await sidebar(page, false);
    await map(page, false);
    await frontOfDesk(page);
    await widen(page, 640);
    await page.getByRole('button', { name: 'Larger terminal text', exact: true }).click({ clickCount: 2, delay: 200 });
    await page.getByRole('textbox', { name: /^Prompt for/ }).fill('List gaps in the 2.4 release notes.');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await sleep(5000);
    await click(page, page.getByRole('button', { name: 'Mark as main agent', exact: true }));
    await page.mouse.move(800, 75);
    await page.screenshot({ path: path.join(outputRoot, 'demo-desk.png') });

    await releaseDesk(page);
    await sidebar(page, true);
    await page.getByRole('searchbox', { name: 'Search roster' }).fill('');
    await page.getByRole('button', { name: /^Needs you/ }).click();
    await page.locator('.roster__list .person').filter({ hasText: 'Migrate orders schema' }).click();
    await sleep(600);
    await frontOfDesk(page, true);
    await releaseDesk(page);
    await map(page, true);
    await page.getByRole('link', { name: /^Map: visit Migrate orders schema/ }).hover();
    await sleep(800);
    await page.screenshot({ path: path.join(outputRoot, 'demo-roster.png') });

    await floor(page, 'demo:build');
    await sidebar(page, false);
    await click(page, page.getByRole('button', { name: 'Overview', exact: true }));
    await click(page, page.getByRole('button', { name: 'See this row', exact: true }));
    const buildRoom = page.getByRole('link', { name: 'Map: go to Northstar API / Builds', exact: true });
    const box = await buildRoom.locator('.mm-room__shape').boundingBox();
    await page.mouse.move(box.x + box.width - 2, box.y + 2);
    await page.mouse.move(800, 75);
    await sleep(800);
    await page.screenshot({ path: path.join(outputRoot, 'demo-floors.png') });
    console.log('SCREENSHOTS complete');
  } finally { await browser.close(); }
}

await mkdir(outputRoot, { recursive: true });
if (mode === 'all' || mode === 'video') await video();
if (mode === 'all' || mode === 'screenshots') await screenshots();
