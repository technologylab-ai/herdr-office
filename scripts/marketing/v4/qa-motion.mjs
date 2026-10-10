/** Offline QA of every decoded frame. Scores locate suspects; they do not certify camera semantics. */
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { sequence } from './plan.mjs';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  all: { type: 'boolean' },
  'self-test': { type: 'boolean' },
  window: { type: 'string', multiple: true },
  output: { type: 'string' },
} });
const directory = path.resolve('artifacts/marketing/v4');
const output = path.resolve(values.output || path.join(directory, 'qa-motion'));
await mkdir(output, { recursive: true });
const WIDTH = 320, HEIGHT = 180, BYTES = WIDTH * HEIGHT;
const regions = {
  full: [0, 0, WIDTH, HEIGHT],
  left: [13, 36, 138, 119],
  middle: [77, 45, 166, 103],
  right: [166, 36, 141, 119],
};

async function execute(program, args) {
  return new Promise((resolve, reject) => {
    let stdout = '', stderr = '';
    const child = spawn(program, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-6000); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(`${program} failed (${code}): ${stderr}`)));
  });
}
function difference(a, b, [x, y, width, height]) {
  let total = 0;
  for (let row = y; row < y + height; row++) {
    const start = row * WIDTH + x;
    for (let column = 0; column < width; column++) total += Math.abs(a[start + column] - b[start + column]);
  }
  return total / (width * height);
}
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
}
async function scan(file) {
  const info = JSON.parse(await execute('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_streams', '-show_format', '-of', 'json', file]));
  const stream = info.streams[0];
  const [num, den] = stream.avg_frame_rate.split('/').map(Number);
  const fps = num / den;
  if (Math.abs(fps - 30) > .02) throw new Error('Motion QA expects the native 30fps production clip; do not subsample selection windows.');
  const frames = [], flashes = [], ring = [];
  await new Promise((resolve, reject) => {
    let pending = Buffer.alloc(0), stderr = '';
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-map', '0:v:0',
      '-vf', `scale=${WIDTH}:${HEIGHT}:flags=area,format=gray`, '-fps_mode', 'passthrough', '-an', '-f', 'rawvideo', 'pipe:1'],
    { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => {
      pending = Buffer.concat([pending, chunk]);
      while (pending.length >= BYTES) {
        const current = pending.subarray(0, BYTES); pending = pending.subarray(BYTES);
        const index = frames.length, previous = ring.at(-1);
        const entry = { frame: index, seconds: index / fps, delta: {} };
        for (const [name, region] of Object.entries(regions)) entry.delta[name] = previous ? difference(previous, current, region) : 0;
        frames.push(entry);
        // A wrong view lasting one to three frames produces an entry and exit
        // jump, followed by a frame resembling the original view.
        for (let length = 1; length <= 3; length++) {
          const before = ring.at(-(length + 1));
          const enter = frames[index - length];
          if (!before || !enter) continue;
          for (const [name, region] of Object.entries(regions)) {
            const entryDelta = enter.delta[name], exitDelta = entry.delta[name];
            if (entryDelta < 5 || exitDelta < 5) continue;
            const returnDelta = difference(before, current, region);
            if (returnDelta < Math.min(entryDelta, exitDelta) * .35) flashes.push({
              startFrame: index - length, endFrame: index - 1, frameCount: length,
              seconds: (index - length) / fps, region: name,
              entryDelta, exitDelta, returnDelta,
            });
          }
        }
        ring.push(current); if (ring.length > 5) ring.shift();
      }
    });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-6000); });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0 || pending.length) reject(new Error(`Full-frame decode failed (${code}, remainder ${pending.length}): ${stderr}`));
      else resolve();
    });
  });
  const transitions = [], summary = {};
  for (const name of Object.keys(regions)) {
    const deltas = frames.slice(1).map(frame => frame.delta[name]);
    const typical = median(deltas);
    const deviation = median(deltas.map(value => Math.abs(value - typical)));
    const threshold = Math.max(4, typical + 8 * Math.max(.1, deviation));
    summary[name] = { median: typical, medianAbsoluteDeviation: deviation, candidateThreshold: threshold, maximum: Math.max(0, ...deltas) };
    for (const frame of frames) if (frame.delta[name] >= threshold) transitions.push({ frame: frame.frame, seconds: frame.seconds, region: name, delta: frame.delta[name] });
  }
  const result = {
    clip: path.basename(file), sha256: createHash('sha256').update(await readFile(file)).digest('hex'),
    nativeFps: fps, decodedFrames: frames.length, duration: Number(info.format.duration),
    analysisResolution: [WIDTH, HEIGHT], summary, possibleOneToThreeFrameFlashes: flashes,
    abruptTransitionCandidates: transitions, frames,
    semanticAcceptance: 'requires frame-window and camera-telemetry review; empty scores alone are not a pass',
  };
  await writeFile(path.join(output, `${path.basename(file).replace(/\.[^.]+$/, '')}-motion.json`), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ clip: result.clip, decodedFrames: frames.length, flashCandidates: flashes.length, abruptCandidates: transitions.length }));
  return result;
}

async function denseWindow(file, from, to, label) {
  if (!(from >= 0 && to > from)) throw new Error('Window must be LABEL:START:END, in clip-local seconds.');
  const folder = path.join(output, `window-${label.replace(/[^a-zA-Z0-9_-]/g, '_')}`);
  await mkdir(folder, { recursive: true });
  // Every frame is retained. The JSON index gives each tile's native frame/time,
  // including on FFmpeg builds without drawtext/font support.
  const filter = `select='gte(t,${from})*lt(t,${to})',scale=480:270,tile=4x4:nb_frames=16:padding=4:margin=4`;
  await execute('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', file, '-vf', filter,
    '-fps_mode', 'passthrough', '-an', path.join(folder, 'sheet-%03d.png')]);
  const firstFrame = Math.ceil(from * 30), endFrame = Math.ceil(to * 30);
  const tiles = Array.from({ length: endFrame - firstFrame }, (_, index) => ({
    sheet: `sheet-${String(Math.floor(index / 16) + 1).padStart(3, '0')}.png`,
    row: Math.floor(index % 16 / 4), column: index % 4,
    nativeFrame: firstFrame + index, seconds: (firstFrame + index) / 30,
  }));
  await writeFile(path.join(folder, 'window.json'), JSON.stringify({ clip: path.basename(file), from, to, nativeFps: 30,
    expectedFrames: tiles.length, allFramesRetained: true, order: 'row-major, left-to-right then top-to-bottom', tiles }, null, 2));
  return folder;
}

if (values['self-test']) {
  const fixture = path.join(output, 'two-frame-flash.mkv');
  await execute('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
    '-i', 'color=c=0x303030:s=320x180:r=30:d=2', '-vf', "drawbox=x=0:y=0:w=iw:h=ih:color=0xd0d0d0:t=fill:enable='between(n,20,21)'", '-c:v', 'ffv1', fixture]);
  const test = await scan(fixture);
  if (!test.possibleOneToThreeFrameFlashes.some(flash => flash.startFrame === 20 && flash.endFrame === 21)) throw new Error('Two-frame flash self-test failed.');
  await denseWindow(fixture, .5, 1, 'self-test-all15frames');
  console.log('Motion QA self-test passed: the two-frame wrong view was located and all fifteen test-window frames were exported.');
} else {
  const requested = values.all ? [
    ...sequence.filter(clip => clip.kind === 'footage').map(clip => path.join(directory, `${clip.id}.mp4`)),
    ...sequence.filter(clip => clip.kind === 'card').map(clip => path.join(directory, `${clip.id}-bg.mp4`)),
  ] : positionals.map(file => path.resolve(file));
  if (!requested.length) throw new Error('Supply clips, --all, or --self-test. Windows require exactly one clip.');
  const missing = [], results = [];
  for (const file of requested) {
    try { await stat(file); } catch { missing.push(path.basename(file)); continue; }
    results.push(await scan(file));
  }
  for (const spec of values.window || []) {
    if (requested.length !== 1) throw new Error('Dense windows require one input clip.');
    const [label, from, to] = spec.split(':');
    await denseWindow(requested[0], Number(from), Number(to), label);
  }
  await writeFile(path.join(output, 'summary.json'), JSON.stringify({ complete: !missing.length, missing,
    results: results.map(({ clip, sha256, decodedFrames, possibleOneToThreeFrameFlashes, abruptTransitionCandidates }) =>
      ({ clip, sha256, decodedFrames, possibleOneToThreeFrameFlashes, abruptTransitionCandidates })),
    semanticAcceptance: 'pending manual dense-window/camera review' }, null, 2) + '\n');
}
