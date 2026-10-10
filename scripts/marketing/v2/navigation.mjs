import { camera, turn, sleep } from '../recording.mjs';

export async function reset(page) {
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/demo/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    return { ok: response.ok, value: await response.json() };
  });
  if (!result.ok || !result.value.demo) throw new Error('Synthetic demo reset failed.');
  await sleep(250);
}

export async function sidebar(page, open) {
  const button = page.getByRole('button', { name: open ? 'Show directory' : 'Hide directory', exact: true });
  if (await button.isVisible()) await button.click();
  await sleep(120);
}

export async function map(page, open) {
  const shown = await page.getByRole('button', { name: 'Hide floor map', exact: true }).isVisible();
  if (shown !== open) { await page.locator('.stage canvas').focus(); await page.keyboard.press('m'); }
  await sleep(100);
}

export async function closeDesk(page) {
  const close = page.getByRole('button', { name: 'Close desk panel', exact: true });
  if (await close.isVisible()) await close.click();
  await sleep(120);
}

export async function goCompany(page, name) {
  await page.keyboard.press('Escape');
  await closeDesk(page);
  await sidebar(page, true);
  await page.getByRole('tab', { name: 'Directory', exact: true }).click();
  await page.getByRole('button', { name: 'Eye level', exact: true }).click();
  await page.locator('#directory').getByTitle(`Go to ${name}`, { exact: true }).click();
  await sleep(250);
}

export async function openRelease(page) {
  await sidebar(page, true);
  await page.getByRole('tab', { name: /^Roster/ }).click();
  await page.getByRole('searchbox', { name: 'Search roster' }).fill('release');
  await page.locator('.roster__list .person').filter({ hasText: 'Check release notes' }).click();
  await sleep(250);
}

/** Reposition via actual wheel and drag, accounting for device-pixel wheel input. */
export async function frontOfDesk(page, { standing = false, leftFrame = false } = {}) {
  await sleep(220);
  const arrival = await camera(page);
  const desk = { x: arrival.x - 1.35, z: arrival.z - 1.7 };
  const target = { x: desk.x + (standing ? .2 : -1), z: desk.z + (standing ? -1.3 : -1.2) };
  const dx = target.x - arrival.x, dz = target.z - arrival.z;
  await turn(page, Math.atan2(-dx, -dz));
  await page.mouse.move(650, 520);
  await page.mouse.wheel(0, -Math.hypot(dx, dz) / .025 * await page.evaluate(() => devicePixelRatio));
  await page.waitForFunction(target => {
    const canvas = document.querySelector('.stage canvas');
    const view = JSON.parse(canvas.dataset.officeView);
    return Math.hypot(view.x - target.x, view.z - target.z) < .06 && !JSON.parse(canvas.dataset.officeTiming).moving;
  }, target, { polling: 50, timeout: 6000 });
  const position = await camera(page);
  const headYaw = Math.atan2(-(desk.x + (standing ? 1.2 : 0) - position.x), -(desk.z + .65 - position.z));
  await turn(page, headYaw - (leftFrame ? .55 : 0));
  await sleep(200);
  return { arrival, target, position, headYaw, actual: await camera(page) };
}

export async function widen(page, width) {
  const grip = page.getByRole('separator', { name: 'Resize desk panel' });
  const box = await grip.boundingBox();
  const current = Number(await grip.getAttribute('aria-valuenow'));
  const x = box.x + box.width / 2, y = box.y + 230;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x - width + current, y, { steps: 12 }); await page.mouse.up();
}

export async function lockedTurn(page, yaw, seconds = 1) {
  const before = await camera(page);
  const angle = Math.atan2(Math.sin(yaw - before.yaw), Math.cos(yaw - before.yaw));
  // PointerLockControls consumes real mouse movement at 0.002 radians per pixel.
  const mouse = page.mouse;
  const initial = await page.evaluate(() => window.__v2Mouse ?? { x: 960, y: 540 });
  const dx = -angle / .002;
  const steps = Math.ceil(seconds * 30);
  const started = Date.now();
  for (let index = 1; index <= steps; index++) {
    await mouse.move(initial.x + dx * index / steps, initial.y);
    await sleep(Math.max(0, seconds * 1000 * index / steps - (Date.now() - started)));
  }
  await page.evaluate(point => { window.__v2Mouse = point; }, { x: initial.x + dx, y: initial.y });
  await sleep(120);
  const after = await camera(page);
  const error = Math.abs(Math.atan2(Math.sin(after.yaw - yaw), Math.cos(after.yaw - yaw)));
  if (error > .04) throw new Error(`Pointer-locked look did not turn the actual camera: ${JSON.stringify({ before, after, yaw, error })}`);
  return { before, after, yaw, error };
}
