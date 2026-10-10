/** Claude-directed lean/extended feature cuts with one uninterrupted soundtrack. */
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  extended: { type: 'boolean' },
  'run-file': { type: 'string' },
  'output-dir': { type: 'string' },
  'output-name': { type: 'string' },
  'audio-from': { type: 'string' },
} });
if (positionals.length > 1) throw new Error('Expected at most one source music path.');
const inputDirectory = path.resolve('artifacts/marketing/v2');
const directory = path.resolve(values['output-dir'] || inputDirectory);
const extended = !!values.extended;
const variant = extended ? 'extended' : 'lean';
const source = path.resolve(positionals[0] || 'artifacts/marketing/suno-source.mp3');
const audioFrom = values['audio-from'] && path.resolve(values['audio-from']);
const outputName = values['output-name'] || (extended ? 'herdr-office-teaser-v2-extended.mp4' : 'herdr-office-teaser-v2.mp4');
if (path.basename(outputName) !== outputName || !outputName.endsWith('.mp4')) throw new Error('Output name must be an MP4 filename.');
if ((values['run-file'] || audioFrom) && directory === inputDirectory) throw new Error('Replacement cuts require a separate output directory to preserve V2.');
const final = path.join(directory, outputName);
if (audioFrom === final || (values['run-file'] && path.resolve(values['run-file']) === final)) throw new Error('The output cannot overwrite an input.');
const clips = [
  ['cover', 5, true], ['office', 9, false], ['walk-card', 3, true],
  ['run', 13, false], ['map', 10, false], ['roster', 6, false],
  ['terminal-card', 3, true], ['watch', 18, false], ['steer', 19, false],
  ['bookmark', 12, false], ['end', 6, true],
];
// Claude approved removing idle holds, not speeding up UI or cutting the music.
// Bounds are aligned to actual 30fps frames (the choice-only plan was in seconds).
const leanFrames = {
  map: [[0, 225]],
  watch: [[0, 157], [217, 292], [310, 400], [490, 540]],
  steer: [[0, 492]],
};
const rangesFor = (name, seconds) => !extended && leanFrames[name] ? leanFrames[name] : [[0, seconds * 30]];
const durationFor = (name, seconds) => rangesFor(name, seconds).reduce((sum, [start, end]) => sum + end - start, 0) / 30;
const duration = clips.reduce((sum, [name, seconds]) => sum + durationFor(name, seconds), 0);
await mkdir(directory, { recursive: true });

async function execute(program, args, label) {
  return new Promise((resolve, reject) => {
    let stdout = '', stderr = '';
    const child = spawn(program, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', async code => {
      if (code === 0) resolve({ stdout, stderr });
      else {
        // Source music may carry private tags. Keep diagnostic output ignored.
        await writeFile(path.join(directory, 'assembly-error.log'), stderr);
        reject(new Error(`${label} failed (${code}); see the local assembly-error.log.`));
      }
    });
  });
}
const ffmpeg = (args, label) => execute('ffmpeg', ['-y', '-hide_banner', ...args], label);
const probe = async file => JSON.parse((await execute('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], 'Media probe')).stdout);
const measurement = log => JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));
if (audioFrom) {
  const info = await probe(audioFrom), audio = info.streams.find(stream => stream.codec_type === 'audio');
  if (!audio || audio.codec_name !== 'aac' || audio.channels !== 2 || Number(audio.sample_rate) !== 48000 || Math.abs(Number(info.format.duration) - duration) > .05) {
    throw new Error('Copied soundtrack must be stereo 48kHz AAC with the same duration as this cut.');
  }
}

const inputs = [], filters = [], clipReport = [];
let timeline = 0;
for (const [index, [name, sourceDuration, slide]] of clips.entries()) {
  const file = name === 'run' && values['run-file'] ? path.resolve(values['run-file']) : path.join(inputDirectory, `${name}.mp4`);
  const info = await probe(file);
  const video = info.streams.find(stream => stream.codec_type === 'video');
  if (!video || video.width !== 1920 || video.height !== 1080 || Math.abs(Number(info.format.duration) - sourceDuration) > .05) {
    throw new Error(`Unexpected dimensions or duration for ${name}.mp4`);
  }
  inputs.push('-i', file);
  const ranges = rangesFor(name, sourceDuration), seconds = durationFor(name, sourceDuration);
  let cutInput;
  if (ranges.length === 1) {
    filters.push(`[${index}:v]fps=30,trim=start_frame=${ranges[0][0]}:end_frame=${ranges[0][1]},setpts=PTS-STARTPTS[cut${index}]`);
  } else {
    filters.push(`[${index}:v]fps=30,split=${ranges.length}${ranges.map((_, part) => `[s${index}_${part}]`).join('')}`);
    for (const [part, [start, end]] of ranges.entries()) {
      filters.push(`[s${index}_${part}]trim=start_frame=${start}:end_frame=${end},setpts=PTS-STARTPTS[p${index}_${part}]`);
    }
    filters.push(ranges.map((_, part) => `[p${index}_${part}]`).join('') + `concat=n=${ranges.length}:v=1:a=0[cut${index}]`);
  }
  cutInput = `[cut${index}]`;
  let filter = `${cutInput}setsar=1,format=yuv420p`;
  // A 0.2s tail and 0.2s head dip through forest at card boundaries.
  // These stay inside each clip, preserving the exact timeline and feature holds.
  if (index > 0 && (slide || clips[index - 1][2])) filter += ',fade=t=in:st=0:d=0.2:color=0x0a120f';
  if (index < clips.length - 1 && (slide || clips[index + 1][2])) filter += `,fade=t=out:st=${seconds - .2}:d=0.2:color=0x0a120f`;
  if (index === clips.length - 1) filter += `,fade=t=out:st=${seconds - .5}:d=0.5:color=0x0a120f`;
  filters.push(filter + `[v${index}]`);
  clipReport.push({ name, start: timeline, end: timeline + seconds, slide,
    sourceFrames: ranges, sourceDuration,
    sourceSha256: createHash('sha256').update(await readFile(file)).digest('hex') }); timeline += seconds;
}
filters.push(clips.map((_, index) => `[v${index}]`).join('') + `concat=n=${clips.length}:v=1:a=0[picture]`);
const picture = path.join(directory, `herdr-office-picture-v2-${variant}.mp4`);
await ffmpeg(['-loglevel', 'error', ...inputs, '-filter_complex', filters.join(';'), '-map', '[picture]', '-an',
  '-t', String(duration), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
  '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart', picture], 'Picture assembly');

if (audioFrom) {
  await ffmpeg(['-loglevel', 'error', '-i', picture, '-i', audioFrom, '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-c:a', 'copy', '-map_metadata', '-1', '-map_chapters', '-1', '-t', String(duration),
    '-movflags', '+faststart', final], 'Mux with unchanged approved soundtrack');
} else {
  const music = path.join(directory, `continuous-soundtrack-${variant}.wav`);
  await ffmpeg(['-loglevel', 'error', '-i', source, '-map', '0:a:0', '-vn',
    '-af', `atrim=start=15:end=${15 + duration},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.5,afade=t=out:st=${duration - 2}:d=2`,
    '-map_metadata', '-1', '-map_chapters', '-1', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_f32le', music], 'Continuous soundtrack');
  const first = measurement((await ffmpeg(['-i', music, '-map', '0:a:0', '-af',
    'loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json', '-f', 'null', '-'], 'Audio measurement')).stderr);
  const normalize = `loudnorm=I=-14:TP=-1.5:LRA=7:measured_I=${first.input_i}:measured_TP=${first.input_tp}:measured_LRA=${first.input_lra}:measured_thresh=${first.input_thresh}:offset=${first.target_offset}:linear=true:print_format=json`;
  await ffmpeg(['-loglevel', 'error', '-i', picture, '-i', music, '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-af', normalize, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-map_metadata', '-1', '-map_chapters', '-1', '-t', String(duration), '-movflags', '+faststart', final], 'Final video mux');
}
const decoded = measurement((await ffmpeg(['-i', final, '-map', '0:a:0', '-af',
  'loudnorm=I=-14:TP=-1:LRA=7:print_format=json', '-f', 'null', '-'], 'Encoded audio check')).stderr);
if (Math.abs(Number(decoded.input_i) + 14) > .5 || Number(decoded.input_tp) > -1) throw new Error('Encoded audio missed its loudness or peak limit.');
await ffmpeg(['-loglevel', 'error', '-i', final, '-f', 'null', '-'], 'Full audio/video decode');
const finalInfo = await probe(final);
if (Math.abs(Number(finalInfo.format.duration) - duration) > .05) throw new Error('Final duration changed.');
const soundtrackOrigin = audioFrom
  ? { copiedFrom: path.basename(audioFrom), streamCopy: true, newSectionSplices: 0, newTempoChanges: 0 }
  : { sourceStart: 15, sourceEnd: 15 + duration, contiguous: true, sectionSplices: 0, tempoChanges: 0, fadeInSeconds: .5, fadeOutSeconds: 2 };
const report = { variant, duration, clips: clipReport, music: { ...soundtrackOrigin,
  integratedLufs: Number(decoded.input_i), truePeakDbtp: Number(decoded.input_tp), metadataStripped: true, artworkIncluded: false },
  final: { filename: path.basename(final), duration: Number(finalInfo.format.duration),
    streams: finalInfo.streams.map(stream => ({ codec: stream.codec_name, width: stream.width, height: stream.height, channels: stream.channels })) } };
await writeFile(path.join(directory, extended ? 'assembly-report-extended.json' : 'assembly-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
