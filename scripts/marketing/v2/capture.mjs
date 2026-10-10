/** Independent actual UI takes for Claude Opus 5.5's expanded, 104-second film. */
import { openDemo, startRecording, encode, camera, turn, sleep } from '../recording.mjs';
import { directory, renderSlides, installAnnotations, annotate, ffmpeg } from './design.mjs';
import { reset, sidebar, map, closeDesk, goCompany, openRelease, frontOfDesk, widen, lockedTurn } from './navigation.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const mode = process.argv[2] || 'all';
const reports = {};
await mkdir(directory, { recursive: true });
if (mode !== 'all' && mode !== 'slides') {
  try { Object.assign(reports, JSON.parse(await readFile(path.join(directory, 'capture-report.json'), 'utf8')).reports); } catch { /* First independent take. */ }
}
if (mode === 'all' || mode === 'slides') await renderSlides();
if (mode === 'slides') process.exit(0);

const session = await openDemo('http://127.0.0.1:5186');
const { page, browser, cdp, gpu, external } = session;
page.setDefaultTimeout(6000);
await reset(page);
await installAnnotations(page);

async function shot(id, duration, action) {
  console.log(`START ${id}`);
  const recorder = await startRecording(cdp, path.join(directory, 'takes', id));
  const events = [];
  const at = async (seconds, name, run) => {
    await recorder.at(seconds);
    const elapsed = (Date.now() - recorder.started) / 1000;
    events.push({ seconds: +elapsed.toFixed(3), name });
    if (run) await run();
  };
  await action(at, recorder);
  await recorder.at(duration);
  const frames = await recorder.finish(duration);
  await encode(frames.concat, path.join(directory, `${id}.mp4`), 1920, 1080, duration, false);
  reports[id] = { duration, events, frames: frames.frames };
  await writeFile(path.join(directory, 'capture-report.json'), JSON.stringify({ gpu, external, reports }, null, 2));
  console.log(`DONE ${id}`);
}

async function office() {
  await openRelease(page);
  await sidebar(page, false); await map(page, false);
  await frontOfDesk(page);
  await closeDesk(page);
  await annotate(page, 'Workspaces become companies. Tabs become departments. Panes become desks.');
  await shot('office', 9, async at => {
    await at(.4, 'close-up office reveal', async () => { await page.mouse.move(700, 620); await page.mouse.wheel(0, 8); });
    await at(3, 'real overview', async () => {
      await page.getByRole('button', { name: 'Overview', exact: true }).click();
      await sidebar(page, true);
      await annotate(page, 'Workspaces become companies. Tabs become departments. Panes become desks.', { sidebar: true });
    });
    await at(6, 'slow overview approach', async () => { await page.mouse.move(1000, 650); await page.mouse.wheel(0, -35); });
  });
}

async function runProjects() {
  await goCompany(page, 'Orbit Studio');
  await sidebar(page, false); await map(page, false);
  await turn(page, -Math.PI / 2);
  await page.mouse.move(960, 540);
  await page.evaluate(() => { window.__v2Mouse = { x: 960, y: 540 }; });
  await annotate(page, 'Walk the floor. Hold Shift to run between projects.');
  const samples = [], keys = [];
  await page.exposeFunction('v2RunKey', event => { keys.push(event); });
  await page.evaluate(() => {
    const record = e => { if (/^(Key[WASDF]|ShiftLeft|Escape)$/.test(e.code)) window.v2RunKey({ type: e.type, code: e.code, at: Date.now() }); };
    document.addEventListener('keydown', record); document.addEventListener('keyup', record);
    window.__v2RunKeyRecord = record;
  });
  const sample = async (phase, recorder) => samples.push({ phase, elapsed: (Date.now() - recorder.started) / 1000,
    view: await camera(page), pointerLocked: await page.evaluate(() => document.pointerLockElement?.tagName === 'CANVAS') });
  await shot('run', 13, async (at, recorder) => {
    await at(0, 'F captures the actual pointer', async () => {
      await page.locator('.stage canvas').focus(); await page.keyboard.press('f');
      await page.waitForFunction(() => document.pointerLockElement?.tagName === 'CANVAS');
      await sample('Orbit Studio start', recorder);
    });
    await page.keyboard.down('w');
    await at(2, 'Shift accelerates the existing W walk', async () => {
      await sample('walk end', recorder); await page.keyboard.down('Shift');
    });
    while ((await camera(page)).x < -6.1 && Date.now() - recorder.started < 4400) await sleep(35);
    await page.keyboard.up('w'); await page.keyboard.up('Shift');
    await lockedTurn(page, -Math.PI, 1.05);
    await sample('Northstar API stop', recorder);
    await sleep(1350);
    await lockedTurn(page, -Math.PI / 2, 1.05);
    await page.keyboard.down('Shift'); await page.keyboard.down('w');
    while ((await camera(page)).x < 27.8 && Date.now() - recorder.started < 10_600) await sleep(35);
    await page.keyboard.up('w'); await page.keyboard.up('Shift');
    await lockedTurn(page, -Math.PI, 1.05);
    await sample('Signal Lab stop', recorder);
    await page.screenshot({ path: path.join(directory, 'run-signal-proof.png') });
  });
  await page.evaluate(() => {
    document.removeEventListener('keydown', window.__v2RunKeyRecord); document.removeEventListener('keyup', window.__v2RunKeyRecord);
  });
  await writeFile(path.join(directory, 'run-proof.json'), JSON.stringify({ samples, keys }, null, 2));
  const first = samples[0].view, last = samples.at(-1).view;
  if (last.x - first.x < 50 || !samples.every(s => s.pointerLocked) || last.x < 23.4 || last.x > 33.5) {
    throw new Error(`The actual run did not cross all three named projects: ${JSON.stringify(samples)}`);
  }
  await page.keyboard.press('Escape');
}

async function blockedMap() {
  await page.keyboard.press('Escape'); await closeDesk(page);
  await sidebar(page, true); await map(page, true);
  await page.getByRole('tab', { name: 'Directory', exact: true }).click();
  await annotate(page, 'Agents that need you stand beside their desks.', { sidebar: true });
  const link = page.getByRole('link', { name: /^Map: visit Migrate orders schema/ });
  await shot('map-select', 3.2, async at => {
    await at(0, 'hover the blocked agent', () => link.hover());
    await at(2.5, 'real map visit', async () => {
      const box = await link.locator('.mm-person__dot').boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    });
  });
  await frontOfDesk(page, { standing: true });
  await annotate(page, 'Agents that need you stand beside their desks.', { sidebar: true });
  await page.mouse.move(1580, 75);
  await page.screenshot({ path: path.join(directory, 'standing-proof.png') });
  await shot('standing', 6.8, async at => {
    await at(.3, 'small actual approach to the standing person', async () => { await page.mouse.move(730, 640); await page.mouse.wheel(0, 9); });
  });
  await ffmpeg(['-loglevel', 'error', '-i', path.join(directory, 'map-select.mp4'), '-i', path.join(directory, 'standing.mp4'),
    '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0,format=yuv420p[v]', '-map', '[v]', '-an', '-t', '10',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-color_range', 'tv', '-colorspace', 'bt709',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-map_metadata', '-1', '-map_chapters', '-1',
    '-movflags', '+faststart', path.join(directory, 'map.mp4')]);
}

async function roster() {
  await sidebar(page, true);
  await annotate(page, 'Find any agent by task, folder or team.', { sidebar: true });
  await shot('roster', 6, async at => {
    await at(.2, 'open the roster', () => page.getByRole('tab', { name: /^Roster/ }).click());
    await at(.7, 'search release', async () => {
      const search = page.getByRole('searchbox', { name: 'Search roster' });
      await search.click(); await page.keyboard.type('release', { delay: 110 });
    });
    await at(3, 'visit the search result', () => page.locator('.roster__list .person').filter({ hasText: 'Check release notes' }).click());
  });
}

async function observeTerminal(id, recorder) {
  await page.evaluate(({ id, started }) => {
    window.__v2TerminalProof ??= {};
    const entries = []; window.__v2TerminalProof[id] = entries;
    const output = document.querySelector('[aria-label="Terminal output"] pre');
    const capture = () => {
      const entry = { seconds: (Date.now() - started) / 1000, text: output?.textContent,
        status: document.querySelector('.drawer__facts')?.textContent,
        fontSize: output ? getComputedStyle(output).fontSize : null,
        drawerWidth: document.querySelector('.drawer')?.getBoundingClientRect().width,
        scrollHeight: output?.parentElement?.scrollHeight, clientHeight: output?.parentElement?.clientHeight };
      if (!entries.length || entries.at(-1).text !== entry.text || entries.at(-1).status !== entry.status) entries.push(entry);
    };
    capture(); const timer = setInterval(capture, 100);
    window.__v2TerminalProofTimer = timer;
  }, { id, started: recorder.started });
}

async function saveTerminalProof(id, duration) {
  const values = await page.evaluate(id => { clearInterval(window.__v2TerminalProofTimer); return window.__v2TerminalProof[id]; }, id);
  for (let index = 0; index < values.length; index++) values[index].holdSeconds = +(Math.max(0, (values[index + 1]?.seconds ?? duration) - values[index].seconds)).toFixed(3);
  await writeFile(path.join(directory, `${id}-dom-proof.json`), JSON.stringify(values, null, 2));
  return values;
}

async function terminal() {
  await openRelease(page); await sidebar(page, false); await map(page, false);
  await frontOfDesk(page, { leftFrame: true });
  await annotate(page, 'Open the desk. Watch the work as it happens.', { terminal: true });
  await page.screenshot({ path: path.join(directory, 'terminal-before-proof.png') });
  await shot('watch', 18, async (at, recorder) => {
    await observeTerminal('watch', recorder);
    await at(.2, 'drag terminal from 440 to 960 pixels', () => widen(page, 960));
    await at(.9, 'increase actual terminal text to 19 pixels', async () => {
      const increase = page.getByRole('button', { name: 'Larger terminal text', exact: true });
      await increase.click({ clickCount: 6, delay: 105 });
    });
    await at(2, 'begin isolated scripted activity', async () => {
      const result = await page.evaluate(async () => {
        const response = await fetch('/api/demo/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionId: 'demo:studio', paneId: 'demo-w1:p1', scenario: 'release-review' }) });
        return { ok: response.ok, value: await response.json() };
      });
      if (!result.ok || !result.value.demo) throw new Error('Scripted activity was not isolated.');
    });
    await at(3, 'clear the setup caption', () => annotate(page, '', { terminal: true, show: false }));
    await at(10, 'save actual incremental console proof', () => page.screenshot({ path: path.join(directory, 'terminal-working-proof.png') }));
  });
  const watch = await saveTerminalProof('watch', 18);
  if (!watch.some(e => e.text.includes('Reading CHANGELOG')) || !watch.some(e => e.text.includes('Comparing merged changes')) || !watch.some(e => e.text.includes('Migration and rollback notes are missing'))) {
    throw new Error('The working terminal did not visibly progress.');
  }
  await steering();
}

async function steering() {
  // The dedicated chapter already explains the action. Keep the prompt and response unobstructed.
  await annotate(page, '', { terminal: true, show: false });
  // Reset only the real terminal source polling phase while off camera, so the final Done line lands promptly.
  await page.getByRole('tab', { name: 'Screen', exact: true }).click();
  await page.getByRole('tab', { name: 'Recent', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Terminal output"] pre')?.textContent.includes('Review complete. Ready for the next instruction.'));
  await shot('steer', 19, async (at, recorder) => {
    await observeTerminal('steer', recorder);
    await at(.3, 'type the next instruction', async () => {
      await page.getByRole('textbox', { name: /^Prompt for/ }).click();
      await page.keyboard.type('Add migration and rollback notes first.', { delay: 115 });
    });
    await at(6, 'click Send', () => page.getByRole('button', { name: 'Send', exact: true }).click());
    await at(11, 'save actual writing proof', () => page.screenshot({ path: path.join(directory, 'terminal-steering-proof.png') }));
    await at(17, 'save the completed response', () => page.screenshot({ path: path.join(directory, 'terminal-done-proof.png') }));
  });
  const steer = await saveTerminalProof('steer', 19);
  if (!steer.some(e => e.text.includes('Writing docs/releases/2.4.md')) || !steer.some(e => e.text.includes('Updated release notes. Checks passed.'))) throw new Error('The actual steering response was not visible.');
  const font = await page.getByRole('region', { name: 'Terminal output' }).locator('pre').evaluate(el => getComputedStyle(el).fontSize);
  const width = Math.round((await page.locator('.drawer').boundingBox()).width);
  if (font !== '19px' || width !== 960) throw new Error(`Terminal framing is wrong: ${font}, ${width}px`);
}

async function stageSteering() {
  // Warm the same review story while setting up the camera; do not alter the other recorded clips.
  await page.evaluate(() => fetch('/api/demo/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectionId: 'demo:studio', paneId: 'demo-w1:p1', scenario: 'release-review' }) }));
  await openRelease(page); await sidebar(page, false); await map(page, false);
  await frontOfDesk(page, { leftFrame: true });
  await widen(page, 960);
  await page.getByRole('button', { name: 'Larger terminal text', exact: true }).click({ clickCount: 6, delay: 105 });
  await annotate(page, '', { terminal: true, show: false });
  await page.waitForFunction(() => document.querySelector('[aria-label="Terminal output"] pre')?.textContent.includes('Review complete. Ready for the next instruction.'), null, { timeout: 20_000 });
  await steering();
}

async function bookmark() {
  await annotate(page, 'Star a main agent. Each machine is a floor. Jump back from anywhere.');
  await shot('bookmark', 12, async at => {
    await at(.4, 'star the actual selected agent', () => page.getByRole('button', { name: 'Mark as main agent', exact: true }).click());
    await at(3, 'close the terminal panel', () => closeDesk(page));
    await at(3.7, 'choose Build Node', async () => {
      await page.getByRole('combobox', { name: 'Floor', exact: true }).selectOption('demo:build');
      await sleep(700); await page.getByRole('button', { name: 'Overview', exact: true }).click();
    });
    await at(8.8, 'jump back to the bookmarked main agent', () => page.getByRole('button', { name: /^Go to main agent Check release notes/ }).click());
    await at(10.8, 'save the returned main-agent panel', () => page.screenshot({ path: path.join(directory, 'main-return-proof.png') }));
  });
}

try {
  if (mode === 'all' || mode === 'office') await office();
  if (mode === 'all' || mode === 'run') await runProjects();
  if (mode === 'all' || mode === 'map') await blockedMap();
  if (mode === 'all' || mode === 'roster') await roster();
  if (mode === 'all' || mode === 'terminal') await terminal();
  if (mode === 'steer') await stageSteering();
  if (mode === 'all' || mode === 'bookmark') {
    if (mode === 'bookmark') await openRelease(page);
    await bookmark();
  }
} catch (error) {
  await page.screenshot({ path: path.join(directory, 'capture-error.png') });
  throw error;
} finally { await browser.close(); }
