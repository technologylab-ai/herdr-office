/** Only the corner-running replacement for v3; v2 footage is never written. */
import { openDemo, startRecording, encode, camera, turn, sleep } from '../recording.mjs';
import { installAnnotations, annotate } from '../v2/design.mjs';
import { goCompany, sidebar, map } from '../v2/navigation.mjs';
import { deriveFloor } from '../../../src/world/layout.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve('artifacts/marketing/v3');
const preflight = process.argv[2] === 'preflight';
await mkdir(directory, { recursive: true });
const info = await fetch('http://127.0.0.1:5186/api/demo/info').then(response => response.json());
if (info.demo !== true || info.isolated !== true) throw new Error('The server is not the isolated fictional demo.');
await fetch('http://127.0.0.1:5186/api/demo/reset', { method: 'POST', headers: {
  Origin: 'http://127.0.0.1:5186', 'Content-Type': 'application/json',
}, body: JSON.stringify({ layout: 'base' }) });
const { page, browser, cdp, gpu, external } = await openDemo('http://127.0.0.1:5186');
const proof = { gpu, external, samples: [], keys: [], turns: [], movement: [], targetTolerance: .15 };
let started;

async function settledView() {
  // An actual Shift press wakes the renderer promptly; it does not move or set the camera.
  await page.keyboard.press('Shift');
  await page.waitForFunction(() => {
    const value = document.querySelector('.stage canvas')?.dataset.officeTiming;
    return value && !JSON.parse(value).moving;
  }, null, { polling: 20, timeout: 1500 });
  return camera(page);
}

async function sample(phase) {
  const view = await camera(page);
  proof.samples.push({ phase, seconds: (Date.now() - started) / 1000, view,
    locked: await page.evaluate(() => document.pointerLockElement?.tagName === 'CANVAS') });
  return view;
}

function correctionDuration(distance) {
  // Actual walk acceleration is a 0.1 s exponential approach to 6 m/s.
  let low = 0, high = 1;
  for (let index = 0; index < 24; index++) {
    const t = (low + high) / 2;
    if (6 * (t - .1 * (1 - Math.exp(-t / .1))) < distance) low = t; else high = t;
  }
  return (low + high) / 2 + .012;
}

async function toTarget(axis, target, sign, fast, name) {
  const before = await camera(page), time = Date.now();
  if (fast) await page.keyboard.down('Shift');
  await page.keyboard.down('w');
  const buffer = fast ? .98 : .42;
  while (sign * (target - (await camera(page))[axis]) > buffer) {
    if (Date.now() - time > 6000) throw new Error(`The real walk did not approach ${name}`);
    await sleep(20);
  }
  await page.keyboard.up('w'); if (fast) await page.keyboard.up('Shift');
  let actual = await settledView(), corrections = 0;
  while (Math.abs(target - actual[axis]) > .15 && corrections < 3) {
    const remaining = sign * (target - actual[axis]);
    const key = remaining > 0 ? 'w' : 's';
    await page.keyboard.down(key); await sleep(Math.min(.34, correctionDuration(Math.abs(remaining))) * 1000); await page.keyboard.up(key);
    actual = await settledView(); corrections++;
  }
  proof.movement.push({ name, axis, target, before, after: actual, fast, corrections,
    seconds: (Date.now() - time) / 1000, error: Math.abs(target - actual[axis]) });
  if (Math.abs(target - actual[axis]) > .15) throw new Error(`${name} missed the actual target: ${JSON.stringify(actual)}`);
  return sample(name);
}

async function corner(yaw, name) {
  const before = await camera(page);
  const angle = Math.atan2(Math.sin(yaw - before.yaw), Math.cos(yaw - before.yaw));
  const initial = await page.evaluate(() => window.__v2Mouse);
  const dx = -angle / .002, turnStarted = Date.now(), steps = 36;
  for (let index = 1; index <= steps; index++) {
    await page.mouse.move(initial.x + dx * index / steps, initial.y);
    await sleep(Math.max(0, 1200 * index / steps - (Date.now() - turnStarted)));
  }
  await page.evaluate(point => { window.__v2Mouse = point; }, { x: initial.x + dx, y: initial.y });
  await page.waitForFunction(yaw => {
    const data = document.querySelector('.stage canvas')?.dataset.officeView;
    if (!data) return false;
    const actual = JSON.parse(data).yaw;
    return Math.abs(Math.atan2(Math.sin(actual - yaw), Math.cos(actual - yaw))) < .025;
  }, yaw, { polling: 20, timeout: 1000 });
  const after = await camera(page);
  const turnProof = { before, after, yaw, error: Math.abs(Math.atan2(Math.sin(after.yaw - yaw), Math.cos(after.yaw - yaw))), duration: (Date.now() - turnStarted) / 1000 };
  proof.turns.push({ name, seconds: (Date.now() - started) / 1000, ...turnProof });
  await sample(name);
}

try {
  // Let the base floor render first so the original twelve avatar appearances remain stable.
  const reset = await page.evaluate(async () => {
    const response = await fetch('/api/demo/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout: 'multi-lane' }) });
    return { ok: response.ok, body: await response.json() };
  });
  if (!reset.ok) throw new Error('The isolated multi-lane fixture is not ready.');
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.stage canvas');
    return canvas?.dataset.agentPresence && JSON.parse(canvas.dataset.agentPresence).length === 24;
  }, null, { timeout: 30_000 });
  const world = await page.evaluate(() => fetch('/api/world').then(response => response.json()));
  const plan = deriveFloor(world.connections.find(c => c.id === 'demo:studio').snapshot);
  const signal = plan.companies.find(c => c.name === 'Signal Lab');
  const bramble = plan.companies.find(c => c.name === 'Bramble Pay');
  if (!signal || !bramble || plan.companies.length !== 6) throw new Error('The required six-company floor is missing.');
  const row1 = plan.companies.filter(c => c.z === signal.z);
  const crossX = signal.x + signal.width + 5;
  const laneZ = (Math.max(...row1.map(c => c.z + c.depth)) + bramble.z) / 2;
  const endX = bramble.x + bramble.width / 2;
  proof.floor = { width: plan.width, depth: plan.depth, companies: plan.companies.map(c => ({ id: c.id, name: c.name, x: c.x, z: c.z, width: c.width, depth: c.depth })) };
  proof.route = { crossX, laneZ, endX, startCompany: signal.name, endCompany: bramble.name };
  await installAnnotations(page);
  await goCompany(page, 'Signal Lab'); await sidebar(page, false); await map(page, false);
  // The department side panels begin at z18.0; use the actual open front aisle instead.
  await page.mouse.move(960, 640); await page.mouse.wheel(0, 80);
  await page.waitForFunction(() => {
    const data = document.querySelector('.stage canvas')?.dataset.officeView;
    return data && Math.abs(JSON.parse(data).z - 16.6) < .06;
  }, null, { polling: 20, timeout: 4000 });
  await settledView();
  await turn(page, -Math.PI / 2);
  await page.mouse.move(960, 540); await page.evaluate(() => { window.__v2Mouse = { x: 960, y: 540 }; });
  await annotate(page, 'Walk the floor. Hold Shift to run between projects.');
  await page.exposeFunction('v3Keys', value => proof.keys.push(value));
  await page.evaluate(() => {
    const capture = event => { if (/^(Key[WASDF]|ShiftLeft|Escape)$/.test(event.code)) window.v3Keys({ type: event.type, code: event.code, at: Date.now() }); };
    document.addEventListener('keydown', capture); document.addEventListener('keyup', capture);
  });

  const recorder = preflight ? null : await startRecording(cdp, path.join(directory, 'take'));
  started = recorder?.started ?? Date.now();
  await page.locator('.stage canvas').focus(); await page.keyboard.press('f');
  await page.waitForFunction(() => document.pointerLockElement?.tagName === 'CANVAS');
  await sample('Signal Lab, first lane');
  if ((await camera(page)).z >= 18) throw new Error('The actual starting position clips the department side panel.');
  await toTarget('x', crossX, 1, false, 'Right-hand cross aisle');
  await corner(-Math.PI, 'First corridor corner, toward the second lane');
  await toTarget('z', laneZ, 1, true, 'Between-row lane');
  await corner(-3 * Math.PI / 2, 'Second corridor corner, along the new lane');
  await toTarget('x', endX, -1, true, 'Bramble Pay in the second lane');
  await corner(-Math.PI, 'Face Bramble Pay');
  await page.screenshot({ path: path.join(directory, 'second-lane-proof.png') });
  const arrivalSeconds = (Date.now() - started) / 1000;
  proof.arrivalSeconds = arrivalSeconds;
  proof.finalHoldSeconds = 13 - arrivalSeconds;
  if (proof.finalHoldSeconds < 2) throw new Error(`The real corridor turns need a longer clip: final hold ${proof.finalHoldSeconds.toFixed(2)}s`);
  if (recorder) {
    await recorder.at(13);
    await sample('Final second-lane company hold, at the captured film boundary');
    const recording = await recorder.finish(13);
    proof.frames = recording.frames;
    await encode(recording.concat, path.join(directory, 'run.mp4'), 1920, 1080, 13, false);
  } else {
    await sleep(Math.max(0, 13000 - (Date.now() - started)));
    await sample('Final second-lane company hold, at the preflight boundary');
  }
  await writeFile(path.join(directory, preflight ? 'preflight-proof.json' : 'run-proof.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify({ duration: 13, arrivalSeconds, holdSeconds: proof.finalHoldSeconds, route: proof.route, movement: proof.movement, turns: proof.turns.map(t => ({ name: t.name, error: t.error })) }));
} catch (error) {
  await page.screenshot({ path: path.join(directory, 'capture-error.png') });
  await writeFile(path.join(directory, 'capture-error-proof.json'), JSON.stringify(proof, null, 2));
  throw error;
} finally { await browser.close(); }
