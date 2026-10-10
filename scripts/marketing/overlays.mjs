/** Recording-only art direction: Claude Opus 5.5 launch production brief. */
export async function installOverlays(page) {
  await page.addStyleTag({ content: `
    #marketing-overlay { position: fixed; inset: 0; z-index: 10000; pointer-events: none; }
    #marketing-caption { position: absolute; left: 350px; top: 104px; max-width: 800px;
      padding: 18px 24px; background: rgba(15,24,20,.88); border: 1px solid rgba(243,234,215,.17);
      border-radius: 14px; box-shadow: 0 24px 60px -24px rgba(0,0,0,.7);
      color: #f3ead7; font: 500 30px/1.25 -apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;
      opacity: 0; transform: translateY(12px); transition: opacity .3s,transform .3s cubic-bezier(.22,.8,.24,1); }
    #marketing-caption.is-on { opacity: 1; transform: translateY(0); }
    #marketing-caption .marketing-tag { display: block; margin-top: 12px; color: #f1c49d;
      font: 500 16px/1.5 'SF Mono',Menlo,monospace; }
    #marketing-title { position: absolute; left: 350px; top: 100px; width: 1000px;
      color: #faf5ea; opacity: 0; transform: translateY(12px);
      transition: opacity .3s,transform .3s cubic-bezier(.22,.8,.24,1); }
    #marketing-title.is-on { opacity: 1; transform: translateY(0); }
    .marketing-eyebrow { display: block; font: 600 15px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;
      letter-spacing: .16em; text-transform: uppercase; color: #e7a877; margin-bottom: 14px; }
    .marketing-heading { display: block; font: 700 88px/1 'Iowan Old Style',Charter,Georgia,serif; margin-bottom: 16px; }
    .marketing-subtitle { display: block; font: 500 30px/1.25 -apple-system,BlinkMacSystemFont,sans-serif; }
    .marketing-note { display: block; margin-top: 14px; font: 500 16px/1.4 'SF Mono',Menlo,monospace; color: #f1c49d; }
    #marketing-end { position: absolute; inset: 0;
      text-align: center; opacity: 0; transition: opacity .267s; }
    #marketing-end.is-on { opacity: 1; }
    #marketing-end .marketing-content { position: absolute; left: 470px; top: 402px; width: 980px;
      padding: 24px 30px; background: rgba(15,24,20,.88); border: 1px solid rgba(243,234,215,.17);
      border-radius: 14px; }
    #marketing-end svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    #marketing-end .marketing-url { display: block; font: 500 28px/1.5 'SF Mono',Menlo,monospace;
      color: #f1c49d; margin: 26px 0 36px; }
    #marketing-end .marketing-disclosure { font: 400 18px/1.6 -apple-system,BlinkMacSystemFont,sans-serif;
      color: #b8ad94; max-width: 800px; margin: auto; }
    #marketing-pointer { position: fixed; width: 14px; height: 18px; display: none;
      z-index: 10001; pointer-events: none; }
  ` });
  await page.evaluate(() => {
    const container = document.createElement('div');
    container.id = 'marketing-overlay';
    container.innerHTML = `<div id="marketing-caption"></div>
      <div id="marketing-title"><span class="marketing-eyebrow">technologylab</span>
        <span class="marketing-heading">Herdr Office</span>
        <span class="marketing-subtitle">Your Herdr sessions as a 3D office you can walk through.</span>
        <span class="marketing-note">Fictional demo workspace · real app UI</span></div>
      <div id="marketing-end"><svg viewBox="0 0 1920 1080"><path id="marketing-shade" fill="#0a120f" fill-opacity=".72" fill-rule="evenodd"/></svg><div class="marketing-content">
        <span class="marketing-eyebrow">technologylab</span><span class="marketing-heading">Herdr Office</span>
        <span class="marketing-subtitle">A local, first-person office for your Herdr sessions.</span>
        <span class="marketing-url">github.com/technologylab-ai/herdr-office</span>
        <p class="marketing-disclosure">Requires Herdr · Fictional demo · Simulated terminal response</p></div></div>`;
    document.body.append(container);
    // Claude-approved plain macOS arrow; the screencast omits the operating-system pointer.
    const pointer = document.createElement('div');
    pointer.id = 'marketing-pointer';
    pointer.innerHTML = '<svg width="14" height="18" viewBox="0 0 14 18"><path d="M1 1V14L4.8 10.4L7.6 16.8L10.2 15.6L7.4 9.5H13Z" fill="#000" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    document.body.append(pointer);
    document.addEventListener('mousemove', event => {
      pointer.style.display = document.pointerLockElement ? 'none' : 'block';
      pointer.style.left = `${event.clientX - 1}px`;
      pointer.style.top = `${event.clientY - 1}px`;
    });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement) pointer.style.display = 'none';
    });
    document.addEventListener('mouseleave', () => { pointer.style.display = 'none'; });
  });
}

export async function caption(page, text, { left = 350, tag = '', show = true, maxWidth = 800 } = {}) {
  await page.evaluate(({ text, left, tag, show, maxWidth }) => {
    const el = document.getElementById('marketing-caption');
    el.style.left = `${left}px`;
    el.style.maxWidth = `${maxWidth}px`;
    el.replaceChildren(document.createTextNode(text));
    if (tag) {
      const span = document.createElement('span');
      span.className = 'marketing-tag';
      span.textContent = tag;
      el.append(span);
    }
    el.classList.toggle('is-on', show);
  }, { text, left, tag, show, maxWidth });
}

export async function show(page, id, visible = true) {
  if (id === 'marketing-end' && visible) await page.evaluate(() => {
    let d = 'M0 0H1920V1080H0Z';
    for (const element of document.querySelectorAll('.chrome')) {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height || getComputedStyle(element).opacity === '0') continue;
      d += `M${rect.left} ${rect.top}H${rect.right}V${rect.bottom}H${rect.left}Z`;
    }
    document.getElementById('marketing-shade').setAttribute('d', d);
  });
  await page.evaluate(({ id, visible }) => document.getElementById(id).classList.toggle('is-on', visible), { id, visible });
}

export async function removeOverlays(page) {
  await page.locator('#marketing-overlay').evaluate(el => el.remove());
  await page.locator('#marketing-pointer').evaluate(el => el.remove());
}
