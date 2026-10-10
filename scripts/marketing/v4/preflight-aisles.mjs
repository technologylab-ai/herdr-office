import { openDemo, camera, turn, sleep } from '../recording.mjs';
import { sidebar, map, goCompany } from '../v2/navigation.mjs';
import { moveAxis } from './navigation.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve('artifacts/marketing/v4');
await mkdir(directory, { recursive: true });
const { page, browser } = await openDemo('http://127.0.0.1:5186');
const samples = [];
try {
  await page.evaluate(() => fetch('/api/demo/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout: 'campus' }) }));
  await page.waitForFunction(() => JSON.parse(document.querySelector('.stage canvas')?.dataset.agentPresence || '[]').length === 72, null, { timeout: 60_000 });
  await goCompany(page, 'Bramble Pay'); await sidebar(page, false); await map(page, false);
  await turn(page, Math.PI / 2);
  await page.locator('.stage canvas').focus();
  await moveAxis(page, 'x', -13.333333333333, 'w', false);
  await turn(page, Math.PI);
  for (const z of [31, 33, 39, 41]) {
    const current = await camera(page);
    await moveAxis(page, 'z', z, z > current.z ? 'w' : 's', false);
    await page.mouse.move(1850, 70); await sleep(200);
    await page.screenshot({ path: path.join(directory, `vertical-aisle-z${z}.png`) });
    samples.push({ z, actual: await camera(page) });
  }
  await writeFile(path.join(directory, 'vertical-aisle-preflight.json'), JSON.stringify(samples, null, 2));
  console.log(JSON.stringify(samples));
} finally { await browser.close(); }
