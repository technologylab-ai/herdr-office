/** Prepare genuine action/background plates; remove only approved waiting ranges. */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { sequence } from './plan.mjs';

const directory = path.resolve('artifacts/marketing/v7');
await mkdir(directory, { recursive: true });
async function execute(program, args) {
  return new Promise((resolve, reject) => {
    let stdout = '', stderr = '';
    const child = spawn(program, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(stderr.slice(-1600))));
  });
}
const hash = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const reports = [];
for (const clip of sequence) {
  if (!/^[a-z][a-z0-9-]*$/.test(clip.id)) throw new Error('Invalid scene ID.');
  if (clip.reuseFile) {
    const source = path.resolve(clip.reuseFile);
    const output = path.join(directory, `${clip.id}.mp4`);
    if (source === output) throw new Error('Refusing to overwrite the reused source.');
    await copyFile(source, output);
    reports.push({ id: clip.id, reusedApprovedComposite: true,
      sourceSha256: await hash(source), outputSha256: await hash(output) });
    continue;
  }
  const card = clip.kind === 'card';
  let source = path.resolve(card ? clip.backgroundSource : clip.sourceFile);
  const output = path.join(directory, clip.id + (card ? '-bg.mp4' : '.mp4'));
  // Action HUD IDs share their names with the newly recorded bookmark clips.
  // Read the preserved native sources before composites replace those names.
  if (card && (source === path.join(directory, `${clip.id}.mp4`) || source === output)) {
    const native = path.join(directory, 'raw', path.basename(source));
    source = native;
  }
  if (source === output) throw new Error('Refusing to overwrite the source plate.');
  const info = JSON.parse(await execute('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', source]));
  const video = info.streams.find(stream => stream.codec_type === 'video');
  if (!video || video.width !== 1920 || video.height !== 1080) throw new Error('Unexpected source plate dimensions.');
  if (!card) {
    await copyFile(source, output);
    reports.push({ id: clip.id, kind: clip.kind, source: path.basename(source), copied: true,
      sourceSha256: await hash(source), outputSha256: await hash(output) });
    continue;
  }
  const ranges = clip.backgroundRanges || [{ sourceFrames: [0, Math.round(clip.duration * 30)], outputFrames: Math.round(clip.duration * 30) }];
  if (ranges.reduce((sum, range) => sum + range.outputFrames, 0) !== Math.round(clip.duration * 30)) throw new Error('Background ranges do not match HUD duration.');
  for (const range of ranges) {
    const [from, to] = range.sourceFrames;
    if (![from, to, range.outputFrames].every(Number.isInteger) || from < 0 || to <= from || to > Number(info.format.duration) * 30 + .5 || range.outputFrames <= 0) throw new Error('Invalid background source range.');
  }
  const filters = [];
  if (ranges.length > 1) filters.push(`[0:v]fps=30,split=${ranges.length}${ranges.map((_, index) => `[s${index}]`).join('')}`);
  for (const [index, range] of ranges.entries()) {
    const [from, to] = range.sourceFrames;
    const input = ranges.length === 1 ? '[0:v]fps=30,' : `[s${index}]`;
    filters.push(`${input}trim=start_frame=${from}:end_frame=${to},setpts=(PTS-STARTPTS)*${range.outputFrames}/${to - from},fps=30,trim=end_frame=${range.outputFrames},setpts=PTS-STARTPTS[p${index}]`);
  }
  filters.push(ranges.map((_, index) => `[p${index}]`).join('') + `concat=n=${ranges.length}:v=1:a=0,setsar=1,format=yuv420p[v]`);
  await execute('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', source,
    '-filter_complex', filters.join(';'), '-map', '[v]', '-an', '-t', String(clip.duration),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart', output]);
  reports.push({ id: clip.id, kind: clip.kind, source: path.basename(source), sourceRanges: ranges,
    duration: clip.duration, sourceSha256: await hash(source), outputSha256: await hash(output) });
}
await writeFile(path.join(directory, 'plate-preparation-report.json'), JSON.stringify(reports, null, 2) + '\n');
console.log(JSON.stringify({ prepared: reports.length }));
