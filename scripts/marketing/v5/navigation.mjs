/** V4 camera work uses only the app's actual mouse and keyboard controls. */
import { camera, sleep } from '../recording.mjs';

export async function settled(page) {
  await page.keyboard.press('Shift');
  await page.waitForFunction(() => {
    const value = document.querySelector('.stage canvas')?.dataset.officeTiming;
    return value && !JSON.parse(value).moving;
  }, null, { polling: 20, timeout: 2500 });
  return camera(page);
}

export async function moveAxis(page, axis, target, direction, fast = false, tolerance = .15, walkBeforeFast = 0) {
  const initial = await camera(page), started = Date.now();
  let shifting = fast && !walkBeforeFast;
  if (shifting) await page.keyboard.down('Shift');
  await page.keyboard.down(direction);
  const sign = target > initial[axis] ? 1 : -1;
  while (sign * (target - (await camera(page))[axis]) > (shifting ? .9 : .4)) {
    if (fast && !shifting && Date.now() - started >= walkBeforeFast * 1000) { await page.keyboard.down('Shift'); shifting = true; }
    if (Date.now() - started > 10_000) throw new Error(`Actual movement toward ${axis}=${target} did not finish.`);
    await sleep(20);
  }
  await page.keyboard.up(direction); if (shifting) await page.keyboard.up('Shift');
  let actual = await settled(page), corrections = 0;
  while (Math.abs(target - actual[axis]) > tolerance && corrections < 4) {
    const same = sign * (target - actual[axis]) > 0;
    const inverse = { w: 's', s: 'w', a: 'd', d: 'a' }[direction];
    const key = same ? direction : inverse, distance = Math.abs(target - actual[axis]);
    let low = 0, high = .6;
    for (let i = 0; i < 22; i++) {
      const t = (low + high) / 2;
      if (6 * (t - .1 * (1 - Math.exp(-t / .1))) < distance) low = t; else high = t;
    }
    await page.keyboard.down(key); await sleep(Math.min(.5, (low + high) / 2 + .012) * 1000); await page.keyboard.up(key);
    actual = await settled(page); corrections++;
  }
  if (Math.abs(target - actual[axis]) > tolerance) throw new Error(`Actual ${axis} target missed: ${JSON.stringify({ target, actual })}`);
  return { initial, actual, target, axis, direction, fast, corrections, seconds: (Date.now() - started) / 1000 };
}

export async function verticalDrag(page, delta) {
  await page.mouse.move(820, 420); await page.mouse.down();
  await page.mouse.move(820, 420 + delta, { steps: 18 }); await page.mouse.up();
  await sleep(160);
}

export async function lockedLook(page, yaw, seconds = 1.2) {
  const initialView = await camera(page), started = Date.now();
  const angle = Math.atan2(Math.sin(yaw - initialView.yaw), Math.cos(yaw - initialView.yaw));
  const point = await page.evaluate(() => window.__v4Mouse ?? { x: 960, y: 540 });
  const dx = -angle / .002, steps = Math.ceil(seconds * 30);
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(point.x + dx * i / steps, point.y);
    await sleep(Math.max(0, seconds * 1000 * i / steps - (Date.now() - started)));
  }
  await page.evaluate(point => { window.__v4Mouse = point; }, { x: point.x + dx, y: point.y });
  await page.waitForFunction(yaw => {
    const view = document.querySelector('.stage canvas')?.dataset.officeView;
    return view && Math.abs(Math.atan2(Math.sin(JSON.parse(view).yaw - yaw), Math.cos(JSON.parse(view).yaw - yaw))) < .025;
  }, yaw, { polling: 20, timeout: 2000 });
  return { initialView, finalView: await camera(page), seconds: (Date.now() - started) / 1000 };
}
