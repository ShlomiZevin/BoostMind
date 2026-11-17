// The Shlomiverse game protocol, the game's side. Every game in the verse loads it in its <head>:
//   <script src="/verse/game-frame.js"></script>
// and takes its top offset from one variable, so it keeps a strip free for what the platform adds:
//   --safe-t: calc(env(safe-area-inset-top, 0px) + var(--verse-top, 0px));
// Inside the verse's game page (/play/<id>,
// verse/player.js openGame) the page answers this script's hello, and then:
//   - <html> gets class "in-verse" (a game hides its own share / like / "back to the site" with .verse-hide);
//   - in full screen --verse-top = the height of the strip where the verse puts the character's face and
//     "יציאה ממסך מלא" (0 in the frame, where the profile and buttons sit outside the game) - html.verse-full, and a
//     `verseframe` event with { top } for canvas games that draw their own HUD (window.VerseFrame.top);
//   - links that leave the game open in the whole tab, never inside the frame; a link back to the game's own hub
//     (/hani-games/, ../) goes to the verse's games page instead.
// Daily records: at game over the game reports its final score - one line, `window.VerseFrame && VerseFrame.score(n)` -
// and game.json says what it is called: "record": { "unit": "נקודות", "better": "high" } ("low" for a time). The verse
// keeps the day's table, shows it on the home and on the game page, and celebrates a new record.
// Every play goes through the verse (sign-in, records): a game opened on its own address forwards to its page there.
// ?solo=1 (or ?notrack=1, or localhost) keeps it on its own - for testing.
// The way back to the games feed (his call 2026-11-17): ONE button on the game's own main menu / start screen - class
// "verse-only" (shown only inside the verse) + data-verse-back, or a call to window.VerseGame.back(); it returns to the feed at
// the same game. VerseGame.inVerse says the game runs inside the verse. Exits inside the game (pause menu, home) keep going to
// the game's own menu. A link marked data-verse-back (an existing "לכל המשחקים") does the same instead of leaving.
// The button itself is the verse's, the same in every game (his rule): a game places <span data-verse-back-btn></span> in its
// main menu and this script draws it there - an orange pill with the planet and "חזרה למשחקים", scoped styles, only in the verse.
// (?autostart=1 - pressing the start button for the game - is kept inert: nothing passes it since his call to drop it.)
(() => {
  const root = document.documentElement;
  window.VerseFrame = { inVerse: false, top: 0, score() {} };
  window.VerseGame = { inVerse: false, back() {} };
  if (window.top === window) {
    const q = new URLSearchParams(location.search), parts = location.pathname.split('/').filter(Boolean);
    const solo = q.has('solo') || q.has('notrack') || /^(localhost|127\.)/.test(location.hostname);
    if (!solo && parts.length >= 2 && /-games$/.test(parts[0])) location.replace(`/play/${parts[0]}-${parts[1]}`);
    return;
  }
  window.VerseGame.back = () => { parent.postMessage({ verse: 'back' }, '*'); };
  window.VerseFrame.score = (n) => { if (window.VerseFrame.inVerse && Number(n) > 0) parent.postMessage({ verse: 'score', value: Number(n) }, '*'); };
  const css = document.createElement('style');
  css.textContent = 'html.in-verse .verse-hide{display:none!important}html:not(.in-verse) .verse-only{display:none!important}'
    + 'html:not(.in-verse) [data-verse-back-btn]{display:none!important}'
    + '[data-verse-back-btn]{display:inline-flex;justify-content:center}'
    + '.vxgb-btn{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 22px 0 18px;border-radius:999px;'
    + 'background:#ff6a1f;color:#fff;font:800 16px/1 system-ui,-apple-system,"Segoe UI",Arial,sans-serif;direction:rtl;white-space:nowrap;cursor:pointer;'
    + 'box-shadow:0 6px 18px rgba(255,106,31,.38),inset 0 1px 0 rgba(255,255,255,.25);-webkit-tap-highlight-color:transparent}'
    + '.vxgb-btn:active{transform:scale(.97)}.vxgb-btn img{width:26px;height:26px;object-fit:contain;flex:none}';
  document.head.appendChild(css);
  const set = (top) => {
    top = Math.max(0, Math.round(Number(top) || 0));
    window.VerseFrame.inVerse = true;
    window.VerseGame.inVerse = true;
    window.VerseFrame.top = top;
    root.classList.add('in-verse');
    root.classList.toggle('verse-full', top > 0);
    root.style.setProperty('--verse-top', top + 'px');
    dispatchEvent(new CustomEvent('verseframe', { detail: { top } }));
  };
  // --verse-bottom: the phone's bottom safe area in full screen (a frame doesn't get env(safe-area-inset-bottom)) - a game adds it
  // to its bottom padding: --safe-b: calc(env(safe-area-inset-bottom, 0px) + var(--verse-bottom, 0px))
  addEventListener('message', (e) => { const d = e.data; if (d && d.verse === 'frame' && e.source === parent) { root.style.setProperty('--verse-bottom', Math.max(0, Math.round(+d.bottom || 0)) + 'px'); set(d.top); } });
  if (new URLSearchParams(location.search).get('autostart') === '1') {
    root.classList.add('verse-autostart');
    // while it waits: the game hidden (no taps land), a small orange spinner on the game's own background, so it never looks frozen
    css.textContent += 'html.verse-autostart body{opacity:0!important;pointer-events:none!important}'
      + 'html.verse-autostart::before{content:"";position:fixed;inset:0;z-index:2147483646;background:var(--verse-bg,#0b0b0e)}'
      + 'html.verse-autostart::after{content:"";position:fixed;z-index:2147483647;left:50%;top:50%;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;'
      + 'border:3px solid rgba(255,106,31,.25);border-top-color:#ff6a1f;animation:verse-spin .8s linear infinite}'
      + '@keyframes verse-spin{to{transform:rotate(360deg)}}';
    const paintBg = () => { if (!document.body) return; const c = getComputedStyle(document.body).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') root.style.setProperty('--verse-bg', c); };
    if (document.readyState === 'loading') addEventListener('DOMContentLoaded', paintBg); else paintBg();
    const shown = (b) => { if (!b || b.disabled || b.offsetParent === null) return false; for (let n = b; n && n !== document.body; n = n.parentElement) { const c = getComputedStyle(n); if (c.visibility === 'hidden' || c.opacity === '0' || c.display === 'none') return false; } return true; };
    const t0 = Date.now();
    const tryStart = () => {
      if (root.hasAttribute('data-verse-noautostart')) { root.classList.remove('verse-autostart'); return; }   // a game whose #playBtn is something else (Yosef's book)
      // <html data-verse-wait>: the game marks its start button data-verse-start itself once it is ready (its data loaded)
      const b = document.querySelector('[data-verse-start]') || (root.hasAttribute('data-verse-wait') ? null : ['#playBtn', '#playB', '#bPlay'].map((s) => document.querySelector(s)).find(Boolean));
      if (b && shown(b)) {
        b.click();
        // pressed before the game listened (its script still loading): once more, a moment later
        setTimeout(() => { if (shown(b) && Date.now() - t0 < 15000) tryStart(); else root.classList.remove('verse-autostart'); }, 350);
        return;
      }
      if (Date.now() - t0 > 15000 || (document.readyState === 'complete' && !b && !root.hasAttribute('data-verse-wait') && Date.now() - t0 > 300)) { root.classList.remove('verse-autostart'); return; }   // nothing to press: the game as it is
      setTimeout(tryStart, 120);
    };
    if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => setTimeout(tryStart, 50)); else setTimeout(tryStart, 50);
  }
  parent.postMessage({ verse: 'hello' }, '*');
  // the verse's own back button, drawn into every placeholder the game put in its menu
  const drawBack = () => document.querySelectorAll('[data-verse-back-btn]:not([data-drawn])').forEach((s) => {
    s.setAttribute('data-drawn', '');
    s.innerHTML = '<button type="button" class="vxgb-btn" data-verse-back><img src="/verse/logo-160.png" alt=""><span>חזרה למשחקים</span></button>';
  });
  const watch = () => { drawBack(); new MutationObserver(drawBack).observe(document.body, { childList: true, subtree: true }); };   // (screens a game draws later too)
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', watch); else watch();

  // a button marked data-verse-back: the game's own click runs, then back to the games feed
  document.addEventListener('click', (e) => {
    if (window.VerseGame.inVerse && e.target.closest && e.target.closest('[data-verse-back]')) setTimeout(window.VerseGame.back, 0);
  });
  const home = new URL('./', location.href).pathname;   // the game's own folder
  const hub = new URL('../', location.href).pathname;   // its hub (/hani-games/)
  document.addEventListener('click', (e) => {
    if (!window.VerseFrame.inVerse || e.defaultPrevented) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    if (a.closest('[data-verse-back]')) { e.preventDefault(); return; }   // the way back to the games feed (VerseGame.back, below)
    const url = new URL(a.getAttribute('href'), location.href);
    if (url.origin === location.origin && url.pathname.startsWith(home) && url.pathname !== hub) return;   // inside the game
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    e.preventDefault();
    window.open(url.origin === location.origin && url.pathname === hub ? '/games' : url.href, '_top');
  }, true);
})();

// Shlomiverse Online - window.VerseNet, the game's side of the verse's multiplayer platform (verse/net/, README.md there).
// The game never opens a socket or loads Firebase: every op is a postMessage to the verse page, which holds the
// connection, the sign-in and the shared lobby (play with a friend = a code + an invite link; find an opponent).
//   const r = await VerseNet.ready();   // { available, signedIn, me, invite, flags } - available only inside the verse
//   VerseNet.host() / join(code) / quick() / lobby()   -> the verse draws the lobby; on('start') when the match begins
//   on('start', m)  m = { room, mode, host, me, players:[{id,nick,photo,seat}], seed, round, turn, turnAt }
//   send(data[, to]) + on('msg', ({data, from}))      free messages (JSON, <= 2 KB, <= 20/s)
//   move(m) + on('move', ({m, by}))                    turn games: only on your turn, echoed to everyone in order
//   state(obj) + on('state', obj)                      host only: the shared state (<= 8 KB) - the host is the referee
//   VerseNet.turn = whose turn; setTurn(id) / pass([id]) + on('turn', {turn, turnAt}): host sets it, a guest passes via the host
//   claim(key) -> the uid of whoever claimed it FIRST (a server transaction) + on('claim', {key, by}) to all: races
//   host/quick/lobby(key): a game with several online modes keeps rooms + quick match per key (start event has .key)
//   on('players'|'away'|'back'|'left'|'rematch'|'end'|'closed'|'count'), end(), rematch(), leave(), myTurn(), now()
(() => {
  const inFrame = window.top !== window;
  const subs = {}, wait = {};
  let n = 0, offset = 0;
  const N = window.VerseNet = {
    available: false, me: null, room: null, isHost: false, mode: null, players: [], turn: null, turnAt: 0, seed: 0, round: 0, count: 0,
    on(ev, fn) { (subs[ev] = subs[ev] || []).push(fn); return () => { subs[ev] = (subs[ev] || []).filter((f) => f !== fn); }; },
    myTurn() { return !!N.me && N.turn === N.me; },
    now() { return Date.now() + offset; },
    ready() { return ask('hello').then((r) => { N.available = !!(r && r.available); N.me = r && r.me; return r; }, () => ({ available: false })); },
    host: (key, label) => ask('host', { key, label }), join: (code) => ask('join', { code }), quick: (key, label) => ask('quick', { key, label }), lobby: (key, label) => ask('lobby', { key, label }),
    claim: (key) => ask('claim', { key }), cancel: () => ask('cancel'),
    leave: () => { N.room = null; return ask('leave'); },
    send: (data, to) => ask('send', { data, to }), move: (m) => ask('move', { m }), state: (state) => ask('state', { state }),
    setTurn: (to) => ask('turn', { to }), pass: (to) => ask('pass', { to }), end: (result) => ask('end', { result }), rematch: () => ask('rematch'),
  };
  function ask(op, args = {}) {
    if (!inFrame) return Promise.reject(Object.assign(new Error('not_in_verse'), { code: 'not_in_verse' }));
    const id = ++n;
    return new Promise((ok, no) => {
      wait[id] = { ok, no };
      parent.postMessage({ verse: 'net', op, id, ...args }, '*');
      if (op === 'hello') setTimeout(() => { if (wait[id]) { delete wait[id]; no(Object.assign(new Error('no_answer'), { code: 'no_answer' })); } }, 8000);
    });
  }
  const clock = (d) => { if (d && d.now) offset = d.now - Date.now(); };
  addEventListener('message', (e) => {
    const d = e.data;
    if (!inFrame || e.source !== parent || !d || d.verse !== 'net') return;
    if (d.re) { const w = wait[d.re]; if (!w) return; delete wait[d.re]; return d.ok ? w.ok(d.val) : w.no(Object.assign(new Error(String(d.val)), { code: d.val })); }
    const x = d.data;
    if (d.ev === 'start') { clock(x); Object.assign(N, { room: x.room, isHost: x.host, mode: x.mode, me: x.me, players: x.players, turn: x.turn, turnAt: x.turnAt, seed: x.seed, round: x.round }); }
    else if (d.ev === 'turn') { clock(x); N.turn = x.turn; N.turnAt = x.turnAt; }
    else if (d.ev === 'players') N.players = x;
    else if (d.ev === 'count') N.count = x;
    (subs[d.ev] || []).slice().forEach((fn) => { try { fn(x); } catch (err) { console.error('VerseNet', d.ev, err); } });
  });
})();
