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
(() => {
  const root = document.documentElement;
  window.VerseFrame = { inVerse: false, top: 0, score() {} };
  if (window.top === window) {
    const q = new URLSearchParams(location.search), parts = location.pathname.split('/').filter(Boolean);
    const solo = q.has('solo') || q.has('notrack') || /^(localhost|127\.)/.test(location.hostname);
    if (!solo && parts.length >= 2 && /-games$/.test(parts[0])) location.replace(`/play/${parts[0]}-${parts[1]}`);
    return;
  }
  window.VerseFrame.score = (n) => { if (window.VerseFrame.inVerse && Number(n) > 0) parent.postMessage({ verse: 'score', value: Number(n) }, '*'); };
  const css = document.createElement('style');
  css.textContent = 'html.in-verse .verse-hide{display:none!important}';
  document.head.appendChild(css);
  const set = (top) => {
    top = Math.max(0, Math.round(Number(top) || 0));
    window.VerseFrame.inVerse = true;
    window.VerseFrame.top = top;
    root.classList.add('in-verse');
    root.classList.toggle('verse-full', top > 0);
    root.style.setProperty('--verse-top', top + 'px');
    dispatchEvent(new CustomEvent('verseframe', { detail: { top } }));
  };
  addEventListener('message', (e) => { const d = e.data; if (d && d.verse === 'frame' && e.source === parent) set(d.top); });
  parent.postMessage({ verse: 'hello' }, '*');

  const home = new URL('./', location.href).pathname;   // the game's own folder
  const hub = new URL('../', location.href).pathname;   // its hub (/hani-games/)
  document.addEventListener('click', (e) => {
    if (!window.VerseFrame.inVerse || e.defaultPrevented) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
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
