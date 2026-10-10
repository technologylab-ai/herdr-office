/** Exact frame edits chosen by Opus; all navigation is native captured gameplay. */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve('artifacts/marketing/v10'), raw = path.join(directory, 'raw');
await mkdir(raw, { recursive: true });
const report = { creativeContract: 'opus-social-contract.json', syntheticCamera: false, clips: [] };
async function execute(program, args) {
  return new Promise((resolve, reject) => {
    let stdout = '', stderr = '';
    const child = spawn(program, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', c => { stdout += c; }); child.stderr.on('data', c => { stderr += c; });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve(stdout) : reject(new Error(stderr.slice(-2000))));
  });
}
const hash = async file => createHash('sha256').update(await readFile(file)).digest('hex');
async function render(id, inputs, filter, frames, ranges) {
  const file = path.join(raw, `${id}.mp4`);
  await execute('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...inputs.flatMap(f => ['-i', path.resolve(f)]),
    '-filter_complex', filter, '-map', '[v]', '-an', '-frames:v', String(frames), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart', file]);
  const info = JSON.parse(await execute('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]));
  if (Number(info.streams[0].nb_frames) !== frames) throw new Error(`${id} has an unexpected frame count.`);
  report.clips.push({ id, frames, duration: frames / 30, sourceRanges: ranges,
    sources: await Promise.all(inputs.map(async file => ({ path: file, sha256: await hash(file) }))), sha256: await hash(file) });
  console.log(`DONE ${id} ${frames}frames`);
}
await render('opener-floors', [
  'artifacts/marketing/v7/raw/floors-select.mp4',
  'artifacts/marketing/v10/raw/floors-return-select.mp4',
  'artifacts/marketing/v9/raw/studio-arrival.mp4',
], '[0:v]fps=30,trim=start_frame=26:end_frame=75,setpts=PTS-STARTPTS[a];'
  + '[1:v]fps=30,trim=end_frame=36,setpts=PTS-STARTPTS[b];'
  + '[2:v]fps=30,trim=start_frame=84:end_frame=119,setpts=PTS-STARTPTS[c];'
  + '[a][b][c]concat=n=3:v=1:a=0,format=yuv420p[v]', 120,
[{ source: 0, frames: [26, 75], outputFrames: 49 }, { source: 1, frames: [0, 36], outputFrames: 36 }, { source: 2, frames: [84, 119], outputFrames: 35 }]);

await render('descent', ['artifacts/marketing/v9/raw/studio-descent.mp4', 'artifacts/marketing/v9/raw/walk-card.mp4'],
  '[0:v]fps=30,split=3[s][t][e];'
  + '[s]trim=end_frame=234,setpts=(PTS-STARTPTS)*130/234,fps=30,trim=end_frame=130,setpts=PTS-STARTPTS[a];'
  + '[t]trim=start_frame=234:end_frame=238,setpts=PTS-STARTPTS[b];'
  + '[e]trim=start_frame=238:end_frame=248,setpts=PTS-STARTPTS,format=yuv420p[c];'
  + '[1:v]fps=30,trim=end_frame=10,setpts=PTS-STARTPTS,format=yuv420p[d];'
  + "[c][d]blend=all_expr='A*(1-min(1,T/0.3))+B*min(1,T/0.3)':shortest=1[f];"
  + '[a][b][f]concat=n=3:v=1:a=0,format=yuv420p[v]', 144,
[{ source: 0, frames: [0, 234], outputFrames: 130, speed: 1.8 },
  { source: 0, frames: [234, 238], outputFrames: 4, speed: 1 },
  { source: [0, 1], frames: [[238, 248], [0, 10]], outputFrames: 10, matchedHeightBlend: true,
    sameGroundPosition: true, blendEndsOnFullGroundFrame: true }]);

await render('run-to-basalt', ['artifacts/marketing/v5/run.mp4'],
  '[0:v]fps=30,split=2[s][t];'
  + '[s]trim=end_frame=466,setpts=(PTS-STARTPTS)*259/466,fps=30,trim=end_frame=259,setpts=PTS-STARTPTS[a];'
  + '[t]trim=start_frame=466:end_frame=481,setpts=PTS-STARTPTS[b];'
  + '[a][b]concat=n=2:v=1:a=0,format=yuv420p[v]', 274,
[{ source: 0, frames: [0, 466], outputFrames: 259, speed: 466 / 259 },
  { source: 0, frames: [466, 481], outputFrames: 15, speed: 1 }]);
await writeFile(path.join(directory, 'navigation-edit-report.json'), JSON.stringify(report, null, 2) + '\n');
