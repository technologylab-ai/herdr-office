/** Claude Opus 5.5 V5 frosted-glass overlays and fixed local-blur masks. */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { palette, sequence, glassDesign } from './plan.mjs';
export { installAnnotations, annotate, setAnnotationMode } from './annotations.mjs';
export const directory = path.resolve('artifacts/marketing/v5');
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
  const text = [...panel.querySelectorAll('.content')];
  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = value => 1 - Math.pow(1 - value, 3);
  window.cardAt = window.hudAt = time => {
    const envelope = ease(clamp(time / .35)) * (1 - clamp((time - (config.duration - .30)) / .30));
    panel.style.opacity = String(envelope);
    for (const [i, node] of text.entries()) {
      const amount = ease(clamp((time - i * .08) / .35));
      const out = 1 - clamp((time - (config.duration - .55)) / .25);
      node.style.opacity = String(amount * out);
      node.style.transform = 'translateY(' + (12 * (1 - amount)) + 'px)';
    }
    return time;
  };
  window.cardLayout = () => {
    const title = panel.querySelector('h1'), rect = panel.getBoundingClientRect();
    return { x:rect.x,y:rect.y,width:rect.width,height:rect.height,titleSize:Number.parseFloat(getComputedStyle(title).fontSize),
      overflowX:panel.scrollWidth>panel.clientWidth+1,overflowY:panel.scrollHeight>panel.clientHeight+1 };
  };
  window.cardReady = document.fonts.ready.then(() => {
    const title = panel.querySelector('h1');
    let size = config.titleSize;
    while (size > 56 && title.scrollHeight > size * 1.12 * 2.1) { size -= 2; title.style.fontSize = size + 'px'; }
    window.cardAt(1.1);
    if (location.hash === '#play') {
      const start=performance.now();
      const animate=now=>{window.hudAt((now-start)/1000%config.duration);requestAnimationFrame(animate);};
      requestAnimationFrame(animate);
    }
    return true;
  });
}

export function cardHtml(scene) {
  if (scene?.kind !== 'card' || !scene.card) throw new Error('Expected a V5 glass HUD scene.');
  const [x,y,width,height]=glassDesign.placementsByScene[scene.id];
  const titleSize=palette.titleSize,card=scene.card,cfg={duration:scene.duration,x,y,width,height,titleSize};
  const css=[
    'html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:transparent!important;color:#F6F7F9;',
    'font-family:-apple-system,"SF Pro Text","Helvetica Neue",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}',
    '*{box-sizing:border-box}#hud{position:absolute;left:'+x+'px;top:'+y+'px;width:'+width+'px;height:'+height+'px;',
    'padding:36px 40px;border:1px solid rgba(255,255,255,.24);border-radius:28px;background:rgba(15,17,21,.14);',
    'box-shadow:0 16px 40px rgba(0,0,0,.16);opacity:0;pointer-events:none}',
    '#hud::before{content:"";position:absolute;left:28px;top:0;width:40%;height:1px;',
    'background:linear-gradient(90deg,rgba(255,255,255,.5),rgba(255,255,255,0))}',
    '#hud::after{content:"";position:absolute;inset:0;border-radius:27px;',
    'background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,0) 30%);pointer-events:none}',
    '.content{position:relative;z-index:1;text-shadow:0 1px 2px rgba(0,0,0,.55),0 0 12px rgba(0,0,0,.35)}',
    '.eyebrow{margin:0 0 14px;font-size:18px;font-weight:600;letter-spacing:.16em;color:#FF5A7A;text-transform:uppercase}',
    'h1{font-family:-apple-system,"SF Pro Display","Helvetica Neue",Helvetica,Arial,sans-serif;',
    'font-size:'+titleSize+'px;line-height:1.12;font-weight:300;letter-spacing:-.02em;margin:0;color:#F6F7F9}',
    '.subtitle{font-size:26px;line-height:1.3;font-weight:400;margin-top:16px;overflow-wrap:anywhere;color:rgba(246,247,249,.9)}',
    '.footer{font-size:18px;line-height:1.3;margin-top:18px;color:rgba(246,247,249,.72)}',
    'body.mask #hud{opacity:1!important;background:#fff!important;border:0!important;box-shadow:none!important}',
    'body.mask #hud::before,body.mask #hud::after{display:none!important}body.mask .content{visibility:hidden!important}'
  ].join('');
  return '<!doctype html><html><head><meta charset="utf-8"><title>Herdr Office glass HUD '+esc(scene.id)+'</title><style>'+css+
    '</style></head><body><section id="hud" aria-label="Editorial frosted-glass chapter">'+
    (card.eyebrow?'<div class="content eyebrow">'+esc(card.eyebrow)+'</div>':'')+
    '<h1 class="content">'+esc(card.title)+'</h1>'+
    (card.subtitle?'<div class="content subtitle">'+esc(card.subtitle)+'</div>':'')+
    (card.footer?'<div class="content footer">'+esc(card.footer)+'</div>':'')+
    '</section><script>('+hudRuntime.toString()+')('+JSON.stringify(cfg)+');</script></body></html>';
}
export const documentForCard = cardHtml;
export const hudHtml = cardHtml;

/** Produce straight-alpha RGB tint/rim/text overlays and static rounded blur masks. Root applies real local game blur. */
export async function renderSlides(only = [], { previewsOnly = false } = {}) {
  const ids = [only].flat().filter(Boolean);
  const cards = sequence.filter(s => s.kind === 'card' && (!ids.length || ids.includes(s.id)));
  if (ids.some(id => !cards.some(s => s.id === id))) throw new Error('Unknown V5 HUD id.');
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
      if (layout.overflowX || layout.overflowY || layout.y + layout.height > 1001) throw new Error(scene.id + ' HUD overflow: ' + JSON.stringify(layout));
      await page.screenshot({ path: path.join(directory, scene.id + '-hud.png'), omitBackground: true });
      await page.evaluate(()=>document.body.classList.add('mask'));
      await page.screenshot({path:path.join(directory,scene.id+'-glass-mask.png'),omitBackground:true});
      await page.evaluate(()=>{document.body.classList.remove('mask');window.hudAt(1.1);});

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
