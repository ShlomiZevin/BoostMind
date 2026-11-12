// Online versus for the three solo apps (his decision 12 Nov 2026), on the Shlomiverse's platform (window.VerseNet):
//   Meetly race  - the SAME grid on both phones (seed from the start event); the first to tap the target takes the round
//                  (VerseNet.claim = a server transaction: arrival order decides, not who hosts); a wrong tap locks you
//                  for 1.5 s; best of 7 (first to 4).
//   Teamz race   - the SAME board on both phones; the first to connect everyone AND fill the board takes it; the
//                  opponent's progress shows live as "x/y" (only progress is sent, never cell moves); best of 5.
//   Zoomba duel  - each player's own board (same seed); a merge to level 6-7 sends Daniel into the opponent's board,
//                  8+ sends Itay; the HUD shows the opponent's top meeting + score; the first whose board locks loses.
// Each app card keeps solo as its main button; "אונליין ←" opens the verse's lobby for that app (rooms and quick match
// are kept per app: VerseNet.lobby(key)). Online matches never report a daily record.
// Loaded after game.js + callio.js (shares $, G, startMode, showStart, sfx, say, verb, flash, img, NAME, ZL, mt, tz, zb).
'use strict';
const VS_APPS = { meetly: { to: 4, of: 7 }, teamz: { to: 3, of: 5 }, zoomba: { to: 1, of: 1 } };
const vsLabel = (k) => ({ title: APP[k] + ' אונליין', sub: { meetly: 'מירוץ על אותה שיחה: מי שמוצא ראשון לוקח את הסיבוב. הראשון ל-4.', teamz: 'מירוץ על אותו לוח: מי שמיישר קו ראשון לוקח. הראשון ל-3.', zoomba: 'דו־קרב: כל מיזוג גדול שולח ליריב את דניאל או את איתי. מי שננעל ראשון – מפסיד.' }[k] });
const VS = window.VS = {
  active: null, m: null, me: null, wins: {}, over: false, wantAgain: false, lock: 0, roundDone: -1, op: {}, sentAt: 0, last: '',
  opName() { const o = this.m && this.m.players.find((p) => p.id !== this.me); return o ? o.nick : 'היריב'; },
  opId() { const o = this.m && this.m.players.find((p) => p.id !== this.me); return o ? o.id : null; },
  begin(m) {
    if (G.tut) { G.tut = null; $('#tut').hidden = true; }
    $('#end').hidden = true;
    Object.assign(this, { active: m.key, m, me: m.me, wins: { [m.me]: 0 }, over: false, wantAgain: false, lock: 0, roundDone: -1, op: {}, last: '' });
    m.players.forEach((p) => { this.wins[p.id] = 0; });
    startMode(m.key);   // the app builds its board from m.seed (game.js vsOn)
    $('#bRestart').style.visibility = 'hidden'; $('#play').classList.add('vs');
    sfx('join', .7);
    const intro = { meetly: 'מי שמוצא ראשון לוקח. טעות = נעילה', teamz: 'מי שמיישר קו ראשון לוקח', zoomba: 'מיזוג גדול שולח ליריב את דניאל' }[m.key];
    this.task();
    this.hud();
    flash('מול ' + this.opName() + ' · ' + intro);   // the rule once, over the board's start; the strip keeps the task
    window.track && window.track('game_start', SLUG + '-' + m.key + '-online');
  },
  // the strip always says what to do now (solo Meetly's task with its face), with the round
  round() { return Math.min(VS_APPS[this.active].of, Object.values(this.wins).reduce((p, q) => p + q, 0) + 1); },
  task() {
    const a = this.active;
    if (a === 'meetly') { const T = TASKS[mt.task]; verb('סיבוב ' + this.round() + '/7 · ' + T.t, T.face); }
    else if (a === 'teamz') verb('לוח ' + this.round() + '/5 · חברו כל זוג ומלאו את הלוח – ראשון לוקח', 'ronit');
    else if (a === 'zoomba') verb('החליקו. מיזוג לרמה 6 שולח ליריב את דניאל, 8 – את איתי', 'amir');
  },
  hud() {
    const h = $('#clHud'); h.hidden = false; $('#play').classList.toggle('narrow', $('#hud').clientWidth < 360);
    const op = this.opName(), o = this.op, a = this.active;
    const chip = (nm, val, cls, extra) => '<div class="pc ' + cls + '"><em>' + esc((nm || '?')[0]) + '</em><span class="nm">' + esc(String(nm || '').split(' ')[0]) + '</span><b>' + val + '</b>' + (extra || '') + '</div>';
    const narrow = $('#play').classList.contains('narrow');
    $('#score').hidden = true;
    if (a === 'zoomba') {
      h.innerHTML = chip('אתם', G.score, 'me') + chip(op, (o.score || 0), 'op') + '<span class="vsTop" title="הפגישה הגדולה של ' + esc(op) + '">' + esc(!o.top ? '…' : narrow ? 'רמה ' + o.top : ZL[o.top].he) + '</span>';
    } else {
      // Teamz: the opponent's progress lives in the opponent's own chip; Meetly: the round
      const prog = a === 'teamz' && o.tp != null && o.lv === tz.level ? '<span class="pg">🔗 ' + o.tp + '/' + o.of + '</span>' : '';
      const rd = a === 'meetly' ? '<span class="vsTop">' + (narrow ? '' : 'סיבוב ') + this.round() + '/7</span>' : '';
      h.innerHTML = chip('אתם', this.wins[this.me] || 0, 'me') + chip(op, this.wins[this.opId()] || 0, 'op', prog) + rd;
    }
  },

  // ---------- Meetly race ----------
  mTap(d, c) {
    if (this.over || mt.round === this.roundDone) return;
    if (Date.now() < this.lock) { sfx('wrong', .3); return; }
    if (c.target) {
      d.classList.add('found');
      VerseNet.claim('m' + mt.round).catch(() => {});
    } else {
      d.classList.remove('wrong'); void d.offsetWidth; d.classList.add('wrong'); sfx('wrong', .6);
      this.lock = Date.now() + 1500;
      const g = $('#mgrid'); g.classList.add('locked'); setTimeout(() => g.classList.remove('locked'), 1500);
      flash('נעול ל-1.5 שניות');
    }
  },
  // ---------- Teamz race ----------
  tProgress() {
    const n = tz.pairs.filter((_, i) => tz.complete(i)).length, k = tz.level + ':' + n;
    if (k === this.last) return; this.last = k;
    VerseNet.send({ tp: n, of: tz.pairs.length, lv: tz.level }).catch(() => {});
  },
  tSolved() { if (!this.over && tz.level !== this.roundDone) VerseNet.claim('t' + tz.level).catch(() => {}); },
  // ---------- Zoomba duel ----------
  zMoved(merges) {
    const top = merges.length ? Math.max(...merges.map((t) => t.lv)) : 0;
    if (top >= 6) {
      const who = top >= 8 ? 'itay' : 'daniel';
      VerseNet.send({ atk: who, lv: top }).catch(() => {});
      flash((who === 'itay' ? 'איתי' : 'דניאל') + ' נשלח ל' + this.opName() + '!');
    }
    this.hud();
    if (Date.now() - this.sentAt > 250 || top) { this.sentAt = Date.now(); VerseNet.send({ top: zb.best, score: G.score }).catch(() => {}); }
  },
  zAttacked(who) {
    if (this.over) return;
    const e = zb.empties();
    const msg = this.opName() + ' שלח לך את ' + (who === 'itay' ? 'איתי' : 'דניאל');
    flash(msg); sfx(who === 'itay' ? 'itay' : 'join', .7);
    say(who, who === 'itay' ? L.itay : L.daniel, 2200, who === 'daniel' ? 'daniel-try' : undefined);
    if (!e.length || zb.busy) return;
    const [r, c] = e[Math.floor(Math.random() * e.length)];
    if (who === 'itay') zb.add(r, c, 0, 'itay', 7); else zb.add(r, c, 0, 'daniel');
    if (!zb.canMove()) this.zLost();
  },
  zLost() { if (!this.over) VerseNet.claim('lost').catch(() => {}); },

  // ---------- the platform's word ----------
  onClaim({ key, by }) {
    if (!this.active || this.over) return;
    const mine = by === this.me, a = this.active;
    if (a === 'zoomba' && key === 'lost') return this.end(!mine);
    const n = Number(key.slice(1));
    if (a === 'meetly' && key[0] === 'm' && n === mt.round && this.roundDone !== n) {
      this.roundDone = n; this.wins[by] = (this.wins[by] || 0) + 1;
      const t = mt.targetEl(); if (t) t.classList.add('found');
      sfx(mine ? 'found' : 'wrong', .7); flash(mine ? 'ראשונים! +1' : this.opName() + ' מצא ראשון');
      const s = TASKS[mt.task].said; if (mine) say(s[0], s[1], 1600);
      this.hud();
      setTimeout(() => { if (this.active !== 'meetly' || this.over) return; if (!this.check()) { mt.round++; mt.next(); this.lock = 0; this.task(); this.hud(); } }, 1300);
    }
    if (a === 'teamz' && key[0] === 't' && n === tz.level && this.roundDone !== n) {
      this.roundDone = n; this.wins[by] = (this.wins[by] || 0) + 1;
      sfx(mine ? 'level' : 'wrong', .7); flash(mine ? 'מסונכרנים ראשונים! +1' : this.opName() + ' יישר קו ראשון');
      say(mine ? 'amir' : 'ronit', mine ? 'מצוין. אז אנחנו מסונכרנים.' : 'לא. אנחנו לא מסונכרנים.', 1600);
      this.op.tp = null; this.hud();
      setTimeout(() => { if (this.active !== 'teamz' || this.over) return; if (!this.check()) { tz.level++; tz.load(); this.last = ''; this.task(); this.hud(); } }, 1500);
    }
  },
  check() {   // best of N: the first to `to` wins
    const need = VS_APPS[this.active].to;
    const w = Object.entries(this.wins).find(([, v]) => v >= need);
    if (!w) return false;
    this.end(w[0] === this.me);
    return true;
  },
  onMsg({ data }) {
    if (!this.active || !data) return;
    if (data.atk && this.active === 'zoomba') this.zAttacked(data.atk);
    if (data.top != null) { this.op.top = data.top; this.op.score = data.score; }
    if (data.tp != null) Object.assign(this.op, { tp: data.tp, of: data.of, lv: data.lv });
    this.hud();
  },
  end(won, why) {
    if (this.over) return;
    this.over = true; G.over = true;
    if (this.m.host) VerseNet.end().catch(() => {});
    const a = this.active, me = this.wins[this.me] || 0, op = this.wins[this.opId()] || 0;
    const E = $('#end'); E.dataset.mode = a;
    const sub = why === 'left' ? this.opName() + ' כבר לא בפגישה' : a === 'zoomba' ? (won ? 'הלוח של ' + this.opName() + ' ננעל' : 'הלוח שלכם ננעל') : APP[a] + ' · מול ' + this.opName();
    onlineEnd({ head: won ? 'ניצחתם!' : 'הפסדתם', sub, line: won ? 'מצוין. נתת לנו הרבה חומר למחשבה.' : 'לא. אנחנו לא מסונכרנים.',
      mine: a === 'zoomba' ? G.score : me, theirs: a === 'zoomba' ? (this.op.score || 0) : op, op: this.opName(), unit: a === 'zoomba' ? 'נקודות' : a === 'meetly' ? 'סיבובים' : 'לוחות',
      left: why === 'left', face: won ? 'amir-talk' : 'ronit' });
    sfx(won ? 'win' : 'over', .8);
    window.track && window.track('game_over', SLUG + '-' + a + '-online');
    setTimeout(() => { E.hidden = false; }, 400);
  },
  again() {
    if (this.wantAgain) return; this.wantAgain = true;
    $('#endBest').textContent = 'מחכים ל' + this.opName() + '…';
    VerseNet.rematch().catch(() => { $('#endBest').textContent = this.opName() + ' כבר לא כאן'; $('#bAgain').hidden = true; });
  },
  leave() { if (this.active) { VerseNet.leave().catch(() => {}); } this.active = null; this.m = null; $('#play').classList.remove('vs'); },
};

// the hub must fit the height it gets (inside the verse's frame a phone gives it ~380-680 px): step down until it does
function fitHub() {
  const st = $('#start'); if (st.hidden) return;
  st.classList.remove('t1', 't2', 't3', 't4', 't5');
  const over = () => $('#foot').getBoundingClientRect().bottom > innerHeight - 4 || [...document.querySelectorAll('.app')].some((a) => !a.hidden && a.getBoundingClientRect().bottom > innerHeight - 4);
  for (const c of ['t1', 't2', 't3', 't4', 't5']) if (over()) st.classList.add(c);
}
{ const _ss = showStart; showStart = function () { _ss(); fitHub(); }; }
addEventListener('resize', () => setTimeout(fitHub, 80));
addEventListener('verseframe', () => setTimeout(fitHub, 30));
setTimeout(fitHub, 50);

if (window.VerseNet) {
  const N = VerseNet, isVs = (k) => !!VS_APPS[k];
  N.on('start', (m) => { if (isVs(m.key)) VS.begin(m); });
  N.on('claim', (c) => VS.onClaim(c));
  N.on('msg', (x) => VS.onMsg(x));
  N.on('left', ({ id }) => {
    if (!VS.active || id === VS.me) return;
    sfx('leave', .7);
    if (!VS.over) VS.end(true, 'left');
    else { $('#bAgain').hidden = true; $('#endBest').textContent = VS.opName() + ' כבר לא בפגישה'; }
  });
  N.on('rematch', ({ by }) => { if (VS.active && VS.over && by !== VS.me) $('#endBest').textContent = VS.opName() + ' רוצה משחק חוזר!'; });
  N.on('away', ({ id }) => { if (VS.active && !VS.over && id !== VS.me) verb('החיבור של ' + VS.opName() + ' נפל – מחכים לו…', 'itay'); });
  N.on('closed', () => {});

  // the end screen and HUD buttons, while a versus match runs
  const again = $('#bAgain').onclick, menu = $('#bMenu').onclick, home = $('#bHome').onclick, nw = $('#bNew').onclick;
  $('#bAgain').onclick = () => (VS.active ? VS.again() : again());
  $('#bNew').onclick = () => { if (!VS.active) return nw(); const k = VS.active; $('#end').hidden = true; VS.leave(); showStart(); N.quick(k, vsLabel(k)).catch(() => {}); };
  $('#bMenu').onclick = () => { if (VS.active) { VS.leave(); return showStart(); } menu(); };
  $('#bHome').onclick = () => { if (VS.active) { VS.leave(); return showStart(); } home(); };

  // "אונליין ←" on each app card (hidden until his ?online=1 preview, like Callio)
  document.querySelectorAll('[data-onl]').forEach((el) => el.addEventListener('click', async (e) => {
    e.stopPropagation(); e.preventDefault();
    sfx('tap', .5);
    if (!N.available) await NET_READY;   // tapped before the verse answered: wait for it (callio.js)
    if (!N.available) { $('#tagline').textContent = 'משחק אונליין עובד בתוך שלומיוורס – shlomiverse.com'; return; }
    N.lobby(el.dataset.onl, vsLabel(el.dataset.onl)).catch(() => {});
  }));
  const showOnl = () => { document.querySelectorAll('[data-onl]').forEach((el) => { el.hidden = false; }); $('#appCallio').hidden = false; fitHub(); };
  showOnl();  // released to everyone 12 Nov 2026
  NET_READY.then((r) => { if (r && r.flags && r.flags.online) showOnl(); });
}
