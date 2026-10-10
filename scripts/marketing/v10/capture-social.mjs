/** Opus social arc: one worked-on/saved Basalt agent, explicit search arrivals. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { openDemo, startRecording, encode, camera, turn, sleep } from '../recording.mjs';
import { sidebar, map, closeDesk, goCompany, widen } from '../v2/navigation.mjs';
import { settled } from '../v5/navigation.mjs';
import { installAnnotations, setAnnotationMode } from '../v5/annotations.mjs';
import { deriveFloor } from '../../../src/world/layout.ts';
import { socialDemo } from '../../../server/demo-social.ts';

const directory = path.resolve('artifacts/marketing/v10'), raw = path.join(directory, 'raw');
await mkdir(raw, { recursive: true });
const old = JSON.parse(await readFile('artifacts/marketing/v5/capture-report.json', 'utf8'));
const heroPose = old.shots.run.trace.at(-1).view;
const standingPose = old.shots['needs-card-bg'].trace[0].view;
const releasePose = old.shots['work-card-bg'].trace[0].view;
const hero = socialDemo.terminal;
const report = { fixture: 'social', canonicalHero: hero, heroPose, sources: [], shots: {}, interactions: [], requests: [] };
const save = () => writeFile(path.join(directory, 'social-capture-report.json'), JSON.stringify(report, null, 2));
async function resetOutside() {
  const origin = 'http://127.0.0.1:5186';
  const info = await fetch(origin + '/api/demo/info').then(r => r.json());
  if (!info.demo || !info.isolated) throw new Error('Synthetic isolated server required.');
  const response = await fetch(origin + '/api/demo/reset', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ layout: 'social' }) });
  if (!response.ok) throw new Error('Social fixture reset failed.');
}
async function api(page, endpoint, body) {
  const result = await page.evaluate(async ({ endpoint, body }) => {
    const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { ok: r.ok, body: await r.json() };
  }, { endpoint, body });
  if (!result.ok) throw new Error(`Synthetic API ${endpoint} rejected capture setup.`);
  return result.body;
}
async function inventory(page) {
  const world = await page.evaluate(() => fetch('/api/world').then(r => r.json()));
  const floors = world.connections.map(c => {
    const p = deriveFloor(c.snapshot);
    return { id: c.id, companies: c.snapshot.workspaces.length, departments: c.snapshot.tabs.length,
      agents: c.snapshot.agents.length, rows: new Set(p.companies.map(x => x.z)).size,
      names: c.snapshot.workspaces.map(x => x.label) };
  });
  const studio = floors.find(f => f.id === 'demo:studio'), build = floors.find(f => f.id === 'demo:build');
  if (studio.companies !== 18 || studio.departments !== 30 || studio.agents !== 72 || studio.rows !== 6 ||
      build.companies !== 1 || build.departments !== 2 || build.agents !== 4 || !build.names.includes('Cinder CI')) throw new Error('Social inventory/secondary identity changed.');
  const selected = await page.getByRole('combobox', { name: 'Floor', exact: true }).inputValue();
  const rendered = await page.locator('.stage canvas').evaluate(c => JSON.parse(c.dataset.agentPresence || '[]').length);
  if (rendered !== (selected === 'demo:studio' ? 72 : 4)) throw new Error('Reported and rendered roster mismatch.');
  return { selected, rendered, floors, camera: await camera(page) };
}
async function beginTrace(page, started) {
  await page.evaluate(started => {
    window.__socialTrace = [];
    window.__socialTimer = setInterval(() => {
      const c = document.querySelector('.stage canvas'); if (!c?.dataset.officeView) return;
      const pre = document.querySelector('[aria-label="Terminal output"] pre');
      const drawer = document.querySelector('.drawer');
      const search = document.querySelector('[aria-label="Search roster"]');
      const hint = document.querySelector('.minimap__hint'), hintRect = hint?.getBoundingClientRect();
      const oldDisclosure = document.querySelector('#v5-disclosure');
      window.__socialTrace.push({ seconds: (Date.now() - started) / 1000,
        camera: JSON.parse(c.dataset.officeView), floor: document.querySelector('[aria-label="Floor"]')?.value,
        drawerTitle: document.querySelector('.drawer__title')?.textContent ?? null,
        facts: document.querySelector('.drawer__facts')?.textContent ?? null,
        terminal: pre?.textContent ?? null, font: pre ? getComputedStyle(pre).fontSize : null,
        width: drawer?.getBoundingClientRect().width ?? null,
        scrollHeight: pre?.parentElement.scrollHeight ?? null, clientHeight: pre?.parentElement.clientHeight ?? null,
        search: search?.value ?? null, results: document.querySelectorAll('.roster__list .person').length,
        main: document.querySelector('.main-jump')?.getAttribute('aria-label') ?? null,
        mapVisible: !!document.querySelector('.minimap'),
        mapHint: hint?.textContent ?? null,
        mapHintGeometry: hint ? { left: hintRect.left, bottom: hintRect.bottom, scrollHeight: hint.scrollHeight, clientHeight: hint.clientHeight,
          whiteSpace: getComputedStyle(hint).whiteSpace } : null,
        legacyDisclosureHidden: !!oldDisclosure && getComputedStyle(oldDisclosure).display === 'none',
        cueOpacity: Number(getComputedStyle(document.querySelector('#v5-clickcue')).opacity) });
    }, 40);
  }, started);
}
async function shot(page, cdp, id, duration, action = async () => {}) {
  const before = await inventory(page), recorder = await startRecording(cdp, path.join(directory, 'takes', id));
  await beginTrace(page, recorder.started);
  const events = [];
  const at = async (seconds, name, callback) => {
    await recorder.at(seconds); const began = (Date.now() - recorder.started) / 1000;
    if (callback) await callback();
    events.push({ at: began, completed: (Date.now() - recorder.started) / 1000, name });
  };
  await action(at, recorder); await recorder.at(duration);
  const trace = await page.evaluate(() => { clearInterval(window.__socialTimer); return window.__socialTrace; });
  const stopRequestedAt = Date.now(), frames = await recorder.finish(duration), stopConfirmedAt = Date.now();
  await encode(frames.concat, path.join(raw, `${id}.mp4`), 1920, 1080, duration, false);
  report.shots[id] = { duration, before, after: await inventory(page), events, trace, startedAt: recorder.started,
    stopRequestedAt, stopConfirmedAt, nativeFrames: frames.frames };
  await save(); console.log(`DONE ${id}`);
}
async function chooseFloor(page, id, afterShot = null) {
  const releasedAt = Date.now(); await page.mouse.up();
  await page.getByRole('combobox', { name: 'Floor', exact: true }).selectOption(id); await page.keyboard.press('Escape');
  await page.waitForFunction(id => document.querySelector('[aria-label="Floor"]')?.value === id && JSON.parse(document.querySelector('.stage canvas')?.dataset.agentPresence || '[]').length === (id === 'demo:studio' ? 72 : 4), id, { timeout: 30000 });
  report.interactions.push({ type: 'actual Floor selection', id, afterShot, releasedAt,
    afterRecordedCut: afterShot ? releasedAt > report.shots[afterShot].stopConfirmedAt : null });
}
async function compact(page) {
  await closeDesk(page); await sidebar(page, false); await map(page, false);
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'See this row', exact: true }).click(); await settled(page); await sleep(200);
  await setAnnotationMode(page); await page.mouse.move(1650, 720);
  if (Math.abs((await camera(page)).height - 18) > .01) throw new Error('Cinder CI must retain the approved compact18m framing.');
}
async function moveToPose(page, target) {
  const current = await camera(page), dx = target.x - current.x, dz = target.z - current.z;
  const distance = Math.hypot(dx, dz);
  if (distance > 5.5) throw new Error('Capture framing requires a short genuine wheel move, not a hidden camera setter.');
  if (distance > .002) {
    await turn(page, Math.atan2(-dx, -dz)); await page.mouse.move(700, 550);
    await page.mouse.wheel(0, -distance / .025); await sleep(900); await settled(page); await sleep(200);
  }
  await turn(page, target.yaw); await sleep(200);
  const actual = await camera(page);
  if (Math.hypot(actual.x - target.x, actual.z - target.z) > .02 || Math.abs(actual.height - target.height) > .001) throw new Error(`Canonical capture pose mismatch: ${JSON.stringify({ target, actual })}`);
  return actual;
}
async function frameHero(page, keepingDrawer = false) {
  if (!keepingDrawer) await goCompany(page, 'Basalt Ledger');
  else {
    await sidebar(page, true); await page.getByRole('tab', { name: 'Directory', exact: true }).click();
    await page.locator('#directory').getByTitle('Go to Basalt Ledger', { exact: true }).click(); await sleep(250);
  }
  await sidebar(page, false); await map(page, false); await moveToPose(page, heroPose);
  await setAnnotationMode(page, { terminal: keepingDrawer }); await page.mouse.move(470, 625);
}
async function selectRoster(page, title) {
  await sidebar(page, true); await page.getByRole('tab', { name: /^Roster/ }).click();
  await page.getByRole('searchbox', { name: 'Search roster' }).fill(title);
  await page.locator('.roster__list .person').filter({ hasText: title }).click(); await sleep(250);
}
async function ffmpeg(args) {
  await new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
    child.on('error', reject); child.on('exit', c => c === 0 ? resolve() : reject(new Error(`ffmpeg failed (${c}).`)));
  });
}
async function cut(input, output, from, to) {
  await ffmpeg(['-i', path.join(raw, `${input}.mp4`), '-vf', `trim=start_frame=${from}:end_frame=${to},setpts=PTS-STARTPTS`,
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart', path.join(raw, `${output}.mp4`)]);
}
async function join(files, output) {
  await ffmpeg([...files.flatMap(f => ['-i', path.join(raw, `${f}.mp4`)]), '-filter_complex',
    files.map((_, i) => `[${i}:v]`).join('') + `concat=n=${files.length}:v=1:a=0,format=yuv420p[v]`,
    '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart', path.join(raw, `${output}.mp4`)]);
}
await resetOutside();
{
  const { page, browser, cdp, gpu, external } = await openDemo('http://127.0.0.1:5186');
  report.sources.push({ role: 'opener compact Cinder CI selector', gpu, external });
  try {
    await installAnnotations(page); await page.evaluate(() => window.__v5Annotations.hide());
    await chooseFloor(page, 'demo:build'); await compact(page);
    await shot(page, cdp, 'floors-return-select', 1.2, async at => {
      await at(.3, 'move to the real Floor control', async () => {
        const b = await page.getByRole('combobox', { name: 'Floor', exact: true }).boundingBox();
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
      });
      await at(.7, 'real Floor press held through the cut', () => page.mouse.down());
    });
    await chooseFloor(page, 'demo:studio', 'floors-return-select');
  } finally { await browser.close(); }
}
await resetOutside();
{
  const { page, browser, cdp, gpu, external } = await openDemo('http://127.0.0.1:5186');
  report.sources.push({ role: 'Basalt work, search and exact saved Basalt return', gpu, external });
  page.on('request', request => {
    const url = new URL(request.url());
    if (/\/api\/(panes|agents)\/.*\/(terminal|prompt)$/.test(url.pathname)) report.requests.push({ method: request.method(), path: url.pathname,
      connectionId: url.searchParams.get('connectionId'), body: request.method() === 'POST' ? request.postDataJSON() : null, at: Date.now() });
  });
  try {
    await installAnnotations(page); await page.evaluate(() => window.__v5Annotations.hide());
    await selectRoster(page, hero.title); await widen(page, 960);
    await page.getByRole('button', { name: 'Larger terminal text', exact: true }).click({ clickCount: 11, delay: 30 });
    await closeDesk(page); await frameHero(page);
    await api(page, '/api/demo/activity', { connectionId: hero.connectionId, paneId: hero.paneId, scenario: hero.scenario });
    await shot(page, cdp, 'basalt-work-continuous', 13, async (at, recorder) => {
      await at(.3, 'click the SAME red-haired Basalt person reached by the accepted run', async () => {
        const before = await camera(page); await page.mouse.click(470, 625);
        await page.getByRole('complementary', { name: `Desk: ${hero.title}`, exact: true }).waitFor({ state: 'visible' });
        await setAnnotationMode(page, { terminal: true });
        const after = await camera(page);
        if (Math.hypot(after.x - before.x, after.z - before.z) > .001) throw new Error('Basalt direct click changed the camera.');
        report.interactions.push({ type: 'same reached Basalt human opens terminal', before, after, paneId: hero.paneId });
      });
      await at(3.5, 'type Opus instruction with actual native keystrokes', async () => {
        await page.getByRole('textbox', { name: /^Prompt for/ }).click();
        for (const [i, letter] of [...hero.prompt].entries()) {
          await recorder.at(3.5 + i * 1.9 / hero.prompt.length); await page.keyboard.type(letter);
        }
      });
      await at(5.5, 'actual Send button submits to the same Basalt demo pane', async () => {
        if (!await page.getByRole('button', { name: 'Send', exact: true }).isEnabled()) throw new Error('Basalt prompt is not ready.');
        await page.getByRole('button', { name: 'Send', exact: true }).click();
      });
      await at(10.8, 'completed Basalt result held before starring', async () => {
        const output = await page.locator('[aria-label="Terminal output"] pre').textContent();
        if (!output.includes('Done. Summary: reports/nightly-demo.md')) throw new Error('Steered result did not finish in the actual terminal.');
      });
      await at(11.5, 'mark this same Basalt agent as the browser bookmark', () => page.getByRole('button', { name: 'Mark as main agent', exact: true }).click());
    });
    await cut('basalt-work-continuous', 'basalt-open', 0, 30);
    await cut('basalt-work-continuous', 'basalt-steer', 30, 330);
    await cut('basalt-work-continuous', 'basalt-star', 330, 390);

    await closeDesk(page); await selectRoster(page, 'Migrate orders schema');
    await sidebar(page, false); await map(page, false); await moveToPose(page, standingPose); await closeDesk(page);
    await setAnnotationMode(page); await page.mouse.move(960, 540);
    await shot(page, cdp, 'needs-input', 3, async at => {
      await at(1, 'click the actual standing Studio/Northstar human', async () => {
        const before = await camera(page); await page.mouse.click(960, 540);
        await page.getByRole('complementary', { name: 'Desk: Migrate orders schema', exact: true }).waitFor({ state: 'visible' });
        await setAnnotationMode(page, { terminal: true });
        const after = await camera(page); if (Math.hypot(after.x - before.x, after.z - before.z) > .001) throw new Error('Standing-human click moved the camera.');
        report.interactions.push({ type: 'standing human question', before, after, normalPromptEnabled: await page.getByRole('textbox', { name: /^Prompt for/ }).isEnabled() });
      });
    });

    await closeDesk(page); await sidebar(page, false); await setAnnotationMode(page); await page.mouse.move(1650, 720);
    const result = page.locator('.roster__list .person').filter({ hasText: 'Check release notes' });
    await shot(page, cdp, 'search-input', 1.9, async at => {
      await at(.2, 'open the native roster search with all old terminals closed', async () => {
        await sidebar(page, true); await page.getByRole('tab', { name: /^Roster/ }).click();
        await page.getByRole('searchbox', { name: 'Search roster' }).fill('');
      });
      await at(.4, 'type release into the native search box', async () => {
        await page.getByRole('searchbox', { name: 'Search roster' }).click(); await page.keyboard.type('release', { delay: 65 });
      });
      await at(1.25, 'one matching Orbit Studio result', async () => {
        if (await page.locator('.roster__list .person').count() !== 1) throw new Error('release search must yield exactly one real result.');
        const b = await result.boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
      });
      await at(1.6, 'actual result press held before native focus navigation', () => page.mouse.down());
    });
    const searchUpAt = Date.now(); await page.mouse.up();
    await page.getByRole('complementary', { name: 'Desk: Check release notes', exact: true }).waitFor({ state: 'visible' });
    await sidebar(page, false); await map(page, false); await moveToPose(page, releasePose);
    await setAnnotationMode(page, { terminal: true }); await page.mouse.move(1650, 720);
    report.interactions.push({ type: 'actual release result opens Orbit Studio after held-click cut', searchUpAt,
      afterRecordedCut: searchUpAt > report.shots['search-input'].stopConfirmedAt, selectedTitle: 'Check release notes', floor: 'demo:studio', actualFrontPose: await camera(page) });
    await shot(page, cdp, 'search-arrival', 2.1);
    await join(['search-input', 'search-arrival'], 'search-release');

    await shot(page, cdp, 'build-select', 1, async at => {
      await at(.2, 'move to actual Floor picker while Orbit terminal is open', async () => {
        const b = await page.getByRole('combobox', { name: 'Floor', exact: true }).boundingBox();
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
      });
      await at(.5, 'press actual Floor picker and hold until cut', () => page.mouse.down());
    });
    await chooseFloor(page, 'demo:build', 'build-select'); await compact(page);
    const main = page.getByRole('button', { name: /^Go to main agent Reconcile nightly settlement files on Studio Mac/ });
    await shot(page, cdp, 'build-bookmark-press', 2.9, async at => {
      await at(2.1, 'move to named saved BASALT shortcut; separate from Floor picker', async () => {
        const b = await main.boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
      });
      await at(2.5, 'press the actual saved Basalt shortcut and hold through the cut', () => page.mouse.down());
    });
    await cut('build-bookmark-press', 'build-readable', 0, 60);
    await cut('build-bookmark-press', 'bookmark-press', 60, 87);
    await join(['build-select', 'build-readable'], 'build-floor');
    const mainUpAt = Date.now(); await page.mouse.up();
    await page.waitForFunction(() => document.querySelector('[aria-label="Floor"]')?.value === 'demo:studio' && JSON.parse(document.querySelector('.stage canvas')?.dataset.agentPresence || '[]').length === 72, null, { timeout: 30000 });
    await page.getByRole('complementary', { name: `Desk: ${hero.title}`, exact: true }).waitFor({ state: 'visible' });
    await frameHero(page, true); await page.mouse.move(1650, 720);
    const restored = await page.locator('[aria-label="Terminal output"] pre').textContent();
    if (!restored.includes('Done. Summary: reports/nightly-demo.md') || !restored.includes(hero.prompt)) throw new Error('Saved Basalt return lost the SAME steered terminal history.');
    report.interactions.push({ type: 'same saved Basalt return', mainUpAt, afterRecordedCut: mainUpAt > report.shots['build-bookmark-press'].stopConfirmedAt,
      paneId: hero.paneId, title: hero.title, frontPose: await camera(page), terminal: restored });
    await shot(page, cdp, 'basalt-return-outro', 8.2, async (at, recorder) => {
      await at(1.1, 'open native Studio Map beside the SAME saved Basalt agent', () => map(page, true));
      await at(1.85, 'hover the actual highlighted saved Basalt map dot by return-time2.9s', async () => {
        const target = page.getByRole('link', { name: /^Map: visit Reconcile nightly settlement files \(codex\)/ }).locator('.mm-person__dot');
        await target.hover();
        await page.waitForFunction(() => document.querySelector('.minimap__hint')?.textContent.includes('Reconcile nightly settlement files'));
        const hint = await page.locator('.minimap__hint').evaluate(el => {
          const r = el.getBoundingClientRect(); return { text: el.textContent, left: r.left, bottom: r.bottom,
            scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, whiteSpace: getComputedStyle(el).whiteSpace };
        });
        if (!hint.text.includes('codex') || !hint.text.includes('Done') || hint.scrollHeight > hint.clientHeight || hint.left <= 620 || hint.bottom >= 762) throw new Error(`Native hover hint is clipped or misplaced: ${JSON.stringify(hint)}`);
        report.interactions.push({ type: 'actual saved Basalt map hover', bookmarkReturnAt: (Date.now() - recorder.started) / 1000 + .9, hint });
      });
    });
    await cut('basalt-return-outro', 'returned-basalt', 0, 126);
    await cut('basalt-return-outro', 'outro', 126, 246);
    await join(['bookmark-press', 'returned-basalt'], 'bookmark-return');
    if (external.length) throw new Error('External services are forbidden during capture.');
    await save();
  } catch (error) {
    await page.screenshot({ path: path.join(directory, 'social-capture-error.png') }); await save(); throw error;
  } finally { await browser.close(); }
}
