import { openDemo, camera, sleep } from '../recording.mjs';
import { openRelease, sidebar, map, frontOfDesk, closeDesk, widen } from '../v2/navigation.mjs';
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
  await openRelease(page); await sidebar(page, false); await map(page, false);
  await frontOfDesk(page, { leftFrame: true });
  await closeDesk(page); await sleep(250);
  proof.beforeHumanClick = await camera(page);
  await page.screenshot({ path: path.join(directory, 'human-before-click-preflight.png') });
  await page.mouse.click(470, 465);
  await page.getByRole('complementary', { name: 'Desk: Check release notes', exact: true }).waitFor({ state: 'visible', timeout: 5000 });
  await sleep(250); proof.afterHumanClick = await camera(page);
  proof.cameraDelta = Math.hypot(proof.beforeHumanClick.x - proof.afterHumanClick.x, proof.beforeHumanClick.z - proof.afterHumanClick.z);
  if (proof.cameraDelta > .02) throw new Error('Selecting the actual person moved the camera.');
  await widen(page, 960);
  await page.getByRole('button', { name: 'Larger terminal text', exact: true }).click({ clickCount: 11, delay: 65 });
  await page.evaluate(() => fetch('/api/demo/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectionId: 'demo:studio', paneId: 'demo-w1:p1', scenario: 'release-review' }) }));
  await sleep(15_000);
  const prompt = page.getByRole('textbox', { name: /^Prompt for/ });
  await prompt.waitFor({ state: 'visible' });
  await prompt.fill('Add migration and rollback notes first.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await sleep(8500);
  proof.terminal = await page.getByRole('region', { name: 'Terminal output' }).locator('pre').evaluate(el => ({
    font: getComputedStyle(el).fontSize, text: el.textContent,
    scrollHeight: el.parentElement.scrollHeight, clientHeight: el.parentElement.clientHeight,
    width: document.querySelector('.drawer').getBoundingClientRect().width,
  }));
  await page.mouse.move(1850, 70);
  await page.screenshot({ path: path.join(directory, 'font24-person-open-preflight.png') });
  if (proof.terminal.font !== '24px' || proof.terminal.width !== 960 || proof.terminal.scrollHeight > proof.terminal.clientHeight + 1) throw new Error('Actual24px terminal output does not fit.');
  await writeFile(path.join(directory, 'human-click-font24-proof.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
} catch (error) {
  await page.screenshot({ path: path.join(directory, 'human-click-error.png') });
  throw error;
} finally { await browser.close(); }
