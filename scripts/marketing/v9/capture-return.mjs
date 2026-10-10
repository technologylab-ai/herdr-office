/** Real continuous overview flight, then a matched native eye-level handoff. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { openDemo, startRecording, encode, camera, sleep } from '../recording.mjs';
import { sidebar, map, closeDesk } from '../v2/navigation.mjs';
import { moveAxis, settled, verticalDrag } from '../v5/navigation.mjs';
import { installAnnotations, setAnnotationMode } from '../v5/annotations.mjs';
import { deriveFloor } from '../../../src/world/layout.ts';

const directory = path.resolve('artifacts/marketing/v9'), raw = path.join(directory, 'raw');
await mkdir(raw, { recursive: true });
const oldReport = JSON.parse(await readFile('artifacts/marketing/v5/capture-report.json', 'utf8'));
const accepted = oldReport.shots['walk-card-bg'].trace[0].view;
const oldPitch = -Math.atan(.33 / 7), macroPitch = -49 * Math.PI / 180;
const report = { acceptedPose: accepted, acceptedPitch: oldPitch, sources: [], shots: {}, selections: [], flight: null };
const studioOnly = process.argv[2] === 'studio-only';
if (studioOnly) {
  const previous = JSON.parse(await readFile(path.join(directory, 'return-capture-report.json'), 'utf8'));
  report.shots['floors-return-select'] = previous.shots['floors-return-select'];
  report.sources = previous.sources.filter(source => source.role === 'compact Build selector');
  report.selections = previous.selections;
}
const save = () => writeFile(path.join(directory, 'return-capture-report.json'), JSON.stringify(report, null, 2));
async function resetOutside(layout) {
  const origin = 'http://127.0.0.1:5186';
  const info = await fetch(origin + '/api/demo/info').then(r => r.json());
  if (!info.demo || !info.isolated) throw new Error('Refusing to record a non-isolated server.');
  const response = await fetch(origin + '/api/demo/reset', { method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ layout }) });
  if (!response.ok) throw new Error('Synthetic fixture reset failed.');
}
async function inventory(page) {
  const world = await page.evaluate(() => fetch('/api/world').then(r => r.json()));
  const floors = world.connections.map(c => {
    const plan = deriveFloor(c.snapshot);
    return { id: c.id, companies: c.snapshot.workspaces.length, departments: c.snapshot.tabs.length,
      agents: c.snapshot.agents.length, rows: new Set(plan.companies.map(company => company.z)).size };
  });
  const studio = floors.find(f => f.id === 'demo:studio'), build = floors.find(f => f.id === 'demo:build');
  if (studio.companies !== 18 || studio.agents !== 72 || studio.rows !== 6 || build.companies !== 1 || build.departments !== 2 || build.agents !== 4) throw new Error('Campus size contrast changed.');
  const selected = await page.getByRole('combobox', { name: 'Floor', exact: true }).inputValue();
  const avatars = await page.locator('.stage canvas').evaluate(canvas => JSON.parse(canvas.dataset.avatarStyles || '[]'));
  if (avatars.length !== (selected === 'demo:studio' ? 72 : 4)) throw new Error('Rendered roster mismatch.');
  return { selected, floors, avatars, camera: await camera(page) };
}
async function trace(page, started) {
  await page.evaluate(started => {
    window.__returnTrace = [];
    window.__returnTimer = setInterval(() => {
      const canvas = document.querySelector('.stage canvas');
      if (!canvas?.dataset.officeView) return;
      window.__returnTrace.push({ seconds: (Date.now() - started) / 1000,
        camera: JSON.parse(canvas.dataset.officeView), timing: JSON.parse(canvas.dataset.officeTiming),
        floor: document.querySelector('[aria-label="Floor"]')?.value,
        cueOpacity: Number(getComputedStyle(document.querySelector('#v5-clickcue')).opacity) });
    }, 20);
  }, started);
}
async function finishShot(page, recorder, id, duration, before, events = []) {
  await recorder.at(duration);
  const values = await page.evaluate(() => { clearInterval(window.__returnTimer); return window.__returnTrace; });
  const stopRequestedAt = Date.now(), frames = await recorder.finish(duration), stopConfirmedAt = Date.now();
  await encode(frames.concat, path.join(raw, `${id}.mp4`), 1920, 1080, duration, false);
  report.shots[id] = { duration, before, after: await inventory(page), events, trace: values,
    startedAt: recorder.started, stopRequestedAt, stopConfirmedAt, nativeFrames: frames.frames };
  await save(); console.log(`DONE ${id} ${duration}s`);
}
async function drag(page, yawDelta, pitchDelta, seconds = 1, rate = 45) {
  const point = { x: 960, y: 620 }, dx = -yawDelta / .003, dy = -pitchDelta / .003;
  const started = Date.now(), steps = Math.ceil(seconds * rate);
  await page.mouse.move(point.x, point.y); await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(point.x + dx * i / steps, point.y + dy * i / steps);
    await sleep(Math.max(0, seconds * 1000 * i / steps - (Date.now() - started)));
  }
  await page.mouse.up();
  return { yawDelta, pitchDelta, dx, dy, duration: (Date.now() - started) / 1000 };
}
async function macro(page) {
  const world = await page.evaluate(() => fetch('/api/world').then(r => r.json()));
  const layout = deriveFloor(world.connections.find(c => c.id === 'demo:studio').snapshot);
  await closeDesk(page); await sidebar(page, false); await map(page, false);
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'See this row', exact: true }).click(); await sleep(250);
  const before = await camera(page), row = layout.companies.filter(c => c.z === 14);
  const nativePitch = -Math.atan2(before.height, 14 + Math.max(...row.map(c => c.depth)) * .42 - before.z);
  while (await page.getByRole('button', { name: 'Raise view 5 metres', exact: true }).isEnabled()) {
    await page.getByRole('button', { name: 'Raise view 5 metres', exact: true }).click(); await sleep(120);
  }
  await verticalDrag(page, (nativePitch - macroPitch) / .003);
  await page.locator('.stage canvas').focus(); await moveAxis(page, 'z', -20, 's', true);
  const x = (await camera(page)).x; await moveAxis(page, 'x', 0, x < 0 ? 'a' : 'd');
  await settled(page); await setAnnotationMode(page); await page.mouse.move(1650, 720); await sleep(250);
}
// Read-only instrumentation uses the native per-render GPU camera pose, with
// published-position observation as a diagnostic fallback. It changes no state.
async function observeFlight(page) {
  await page.evaluate(() => {
    const canvas = document.querySelector('.stage canvas');
    const publish = () => {
      const value = JSON.parse(canvas.dataset.officeView), at = performance.now(), previous = window.__flightObserved;
      const dt = previous ? (at - previous.at) / 1000 : 0;
      window.__flightObserved = { value, at, velocity: dt > 0 ? {
        x: (value.x - previous.value.x) / dt, y: (value.height - previous.value.height) / dt,
        z: (value.z - previous.value.z) / dt } : { x: 0, y: 0, z: 0 } };
    };
    window.__flightEstimate = () => {
      if (window.__gpuCamera) {
        const g = window.__gpuCamera;
        return { x: g.x, height: g.height, z: g.z, pitch: g.pitch,
          velocity: { x: -Math.sin(g.yaw) * Math.cos(g.pitch) * 14,
            y: Math.sin(g.pitch) * 14, z: -Math.cos(g.yaw) * Math.cos(g.pitch) * 14 },
          age: 0, readOnlySource: 'native WebGL viewMatrix upload' };
      }
      const p = window.__flightObserved, age = Math.min(.15, (performance.now() - p.at) / 1000);
      return { x: p.value.x + p.velocity.x * age, height: p.value.height + p.velocity.y * age,
        z: p.value.z + p.velocity.z * age, velocity: p.velocity, age };
    };
    publish();
    window.__flightObserver = new MutationObserver(records => {
      if (records.some(r => r.attributeName === 'data-office-view')) publish();
    });
    window.__flightObserver.observe(canvas, { attributes: true, attributeFilter: ['data-office-view'] });
    window.__flightWheels = [];
    window.__flightWheelListener = e => { window.__flightWheels.push({ at: performance.now(), delta: e.deltaY, shift: e.shiftKey, position: window.__flightEstimate() }); };
    canvas.addEventListener('wheel', window.__flightWheelListener, { capture: true, passive: true });
  });
}
async function fly(page, target, unit) {
  await page.locator('.stage canvas').focus(); await page.mouse.move(1650, 720); await page.keyboard.down('Shift');
  const started = Date.now();
  while (true) {
    await page.mouse.wheel(0, -240); await sleep(130);
    const remaining = await page.evaluate(({ target, unit }) => {
      const p = window.__flightEstimate();
      return (target.x - p.x) * unit.x + (target.height - p.height) * unit.y + (target.z - p.z) * unit.z;
    }, { target, unit });
    if (remaining <= 11) break;
    if (Date.now() - started > 12_000) throw new Error('Continuous descent did not approach the aisle.');
  }
  // Refresh pending forward travel to 12m, then reduce that same pending amount
  // by one real wheel input. The positive remaining travel decays smoothly.
  const previousWheelCount = await page.evaluate(() => window.__flightWheels.length);
  await page.mouse.wheel(0, -240);
  await page.waitForFunction(count => window.__flightWheels.length > count, previousWheelCount, { polling: 10, timeout: 1000 });
  const last = await page.evaluate(() => window.__flightWheels.at(-1));
  const p = last.position;
  const distance = (target.x - p.x) * unit.x + (target.height - p.height) * unit.y + (target.z - p.z) * unit.z;
  if (distance <= 0 || distance >= 12) throw new Error('Final wheel brake is outside its safe forward range.');
  const adjustment = distance - 12;
  await page.mouse.wheel(0, -adjustment / .05); await page.keyboard.up('Shift');
  await page.waitForFunction(() => {
    const timing = JSON.parse(document.querySelector('.stage canvas').dataset.officeTiming);
    return !timing.moving;
  }, null, { polling: 20, timeout: 5000 });
  await sleep(100);
  const actual = await camera(page), endpointError = Math.hypot(actual.x - target.x, actual.z - target.z);
  if (endpointError > .15 || Math.abs(actual.height - 3) > .2) throw new Error(`Flight endpoint mismatch: ${JSON.stringify({ target, actual, endpointError })}`);
  const velocity = p.velocity, observedPitch = p.pitch ?? Math.atan2(velocity.y, Math.hypot(velocity.x, velocity.z));
  return { seconds: (Date.now() - started) / 1000, actual, target, endpointError, distance, adjustment,
    observedPitch, wheels: await page.evaluate(() => window.__flightWheels) };
}
async function runFFmpeg(args) {
  await new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`ffmpeg failed (${code}).`)));
  });
}
// Build control press belongs to a separate cold capture, preserving the
// accepted Studio cast's fresh-campus allocation in the primary browser.
if (!studioOnly) {
await resetOutside('campus');
{
  const { page, browser, cdp, gpu, external } = await openDemo('http://127.0.0.1:5186');
  report.sources.push({ role: 'compact Build selector', gpu, external });
  try {
    await page.getByRole('combobox', { name: 'Floor', exact: true }).selectOption('demo:build');
    await page.waitForFunction(() => JSON.parse(document.querySelector('.stage canvas')?.dataset.agentPresence || '[]').length === 4);
    await installAnnotations(page); await sidebar(page, false); await map(page, false);
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await page.getByRole('button', { name: 'See this row', exact: true }).click(); await settled(page);
    await page.mouse.move(1650, 720);
    const before = await inventory(page), recorder = await startRecording(cdp, path.join(directory, 'takes/floors-return-select'));
    await trace(page, recorder.started); await recorder.at(.3);
    const box = await page.getByRole('combobox', { name: 'Floor', exact: true }).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
    await recorder.at(.7); await page.mouse.down();
    await finishShot(page, recorder, 'floors-return-select', 1.2, before, [{ at: .7, action: 'real Floor selector press held through edited cut' }]);
    await page.mouse.up(); await page.getByRole('combobox', { name: 'Floor', exact: true }).selectOption('demo:studio'); await page.keyboard.press('Escape');
    report.selections.push({ action: 'actual control selection after recorded Build cut', value: await page.getByRole('combobox', { name: 'Floor', exact: true }).inputValue() });
  } finally { await browser.close(); }
}
}
await resetOutside('campus');
{
  const { page, browser, cdp, gpu, external } = await openDemo('http://127.0.0.1:5186');
  report.sources.push({ role: 'continuous Studio flight and matched ground', gpu, external });
  try {
    // Observe the exact per-render camera pose, without altering GL uploads.
    // This avoids extrapolating the application's 100ms diagnostic publication.
    await page.addInitScript(() => {
      const names = new WeakMap();
      for (const ctor of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
        if (!ctor) continue;
        const getLocation = ctor.prototype.getUniformLocation;
        const upload = ctor.prototype.uniformMatrix4fv;
        ctor.prototype.getUniformLocation = function(program, name) {
          const location = getLocation.call(this, program, name);
          if (location) names.set(location, name);
          return location;
        };
        ctor.prototype.uniformMatrix4fv = function(location, transpose, values, ...rest) {
          const result = upload.call(this, location, transpose, values, ...rest);
          if (names.get(location) === 'viewMatrix' && values?.length >= 16) {
            const offset = rest[0] || 0, m = Array.from(values).slice(offset, offset + 16);
            const tx = m[12], ty = m[13], tz = m[14];
            window.__gpuCamera = { x: -(m[0] * tx + m[1] * ty + m[2] * tz),
              height: -(m[4] * tx + m[5] * ty + m[6] * tz), z: -(m[8] * tx + m[9] * ty + m[10] * tz),
              yaw: Math.atan2(m[2], m[10]), pitch: Math.asin(-m[6]), at: performance.now() };
          }
          return result;
        };
      }
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Walk in', exact: true }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => JSON.parse(document.querySelector('.stage canvas')?.dataset.agentPresence || '[]').length === 72 && window.__gpuCamera, null, { timeout: 60000 });
    const initialStyles = await page.locator('.stage canvas').evaluate(canvas => JSON.parse(canvas.dataset.avatarStyles));
    await page.evaluate(() => fetch('/api/demo/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout: 'campus' }) }));
    await page.waitForFunction(() => JSON.parse(document.querySelector('.stage canvas')?.dataset.agentPresence || '[]').length === 72, null, { timeout: 60000 });
    await installAnnotations(page); await macro(page);
    const before = await inventory(page);
    report.castConsistency = { initialStyles, refreshedStyles: before.avatars,
      initialLayout: 'campus', referenceActor: { paneId: 'demo-w4:p4', expectedStyle: 0 },
      referenceActorMatched: before.avatars.find(a => a.paneId === 'demo-w4:p4')?.style === 0,
      stylesStableOnRefresh: initialStyles.every(old => before.avatars.some(a => a.paneId === old.paneId && a.style === old.style)) };
    if (!report.castConsistency.stylesStableOnRefresh) throw new Error('Campus roster styles changed on refresh.');
    if (before.avatars.find(a => a.paneId === 'demo-w4:p4')?.style !== 0) throw new Error('Accepted no-glasses Script level two appearance changed.');
    const observed = await page.evaluate(() => window.__gpuCamera);
    if (Math.hypot(observed.x - before.camera.x, observed.z - before.camera.z, observed.height - before.camera.height) > .001) throw new Error('Read-only GPU camera differs from the native published pose.');
    report.readOnlyGpuValidation = { observed, native: before.camera, valuesUnmodified: true };
    await page.screenshot({ path: path.join(directory, 'studio-arrival-proof.png') });
    const target = { x: accepted.x, z: accepted.z, height: 3.02 }, start = before.camera;
    const dx = target.x - start.x, dz = target.z - start.z, dy = target.height - start.height;
    const length = Math.hypot(dx, dy, dz), unit = { x: dx / length, y: dy / length, z: dz / length };
    const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
    const recorder = await startRecording(cdp, path.join(directory, 'takes/studio-return-continuous'));
    await trace(page, recorder.started); await observeFlight(page);
    const events = [];
    await recorder.at(2.8);
    events.push({ at: (Date.now() - recorder.started) / 1000, action: 'actual mouse aim from unchanged full-campus arrival' });
    const aim = await drag(page, yaw - start.yaw, pitch - macroPitch, 1, 18);
    await recorder.at(3.8);
    const flightAt = (Date.now() - recorder.started) / 1000;
    events.push({ at: flightAt, action: 'continuous real Shift-wheel descent' });
    report.flight = await fly(page, target, unit);
    report.flight.aim = aim;
    events.push({ at: (Date.now() - recorder.started) / 1000, action: 'actual continuous mouse leveling to accepted run yaw/pitch' });
    const level = await drag(page, Math.atan2(Math.sin(accepted.yaw - report.flight.actual.yaw), Math.cos(accepted.yaw - report.flight.actual.yaw)), oldPitch - report.flight.observedPitch, 1);
    const fullyLeveledAt = (Date.now() - recorder.started) / 1000;
    const duration = Math.ceil(Math.max(11.8, fullyLeveledAt + .8) * 30) / 30;
    await finishShot(page, recorder, 'studio-return-continuous', duration, before, events);
    report.flight.level = level; report.flight.fullyLeveledAt = fullyLeveledAt;
    report.flight.leveledHold = duration - fullyLeveledAt;
    const origin = await page.evaluate(() => performance.timeOrigin);
    const wheelAt = (origin + report.flight.wheels[0].at - recorder.started) / 1000;
    const prefixFrames = Math.ceil(wheelAt * 30);
    report.flight.firstWheelAt = wheelAt;
    report.flight.arrivalPrefix = prefixFrames / 30; report.flight.descentDuration = duration - prefixFrames / 30;
    await page.screenshot({ path: path.join(directory, 'leveled-three-metre-proof.png') });
    await runFFmpeg(['-i', path.join(raw, 'studio-return-continuous.mp4'), '-vf', `trim=end_frame=${prefixFrames},setpts=PTS-STARTPTS`, '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart', path.join(raw, 'studio-arrival.mp4')]);
    await runFFmpeg(['-i', path.join(raw, 'studio-return-continuous.mp4'), '-vf', `trim=start_frame=${prefixFrames},setpts=PTS-STARTPTS`, '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart', path.join(raw, 'studio-descent.mp4')]);
    const threeMetre = await camera(page);
    await page.getByRole('button', { name: 'Eye level', exact: true }).click();
    const eyeRestore = await drag(page, 0, oldPitch + .03, .25); await settled(page); await sleep(250);
    await page.mouse.move(1650, 720);
    const ground = await inventory(page);
    if (Math.hypot(ground.camera.x - threeMetre.x, ground.camera.z - threeMetre.z) > .001 || Math.abs(ground.camera.yaw - threeMetre.yaw) > .001 || ground.camera.height !== 1.68) throw new Error('Eye-level handoff changed ground position or yaw.');
    report.groundHandoff = { threeMetre, ground: ground.camera, actualEyeClick: true, pitchRestoredByRealDrag: eyeRestore, targetPitch: oldPitch, noCameraSetter: true };
    await page.screenshot({ path: path.join(directory, 'matched-ground-proof.png') });
    const groundRecorder = await startRecording(cdp, path.join(directory, 'takes/walk-card'));
    await trace(page, groundRecorder.started); await finishShot(page, groundRecorder, 'walk-card', 3.5, ground);
    if (external.length) throw new Error('External browser requests are forbidden.');
    await save();
  } catch (error) {
    await page.screenshot({ path: path.join(directory, 'return-capture-error.png') }); await save(); throw error;
  } finally { await browser.close(); }
}
