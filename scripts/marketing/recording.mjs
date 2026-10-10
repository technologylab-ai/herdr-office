/** Isolated Chrome recording helpers. Never connect this to a live bridge. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const outputRoot = path.resolve('artifacts/marketing');

export async function openDemo(url, viewport = { width: 1920, height: 1080 }, deviceScaleFactor = 1) {
  const origin = new URL(url);
  if (origin.hostname !== '127.0.0.1' || origin.port !== '5186') {
    throw new Error('Recording is restricted to the isolated synthetic demo at 127.0.0.1:5186.');
  }
  const info = await fetch(new URL('/api/demo/info', origin)).then(response => response.json());
  if (info.demo !== true || info.isolated !== true) throw new Error('The server is not an isolated synthetic demo.');
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'],
  });
  const context = await browser.newContext({ viewport, deviceScaleFactor });
  const page = await context.newPage();
  const external = [];
  // This server never proxies the user's bridge. Also prohibit accidental remote requests.
  await context.route('**/*', async route => {
    const request = new URL(route.request().url());
    if (request.protocol === 'data:' || request.origin === origin.origin) return route.continue();
    external.push(request.origin);
    return route.abort();
  });
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('herdr-office:view-mode', 'overview');
    localStorage.setItem('herdr-office:connection', 'demo:studio');
    localStorage.setItem('herdr-office:hints-hidden', 'true');
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Walk in', exact: true }).waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const button = document.querySelector('button[aria-label="Walk in"]');
    return button && !button.disabled;
  }, null, { timeout: 60000 });
  const cdp = await context.newCDPSession(page);
  const gpu = await page.evaluate(() => {
    const canvas = document.querySelector('.stage canvas');
    const gl = canvas.getContext('webgl2');
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    return gl.getParameter(extension.UNMASKED_RENDERER_WEBGL);
  });
  if (/SwiftShader|llvmpipe/i.test(gpu)) throw new Error(`Hardware rendering required for marketing capture: ${gpu}`);
  console.log(JSON.stringify({ event: 'hardware-ready', gpu, viewport }));
  return { browser, context, page, cdp, external, gpu };
}

/** Capture actual paint events and preserve their timing; idle repeats become normal video frames. */
export async function startRecording(cdp, directory, width = 1920, height = 1080) {
  await mkdir(directory, { recursive: true });
  const frames = [];
  let active = true;
  const onFrame = event => {
    void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId });
    if (active) frames.push({ bytes: Buffer.from(event.data, 'base64'), time: event.metadata.timestamp });
  };
  cdp.on('Page.screencastFrame', onFrame);
  await cdp.send('Page.startScreencast', {
    format: 'jpeg', quality: 96, maxWidth: width, maxHeight: height, everyNthFrame: 1,
  });
  const started = Date.now();
  return {
    started,
    async at(seconds) { await sleep(Math.max(0, seconds * 1000 - (Date.now() - started))); },
    async finish(duration = 40) {
      active = false;
      await cdp.send('Page.stopScreencast');
      cdp.off('Page.screencastFrame', onFrame);
      if (frames.length < 2) throw new Error('Chrome did not produce screencast frames.');
      const writes = [];
      const lines = [];
      for (let index = 0; index < frames.length; index++) {
        const filename = `frame-${String(index).padStart(6, '0')}.jpg`;
        writes.push(writeFile(path.join(directory, filename), frames[index].bytes));
        lines.push(`file '${filename}'`);
        const next = frames[index + 1];
        const elapsed = frames[index].time - frames[0].time;
        const frameDuration = next ? next.time - frames[index].time : duration - elapsed;
        lines.push(`duration ${Math.max(.001, frameDuration).toFixed(6)}`);
      }
      lines.push(`file 'frame-${String(frames.length - 1).padStart(6, '0')}.jpg'`);
      await Promise.all(writes);
      await writeFile(path.join(directory, 'frames.ffconcat'), `ffconcat version 1.0\n${lines.join('\n')}\n`);
      console.log(JSON.stringify({ event: 'recorded', frames: frames.length, duration }));
      return { frames: frames.length, concat: path.join(directory, 'frames.ffconcat') };
    },
  };
}

export async function encode(concat, output, width = 1920, height = 1080, duration = 40, fades = true) {
  const filter = `fps=30,scale=${width}:${height}:flags=lanczos:in_range=full:out_range=limited:out_color_matrix=bt709,format=yuv420p`
    + (fades ? `,fade=t=in:st=0:d=0.5,fade=t=out:st=${duration - .3}:d=0.3` : '');
  const args = ['-y', '-hide_banner', '-loglevel', 'warning', '-f', 'concat', '-safe', '0', '-i', concat,
    '-t', String(duration), '-vf', filter,
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-color_range', 'tv',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', output];
  await new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
  });
}

/** Claude-approved editorial end card: actual frame, short dissolve, readable hold. */
export async function holdEndCard(input, output) {
  const still = path.join(path.dirname(output), 'endcard.png');
  const run = args => new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
  });
  await run(['-ss', '39', '-i', input, '-frames:v', '1', '-update', '1', still]);
  const graph = '[0:v]trim=end=37.8,setpts=PTS-STARTPTS,fps=30,format=yuv420p[a];'
    + '[1:v]scale=1920:1080:in_range=full:out_range=limited:out_color_matrix=bt709,format=yuv420p,setpts=PTS-STARTPTS[b];'
    + '[a][b]xfade=transition=fade:duration=0.3:offset=37.5,fade=t=out:st=39.7:d=0.3,format=yuv420p[v]';
  await run(['-i', input, '-loop', '1', '-framerate', '30', '-t', '2.5', '-i', still,
    '-filter_complex', graph, '-map', '[v]', '-an', '-t', '40', '-c:v', 'libx264', '-preset', 'medium',
    '-crf', '18', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart', output]);
}

export async function camera(page) {
  return page.locator('.stage canvas').evaluate(canvas => JSON.parse(canvas.dataset.officeView));
}

export async function turn(page, yaw, pitchDelta = 0) {
  const current = await camera(page);
  const angle = Math.atan2(Math.sin(yaw - current.yaw), Math.cos(yaw - current.yaw));
  let remaining = -angle / .003;
  const bounds = await page.evaluate(() => {
    let left = 35, right = innerWidth - 35;
    for (const selector of ['.sidebar', '.drawer', '.minimap']) {
      const element = document.querySelector(selector);
      if (!element) continue;
      const box = element.getBoundingClientRect();
      if (selector === '.sidebar') left = Math.max(left, box.right + 25);
      else right = Math.min(right, box.left - 25);
    }
    return { left, right };
  });
  while (Math.abs(remaining) > .05) {
    const dx = Math.sign(remaining) * Math.min(Math.abs(remaining), bounds.right - bounds.left - 10);
    const start = dx < 0 ? bounds.right : bounds.left;
    await page.mouse.move(start, 470);
    await page.mouse.down();
    await page.mouse.move(start + dx, 470 + (Math.abs(remaining - dx) < .05 ? pitchDelta : 0), { steps: 8 });
    await page.mouse.up();
    remaining -= dx;
  }
  await sleep(80);
}

export async function moveCursor(page, x, y, steps = 16) {
  await page.mouse.move(x, y, { steps });
}

export async function click(page, locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Capture action is not visible.');
  await moveCursor(page, box.x + box.width / 2, box.y + box.height / 2);
  await sleep(160);
  await locator.click();
}
