// Veyra chat page. The queen's replies come from getReply(): the external agent
// service when VEYRA_CONFIG.chatEndpoint is set, otherwise placeholder lines in her voice.

(() => {
  const { icon, esc, param, queen, tgUrl, store, themeButton, tributeSheet } = Veyra;
  const q = queen(param('q')) || queen(store.get('lastQueen')) || QUEENS[0];
  store.set('lastQueen', q.id);
  document.title = `${q.name} — Veyra`;

  const $ = id => document.getElementById(id);
  const key = 'chat.' + q.id;
  let history = store.get(key, []);
  const save = () => store.set(key, history);
  const time = at => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ----- static chrome -----
  $('theme-slot').outerHTML = themeButton();
  $('queens-title').innerHTML = `${icon.crown} Queens`;
  $('queen-list').innerHTML = QUEENS.map(x => `
    <a href="chat.html?q=${x.id}" ${x.id === q.id ? 'aria-current="page"' : ''}>
      <img src="${x.images.avatar}" alt="">
      <div><strong>${esc(x.name)}</strong><span>${esc(x.traits)}</span></div>
    </a>`).join('');

  $('chat-head').innerHTML = `
    <img src="${q.images.avatar}" alt="">
    <div class="who">
      <div><h1>${esc(q.name)}</h1></div>
      <p>${esc(q.traits)}</p>
    </div>
    <a class="back" href="index.html">${icon.back}<span>Back to queens</span></a>
    <a class="icon-btn mobile-only tg-quick" href="${tgUrl(q.telegram)}" target="_blank" rel="noopener" aria-label="Her Telegram channel">${icon.telegram}</a>
    <button class="icon-btn mobile-only" id="info-toggle" aria-label="About ${esc(q.name)}">${icon.info}</button>`;

  $('chat-info').innerHTML = `
    <button class="icon-btn info-close" id="info-close" aria-label="Close">${icon.close}</button>
    <div class="photo"><img src="${q.images.card}" alt="${esc(q.name)}"></div>
    <div class="name"><h2>${esc(q.name)}</h2></div>
    <p>${esc(q.tagline)}</p>
    <button class="btn btn--accent btn--block" id="tribute-btn">${icon.crown} Send a tribute</button>
    <a class="tg-card" href="${tgUrl(q.telegram)}" target="_blank" rel="noopener">
      ${icon.telegram}
      <div><strong>Join her Telegram channel</strong><span>${esc(q.telegramNote)}</span></div>
      <span class="go">${icon.chevron}</span>
    </a>
    <a class="view-profile" href="${q.id}.html">View her profile</a>`;
  $('send').innerHTML = icon.send;
  $('quick-tribute').innerHTML = icon.crown;

  const info = $('chat-info');
  $('info-toggle').addEventListener('click', () => info.classList.add('open'));
  $('info-close').addEventListener('click', () => info.classList.remove('open'));

  // ----- messages -----
  const box = $('messages');
  function renderOne(m) {
    if (m.role === 'note') return `<div class="msg-note">${m.html}</div>`;
    const me = m.role === 'user';
    return `<div class="msg ${me ? 'me' : ''}">
      ${me ? '' : `<img src="${q.images.avatar}" alt="">`}
      <div><div class="bubble">${esc(m.text)}</div><time>${time(m.at)}</time></div>
    </div>`;
  }
  function render() {
    box.innerHTML = history.map(renderOne).join('');
    box.scrollTop = box.scrollHeight;
  }
  function push(m) { history.push({ at: Date.now(), ...m }); save(); render(); }

  function typing(on) {
    box.querySelector('.typing')?.remove();
    if (on) {
      box.insertAdjacentHTML('beforeend', `<div class="msg typing"><img src="${q.images.avatar}" alt=""><div class="bubble"><i></i><i></i><i></i></div></div>`);
      box.scrollTop = box.scrollHeight;
    }
  }

  // ----- the one integration point -----
  let lastLine = -1;
  async function getReply() {
    const cfg = window.VEYRA_CONFIG;
    if (cfg.chatEndpoint) {
      const res = await fetch(cfg.chatEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          queenId: q.id,
          messages: history.filter(m => m.role !== 'note').map(m => ({ role: m.role, text: m.text })),
        }),
      });
      if (!res.ok) throw new Error('chat ' + res.status);
      return (await res.json()).reply;
    }
    // Placeholder until the agent service is connected.
    await new Promise(r => setTimeout(r, 900 + Math.random() * 1100));
    let i;
    do { i = Math.floor(Math.random() * q.lines.length); } while (i === lastLine && q.lines.length > 1);
    lastLine = i;
    return q.lines[i];
  }

  let busy = false;
  async function answer() {
    busy = true; typing(true);
    try { push({ role: 'queen', text: await getReply() }); }
    catch { typing(false); push({ role: 'note', html: 'She didn’t answer. Try again in a moment.' }); }
    finally { typing(false); busy = false; syncSend(); }
  }

  // ----- composer -----
  const input = $('input'), send = $('send');
  const syncSend = () => { send.disabled = busy || !input.value.trim(); };
  input.addEventListener('input', syncSend);
  $('composer').addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = ''; syncSend();
    push({ role: 'user', text });
    answer();
  });

  // ----- tributes -----
  function tributeSent(t) {
    push({ role: 'note', html: `You sent <b>${esc(t.name)} · $${t.price}</b>${VEYRA_CONFIG.demoTributes ? ' (preview — no charge)' : ''}` });
    busy = true; typing(true);
    setTimeout(() => { typing(false); push({ role: 'queen', text: q.thanks }); busy = false; syncSend(); }, 1100);
  }
  const openTribute = () => { info.classList.remove('open'); tributeSheet(q, null, tributeSent); };
  $('tribute-btn').addEventListener('click', openTribute);
  $('quick-tribute').addEventListener('click', openTribute);

  // ----- start -----
  if (!history.length) push({ role: 'queen', text: q.opening });
  else render();

  // Arriving from a tribute on her profile page.
  const paid = +param('tribute');
  if (paid) {
    const t = q.tributes.find(x => x.price === paid);
    window.history.replaceState(null, '', `chat.html?q=${q.id}`);
    if (t) tributeSent(t);
  }

  if (matchMedia('(min-width: 721px)').matches) input.focus();
})();
