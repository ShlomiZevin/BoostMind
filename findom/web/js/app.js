// Veyra — shared behaviour: config, theme, age gate, tribute sheet, icons.

window.VEYRA_CONFIG = {
  // Chat backend (the external agent service). Unset = local placeholder replies.
  // Contract: POST { queenId, messages: [{ role: "user"|"queen", text }] } -> { reply: "..." }
  chatEndpoint: null,
  // Payments are not connected yet. While true, tributes are recorded locally with no charge.
  demoTributes: true,
};

const Veyra = (() => {
  const store = {
    get(k, fallback) { try { const v = localStorage.getItem('veyra.' + k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
    set(k, v) { try { localStorage.setItem('veyra.' + k, JSON.stringify(v)); } catch {} },
  };

  const icon = {
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M14 6l6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12H4M10 6l-6 6 6 6"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    crown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 3.6L2.9 10.8c-1.3.5-1.3 1.2-.2 1.5l4.8 1.5 1.8 5.6c.2.6.1.9.8.9.5 0 .7-.2 1-.5l2.3-2.3 4.9 3.6c.9.5 1.5.2 1.8-.8l3.2-15.1c.3-1.3-.5-1.9-1.8-1.6zM8.3 13.4l10.1-6.4c.5-.3.9-.1.5.2l-8.6 7.8-.3 3.6-1.7-5.2z"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5" stroke-linecap="round"/></svg>',
    moon: '<svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/></svg>',
    sun: '<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  };

  // ----- theme -----
  function applyTheme(t) { document.documentElement.dataset.theme = t; }
  applyTheme(store.get('theme', 'dark'));
  function themeButton() {
    return `<button class="icon-btn theme-toggle" type="button" aria-label="Toggle light and dark theme" data-theme-toggle>${icon.moon}${icon.sun}</button>`;
  }
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-theme-toggle]')) return;
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    applyTheme(next); store.set('theme', next);
  });

  // ----- helpers -----
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const param = k => new URLSearchParams(location.search).get(k);
  const queen = id => window.QUEENS.find(q => q.id === id);
  const tgUrl = handle => 'https://t.me/' + handle.replace(/^@/, '');

  function overlay(html, cls = '') {
    const el = document.createElement('div');
    el.className = 'overlay ' + cls;
    el.innerHTML = html;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('open'));
    const close = () => { el.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape' && !cls.includes('age-gate')) close(); };
    document.addEventListener('keydown', onKey);
    el.addEventListener('click', e => {
      if (cls.includes('age-gate')) return;
      if (e.target === el || e.target.closest('[data-close]')) close();
    });
    return { el, close };
  }

  // ----- age gate: first visit only -----
  function ageGate() {
    if (store.get('adult', false)) return;
    const { el, close } = overlay(`
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="ag-title">
        <span class="wordmark">Veyrλ</span>
        <h2 id="ag-title">Adults only</h2>
        <p>Veyra is for adults 18 and over. Queens are AI characters.</p>
        <div class="actions">
          <button class="btn btn--solid" data-enter>I'm 18 or older — enter</button>
          <a class="leave" href="https://www.google.com">Leave</a>
        </div>
      </div>`, 'age-gate');
    el.querySelector('[data-enter]').addEventListener('click', () => { store.set('adult', true); close(); });
  }

  // ----- tribute sheet -----
  // onSent(tier) runs after a tribute is recorded (the chat uses it to post her thank-you).
  function tributeSheet(q, preselect, onSent) {
    let chosen = q.tributes.find(t => t.price === preselect) || q.tributes[1];
    const { el, close } = overlay(`
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="tr-title">
        <button class="icon-btn close" data-close aria-label="Close">${icon.close}</button>
        <h2 id="tr-title">Tribute to ${esc(q.name)}</h2>
        <p>Choose an amount. She'll notice.</p>
        <div class="tier-list">
          ${q.tributes.map(t => `<button class="tier" data-price="${t.price}" aria-pressed="${t === chosen}"><span>${esc(t.name)}</span><b>$${t.price}</b></button>`).join('')}
        </div>
        <button class="btn btn--accent btn--block" data-send>Send $${chosen.price}</button>
        <p class="fine">${VEYRA_CONFIG.demoTributes ? 'Preview mode — payments are not connected yet. No charge.' : `${esc(q.name)} is an AI character. Tributes are non-refundable.`}</p>
      </div>`);
    const sendBtn = el.querySelector('[data-send]');
    el.querySelectorAll('.tier').forEach(b => b.addEventListener('click', () => {
      chosen = q.tributes.find(t => t.price === +b.dataset.price);
      el.querySelectorAll('.tier').forEach(x => x.setAttribute('aria-pressed', x === b));
      sendBtn.textContent = `Send $${chosen.price}`;
    }));
    sendBtn.addEventListener('click', () => {
      // Payment provider hooks in here. Until then, record the tribute locally.
      const log = store.get('tributes', []);
      log.push({ queen: q.id, name: chosen.name, price: chosen.price, at: Date.now() });
      store.set('tributes', log);
      close();
      if (onSent) onSent(chosen);
      else location.href = `chat.html?q=${q.id}&tribute=${chosen.price}`;
    });
  }

  function lightbox(src, alt) {
    overlay(`<img src="${src}" alt="${esc(alt)}" data-close>`, 'lightbox');
  }

  function footer() {
    return `<footer class="site-foot"><div class="wrap">
      <span class="wordmark">Veyrλ</span>
      <p>Choose your queen.</p>
      <small>18+ only · Queens are AI characters · © ${new Date().getFullYear()} Veyra</small>
    </div></footer>`;
  }

  document.addEventListener('DOMContentLoaded', ageGate);

  return { store, icon, esc, param, queen, tgUrl, themeButton, tributeSheet, lightbox, footer, overlay };
})();
