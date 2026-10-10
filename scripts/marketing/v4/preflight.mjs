import { openDemo, camera, turn, sleep } from '../recording.mjs';
import { sidebar, map, goCompany } from '../v2/navigation.mjs';
import { settled, moveAxis, verticalDrag, lockedLook } from './navigation.mjs';
import { deriveFloor } from '../../../src/world/layout.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve('artifacts/marketing/v4');
await mkdir(directory, { recursive: true });
const { page, browser, gpu, external } = await openDemo('http://127.0.0.1:5186');
const proof = { gpu, external };
try {
  await page.evaluate(() => fetch('/api/demo/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout: 'campus' }) }));
  await page.waitForFunction(() => {
    const value = document.querySelector('.stage canvas')?.dataset.agentPresence;
    return value && JSON.parse(value).length === 72;
  }, null, { timeout: 60_000 });
  const world = await page.evaluate(() => fetch('/api/world').then(r => r.json()));
  const plan = deriveFloor(world.connections.find(c => c.id === 'demo:studio').snapshot);
  proof.floor = { width: plan.width, depth: plan.depth, companies: plan.companies, agents: 72 };
  await sidebar(page, false); await map(page, false);
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'See this row', exact: true }).click();
  await sleep(250);
  const rowView = await camera(page), row = plan.companies.filter(c => c.z === 14);
  const targetZ = 14 + Math.max(...row.map(c => c.depth)) * .42;
  const originalPitch = -Math.atan2(rowView.height, targetZ - rowView.z);
  while (await page.getByRole('button', { name: 'Raise view 5 metres', exact: true }).isEnabled()) {
    await page.getByRole('button', { name: 'Raise view 5 metres', exact: true }).click(); await sleep(120);
  }
  await verticalDrag(page, (originalPitch + 49 * Math.PI / 180) / .003);
  await page.locator('.stage canvas').focus();
  proof.macroMoves = [];
  proof.macroMoves.push(await moveAxis(page, 'z', -20, 's', true));
  const x = (await camera(page)).x;
  proof.macroMoves.push(await moveAxis(page, 'x', 0, x < 0 ? 'a' : 'd', false));
  proof.macroView = await camera(page); proof.macroDownPitchDegrees = 49;
  await page.mouse.move(1850, 70); await sleep(200);
  await page.screenshot({ path: path.join(directory, 'whole-campus-preflight.png') });

  // Seed at the second/third-row horizontal circulation aisle, with rooms on both sides.
  await goCompany(page, 'Bramble Pay'); await sidebar(page, false); await map(page, false);
  await page.locator('.stage canvas').focus();
  proof.seed = [];
  proof.seed.push(await moveAxis(page, 'z', 49.9, 'w', true));
  await turn(page, -Math.PI / 2);
  proof.seed.push(await moveAxis(page, 'x', 3.3, 'w', false));
  await turn(page, Math.PI / 2);
  await page.mouse.move(960, 540); await page.evaluate(() => { window.__v4Mouse = { x: 960, y: 540 }; });
  await page.locator('.stage canvas').focus(); await page.keyboard.press('f');
  await page.waitForFunction(() => document.pointerLockElement?.tagName === 'CANVAS');
  await page.screenshot({ path: path.join(directory, 'interior-aisle-start-preflight.png') });
  const started = Date.now(), route = [];
  route.push(await moveAxis(page, 'x', -13.333333333333, 'w', true));
  await lockedLook(page, Math.PI, 1.2);
  route.push(await moveAxis(page, 'z', 69.1, 'w', true));
  await lockedLook(page, -Math.PI / 2, 1.2);
  const basalt = plan.companies.find(c => c.name === 'Basalt Ledger');
  const desk = plan.desks.find(d => d.workspaceId === basalt.id);
  route.push(await moveAxis(page, 'x', desk.x - 1, 'w', true));
  await lockedLook(page, Math.PI, 1.2);
  route.push(await moveAxis(page, 'z', desk.z - 1.2, 'w', false));
  proof.run = { route, secondsToOffice: (Date.now() - started) / 1000, view: await camera(page), destination: basalt.name, desk: desk.pane.pane_id };
  await page.screenshot({ path: path.join(directory, 'inside-office-preflight.png') });
  await writeFile(path.join(directory, 'preflight-proof.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify({ macro: proof.macroView, floor: { companies: plan.companies.length, rows: 6, width: plan.width, depth: plan.depth }, run: proof.run }));
} catch (error) {
  await page.screenshot({ path: path.join(directory, 'preflight-error.png') });
  await writeFile(path.join(directory, 'preflight-error-proof.json'), JSON.stringify(proof, null, 2));
  throw error;
} finally { await browser.close(); }
