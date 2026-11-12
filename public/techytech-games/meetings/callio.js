// Callio - the 4th app: a 2-player memory game played ONLINE through the Shlomiverse's platform (window.VerseNet from
// /verse/game-frame.js - never our own sockets). Cards = the Zoom participant tiles: face-down = "camera off",
// flipped = that person's video tile with the name. Find a pair = you go again; a miss = the turn passes (and your
// opponent saw both). 20 s a turn. The HOST is the referee: it alone holds the shuffled deck (a private random seed,
// never in the room), reveals only the flipped cards through VerseNet.state(); the guest only ever sees what is face up.
// Also a solo practice board (no opponent, to learn). Online matches never report a daily record.
// Loaded after game.js (shares its helpers: $, G, say, verb, flash, sfx, img, NAME, store, startMode, showStart, TUT...).
'use strict';
const CL_POOL = ['amir', 'ofer', 'ronit', 'gilad', 'itay', 'yaniv', 'daniel', 'yotam', 'osnat', 'tzvika', 'vova', 'erez', 'ido', 'lior', 'rami', 'yoav'];
const CL_COLS = 4, CL_ROWS = 5, CL_TURN = 20;   // 20 cards = 10 pairs, an upright phone's shape
Object.assign(SND, { flip: 3, pair: 2, turn: 2, win: 1 });
const CL = {
  pair: ['מצוין. אז אנחנו מסונכרנים.', 'חד משמעית. עוד תור.', 'זה GOES WITHOUT SAYING.', 'בדיוק. ממשיכים.'],
  pairWho: ['amir', 'ofer', 'amir', 'ofer'],
  theirPair: ['רגע, מי בכלל אישר לו את הזוג הזה?', 'מבחינתי עוד לא התקיים דיון על הזוג הזה.', 'לא. אנחנו לא מסונכרנים.'],
  miss: ['מאתגר. אבל בעצם אנחנו מסכימים.', 'בואו לא ניתקע בקודם כול.', 'נמשיך להקשיב לשטח.'],
  myTurn: ['התור שלכם. תנו לנו תמונת מצב.', 'קדימה, יישור קו.'],
  wait: ['אז קודם כול—', 'רגע, רק רציתי…', 'אני חושב ש—'],
  timeout: ['רגע, נגמר הזמן. מי בכלל קבע עשרים שניות?', 'הזמן שלנו שווה כסף. התור עובר.'],
  win: 'מצוין. נתת לנו הרבה חומר למחשבה.', lose: 'לא. אנחנו לא מסונכרנים.', tie: 'אז אנחנו מסונכרנים. נקבע פגישת המשך.',
};
const NET = window.VerseNet;
// the verse answers the game's hello a moment after load (it loads its net module first): a tap that comes sooner waits
// for the answer instead of saying "online works only in the verse" (12 Nov 2026, after the release showed the buttons at once)
const NET_READY = NET ? NET.ready() : Promise.resolve({ available: false });
const cl = {
  phase: 'menu', online: false, solo: false, tut: false, deck: null, pub: null, me: null, players: [], m: null, busy: false,
  resolving: false, flips: 0, timer: 0, left: null, wantAgain: false,

  // ---------- screens ----------
  start(tut) {
    $('#cl').hidden = false; $('#clHud').hidden = true; $('#score').hidden = true; $('#bRestart').style.visibility = 'hidden';
    this.tut = !!tut;
    if (tut) return this.practice(true);
    if (this.online && this.m && this.phase !== 'menu') { this.show(); return; }
    this.menu();
  },
  menu() {
    this.phase = 'menu'; this.solo = false; this.stopTimer();
    $('#clMenu').hidden = false; $('#clBoard').hidden = true; $('#clHud').hidden = true;
    $('#clNote').hidden = true;
    verb('בחרו: חבר עם קוד, או יריב אקראי', 'amir');
    this.paintCount();
  },
  paintCount() { const n = NET && NET.count; $('#clCount').innerHTML = n > 1 ? '<i></i>' + (n === 2 ? 'עוד שחקן אחד כאן עכשיו' : n + ' שחקנים כאן עכשיו') : ''; },
  notInVerse() {
    const n = $('#clNote'); n.hidden = false;
    n.innerHTML = 'משחק מול חבר עובד בתוך שלומיוורס. <a href="https://shlomiverse.com/play/techytech-games-meetings" target="_top">פתחו כאן ←</a>';
  },
  async go(kind) {
    sfx('tap', .5);
    if (NET && !NET.available) await NET_READY;
    if (!NET || !NET.available) return this.notInVerse();
    this.phase = 'lobby';
    verb(kind === 'friend' ? 'שלחו לחבר את הקוד' : 'מחפשים יריב…', 'amir');
    try { await (kind === 'friend' ? NET.host('callio') : NET.quick('callio')); }
    catch (e) { if (this.phase === 'lobby') this.menu(); }
  },
  layout() {
    const { W, H } = stage(), cols = this.cols || CL_COLS, rows = this.rows || CL_ROWS, gap = W < 360 ? 5 : 7;
    let cw = (W - 12 - (cols - 1) * gap) / cols, ch = (H - 12 - (rows - 1) * gap) / rows;
    cw = Math.min(cw, ch * .9, 160); ch = Math.min(ch, cw * 1.45);
    const b = $('#clBoard');
    b.style.setProperty('--cg', gap + 'px');
    b.style.gridTemplateColumns = `repeat(${cols},${cw}px)`; b.style.gridTemplateRows = `repeat(${rows},${ch}px)`;
    const bw = cols * cw + (cols - 1) * gap, bh = rows * ch + (rows - 1) * gap;
    Object.assign(b.style, { left: (W - bw) / 2 + 'px', top: (H - bh) / 2 + 'px' });
    b.style.setProperty('--cfs', Math.max(9, Math.min(13, cw / 7.5)) + 'px');
  },
  build(n) {
    const b = $('#clBoard'); b.innerHTML = ''; b.hidden = false; $('#clMenu').hidden = true;
    for (let i = 0; i < n; i++) {
      const c = document.createElement('div'); c.className = 'cc'; c.dataset.i = i;
      c.innerHTML = '<div class="in"><div class="bk"><b>' + (i + 1) + '</b></div><div class="fr"><img alt="" draggable="false"><span></span></div></div>';
      c.onpointerdown = (e) => { e.preventDefault(); this.tap(i); };
      b.appendChild(c);
    }
    this.layout();
  },
  cards() { return $('#clBoard').children; },

  // ---------- the board from the public state ----------
  // pub = { shown: {i: face}, matched: {i: [face, by]}, scores: {id: n}, last: {k, by, seq}, over, winner }
  render() {
    const p = this.pub; if (!p) return;
    const cs = this.cards();
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i], m = p.matched[i], f = m ? m[0] : p.shown[i];
      const up = !!f;
      if (up) { const im = c.querySelector('img'); if (im.dataset.f !== f) { im.src = img(f); im.dataset.f = f; c.querySelector('.fr span').textContent = NAME[f] || ''; } }
      if (up && !c.classList.contains('up')) sfx('flip', .55);
      c.classList.toggle('up', up);
      c.classList.toggle('done', !!m);
      c.classList.toggle('mine', !!m && m[1] === this.me);
      c.classList.toggle('theirs', !!m && m[1] !== this.me);
      c.classList.remove('press');
    }
    this.hud();
  },
  hud() {
    const h = $('#clHud'); h.hidden = false; $('#play').classList.toggle('narrow', $('#hud').clientWidth < 360);
    if (this.solo) { h.innerHTML = '<div class="stat"><small>הפיכות</small><span>' + this.flips + '</span></div><div class="stat"><small>זוגות</small><span>' + Object.keys(this.pub.matched).length / 2 + '/' + this.cards().length / 2 + '</span></div>'; return; }
    const sc = this.pub.scores || {}, turn = NET.turn;
    const me = this.players.find((x) => x.id === this.me), op = this.players.find((x) => x.id !== this.me);
    const chip = (p, cls) => p ? '<div class="pc ' + cls + (turn === p.id ? ' on' : '') + '" data-id="' + p.id + '">' + (p.photo ? '<img src="' + esc(p.photo) + '" alt="">' : '<em>' + esc((p.nick || '?')[0]) + '</em>') + '<span class="nm">' + esc(p.id === this.me ? 'אתם' : String(p.nick || '').split(' ')[0]) + '</span><b>' + (sc[p.id] || 0) + '</b><i></i></div>' : '';
    h.innerHTML = chip(me, 'me') + '<span id="clT"></span>' + chip(op, 'op');
    this.tick();
  },

  // ---------- practice (solo, local referee) ----------
  practice(tut) {
    this.online = false; this.solo = true; this.phase = 'play'; this.flips = 0; this.me = 'me'; this.players = [{ id: 'me', nick: 'אתם' }];
    this.resolving = false;
    if (tut) { this.cols = 3; this.rows = 2; this.deck = ['amir', 'ronit', 'amir', 'ofer', 'ronit', 'ofer']; }   // the try step's pair is in the top row (the card sits low)
    else {
      this.cols = CL_COLS; this.rows = CL_ROWS;
      const r = rng('callio|' + Math.random()), faces = shuffle(r, CL_POOL.slice()).slice(0, 10);
      this.deck = shuffle(r, faces.concat(faces));
    }
    this.pub = { shown: {}, matched: {}, scores: { me: 0 }, last: null, over: false };
    this.build(this.deck.length); this.render();
    verb(tut ? 'הפכו שתי משבצות' : 'אימון: מצאו את כל הזוגות בכמה שפחות הפיכות', 'amir');
    if (!tut) { window.track && window.track('game_start', SLUG); sfx('join', .6); }
  },
  // the referee: used by the solo board and by the online host. Returns true if the flip counted.
  referee(i, by) {
    const p = this.pub, open = Object.keys(p.shown).map(Number);
    if (this.resolving || p.over || p.matched[i] || p.shown[i] || open.length >= 2) return false;
    p.shown[i] = this.deck[i];
    open.push(i);
    if (open.length === 2) {
      this.resolving = true;
      const [a, b] = open, hit = this.deck[a] === this.deck[b];
      setTimeout(() => {
        if (this.pub !== p) return;
        p.shown = {};
        if (hit) { p.matched[a] = [this.deck[a], by]; p.matched[b] = [this.deck[b], by]; p.scores[by] = (p.scores[by] || 0) + 1; }
        p.last = { k: hit ? 'pair' : 'miss', by, f: this.deck[a], seq: (p.last ? p.last.seq : 0) + 1 };
        if (Object.keys(p.matched).length === this.deck.length) {
          p.over = true;
          const ids = Object.keys(p.scores), best = Math.max(...ids.map((k) => p.scores[k]));
          const top = ids.filter((k) => p.scores[k] === best);
          p.winner = top.length === 1 ? top[0] : 'tie';
        }
        this.resolving = false;
        this.after(p, hit, by);
      }, hit ? 650 : 1250);
    }
    return true;
  },
  after(p, hit, by) {
    if (this.solo) { this.render(); this.react(p.last); emit(hit ? 'pair' : 'miss'); if (p.over && !this.tut) this.end(); return; }
    // online host: publish, then the turn: a pair = the same player again (a fresh 20 s), a miss = the next player
    NET.state(p).catch(() => {});
    this.render(); this.react(p.last);
    if (p.over) { NET.end().catch(() => {}); setTimeout(() => this.end(), 900); return; }
    (hit ? NET.setTurn(by) : NET.pass()).catch(() => {});
  },
  tap(i) {
    if (this.phase !== 'play' || this.busy) return;
    const c = this.cards()[i];
    if (this.solo) {
      if (G.tut && !G.tut.waiting) return;
      if (this.referee(i, 'me')) { this.flips++; this.render(); emit('flip'); }
      return;
    }
    if (!NET.myTurn()) { flash('התור של ' + this.opName()); return; }
    if (this.pub.matched[i] || this.pub.shown[i] || Object.keys(this.pub.shown).length >= 2) return;
    c.classList.add('press');
    NET.move({ flip: i }).catch(() => c.classList.remove('press'));
  },

  // ---------- online ----------
  opName() { const o = this.players.find((x) => x.id !== this.me); return o ? o.nick : 'היריב'; },
  begin(m) {
    if (G.tut) { G.tut = null; $('#tut').hidden = true; }
    if (G.mode !== 'callio') startMode('callio');
    $('#end').hidden = true; $('#bNew').hidden = true;
    this.online = true; this.solo = false; this.phase = 'play'; this.m = m; this.me = m.me; this.players = m.players; this.left = null; this.wantAgain = false;
    this.cols = CL_COLS; this.rows = CL_ROWS; this.resolving = false; this.lastSeq = 0;
    this.pub = { shown: {}, matched: {}, scores: Object.fromEntries(m.players.map((p) => [p.id, 0])), last: null, over: false };
    if (m.host) {   // the referee's private deck: its seed never leaves this phone
      const seed = new Uint32Array(2); crypto.getRandomValues(seed);
      const r = rng('callio|' + seed[0] + '|' + seed[1]), faces = shuffle(r, CL_POOL.slice()).slice(0, 10);
      this.deck = shuffle(r, faces.concat(faces));
      NET.state(this.pub).catch(() => {});
    } else this.deck = null;
    this.build(CL_COLS * CL_ROWS); this.render();
    sfx('join', .7); flash('מול ' + this.opName());
    this.turnLine();
    this.startTimer();
    window.track && window.track('game_start', SLUG + '-online');
  },
  show() { $('#clMenu').hidden = true; $('#clBoard').hidden = false; this.layout(); this.render(); },
  onMove({ m, by }) {   // only the host referees; everyone else waits for the state
    if (!this.online || !this.m || !this.m.host || !m || typeof m.flip !== 'number') return;
    if (by !== NET.turn || m.flip < 0 || m.flip >= this.deck.length) return;
    if (this.referee(m.flip, by)) { NET.state(this.pub).catch(() => {}); this.render(); }
  },
  onState(p) {
    if (!this.online || !p || !p.matched || (this.m && this.m.host)) return;   // the host is the referee: its own copy is the truth
    const last = p.last && p.last.seq !== this.lastSeq ? p.last : null;
    this.pub = p; this.render();
    if (last) { this.lastSeq = last.seq; this.react(last); }
    if (p.over) setTimeout(() => this.end(), 900);
  },
  react(last) {
    if (!last) return;
    const mine = last.by === this.me;
    if (last.k === 'pair') {
      sfx('pair', .8);
      const els = [...this.cards()].filter((c) => c.querySelector('img').dataset.f === last.f && c.classList.contains('done'));
      els.forEach((c) => { c.classList.remove('pair'); void c.offsetWidth; c.classList.add('pair'); });
      if (this.solo || mine) { const k = Math.floor(Math.random() * CL.pair.length); say(CL.pairWho[k], CL.pair[k], 1800); flash('זוג! +1'); }
      else say('ronit', CL.theirPair, 2000);
    } else if (last.k === 'miss') {
      sfx('wrong', .35);
      if (this.solo || mine) say(Math.random() < .5 ? 'ofer' : 'amir', CL.miss, 1800);
    } else if (last.k === 'timeout') { sfx('wrong', .4); say('ronit', CL.timeout, 2000); }
  },
  turnLine() {
    if (!this.online || this.phase !== 'play') return;
    if (NET.myTurn()) { sfx('turn', .6); verb('התור שלכם – הפכו שני משתתפים', 'amir'); }
    else verb('התור של ' + this.opName() + ' – זכרו מה הוא הופך', 'daniel-try');
    this.hud();
  },
  onTurn() { this.turnLine(); if (!NET.myTurn() && Math.random() < .35) say('daniel', CL.wait, 1600, 'daniel-try'); },
  startTimer() { this.stopTimer(); this.timer = setInterval(() => this.tick(), 250); },
  stopTimer() { clearInterval(this.timer); this.timer = 0; },
  tick() {
    if (!this.online || this.phase !== 'play') return;
    const left = Math.max(0, CL_TURN - (NET.now() - (NET.turnAt || NET.now())) / 1000);
    const t = $('#clT'); if (t) t.textContent = Math.ceil(left);
    const on = $('#clHud .pc.on'); if (on) { on.style.setProperty('--tl', left / CL_TURN); on.classList.toggle('low', left <= 5); }
    // the host passes a turn that ran out (the cards that were up go face down)
    if (this.m && this.m.host && left <= 0 && !this.resolving && !this.pub.over && !this.timingOut) {
      this.timingOut = true;
      const by = NET.turn;
      this.pub.shown = {}; this.pub.last = { k: 'timeout', by, seq: (this.pub.last ? this.pub.last.seq : 0) + 1 };
      NET.state(this.pub).catch(() => {}); this.render(); this.react(this.pub.last);
      NET.pass().catch(() => {}).finally(() => { setTimeout(() => { this.timingOut = false; }, 600); });
    }
  },

  // ---------- the end ----------
  end(why) {
    if (this.phase === 'over') return;
    this.phase = 'over'; this.stopTimer();
    const p = this.pub, E = $('#end');
    E.dataset.mode = 'callio';
    $('#endNew').hidden = true; $('#bNew').hidden = !this.online;
    if (this.solo) {
      const b = Number(store.get('best-callio') || 0), nb = !b || this.flips < b;
      if (nb) store.set('best-callio', this.flips);
      $('#endTitle').innerHTML = 'כל הזוגות נמצאו<small>אימון ב-Callio</small>';
      $('#endLine').textContent = '"מצוין. עכשיו נסו מול מישהו אמיתי."';
      $('#endScore').textContent = this.flips + ' הפיכות'; $('#endNew').hidden = !nb || !b;
      $('#endBest').textContent = nb ? '' : 'השיא שלכם: ' + b + ' הפיכות';
      $('#endFace').src = img('amir-talk');
      $('#bAgain').textContent = 'עוד אימון'; $('#bNew').className = 'quiet';
      window.track && window.track('game_over', SLUG);
    } else {
      const sc = p.scores || {}, op = this.players.find((x) => x.id !== this.me);
      const mine = sc[this.me] || 0, theirs = op ? sc[op.id] || 0 : 0;
      const won = why === 'left' || p.winner === this.me, tie = !why && p.winner === 'tie';
      onlineEnd({ head: tie ? 'תיקו' : won ? 'ניצחתם!' : 'הפסדתם', sub: why === 'left' ? (this.left || 'היריב') + ' כבר לא בפגישה' : 'Callio · זוגות מול ' + this.opName(),
        line: tie ? CL.tie : won ? CL.win : CL.lose, mine, theirs, op: this.opName(), unit: 'זוגות', left: why === 'left', face: tie ? 'amir' : won ? 'amir-talk' : 'ronit' });
      sfx(won ? 'win' : 'over', .8);
      window.track && window.track('game_over', SLUG + '-online');
    }
    setTimeout(() => { E.hidden = false; }, 300);
  },
  again() {
    if (this.solo) { $('#end').hidden = true; this.practice(false); return; }
    if (this.wantAgain) return;
    this.wantAgain = true;
    $('#endBest').textContent = 'מחכים ל' + this.opName() + '…';
    NET.rematch().catch(() => { $('#endBest').textContent = this.opName() + ' כבר לא כאן'; $('#bAgain').hidden = true; });
  },
  newOpponent() { $('#end').hidden = true; NET.leave().catch(() => {}).finally(() => { this.online = false; this.m = null; this.menu(); this.go('quick'); }); },
  leave() { if (this.online) { NET.leave().catch(() => {}); this.online = false; this.m = null; } this.stopTimer(); this.phase = 'menu'; },
};
// the online end card (Callio and the races): the result is the headline, the reason the small line; both scores with
// their names; "משחק חוזר" is the main button - or, when the other player left, "יריב חדש" is
function onlineEnd({ head, sub, line, mine, theirs, op, unit, left, face }) {
  $('#endTitle').innerHTML = esc(head) + '<small>' + esc(sub) + '</small>';
  $('#endLine').textContent = line ? '"' + line + '"' : '';
  const side = (nm, n) => '<span class="es"><b>' + n + '</b><small>' + esc(nm) + '</small></span>';
  $('#endScore').innerHTML = side('אתם', mine) + '<i>:</i>' + side(String(op || 'היריב').split(' ')[0], theirs);
  $('#endBest').textContent = unit || '';
  $('#endNew').hidden = true;
  $('#bAgain').hidden = !!left; $('#bAgain').textContent = 'משחק חוזר';
  $('#bNew').hidden = false; $('#bNew').className = left ? 'big' : 'quiet';
  $('#endFace').src = img(face);
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
MODES.callio = cl; APP.callio = 'Callio';

// buttons that mean something else in Callio
$('#clFriend').onclick = () => cl.go('friend');
$('#clQuick').onclick = () => cl.go('quick');
$('#clSolo').onclick = () => { sfx('tap', .5); cl.practice(false); };
{
  const again = $('#bAgain').onclick, menu = $('#bMenu').onclick, home = $('#bHome').onclick, restart = $('#bRestart').onclick;
  $('#bAgain').onclick = () => (G.mode === 'callio' ? cl.again() : again());
  $('#bNew').onclick = () => cl.newOpponent();
  $('#bMenu').onclick = () => { if (G.mode === 'callio') cl.leave(); menu(); };
  $('#bHome').onclick = () => {
    if (G.mode === 'callio') { if (G.tut) return; if (cl.phase === 'play' && cl.solo) { cl.menu(); return; } cl.leave(); return showStart(); }
    home();
  };
  $('#bRestart').onclick = () => (G.mode === 'callio' ? null : restart());
}

// the platform's events
if (NET) {
  NET.on('start', (m) => { if ((m.key || 'callio') === 'callio') cl.begin(m); });
  NET.on('move', (x) => cl.onMove(x));
  NET.on('state', (p) => cl.onState(p));
  NET.on('turn', () => cl.onTurn());
  NET.on('count', () => cl.paintCount());
  NET.on('players', (ps) => { if (cl.online && ps && ps.length) { cl.players = ps.concat(cl.players.filter((x) => !ps.some((p) => p.id === x.id))); } });
  NET.on('away', ({ id }) => { if (cl.online && cl.phase === 'play' && id !== cl.me) verb('החיבור של ' + cl.opName() + ' נפל – מחכים לו…', 'itay'); });
  NET.on('back', () => { if (cl.online && cl.phase === 'play') cl.turnLine(); });
  NET.on('left', ({ id }) => {
    if (!cl.online || id === cl.me) return;
    cl.left = cl.opName(); sfx('leave', .7);
    if (cl.phase === 'play') { cl.phase = 'play-left'; cl.end('left'); }
    else if (cl.phase === 'over') { $('#bAgain').hidden = true; $('#endBest').textContent = cl.left + ' כבר לא בפגישה'; }
  });
  NET.on('rematch', ({ by }) => { if (cl.phase === 'over' && by !== cl.me) $('#endBest').textContent = cl.opName() + ' רוצה משחק חוזר!'; });
  NET.on('closed', () => { if (G.mode === 'callio' && cl.phase === 'lobby') cl.menu(); });
  // Callio shows only where online play works and he asked for it: ?online=1 (his preview - he decides when everyone
  // sees it), an invite link (?room=), or a local test
  const local = /^(localhost|127\.)/.test(location.hostname), own = /[?&]online=1/.test(location.search);
  $('#appCallio').hidden = false;  // released to everyone 12 Nov 2026
  NET_READY.then((r) => { if (r && r.flags && r.flags.online) $('#appCallio').hidden = false; });
}

// the tutorial (practice board 3x2, its own fixed deck)
const CS = () => R('#clBoard');
TUT.callio = [
  { who: 'amir', t: 'ב-Callio משחקים זיכרון מול עמית אמיתי, בשיחה חיה. כל משבצת = משתתף עם מצלמה כבויה.', spot: CS },
  { who: 'amir', t: 'המטרה: לאסוף יותר זוגות מהיריב. הופכים שתי משבצות – אם זה אותו אדם, הזוג שלכם.', spot: CS },
  { who: 'amir', t: 'נסו עכשיו: הפכו את שתי המשבצות המסומנות.', try: 'pair', spot: CS, hint: [0, 2] },
  { who: 'ofer', t: 'חד משמעית. מצאתם זוג – ממשיכים עוד תור. פספסתם – התור עובר ליריב.', spot: CS },
  { who: 'ronit', t: 'רגע. והיריב רואה כל מה שהפכתם. זה כל הטריק: זכרו גם את המשבצות שלו.', spot: CS },
  { who: 'amir', t: 'למעלה: אתם, היריב והזוגות של כל אחד. 20 שניות לכל תור – אחרת התור עובר.', spot: () => R('#hud') },
  { who: 'amir', t: '"שחקו עם חבר" = קוד בן 4 אותיות וקישור להזמנה. "מצאו יריב" = מחכים עד שמישהו מגיע. אז אנחנו מסונכרנים?', spot: () => R('#stage') },
];
// mark the cards a "try" step asks for
const _tutShow = tutShow;
tutShow = function () {
  _tutShow();
  const s = G.tut && G.tut.steps[G.tut.i];
  [...$('#clBoard').children].forEach((c, i) => c.classList.toggle('hint', !!(s && s.hint && s.hint.includes(i) && !c.classList.contains('up'))));
};
window.CALLIO = cl;
