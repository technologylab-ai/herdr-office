/** Claude Opus 5.5 V5 annotation spec: light text, no panel, and actual-input cues only. */
const TEXT = { normal: 'Fictional demo world', compressed: 'Fictional demo world · time-compressed' };
const CSS = [
  '#v5-disclosure{position:fixed;right:40px;bottom:40px;z-index:10000;pointer-events:none;',
  'max-width:560px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0;border:0;border-radius:0;',
  'background:none;box-shadow:none;color:rgba(255,255,255,.86);font:400 20px/1.25 -apple-system,"SF Pro Text","Helvetica Neue",Helvetica,Arial,sans-serif;',
  'text-shadow:0 1px 2px rgba(0,0,0,.55),0 0 12px rgba(0,0,0,.35)}',
  '#v5-disclosure.hidden{display:none}',
  '#v5-pointer{position:fixed;width:21.778px;height:28px;z-index:10001;pointer-events:none;display:none;transition:none}',
  '#v5-clickcue{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;box-sizing:border-box;',
  'border:2px solid #FF5A7A;border-radius:50%;z-index:10002;pointer-events:none;opacity:0}',
  '#v5-clickcue.on{animation:v5-real-click .28s ease-out forwards}',
  '@keyframes v5-real-click{from{transform:scale(.6);opacity:.9}to{transform:scale(1);opacity:0}}'
].join('');
const ARROW = '<svg width="21.778" height="28" viewBox="0 0 14 18"><path d="M1 1V14L4.8 10.4L7.6 16.8L10.2 15.6L7.4 9.5H13Z" fill="#000" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
export async function installAnnotations(page) {
  await page.evaluate(({ css, text, arrow }) => {
    for (const name of ['__v5Annotations','__v4Annotations','__v3Annotations','__v2Annotations']) {
      try { window[name]?.dispose?.(); } catch {}
    }
    document.querySelectorAll('[id^="v2-"],[id^="v3-"],[id^="v4-"],[id^="v5-"]').forEach(el => el.remove());
    const style = document.createElement('style'); style.id='v5-annotation-style'; style.textContent=css; document.head.append(style);
    const disclosure=document.createElement('div'); disclosure.id='v5-disclosure'; disclosure.textContent=text.normal;
    const pointer=document.createElement('div'); pointer.id='v5-pointer'; pointer.innerHTML=arrow;
    const cue=document.createElement('div'); cue.id='v5-clickcue';
    document.body.append(disclosure,pointer,cue);
    const state={terminal:false,timeCompressed:false,left:'',bottom:''};
    const visibleRect=el=>{
      if(!el)return null; const r=el.getBoundingClientRect();
      return r.width>0&&r.height>0&&Number(getComputedStyle(el).opacity)>.05?r:null;
    };
    const place=()=>{
      const app=document.querySelector('.app');
      const locked=!!document.pointerLockElement||app?.classList.contains('is-locked');
      const huds=locked?[document.querySelector('.locked-hint')]:[document.querySelector('.dock'),document.querySelector('.plaque')];
      const tops=huds.map(visibleRect).filter(Boolean).map(r=>r.top);
      const top=tops.length?Math.min(...tops):innerHeight-16;
      const sidebar=app?.classList.contains('has-sidebar')?visibleRect(document.querySelector('.sidebar')):null;
      // Terminal scenes use the free left canvas to avoid real drawer controls; no colored box.
      const left=state.terminal?(sidebar?Math.max(350,Math.round(sidebar.right+16)):64)+'px':'auto';
      const bottom=state.terminal?Math.max(16,Math.round(innerHeight-top+16))+'px':'40px';
      if(left!==state.left){disclosure.style.left=left;disclosure.style.right=state.terminal?'auto':'40px';state.left=left;}
      if(bottom!==state.bottom){disclosure.style.bottom=bottom;state.bottom=bottom;}
    };
    const mode=({terminal=false,timeCompressed=false,compressed=timeCompressed}={})=>{
      state.terminal=!!terminal;state.timeCompressed=!!(timeCompressed||compressed);
      const label=state.timeCompressed?text.compressed:text.normal;
      if(disclosure.textContent!==label)disclosure.textContent=label;
      place();
    };
    const move=e=>{
      if(document.pointerLockElement){pointer.style.display='none';return;}
      pointer.style.left=(e.clientX-28/18)+'px';pointer.style.top=(e.clientY-28/18)+'px';pointer.style.display='block';
    };
    const down=e=>{
      if(e.button!==0||document.pointerLockElement)return;
      cue.style.left=e.clientX+'px';cue.style.top=e.clientY+'px';
      cue.classList.remove('on');void cue.offsetWidth;cue.classList.add('on');
    };
    const hidePointer=()=>{pointer.style.display='none';cue.classList.remove('on');};
    const lock=()=>{if(document.pointerLockElement)hidePointer();place();};
    const out=e=>{if(!e.relatedTarget)hidePointer();};
    const listeners=[[document,'mousemove',move],[document,'mousedown',down],[document,'pointerlockchange',lock],
      [document,'mouseleave',hidePointer],[window,'mouseout',out],[window,'blur',hidePointer],[window,'resize',place]];
    listeners.forEach(([target,event,callback])=>target.addEventListener(event,callback,{passive:true}));
    const observer=new ResizeObserver(place);observer.observe(document.documentElement);
    const timer=setInterval(place,100);place();
    window.__v5Annotations={mode,hide:()=>disclosure.classList.add('hidden'),show:()=>{disclosure.classList.remove('hidden');place();},
      dispose:()=>{clearInterval(timer);observer.disconnect();listeners.forEach(([target,event,callback])=>target.removeEventListener(event,callback));
        disclosure.remove();pointer.remove();cue.remove();style.remove();delete window.__v5Annotations;}};
  }, {css:CSS,text:TEXT,arrow:ARROW});
}
export async function setAnnotationMode(page,{terminal=false,timeCompressed=false,compressed=timeCompressed}={}) {
  await page.evaluate(flags=>window.__v5Annotations?.mode(flags),{terminal:!!terminal,timeCompressed:!!(timeCompressed||compressed)});
}
export async function annotate(page,text='',terminal=false) {
  await setAnnotationMode(page,typeof terminal==='object'?terminal:{terminal:!!terminal});
}
