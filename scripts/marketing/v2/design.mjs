/** Claude Opus 5.5's expanded teaser cards and recording-only annotations. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const directory = path.resolve('artifacts/marketing/v2');
export const slideDefinitions = [
  { id: 'cover', duration: 5, eyebrow: 'TECHNOLOGYLAB', title: 'Herdr Office', subtitle: 'Your Herdr sessions as a 3D office you can walk through.', footer: 'Fictional demo workspace · real app UI', titleSize: 148 },
  { id: 'walk-card', duration: 3, eyebrow: '01', title: 'Walk between projects', subtitle: 'First person. WASD to move, Shift to run.', titleSize: 96, chapter: true },
  { id: 'terminal-card', duration: 3, eyebrow: '02', title: 'Watch, then steer', subtitle: 'Open a desk, read the output, send the next instruction.', titleSize: 96, chapter: true },
  { id: 'end', duration: 6, eyebrow: 'TECHNOLOGYLAB', title: 'Herdr Office', subtitle: 'A local, first-person office for your Herdr sessions.', url: 'github.com/technologylab-ai/herdr-office', footer: 'Requires Herdr · Fictional demo · Simulated terminal responses', titleSize: 132 },
];

export async function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    const child = spawn('ffmpeg', ['-y', '-hide_banner', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve(stderr) : reject(new Error(stderr)));
  });
}

export async function renderSlides() {
  await mkdir(directory, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    for (const slide of slideDefinitions) {
      const html = `<!doctype html><html><meta charset="utf-8"><style>
        html,body{margin:0;width:1920px;height:1080px;background:transparent;color:#f3ead7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
        .content{position:absolute;left:160px;top:50%;transform:translateY(-50%);width:1600px}
        .eyebrow{font-family:${slide.chapter ? "'Iowan Old Style',Georgia,serif" : "'Helvetica Neue',Helvetica,sans-serif"};font-size:${slide.chapter ? 36 : 22}px;font-weight:500;letter-spacing:${slide.chapter ? '.02em' : '.2em'};color:#e7a877;margin:0 0 30px}
        .rule{height:2px;width:120px;background:#e7a877;margin-bottom:28px}
        h1{font:400 ${slide.titleSize}px/1.06 'Iowan Old Style',Charter,Georgia,serif;letter-spacing:-.02em;margin:0 0 28px}
        .subtitle{font-size:${slide.chapter ? 34 : 40}px;line-height:1.3;max-width:1550px;color:rgba(243,234,215,${slide.chapter ? .75 : .8})}
        .url{font-size:36px;font-weight:500;color:#5fdbe8;margin-top:42px}
        .footer{position:absolute;left:160px;bottom:96px;font-size:22px;line-height:1.3;color:${slide.id === 'cover' ? '#5fdbe8' : 'rgba(243,234,215,.6)'}}
        </style><body><div class="content"><div class="eyebrow">${slide.eyebrow}</div><div class="rule"></div><h1>${slide.title}</h1><div class="subtitle">${slide.subtitle}</div>${slide.url ? `<div class="url">${slide.url}</div>` : ''}</div>${slide.footer ? `<div class="footer">${slide.footer}</div>` : ''}</body></html>`;
      await page.setContent(html);
      await page.screenshot({ path: path.join(directory, `${slide.id}.png`), omitBackground: true });
      await writeFile(path.join(directory, `${slide.id}.html`), html);
      await ffmpeg(['-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=0x0a120f:s=1920x1080:r=30:d=${slide.duration}`,
        '-loop', '1', '-framerate', '30', '-i', path.join(directory, `${slide.id}.png`), '-filter_complex',
        `[1:v]format=rgba${slide.id === 'cover' ? ',fade=t=in:st=0:d=0.6:alpha=1' : ''}[text];[0:v][text]overlay=shortest=1,format=yuv420p[v]`,
        '-map', '[v]', '-an', '-t', String(slide.duration), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
        '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
        '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart', path.join(directory, `${slide.id}.mp4`)]);
    }
  } finally { await browser.close(); }
}

export async function installAnnotations(page) {
  await page.addStyleTag({ content: `
    #v2-annotation{position:fixed;inset:0;z-index:10000;pointer-events:none;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif}
    #v2-caption{position:absolute;left:64px;top:104px;max-width:790px;padding:18px 24px;background:rgba(10,18,15,.88);border-left:4px solid #e7a877;color:#f3ead7;font-size:34px;line-height:1.25;font-weight:500;opacity:0;transform:translateY(6px);transition:opacity .3s,transform .3s}
    #v2-caption.on{opacity:1;transform:none}
    #v2-disclosure{position:absolute;right:48px;bottom:128px;color:#5fdbe8;font-size:20px;line-height:1.2;text-shadow:0 1px 3px #0a120f}
    #v2-disclosure.terminal{right:auto;left:64px;font-size:22px;max-width:560px;white-space:nowrap}
    #v2-pointer{position:fixed;width:14px;height:18px;z-index:10001;pointer-events:none;display:none}
  ` });
  await page.evaluate(() => {
    const overlay = document.createElement('div'); overlay.id = 'v2-annotation';
    overlay.innerHTML = '<div id="v2-caption"></div><div id="v2-disclosure">Fictional demo workspace</div>';
    document.body.append(overlay);
    const pointer = document.createElement('div'); pointer.id = 'v2-pointer';
    pointer.innerHTML = '<svg width="14" height="18" viewBox="0 0 14 18"><path d="M1 1V14L4.8 10.4L7.6 16.8L10.2 15.6L7.4 9.5H13Z" fill="#000" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    document.body.append(pointer);
    document.addEventListener('mousemove', event => {
      pointer.style.display = document.pointerLockElement ? 'none' : 'block';
      pointer.style.left = `${event.clientX - 1}px`; pointer.style.top = `${event.clientY - 1}px`;
    });
    document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement) pointer.style.display = 'none'; });
    document.addEventListener('mouseleave', () => { pointer.style.display = 'none'; });
  });
}

export async function annotate(page, text, { sidebar = false, terminal = false, show = true } = {}) {
  await page.evaluate(({ text, sidebar, terminal, show }) => {
    const caption = document.getElementById('v2-caption');
    caption.textContent = text; caption.style.left = `${sidebar ? 350 : 64}px`;
    caption.style.maxWidth = `${terminal ? 770 : 900}px`;
    caption.classList.toggle('on', show);
    const disclosure = document.getElementById('v2-disclosure');
    disclosure.textContent = terminal ? 'Fictional demo · scripted terminal output' : 'Fictional demo workspace';
    disclosure.classList.toggle('terminal', terminal);
    const hud = document.querySelector('.dock, .locked-hint');
    const top = hud?.getBoundingClientRect().top ?? innerHeight - 100;
    if (terminal) { disclosure.style.bottom = `${innerHeight - top + 16}px`; }
    else disclosure.style.bottom = `${Math.max(112, innerHeight - top + 16)}px`;
  }, { text, sidebar, terminal, show });
}
