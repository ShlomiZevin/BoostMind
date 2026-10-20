// Sketch Studio's shared top bar for every tool (Video editor, Karaoke, Reader).
//   <script src="/studio/bar.js"></script>  then  <studio-nav app="video|karaoke|reader"></studio-nav> in the page's top bar.
// Inside the studio shell (http://localhost:4747/ - a side rail switches tools) the bar shows only the tool's own
// controls; opened on its own, it also shows the brand and tool tabs (they link back into the shell).
// Every <select> in the bar is shown as the studio's picker (the native dropdown looked out of place).
(() => {
  const inShell = window.top !== window.self;
  const base = location.port === '4747' ? '' : 'http://localhost:4747';
  const TABS = [
    { id: 'video', label: 'Video editor', icon: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="M16 10l5-3v10l-5-3"/>' },
    { id: 'karaoke', label: 'Karaoke', icon: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4"/>' },
    { id: 'reader', label: 'Reader', icon: '<path d="M4 5h11a3 3 0 0 1 3 3v11H7a3 3 0 0 1-3-3z"/><path d="M8 9h6M8 13h6"/>' },
  ];

  const css = document.createElement('style');
  css.textContent = `
    .studio-top { position: sticky !important; top: 0 !important; z-index: 30 !important; display: flex !important; align-items: center !important;
      gap: 10px !important; height: 56px !important; min-height: 56px; padding: 0 16px !important; background: #1a1918 !important;
      border-bottom: 1px solid rgba(255,255,255,0.07) !important; flex-wrap: nowrap; color: #f2f0ed;
      font-family: Inter, Assistant, "Segoe UI", system-ui, sans-serif;
      /* the studio's colours inside the bar, whatever theme the tool's page is in */
      --bg: #1a1918; --text: #f2f0ed; --dim: #aaa59f; --faint: #78736d; --panel: #1a1918; --panel-2: #211f1e; --panel-3: #2a2826;
      --edge: rgba(255,255,255,0.07); --edge-2: rgba(255,255,255,0.12); }
    .studio-top .legacy-nav { display: none !important; }
    .studio-top button, .studio-top a { white-space: nowrap; }
    .studio-top select.studio-enhanced { display: none !important; }
    .sp-btn { display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 10px 0 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12);
      background: #211f1e; color: #f2f0ed; font: 600 13.5px Inter, Assistant, "Segoe UI", sans-serif; cursor: pointer; max-width: 280px; transition: background .15s, border-color .15s; }
    .sp-btn:hover, .sp-btn.open { background: #2a2826; border-color: rgba(255,255,255,0.2); }
    .sp-btn .sp-k { color: #78736d; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
    .sp-btn .sp-v { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sp-btn svg { width: 14px; height: 14px; flex: none; stroke: #aaa59f; fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
    .sp-pop { position: fixed; z-index: 9999; min-width: 240px; max-height: 60vh; overflow: auto; padding: 6px; border-radius: 12px; background: #1f1d1c;
      border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 18px 40px rgba(0,0,0,0.45); font: 500 13.5px Inter, Assistant, "Segoe UI", sans-serif; color: #f2f0ed; }
    .sp-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 8px; cursor: pointer; }
    .sp-item:hover { background: #2a2826; }
    .sp-item .ck { width: 14px; color: #ff6b57; font-weight: 800; }
    .sp-item.on { font-weight: 700; }
    .sp-item.ph { color: #78736d; }
    /* the project menu - one look in every tool (video editor, Reader, Karaoke) */
    .pp-btn { height: 34px; display: inline-flex; align-items: center; gap: 10px; padding: 0 12px; background: #211f1e; border: 1px solid rgba(255,255,255,0.12);
      border-radius: 4px; color: #f2f0ed; cursor: pointer; max-width: 320px; font: 600 14px Inter, Assistant, "Segoe UI", sans-serif; transition: border-color .15s, background .15s; }
    .pp-btn:hover, .pp-btn.open { border-color: rgba(255,255,255,0.22); background: #2a2826; }
    .pp-btn .pp-label { font-size: 11px; letter-spacing: .08em; color: #78736d; text-transform: uppercase; font-weight: 600; }
    .pp-btn .pp-cur { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pp-btn .pp-cur.done { color: #aaa59f; }
    .pp-btn svg { width: 14px; height: 14px; flex: none; stroke: #aaa59f; fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
    .pp-pop { position: fixed; z-index: 9999; width: 380px; background: #1a1918; border: 1px solid rgba(255,255,255,0.12); border-radius: 6px;
      box-shadow: 0 16px 40px rgba(0,0,0,0.45); padding: 8px; font: 500 13.5px Inter, Assistant, "Segoe UI", sans-serif; color: #f2f0ed; }
    .pp-search { width: 100%; box-sizing: border-box; height: 34px; margin-bottom: 6px; background: #131211; border: 1px solid rgba(255,255,255,0.12); border-radius: 4px;
      color: #f2f0ed; padding: 0 10px; outline: none; font: inherit; }
    .pp-search:focus { border-color: #ff6b57; }
    .pp-list { max-height: min(62vh, 560px); overflow: auto; }
    .pp-list::-webkit-scrollbar { width: 8px; } .pp-list::-webkit-scrollbar-thumb { background: #2a2826; border-radius: 4px; }
    .pp-sec { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: #78736d; padding: 10px 10px 4px; }
    .pp-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 4px; cursor: pointer; border-left: 2px solid transparent; }
    .pp-row:hover { background: #211f1e; }
    .pp-row.on { background: #2a2826; border-left-color: #ff6b57; }
    .pp-row.done .pp-id, .pp-row.done .pp-title { color: #78736d; }
    .pp-check { flex: none; width: 20px; height: 20px; border-radius: 4px; border: 1.5px solid rgba(255,255,255,0.12); background: transparent; color: #131211;
      font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
    .pp-check:hover { border-color: #ff6b57; }
    .pp-check.on { background: #ff6b57; border-color: #ff6b57; }
    .pp-ic { flex: none; width: 20px; text-align: center; color: #78736d; }
    .pp-main { flex: 1; min-width: 0; }
    .pp-id { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .pp-tag { font-size: 10px; font-weight: 600; color: #aaa59f; background: #2a2826; border: 1px solid rgba(255,255,255,0.07); border-radius: 3px; padding: 1px 5px; }
    .pp-title { font-size: 12px; color: #aaa59f; direction: rtl; text-align: left; unicode-bidi: plaintext; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }
    .pp-meta { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; font-size: 11px; color: #78736d; }
    .pp-del { flex: none; width: 22px; height: 22px; border-radius: 4px; border: 1px solid transparent; background: transparent; color: #78736d; cursor: pointer; padding: 0; }
    .pp-row:hover .pp-del { border-color: rgba(255,255,255,0.12); }
    .pp-del:hover { color: #ff8a7a; border-color: #ff8a7a !important; }
    .pp-empty { padding: 14px 10px; color: #78736d; font-size: 13px; }
    @media (max-width: 700px) { .studio-top { height: auto !important; flex-wrap: wrap !important; padding: 8px 12px !important; } }`;
  document.head.appendChild(css);

  // ---- the brand + tool tabs (only outside the shell) ----
  class StudioNav extends HTMLElement {
    connectedCallback() {
      const app = this.getAttribute('app');
      this.closest('header, .top')?.classList.add('studio-top');
      if (app === 'karaoke') { try { if (!localStorage.getItem('kb-theme')) document.documentElement.dataset.theme = 'dark'; } catch {} }
      if (inShell) { this.style.display = 'none'; return; }  // the shell's rail does this job
      const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
      root.innerHTML = `
        <style>
          :host { display: flex; align-items: center; gap: 14px; flex: none; font: 600 13px/1 Inter, Assistant, "Segoe UI", system-ui, sans-serif; color: #f2f0ed; }
          .brand { display: flex; align-items: center; gap: 9px; font-weight: 700; font-size: 15px; white-space: nowrap; color: #f2f0ed; text-decoration: none; }
          .mark { width: 26px; height: 26px; border-radius: 7px; background: #ff6b57; color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 14px; }
          .tabs { display: flex; gap: 2px; padding: 3px; background: #131211; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; }
          a.tab { display: flex; align-items: center; gap: 7px; height: 30px; padding: 0 12px; border-radius: 7px; color: #aaa59f; text-decoration: none; white-space: nowrap; }
          a.tab:hover, a.tab.on { color: #f2f0ed; background: #2a2826; }
          a.tab.on svg { stroke: #ff6b57; }
          svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
          .sep { width: 1px; height: 22px; background: rgba(255,255,255,0.12); }
        </style>
        <a class="brand" href="${base}/#${app}"><div class="mark">S</div>Sketch Studio</a>
        <nav class="tabs">${TABS.map((t) => `<a class="tab ${t.id === app ? 'on' : ''}" href="${base}/#${t.id}"><svg viewBox="0 0 24 24">${t.icon}</svg>${t.label}</a>`).join('')}</nav>
        <div class="sep"></div>`;
    }
  }
  if (!customElements.get('studio-nav')) customElements.define('studio-nav', StudioNav);

  // ---- the project menu: <select data-picker="project"> - each <option> may carry data-sub (title), data-meta
  // (right side), data-tag, data-done="1" (a Done section + a ✓ to toggle: fires "studio-done" on the select),
  // data-group (a section of its own) and data-del="1" (a ✕: fires "studio-delete"). The tool keeps its own list.
  const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function enhanceProject(sel) {
    if (sel.classList.contains('studio-enhanced')) return;
    sel.classList.add('studio-enhanced');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'pp-btn';
    sel.after(btn);
    const label = () => {
      const o = sel.options[sel.selectedIndex];
      const done = o && o.dataset.done === '1';
      btn.innerHTML = `<span class="pp-label">${esc(sel.dataset.label || 'Project')}</span><span class="pp-cur ${done ? 'done' : ''}">${done ? '✓ ' : ''}${esc(o && o.value ? o.textContent : '—')}</span>${chev}`;
    };
    label();
    sel.addEventListener('change', label);
    setInterval(() => { const sig = sel.value + '|' + [...sel.options].map((o) => o.value + (o.dataset.done || '')).join(','); if (btn.dataset.v !== sig) { btn.dataset.v = sig; label(); } }, 400);
    btn.onclick = (e) => { e.stopPropagation(); if (pop) return close(); openProjectMenu(sel, btn, label); };
  }
  function openProjectMenu(sel, btn, label) {
    btn.classList.add('open');
    pop = document.createElement('div');
    pop.className = 'pp-pop';
    pop.innerHTML = `<input class="pp-search" placeholder="Search" /><div class="pp-list"></div>`;
    const list = pop.querySelector('.pp-list'), search = pop.querySelector('input');
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const opts = [...sel.options].filter((o) => o.value && (!q || `${o.textContent} ${o.dataset.sub || ''}`.toLowerCase().includes(q)));
      const groups = [];
      const group = (o) => o.dataset.group || (o.dataset.done === '1' ? 'Done' : 'In progress');
      for (const o of opts) { const g = group(o); let G = groups.find((x) => x.name === g); if (!G) groups.push((G = { name: g, items: [] })); G.items.push(o); }
      groups.sort((a, b) => (a.name === 'Done') - (b.name === 'Done'));  // Done sinks to the bottom
      list.innerHTML = groups.map((G) => `<div class="pp-sec">${esc(G.name)} · ${G.items.length}</div>` + G.items.map((o) => {
        const done = o.dataset.done === '1', canDone = 'done' in o.dataset;
        return `<div class="pp-row ${o.value === sel.value ? 'on' : ''} ${done ? 'done' : ''}" data-v="${esc(o.value)}">
          ${canDone ? `<button class="pp-check ${done ? 'on' : ''}" data-done-toggle title="${done ? 'Done - click to reopen' : 'Mark as done'}">${done ? '✓' : ''}</button>` : `<span class="pp-ic">${esc(o.dataset.icon || '')}</span>`}
          <div class="pp-main"><div class="pp-id">${esc(o.textContent)}${o.dataset.tag ? `<span class="pp-tag">${esc(o.dataset.tag)}</span>` : ''}</div>
            ${o.dataset.sub && o.dataset.sub !== o.textContent ? `<div class="pp-title">${esc(o.dataset.sub)}</div>` : ''}</div>
          <div class="pp-meta">${(o.dataset.meta || '').split('·').map((m) => `<span>${esc(m.trim())}</span>`).join('')}</div>
          ${o.dataset.del === '1' ? '<button class="pp-del" data-del title="Delete">✕</button>' : ''}
        </div>`; }).join('')).join('') || `<div class="pp-empty">${search.value.trim() ? 'Nothing matches.' : 'No projects yet.'}</div>`;
    };
    draw();
    search.oninput = draw;
    list.onclick = (e) => {
      const row = e.target.closest('.pp-row'); if (!row) return;
      const v = row.dataset.v, o = [...sel.options].find((x) => x.value === v);
      if (e.target.closest('[data-done-toggle]')) {
        e.stopPropagation();
        const done = o.dataset.done !== '1';
        o.dataset.done = done ? '1' : '0';
        sel.dispatchEvent(new CustomEvent('studio-done', { detail: { value: v, done } }));
        draw(); label(); return;
      }
      if (e.target.closest('[data-del]')) { e.stopPropagation(); sel.dispatchEvent(new CustomEvent('studio-delete', { detail: { value: v } })); close(); return; }
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(sel, v);  // so React's controlled select sees it too
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      label(); close();
    };
    pop.addEventListener('click', (e) => e.stopPropagation());
    document.body.appendChild(pop);
    const r = btn.getBoundingClientRect();
    pop.style.top = `${r.bottom + 6}px`;
    pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8))}px`;
    search.focus();
  }

  // ---- the studio picker in place of native dropdowns ----
  const chev = '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
  function enhance(sel) {
    if (sel.dataset.picker === 'project') return enhanceProject(sel);
    if (sel.classList.contains('studio-enhanced')) return;
    sel.classList.add('studio-enhanced');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'sp-btn';
    const key = sel.getAttribute('data-label') || (sel.closest('.proj') || sel.id === 'ep' ? 'Project' : '');
    sel.after(btn);
    const label = () => {
      const o = sel.options[sel.selectedIndex];
      btn.innerHTML = `${key ? `<span class="sp-k">${key}</span>` : ''}<span class="sp-v">${o ? o.textContent : '—'}</span>${chev}`;
    };
    label();
    sel.addEventListener('change', label);
    setInterval(() => { if (btn.dataset.v !== sel.value + sel.options.length) { btn.dataset.v = sel.value + sel.options.length; label(); } }, 400);  // React sets .value quietly
    btn.onclick = (e) => { e.stopPropagation(); open(sel, btn, label); };
  }
  let pop = null;
  function close() { pop?.remove(); pop = null; document.querySelectorAll('.sp-btn.open').forEach((b) => b.classList.remove('open')); }
  function open(sel, btn, label) {
    if (pop) return close();
    btn.classList.add('open');
    pop = document.createElement('div');
    pop.className = 'sp-pop';
    [...sel.options].forEach((o) => {
      const it = document.createElement('div');
      it.className = 'sp-item' + (o.value === sel.value ? ' on' : '') + (o.value === '' ? ' ph' : '');
      it.innerHTML = `<span class="ck">${o.value === sel.value ? '✓' : ''}</span>${o.textContent}`;
      it.onclick = () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
        setter.call(sel, o.value);  // so React's controlled select sees it too
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        label(); close();
      };
      pop.appendChild(it);
    });
    document.body.appendChild(pop);
    const r = btn.getBoundingClientRect();
    pop.style.top = `${r.bottom + 6}px`;
    pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8))}px`;
  }
  document.addEventListener('click', (e) => { if (pop && !pop.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  const scan = () => document.querySelectorAll('.studio-top select, select[data-picker="project"]').forEach(enhance);
  document.documentElement.classList.add('in-studio');
  // one project for every tool: the editor, the Reader and Karaoke all show the project picked in any of them
  window.StudioProject = {
    get: () => { try { return localStorage.getItem('zc-ep') || ''; } catch { return ''; } },
    set: (id) => { try { localStorage.setItem('zc-ep', id); } catch {} },
    onChange: (fn) => addEventListener('storage', (e) => { if (e.key === 'zc-ep' && e.newValue) fn(e.newValue); }),
  };  // a tool can hide its own project button inside the studio
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('DOMContentLoaded', scan);
})();
