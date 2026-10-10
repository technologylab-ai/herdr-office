import { openDemo, camera, turn, sleep } from '../recording.mjs';
import { reset, goCompany, sidebar, map, lockedTurn } from './navigation.mjs';
import { directory } from './design.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

await mkdir(directory, { recursive: true });
const { page, browser } = await openDemo('http://127.0.0.1:5186');
try {
  await reset(page);
  await goCompany(page, 'Orbit Studio');
  await sidebar(page, false); await map(page, false);
  await turn(page, -Math.PI / 2);
  await page.mouse.move(960, 540);
  await page.evaluate(() => { window.__v2Mouse = { x: 960, y: 540 }; });
  await page.locator('.stage canvas').focus(); await page.keyboard.press('f');
  await page.waitForFunction(() => document.pointerLockElement?.tagName === 'CANVAS');
  const before = await camera(page);
  await page.keyboard.down('w'); await sleep(2000); await page.keyboard.up('w');
  const walk = await camera(page);
  await page.keyboard.down('Shift'); await page.keyboard.down('w'); await sleep(1300);
  await page.keyboard.up('w'); await page.keyboard.up('Shift');
  const run = await camera(page);
  const turnProof = await lockedTurn(page, -Math.PI, 1.1);
  await page.screenshot({ path: path.join(directory, 'run-preflight.png') });
  await writeFile(path.join(directory, 'run-preflight.json'), JSON.stringify({ before, walk, run, turnProof, locked: await page.evaluate(() => !!document.pointerLockElement) }, null, 2));
  console.log(JSON.stringify({ before, walk, run, turnProof }));
} finally { await browser.close(); }
