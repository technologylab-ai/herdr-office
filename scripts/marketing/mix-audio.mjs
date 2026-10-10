/** Claude Opus 5.5's source-based soundtrack edit; no generated music or added effects. */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('artifacts/marketing');
const source = path.resolve(process.argv[2] || path.join(output, 'suno-source.mp3'));
const picture = path.resolve(process.argv[3] || path.join(output, 'herdr-office-picture-reviewed.mp4'));
await mkdir(output, { recursive: true });

async function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    const child = spawn('ffmpeg', ['-y', '-hide_banner', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve(stderr) : reject(new Error(stderr)));
  });
}

function measurement(log) {
  return JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));
}

// 50 ms source-handle crossfades are centered on 20, 32.5 and 37.5 seconds.
// The stronger source groove at 70 seconds therefore lands exactly on the 27.5-second send.
const graph = [
  '[0:a:0]asplit=4[sa][sb][sc][sd]',
  '[sa]atrim=start=15:end=35.025,asetpts=PTS-STARTPTS[a]',
  '[sb]atrim=start=62.475:end=75.025,asetpts=PTS-STARTPTS[b]',
  '[sc]atrim=start=149.975:end=155.025,asetpts=PTS-STARTPTS[c]',
  '[sd]atrim=start=159.975:end=162.5,asetpts=PTS-STARTPTS[d]',
  '[a][b]acrossfade=d=0.05:c1=tri:c2=tri[ab]',
  '[ab][c]acrossfade=d=0.05:c1=tri:c2=tri[abc]',
  '[abc][d]acrossfade=d=0.05:c1=tri:c2=tri,afade=t=in:st=0:d=0.015,afade=t=out:st=39.7:d=0.3,atrim=end=40[music]',
].join(';');
const edited = path.join(output, 'soundtrack-edit.wav');
await ffmpeg(['-loglevel', 'error', '-i', source, '-filter_complex', graph, '-map', '[music]',
  '-vn', '-map_metadata', '-1', '-map_chapters', '-1', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_f32le', edited]);

const first = measurement(await ffmpeg(['-i', edited, '-map', '0:a:0', '-af',
  'loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json', '-f', 'null', '-']));
const normalize = `loudnorm=I=-14:TP=-1.5:LRA=7:measured_I=${first.input_i}:measured_TP=${first.input_tp}:measured_LRA=${first.input_lra}:measured_thresh=${first.input_thresh}:offset=${first.target_offset}:linear=true:print_format=json`;
const final = path.join(output, 'herdr-office-teaser.mp4');
await ffmpeg(['-i', picture, '-i', edited, '-map', '0:v:0', '-map', '1:a:0',
  '-map_metadata', '-1', '-map_chapters', '-1', '-c:v', 'copy', '-af', normalize,
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-t', '40', '-movflags', '+faststart', final]);

const decoded = measurement(await ffmpeg(['-i', final, '-map', '0:a:0', '-af',
  'loudnorm=I=-14:TP=-1:LRA=7:print_format=json', '-f', 'null', '-']));
if (Math.abs(Number(decoded.input_i) + 14) > .5 || Number(decoded.input_tp) > -1) {
  throw new Error(`The encoded soundtrack missed the loudness/peak limits: ${JSON.stringify(decoded)}`);
}
const report = {
  direction: 'Claude Opus 5.5 source-based edit; no added sound effects; original tempo retained.',
  sourceSections: [[15, 35], [62.5, 75], [150, 155], [160, 162.5]],
  outputBoundaries: [0, 5, 20, 27.5, 32.5, 37.5, 40],
  crossfadeSeconds: .05,
  metadataStripped: true,
  attachedArtworkIncluded: false,
  normalization: first,
  encodedIntegratedLufs: Number(decoded.input_i),
  encodedTruePeakDbtp: Number(decoded.input_tp),
};
await writeFile(path.join(output, 'soundtrack-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ final, integratedLufs: report.encodedIntegratedLufs, truePeakDbtp: report.encodedTruePeakDbtp }));
