/** V7: introduce machine floors while preserving the accepted V6 scenes. */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { sequence, chapterDissolves } from './plan.mjs';

const directory = path.resolve('artifacts/marketing/v7');
const source = path.resolve(process.argv[2] || 'artifacts/marketing/suno-source.mp3');
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
        // Input music tags can be private. Diagnostics stay in ignored artifacts.
        await writeFile(path.join(directory, 'assembly-error.log'), stderr);
        reject(new Error(`${label} failed (${code}); see the local assembly-error.log.`));
      }
    });
  });
}
const ffmpeg = (args, label) => execute('ffmpeg', ['-y', '-hide_banner', ...args], label);
const probe = async file => JSON.parse((await execute('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], 'Media probe')).stdout);
const measurement = log => JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));
if (!Array.isArray(sequence) || !sequence.length || new Set(sequence.map(clip => clip.id)).size !== sequence.length) throw new Error('Expected unique scene IDs.');
for (const clip of sequence) {
  if (!/^[a-z][a-z0-9-]*$/.test(clip.id) || !['card', 'footage'].includes(clip.kind) ||
      !Number.isFinite(clip.duration) || clip.duration <= 0 || Math.abs(clip.duration * 30 - Math.round(clip.duration * 30)) > 1e-6) {
    throw new Error('Invalid scene definition. Durations must align to 30fps.');
  }
}
// Claude approved six-frame editorial dissolves at the specified arrival handoffs.
// They show settled destination footage, never the intermediate app camera setup.
const dissolveFrames = 6;
const dissolvePairs = new Set(chapterDissolves.map(item => item.between.join(':')));
const overlapAt = index => dissolvePairs.has(`${sequence[index - 1]?.id}:${sequence[index].id}`) ? dissolveFrames / 30 : 0;
// Preserve the accepted panorama timing and add only the new floor chapter.
const durationFor = clip => clip.duration;
const sourceDuration = sequence.reduce((sum, clip) => sum + (clip.rawSourceDuration || clip.duration), 0);
const duration = sequence.reduce((sum, clip, index) => sum + durationFor(clip) - overlapAt(index), 0);
const musicStart = 15;
const sourceInfo = await probe(source);
if (!sourceInfo.streams.some(stream => stream.codec_type === 'audio') || Number(sourceInfo.format.duration) < musicStart + duration) throw new Error('The continuous soundtrack is too short for this cut.');

const inputs = [], filters = [], clips = [];
let timeline = 0;
for (const [index, clip] of sequence.entries()) {
  const file = path.join(directory, `${clip.id}.mp4`), info = await probe(file);
  const video = info.streams.find(stream => stream.codec_type === 'video');
  if (!video || video.width !== 1920 || video.height !== 1080 || Number(info.format.duration) < clip.duration - .05) throw new Error(`Unexpected dimensions or duration for ${clip.id}.`);
  inputs.push('-i', file);
  const seconds = durationFor(clip);
  const ranges = clip.editorialSpeedRanges || [{ sourceFrames: [0, Math.round(seconds * 30)], outputFrames: Math.round(seconds * 30) }];
  if (ranges.reduce((sum, range) => sum + range.outputFrames, 0) !== Math.round(seconds * 30)) throw new Error('Editorial ranges do not match their promised duration.');
  for (const range of ranges) {
    const [start, end] = range.sourceFrames;
    if (![start, end, range.outputFrames].every(Number.isInteger) || start < 0 || end <= start || end > Number(info.format.duration) * 30 + .5 || range.outputFrames <= 0) throw new Error('Invalid editorial source frame range.');
  }
  let cut;
  if (ranges.length > 1) {
    filters.push(`[${index}:v]fps=30,split=${ranges.length}${ranges.map((_, part) => `[s${index}_${part}]`).join('')}`);
    for (const [part, range] of ranges.entries()) {
      const [start, end] = range.sourceFrames;
      filters.push(`[s${index}_${part}]trim=start_frame=${start}:end_frame=${end},setpts=(PTS-STARTPTS)*${range.outputFrames}/${end - start},fps=30,trim=end_frame=${range.outputFrames},setpts=PTS-STARTPTS[p${index}_${part}]`);
    }
    filters.push(ranges.map((_, part) => `[p${index}_${part}]`).join('') + `concat=n=${ranges.length}:v=1:a=0[cut${index}]`);
    cut = `[cut${index}]`;
  } else {
    const range = ranges[0], [start, end] = range.sourceFrames;
    filters.push(`[${index}:v]fps=30,trim=start_frame=${start}:end_frame=${end},setpts=(PTS-STARTPTS)*${range.outputFrames}/${end - start},fps=30,trim=end_frame=${range.outputFrames},setpts=PTS-STARTPTS[cut${index}]`);
    cut = `[cut${index}]`;
  }
  const filter = `${cut}setsar=1,format=yuv420p,settb=AVTB`;
  // Chapter inputs now contain translucent animated HUDs over real gameplay.
  // Their own overlays/approved edits handle transitions; keep the game visible
  // and preserve continuous composition across adjacent live terminal clips.
  filters.push(filter + `[v${index}]`);
  timeline -= overlapAt(index);
  clips.push({ ...clip, duration: seconds, sourceDuration: Number(info.format.duration), sourceRanges: ranges, start: timeline, end: timeline + seconds, incomingEditorialDissolveSeconds: overlapAt(index),
    sourceSha256: createHash('sha256').update(await readFile(file)).digest('hex') });
  timeline += seconds;
}
let joined = 'v0', joinedDuration = durationFor(sequence[0]);
for (let index = 1; index < sequence.length; index++) {
  const next = `joined${index}`, overlap = overlapAt(index);
  filters.push(overlap
    ? `[${joined}][v${index}]xfade=transition=fade:duration=${overlap}:offset=${joinedDuration - overlap}[${next}]`
    : `[${joined}][v${index}]concat=n=2:v=1:a=0[${next}]`);
  joined = next; joinedDuration += durationFor(sequence[index]) - overlap;
}
filters.push(`[${joined}]null[picture]`);
const picture = path.join(directory, 'herdr-office-picture-v7.mp4');
await ffmpeg(['-loglevel', 'error', ...inputs, '-filter_complex', filters.join(';'), '-map', '[picture]', '-an',
  '-t', String(duration), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
  '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart', picture], 'Picture assembly');

const music = path.join(directory, 'continuous-soundtrack.wav');
await ffmpeg(['-loglevel', 'error', '-i', source, '-map', '0:a:0', '-vn',
  '-af', `atrim=start=${musicStart}:end=${musicStart + duration},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.4,afade=t=out:st=${duration - 2.5}:d=2.5`,
  '-map_metadata', '-1', '-map_chapters', '-1', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_f32le', music], 'Continuous soundtrack');
const first = measurement((await ffmpeg(['-i', music, '-map', '0:a:0', '-af',
  'loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json', '-f', 'null', '-'], 'Audio measurement')).stderr);
const normalize = `loudnorm=I=-14:TP=-1.5:LRA=7:measured_I=${first.input_i}:measured_TP=${first.input_tp}:measured_LRA=${first.input_lra}:measured_thresh=${first.input_thresh}:offset=${first.target_offset}:linear=true:print_format=json`;
const final = path.join(directory, 'herdr-office-teaser-v7.mp4');
await ffmpeg(['-loglevel', 'error', '-i', picture, '-i', music, '-map', '0:v:0', '-map', '1:a:0',
  '-c:v', 'copy', '-af', normalize, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
  '-map_metadata', '-1', '-map_chapters', '-1', '-t', String(duration), '-movflags', '+faststart', final], 'Final video mux');
const decoded = measurement((await ffmpeg(['-i', final, '-map', '0:a:0', '-af',
  'loudnorm=I=-14:TP=-1:LRA=7:print_format=json', '-f', 'null', '-'], 'Encoded audio check')).stderr);
if (Math.abs(Number(decoded.input_i) + 14) > .5 || Number(decoded.input_tp) > -1) throw new Error('Encoded audio missed its loudness or peak limit.');
await ffmpeg(['-loglevel', 'error', '-i', final, '-f', 'null', '-'], 'Full audio/video decode');
const finalInfo = await probe(final);
if (Math.abs(Number(finalInfo.format.duration) - duration) > .05) throw new Error('Final duration changed.');
const report = { duration, sourceDuration, terminalSeconds: sequence.filter(clip => ['watch','steer'].includes(clip.id)).reduce((sum, clip) => sum + clip.duration, 0), editorialDissolves: { frames: dissolveFrames, boundaries: [...dissolvePairs], travelAnimation: false }, clips, fixture: 'showcase', music: {
  sourceStart: musicStart, sourceEnd: musicStart + duration, contiguous: true,
  sectionSplices: 0, tempoChanges: 0, fadeInSeconds: .4, fadeOutSeconds: 2.5,
  integratedLufs: Number(decoded.input_i), truePeakDbtp: Number(decoded.input_tp), metadataStripped: true, artworkIncluded: false,
}, final: { filename: path.basename(final), sha256: createHash('sha256').update(await readFile(final)).digest('hex'),
  duration: Number(finalInfo.format.duration), streams: finalInfo.streams.map(stream => ({
    codec: stream.codec_name, width: stream.width, height: stream.height, channels: stream.channels,
  })) } };
await writeFile(path.join(directory, 'assembly-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
