/** V4 recording overlay: one plain mouse cursor and a cream/navy disclosure pill. No captions. */

const PALETTE = { cream: '#FFF3E2', navy: '#1E2A4A', peach: '#FF9A76', wood: '#C68B59' };
const FONT = "'Avenir Next', Avenir, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const TEXT = { normal: 'Fictional demo workspace', terminal: 'Fictional demo · scripted terminal output' };

const CSS = `
  #v4-disclosure{position:fixed;left:64px;bottom:32px;z-index:10000;pointer-events:none;box-sizing:border-box;
    max-width:560px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:5px 14px;border-radius:999px;
    background:${PALETTE.cream};color:${PALETTE.navy};border:1.5px solid ${PALETTE.navy};
    font-family:${FONT};font-weight:400;font-style:normal;font-size:20px;line-height:1.25;letter-spacing:0}
  #v4-disclosure.terminal{font-size:22px}
  #v4-disclosure.hidden{display:none}
  #v4-clickcue{position:fixed;width:32px;height:32px;margin:-16px 0 0 -16px;box-sizing:border-box;border:3px solid #F2A07B;border-radius:50%;z-index:10002;pointer-events:none;opacity:0}
  #v4-clickcue.on{animation:v4-real-click .25s ease-out forwards}
  @keyframes v4-real-click{from{transform:scale(.6);opacity:.7}to{transform:scale(1);opacity:0}}
  #v4-pointer{position:fixed;left:0;top:0;width:20.222px;height:26px;z-index:10001;pointer-events:none;display:none;
    transition:none;animation:none;filter:none}
`;
const ARROW = '<svg width="20.222" height="26" viewBox="0 0 14 18"><path d="M1 1V14L4.8 10.4L7.6 16.8L10.2 15.6L7.4 9.5H13Z" fill="#000" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';

export async function installAnnotations(page) {
  await page.evaluate(({ css, arrow, text }) => {
    // Remove every earlier overlay generation so only one cursor and one disclosure exist.
    for (const key of ['__v4Annotations', '__v3Annotations', '__v2Annotations']) {
      try { window[key]?.dispose?.(); } catch {}
    }
    document.querySelectorAll('#v2-annotation,#v2-pointer,#v2-caption,#v2-disclosure,#v3-annotation,#v3-pointer,'
      + '#v3-caption,#v3-disclosure,#v4-annotation-style,#v4-disclosure,#v4-pointer,#v4-caption,#v4-clickcue').forEach(el => el.remove());
    document.querySelectorAll('style').forEach(s => { if (/#v[23]-(annotation|pointer)/.test(s.textContent)) s.remove(); });

    const style = document.createElement('style'); style.id = 'v4-annotation-style'; style.textContent = css;
    document.head.append(style);
    const disclosure = document.createElement('div'); disclosure.id = 'v4-disclosure'; disclosure.textContent = text.normal;
    const pointer = document.createElement('div'); pointer.id = 'v4-pointer'; pointer.innerHTML = arrow;
    const cue = document.createElement('div'); cue.id = 'v4-clickcue';
    document.body.append(disclosure, pointer, cue);

    const state = { terminal: false, hidden: false, left: '', bottom: '' };
    const visible = el => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.height > 0 && r.width > 0 && Number(getComputedStyle(el).opacity) > 0.05 ? r : null;
    };
    const place = () => {
      const app = document.querySelector('.app');
      const locked = !!document.pointerLockElement || !!app?.classList.contains('is-locked');
      const huds = locked ? [document.querySelector('.locked-hint')] : [document.querySelector('.dock'), document.querySelector('.plaque')];
      const tops = huds.map(visible).filter(Boolean).map(r => r.top);
      const hudTop = tops.length ? Math.min(...tops) : innerHeight - 16;
      const sidebar = app?.classList.contains('has-sidebar') ? visible(document.querySelector('.sidebar')) : null;
      const left = `${sidebar ? Math.max(350, Math.round(sidebar.right + 16)) : 64}px`;
      const bottom = `${Math.max(16, Math.round(innerHeight - hudTop + 16))}px`;
      if (left !== state.left) { disclosure.style.left = left; state.left = left; }
      if (bottom !== state.bottom) { disclosure.style.bottom = bottom; state.bottom = bottom; }
    };
    const setMode = ({ terminal = false } = {}) => {
      const next = !!terminal;
      if (next !== state.terminal || !disclosure.textContent) {
        state.terminal = next;
        disclosure.textContent = next ? text.terminal : text.normal;
        disclosure.classList.toggle('terminal', next);
      }
      place();
    };

    const showPointer = on => { const d = on ? 'block' : 'none'; if (pointer.style.display !== d) pointer.style.display = d; };
    const onMove = e => {
      if (document.pointerLockElement) return showPointer(false);
      pointer.style.left = `${e.clientX - 26 / 18}px`; pointer.style.top = `${e.clientY - 26 / 18}px`;
      showPointer(true);
    };
    const onDown = e => {
      if (e.button !== 0 || document.pointerLockElement) return;
      cue.style.left = `${e.clientX}px`; cue.style.top = `${e.clientY}px`;
      cue.classList.remove('on'); void cue.offsetWidth; cue.classList.add('on');
    };
    const onLock = () => { if (document.pointerLockElement) { showPointer(false); cue.classList.remove('on'); } place(); };
    const onLeave = () => showPointer(false);
    const onOut = e => { if (!e.relatedTarget) showPointer(false); };

    const listeners = [
      [document, 'mousedown', onDown], [document, 'mousemove', onMove], [document, 'pointerlockchange', onLock], [document, 'mouseleave', onLeave],
      [window, 'mouseout', onOut], [window, 'blur', onLeave], [window, 'resize', place],
    ];
    for (const [t, n, f] of listeners) t.addEventListener(n, f, { passive: true });
    const observer = new ResizeObserver(place);
    const observe = () => ['.ui', '.dock', '.plaque', '.locked-hint', '.sidebar']
      .forEach(sel => document.querySelectorAll(sel).forEach(el => observer.observe(el)));
    observe(); observer.observe(document.documentElement);
    // Cheap fallback for HUD elements that mount, fade or move without resizing; writes only on change.
    const timer = setInterval(() => { observe(); place(); }, 100);
    place();

    window.__v4Annotations = {
      mode: setMode,
      get terminal() { return state.terminal; },
      hide: () => { state.hidden = true; disclosure.classList.add('hidden'); },
      show: () => { state.hidden = false; disclosure.classList.remove('hidden'); place(); },
      dispose: () => {
        clearInterval(timer); observer.disconnect();
        for (const [t, n, f] of listeners) t.removeEventListener(n, f);
        disclosure.remove(); pointer.remove(); cue.remove(); style.remove();
        delete window.__v4Annotations;
      },
    };
  }, { css: CSS, arrow: ARROW, text: TEXT });
}

export async function setAnnotationMode(page, { terminal = false } = {}) {
  await page.evaluate(t => window.__v4Annotations?.mode({ terminal: t }), !!terminal);
}

/** Legacy signature; text is ignored because v4 has no captions. Accepts a bool or { terminal }. */
export async function annotate(page, text = '', terminal = false) {
  const t = typeof terminal === 'object' && terminal !== null ? !!terminal.terminal : !!terminal;
  await setAnnotationMode(page, { terminal: t });
}
