/** Composite Opus's glass HUDs: animated local backdrop blur over genuine gameplay. */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { sequence, glassDesign } from './plan.mjs';

const directory = path.resolve('artifacts/marketing/v10');
const requested = process.argv.slice(2);
const cards = sequence.filter(clip => clip.kind === 'card' && !clip.reuseFile);
if (requested.some(id => !cards.some(clip => clip.id === id))) throw new Error('Unknown HUD scene ID.');
const selected = requested.length ? cards.filter(clip => requested.includes(clip.id)) : cards;
if (!(glassDesign.blurSigma > 0 && glassDesign.blurSigma <= 80)) throw new Error('Expected an Opus-authored local glass blur strength.');
async function execute(program, args, label, binary = false) {
  return new Promise((resolve, reject) => {
    let stdout = '', stderr = ''; const chunks = [];
    const child = spawn(program, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => { if (binary) chunks.push(chunk); else stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', async code => {
      if (code === 0) resolve(binary ? Buffer.concat(chunks) : stdout);
      else {
        await writeFile(path.join(directory, 'hud-composite-error.log'), stderr);
        reject(new Error(`${label} failed (${code}); see local hud-composite-error.log.`));
      }
    });
  });
}
const probe = async file => JSON.parse(await execute('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], 'HUD input probe'));
const hash = async file => createHash('sha256').update(await readFile(file)).digest('hex');
let reports = {};
try { reports = JSON.parse(await readFile(path.join(directory, 'hud-composite-report.json'), 'utf8')); } catch { /* First pass. */ }
for (const clip of selected) {
  const game = path.join(directory, `${clip.id}-bg.mp4`);
  const overlay = path.join(directory, `${clip.id}-hud.mov`);
  const mask = path.join(directory, `${clip.id}-glass-mask.png`);
  const output = path.join(directory, `${clip.id}.mp4`);
  const [gameInfo, overlayInfo, maskInfo] = await Promise.all([probe(game), probe(overlay), probe(mask)]);
  for (const info of [gameInfo, overlayInfo, maskInfo]) {
    const video = info.streams.find(stream => stream.codec_type === 'video');
    if (!video || video.width !== 1920 || video.height !== 1080) throw new Error(`Unexpected HUD input dimensions for ${clip.id}.`);
  }
  if (Number(gameInfo.format.duration) < clip.duration - .02 || Math.abs(Number(overlayInfo.format.duration) - clip.duration) > .05) throw new Error(`Unexpected HUD input duration for ${clip.id}.`);
  const hudVideo = overlayInfo.streams.find(stream => stream.codec_type === 'video');
  if (!/^(argb|rgba|bgra|abgr|gbrap|yuva)/.test(hudVideo.pix_fmt)) throw new Error('HUD overlay must retain its alpha channel.');
  if (!/^(argb|rgba|bgra|abgr|gbrap|yuva)/.test(maskInfo.streams.find(stream => stream.codec_type === 'video').pix_fmt)) throw new Error('Glass blur mask must retain its alpha channel.');
  const alpha = await execute('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-ss', String(clip.duration / 2), '-i', overlay,
    '-vf', 'alphaextract,scale=128:72:flags=area,format=gray', '-frames:v', '1', '-f', 'rawvideo', 'pipe:1'], 'HUD transparency check', true);
  if (alpha.length !== 128 * 72) throw new Error('Could not inspect the HUD alpha plane.');
  const meanAlpha = alpha.reduce((sum, value) => sum + value, 0) / alpha.length;
  if (meanAlpha >= 220 || Math.min(...alpha) >= 200) throw new Error('HUD obscures the full game background.');
  const enter = clip.animation?.enterSeconds ?? glassDesign.enterSeconds ?? .35;
  const exit = clip.animation?.exitSeconds ?? glassDesign.exitSeconds ?? .30;
  const delay = clip.animation?.enterDelaySeconds ?? 0;
  const end = clip.animation?.endSeconds ?? clip.duration;
  if (!(enter > 0 && exit > 0 && delay >= 0 && end <= clip.duration && end - delay > enter + exit)) throw new Error('Invalid glass animation envelope.');
  const maskEnvelope = `1-pow(1-clip((T-${delay})/${enter},0,1),3)`;
  const maskExit = `clip((${end}-T)/${exit},0,1)`;
  const saturation = glassDesign.saturate || 1;
  if (!(saturation > 0 && saturation <= 2)) throw new Error('Invalid glass saturation.');
  const brightness = glassDesign.blurBrightness ?? 1;
  if (!(brightness > 0 && brightness <= 1)) throw new Error('Invalid glass brightness.');
  const luminance = [.2126, .7152, .0722];
  const channels = ['r', 'g', 'b'];
  const saturationMatrix = channels.flatMap((out, row) => channels.map((input, column) =>
    `${out}${input}=${luminance[column] * (1 - saturation) + (row === column ? saturation : 0)}`)).join(':');
  const graph = '[0:v]fps=30,setpts=PTS-STARTPTS,scale=in_range=limited:out_range=full:in_color_matrix=bt709,format=gbrp,split[sharp][blur-source];'
    + `[blur-source]gblur=sigma=${glassDesign.blurSigma}:steps=2,colorchannelmixer=${saturationMatrix},lutrgb=r=val*${brightness}:g=val*${brightness}:b=val*${brightness}[blurred];`
    + `[2:v]fps=30,setpts=PTS-STARTPTS,alphaextract,format=gray,geq=lum='p(X,Y)*(${maskEnvelope})*(${maskExit})',format=gbrp[mask];`
    + '[sharp][blurred][mask]maskedmerge[game];'
    + '[1:v]fps=30,setpts=PTS-STARTPTS,format=rgba[hud];'
    + '[game][hud]overlay=shortest=1:format=rgb:alpha=straight,'
    + 'scale=in_range=full:out_range=limited:out_color_matrix=bt709,format=yuv420p[picture]';
  await execute('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', game, '-i', overlay, '-loop', '1', '-framerate', '30', '-i', mask,
    '-filter_complex', graph, '-map', '[picture]', '-an', '-t', String(clip.duration),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart', output], 'HUD composite');
  reports[clip.id] = { duration: clip.duration, game: path.basename(game), overlay: path.basename(overlay),
    mask: path.basename(mask), gameSha256: await hash(game), overlaySha256: await hash(overlay), maskSha256: await hash(mask), outputSha256: await hash(output),
    alphaPreserved: true, midSceneMeanAlpha: meanAlpha, actualLocalBackdropBlur: true, animationWindow: { delay, end, enter, exit },
    blurSigma: glassDesign.blurSigma, blurBrightness: brightness, fullFrameBackgroundReplaced: false, colorSpace: 'BT.709 limited range' };
  await writeFile(path.join(directory, 'hud-composite-report.json'), JSON.stringify(reports, null, 2) + '\n');
  console.log(JSON.stringify({ scene: clip.id, duration: clip.duration, background: 'real app footage', overlay: 'animated RGBA HUD' }));
}
