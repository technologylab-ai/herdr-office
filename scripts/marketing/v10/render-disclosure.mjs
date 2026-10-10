/** Rasterize static utility-overlay states from Opus's exact specification. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { disclosure, navigationCue } from './plan.mjs';
const directory=path.resolve('artifacts/marketing/v10/global-overlay');
await mkdir(directory,{recursive:true});
const rgba=(hex,alpha)=>{const v=parseInt(hex.slice(1),16);return `rgba(${v>>16},${(v>>8)&255},${v&255},${alpha})`;};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const states=[{id:'right',mode:'right',navigation:false},{id:'left',mode:'left',navigation:false},{id:'right-navigation',mode:'right',navigation:true},{id:'searchRight',mode:'searchRight',navigation:false}];
const chip=(id,rect,spec)=>{const[x,y,w,h]=rect;return `<div class="chip" id="${id}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${spec.radius}px;background:${rgba(spec.background,spec.backgroundOpacity)};color:${spec.fill};font-size:${spec.fontSize}px;line-height:${spec.lineHeight}px;font-weight:${spec.fontWeight};padding:0 ${spec.paddingX??14}px"><span>${esc(spec.text)}</span></div>`;};
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb','--hide-scrollbars']});
const reports=[];
try{
 const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 await context.route('**/*',route=>route.abort());
 const page=await context.newPage();
 for(const state of states){
  const html='<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:1920px;height:1080px;background:transparent;overflow:hidden}*{box-sizing:border-box}.chip{position:absolute;display:flex;align-items:center;font-family:-apple-system,"SF Pro Text",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}.chip span{white-space:nowrap;flex:none}</style>'+chip('disclosure',disclosure[state.mode],disclosure)+(state.navigation?chip('navigation',navigationCue.rect,navigationCue):'');
  const styledHtml=html+(state.mode==='searchRight'?'<style>#disclosure{justify-content:flex-end}</style>':'');
  await page.setContent(styledHtml);await page.evaluate(()=>document.fonts.ready);
  const boxes=await page.evaluate(()=>[...document.querySelectorAll('.chip')].map(p=>{const r=p.getBoundingClientRect(),t=p.firstElementChild.getBoundingClientRect();return {id:p.id,rect:[r.x,r.y,r.width,r.height],textRect:[t.x,t.y,t.width,t.height],overflow:t.right>r.right||t.bottom>r.bottom};}));
  if(boxes.some(b=>b.overflow))throw new Error('Opus utility overlay text overflow.');
  const file=path.join(directory,state.id+'.png');await page.screenshot({path:file,omitBackground:true});
  await writeFile(path.join(directory,state.id+'.html'),styledHtml);
  reports.push({...state,file:path.relative(process.cwd(),file),boxes});
 }
}finally{await browser.close();}
await writeFile(path.join(directory,'render-report.json'),JSON.stringify(reports,null,2)+'\n');
console.log(JSON.stringify(reports));
