/** Claude Opus 5.5's transparent playful office HUDs; engineering follows hud-spec.json. */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { palette, sequence, hudDesign } from './plan.mjs';
export { installAnnotations, annotate, setAnnotationMode } from './annotations.mjs';
export const directory = path.resolve('artifacts/marketing/v4');
const FPS = 30, WIDTH = 1920, HEIGHT = 1080;
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const esc = value => String(value || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
async function execute(program, args) {
  return new Promise((resolve, reject) => {
    let stdout = '', stderr = '';
    const child = spawn(program, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(program + ' failed: ' + stderr.slice(-1200))));
  });
}
export async function ffmpeg(args) { return (await execute('ffmpeg', ['-y', '-hide_banner', ...args])).stderr; }

function hudRuntime(config) {
  const panel = document.getElementById('hud');
  const clamp = value => Math.max(0, Math.min(1, value));
  window.cardAt = window.hudAt = time => {
    const p = clamp(time / .36), s = p - 1;
    const rise = 1 + 2.70158 * s * s * s + 1.70158 * s * s;
    const fade = 1 - Math.pow(1 - p, 3);
    const q = clamp((time - (config.duration - .44)) / .24);
    panel.style.transform = 'translateY(' + (24 * (1 - rise) + 16 * q) + 'px) scale(' + (.96 + .04 * rise) + ')';
    panel.style.opacity = String(fade * (1 - q));
    return time;
  };
  window.cardLayout = () => {
    const title = panel.querySelector('h1');
    const rect = panel.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      titleSize: Number.parseFloat(getComputedStyle(title).fontSize),
      overflowX: panel.scrollWidth > panel.clientWidth + 1, overflowY: panel.scrollHeight > panel.clientHeight + 1 };
  };
  window.cardReady = document.fonts.ready.then(() => {
    const title = panel.querySelector('h1');
    let size = config.titleSize;
    while (size > 72 && title.scrollHeight > size * 1.05 * 1.1) {
      size -= 2; title.style.fontSize = size + 'px';
    }
    // Text fits the localized HUD; never expand into a full-frame opaque background.
    const wanted = Math.max(config.height, panel.scrollHeight + 4);
    panel.style.height = wanted + 'px';
    panel.style.top = Math.max(96, Math.min(config.y, 910 - wanted)) + 'px';
    window.cardAt(1.1);
    if (location.hash === '#play') {
      const start = performance.now();
      const animate = now => { window.hudAt((now - start) / 1000 % config.duration); requestAnimationFrame(animate); };
      requestAnimationFrame(animate);
    }
    return true;
  });
}

export function cardHtml(scene) {
  if (scene?.kind !== 'card' || !scene.card) throw new Error('Expected a V4 HUD scene.');
  const key = scene.id.replace('-card', '');
  const [x, y, width, height] = hudDesign.placements[key];
  const titleSize = ['cover', 'end'].includes(key) ? 104 : 88;
  const card = scene.card;
  const mapping = key === 'cover' ? '<div class="mapping"><span>Workspace → company</span><span>Tab → department</span><span>Pane → desk</span></div>' : '';
  const cfg = { duration: scene.duration, x, y, width, height, titleSize };
  const css = [
    'html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:transparent!important;color:#1D2B4F;',
    "font-family:'Avenir Next',Avenir,'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}",
    '*{box-sizing:border-box}#hud{position:absolute;left:' + x + 'px;top:' + y + 'px;width:' + width + 'px;height:' + height + 'px;',
    'padding:28px 34px;border:2px solid #F2A07B;border-radius:28px;background:rgba(255,243,226,.78);',
    'box-shadow:0 12px 28px rgba(29,43,79,.18);transform-origin:center;opacity:0;pointer-events:none}',
    '.eyebrow{display:inline-block;margin:0 0 6px;font-size:20px;font-weight:700;letter-spacing:.05em;color:#1D2B4F}',
    '.eyebrow::before{content:"";display:inline-block;width:12px;height:12px;margin-right:10px;',
    'border:2px solid #F2A07B;border-radius:4px;transform:rotate(-8deg);background:rgba(242,160,123,.3)}',
    'h1{font-size:' + titleSize + 'px;line-height:1.04;font-weight:800;letter-spacing:-.035em;margin:0;color:#1D2B4F}',
    '.subtitle{font-size:34px;line-height:1.2;font-weight:500;margin-top:10px;overflow-wrap:anywhere}',
    '.footer{font-size:18px;line-height:1.25;margin-top:12px;color:#51463D}',
    '.mapping{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;font-size:18px;font-weight:600}',
    '.mapping span{padding:4px 9px;border-radius:12px;background:rgba(242,160,123,.2);border:1px solid rgba(242,160,123,.65)}',
  ].join('');
  return '<!doctype html><html><head><meta charset="utf-8"><title>Herdr Office HUD ' + esc(scene.id) + '</title><style>' + css +
    '</style></head><body><section id="hud" aria-label="Editorial chapter HUD">' +
    (card.eyebrow ? '<div class="eyebrow">' + esc(card.eyebrow) + '</div>' : '') +
    '<h1>' + esc(card.title) + '</h1>' +
    (card.subtitle ? '<div class="subtitle">' + esc(card.subtitle) + '</div>' : '') +
    mapping + (card.footer ? '<div class="footer">' + esc(card.footer) + '</div>' : '') +
    '</section><script>(' + hudRuntime.toString() + ')(' + JSON.stringify(cfg) + ');</script></body></html>';
}
export const documentForCard = cardHtml;
export const hudHtml = cardHtml;

/** Produce exact-length straight-alpha RGB overlays. Root composes them with real game backgrounds. */
export async function renderSlides(only = [], { previewsOnly = false } = {}) {
  const ids = [only].flat().filter(Boolean);
  const cards = sequence.filter(s => s.kind === 'card' && (!ids.length || ids.includes(s.id)));
  if (ids.some(id => !cards.some(s => s.id === id))) throw new Error('Unknown V4 HUD id.');
  await mkdir(directory, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true,
    args: ['--force-color-profile=srgb', '--hide-scrollbars', '--mute-audio'] });
  const results = [];
  try {
    const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
    await context.route('**/*', route => route.abort());
    const page = await context.newPage();
    for (const scene of cards) {
      const count = Math.round(scene.duration * FPS), html = cardHtml(scene);
      await writeFile(path.join(directory, scene.id + '-hud.html'), html);
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(() => window.cardReady);
      const layout = await page.evaluate(() => window.cardLayout());
      if (layout.overflowX || layout.overflowY || layout.y + layout.height > 911) throw new Error(scene.id + ' HUD overflow: ' + JSON.stringify(layout));
      await page.screenshot({ path: path.join(directory, scene.id + '-hud.png'), omitBackground: true });
      if (previewsOnly) { results.push({ id: scene.id, layout, preview: true }); continue; }
      const raw = path.join(directory, 'hud-frames', scene.id);
      await rm(raw, { recursive: true, force: true }); await mkdir(raw, { recursive: true });
      for (let f = 0; f < count; f++) {
        await page.evaluate(t => window.hudAt(t), f / FPS);
        await page.screenshot({ path: path.join(raw, 'f' + String(f).padStart(4, '0') + '.png'), omitBackground: true });
      }
      const output = path.join(directory, scene.id + '-hud.mov');
      await ffmpeg(['-loglevel', 'error', '-framerate', String(FPS), '-start_number', '0', '-i', path.join(raw, 'f%04d.png'),
        '-frames:v', String(count), '-an', '-c:v', 'qtrle', '-pix_fmt', 'argb', '-color_range', 'pc',
        '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart', output]);
      const info = JSON.parse((await execute('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,pix_fmt,nb_frames:format=duration', '-of', 'json', output])).stdout);
      const video = info.streams[0];
      if (video.width !== WIDTH || video.height !== HEIGHT || video.pix_fmt !== 'argb' || Number(video.nb_frames) !== count ||
        Math.abs(Number(info.format.duration) - scene.duration) > .02) throw new Error('Invalid alpha HUD ' + scene.id);
      results.push({ id: scene.id, file: output, frames: count, duration: scene.duration, layout });
    }
  } finally { await browser.close(); }
  return results;
}
export const renderCards = renderSlides;
export const renderHUDs = renderSlides;
