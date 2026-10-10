/** A short real map visit plus an edited real standing-agent view; preserves the 40-second grid. */
import { openDemo, startRecording, encode, camera, turn, sleep, outputRoot } from './recording.mjs';
import { installOverlays, caption } from './overlays.mjs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const input = path.resolve(process.argv[2] || path.join(outputRoot, 'herdr-office-picture-final.mp4'));
const output = path.join(outputRoot, 'herdr-office-picture-reviewed.mp4');
const { page, browser, cdp } = await openDemo('http://127.0.0.1:5186');

async function run(args) {
  await new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
  });
}

try {
  await page.evaluate(() => fetch('/api/demo/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }));
  await page.getByRole('combobox', { name: 'Floor', exact: true }).selectOption('demo:studio');
  await sleep(600);
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await installOverlays(page);
  const target = page.getByRole('link', { name: /^Map: visit Migrate orders schema/ });
  await target.hover();
  const box = await target.locator('.mm-person__dot').boundingBox();
  const mapRecording = await startRecording(cdp, path.join(outputRoot, 'standing-map-take'));
  await mapRecording.at(.2);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await mapRecording.at(.3);
  await caption(page, 'Agents that need you stand beside their desks.', { maxWidth: 800 });
  await mapRecording.at(.8);
  const mapFrames = await mapRecording.finish(.8);
  await encode(mapFrames.concat, path.join(outputRoot, 'standing-map.mp4'), 1920, 1080, .8, false);

  await sleep(250);
  const arrival = await camera(page);
  const desk = { x: arrival.x - 1.35, z: arrival.z - 1.7 };
  const front = { x: desk.x + .2, z: desk.z - 1.3 };
  const dx = front.x - arrival.x, dz = front.z - arrival.z;
  await turn(page, Math.atan2(-dx, -dz));
  await page.mouse.move(700, 520);
  await page.mouse.wheel(0, -Math.hypot(dx, dz) / .025);
  await page.waitForFunction(front => {
    const canvas = document.querySelector('.stage canvas');
    const view = JSON.parse(canvas.dataset.officeView);
    return Math.hypot(view.x - front.x, view.z - front.z) < .06 && !JSON.parse(canvas.dataset.officeTiming).moving;
  }, front, { polling: 50, timeout: 5000 });
  const position = await camera(page);
  await turn(page, Math.atan2(-(desk.x + 1.2 - position.x), -(desk.z + .65 - position.z)));
  await page.mouse.move(1590, 75);
  await sleep(250);
  await page.screenshot({ path: path.join(outputRoot, 'standing-shot.png') });
  const bodyRecording = await startRecording(cdp, path.join(outputRoot, 'standing-body-take'));
  await bodyRecording.at(.3);
  await page.mouse.move(750, 650);
  await page.mouse.wheel(0, 14);
  await bodyRecording.at(4.2);
  const bodyFrames = await bodyRecording.finish(4.2);
  await encode(bodyFrames.concat, path.join(outputRoot, 'standing-body.mp4'), 1920, 1080, 4.2, false);

  // Actual interactions before 12.5 and from 17.5 onwards keep their original time and order.
  const graph = '[0:v]trim=start=0:end=12.5,setpts=PTS-STARTPTS[prefix];'
    + '[1:v]setpts=PTS-STARTPTS[map];[2:v]setpts=PTS-STARTPTS[body];'
    + '[0:v]trim=start=17.5:end=40,setpts=PTS-STARTPTS[suffix];'
    + '[prefix][map][body][suffix]concat=n=4:v=1:a=0,format=yuv420p[v]';
  await run(['-i', input, '-i', path.join(outputRoot, 'standing-map.mp4'), '-i', path.join(outputRoot, 'standing-body.mp4'),
    '-filter_complex', graph, '-map', '[v]', '-an', '-t', '40', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart', output]);
  console.log(`REVIEWED ${output}`);
} finally { await browser.close(); }
