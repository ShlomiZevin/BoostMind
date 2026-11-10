# one-off: window peeks, HUD at the bottom over the Techy-Tech lobby strip (10 Nov 2026)
import io
P = 'C:/workspace/BoostMind/public/yotam-games/deadlock/game.js'
s = io.open(P, encoding='utf-8').read()

def rep(a, b):
    global s
    assert s.count(a) == 1, a[:60]
    s = s.replace(a, b)

# pictures: the lobby strip under the board
rep("img('floor', 'assets/floor.jpg');", "img('floor', 'assets/floor.jpg');\nimg('lobby', 'assets/lobby.jpg?v=1');")

# layout: nothing over the Techy-Tech wall sign; the HUD sits at the bottom under Yotam's strip
rep("""  const top = cssPx('var(--safe-t)') + 58;""", """  const top = cssPx('var(--safe-t)') + 4;""")
rep("""  const bottom = H - stripH - 16 - (parseFloat""", """  const bottom = H - stripH - 16 - 52 - (parseFloat""")
rep("""  const cropTop = Math.max(0, Math.min(300, FL.y0 - 40 - (bottom - top) * 0.25));""",
    """  const cropTop = Math.max(0, Math.min(60, FL.y0 - 40 - (bottom - top) * 0.25));   // never above the sign (y 90)""")

# draw the lobby under the floor, full width, from the floor's bottom stripe to the screen's bottom
rep("""  if (fl.complete && fl.naturalWidth) ctx.drawImage(fl, OX, OY, FL.w * S, FL.h * S);""",
    """  if (fl.complete && fl.naturalWidth) ctx.drawImage(fl, OX, OY, FL.w * S, FL.h * S);
  drawLobby();""")
rep("""function roundRect(""", """// the Techy-Tech lobby (elevator up to the office, badge reader, charger, Sagi's scooter) fills the space under the board
function drawLobby() {
  const lb = IMG.lobby, y0 = Math.round(OY + (FL.h - 8) * S);
  if (!lb.complete || !lb.naturalWidth || y0 >= H) return;
  const sc = Math.max(W / lb.naturalWidth, (H - y0) / (lb.naturalHeight - 30)), dw = lb.naturalWidth * sc;
  ctx.drawImage(lb, 0, 30, lb.naturalWidth, lb.naturalHeight - 30, (W - dw) / 2, y0, dw, (lb.naturalHeight - 30) * sc);
  const g = ctx.createLinearGradient(0, y0, 0, y0 + 14); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, 14);
}
function roundRect(""")

# peeks: the owner slides from the roof sticker to the side window and says a line
rep("""function show(id) {""", """const peeks = [];   // { i, t, dur, side }
function peek(i, kind) {
  const p = pieces[i]; if (!p || i === 0 || p.gone) return;
  const t = TEAM[p.id], L = WIN[p.id] || WIN.general;
  const text = pickNo(Math.random() < .25 ? WIN.general[kind] : L[kind], p.id + kind);
  for (let k = peeks.length - 1; k >= 0; k--) if (peeks[k].i === i || peeks.length > 1) { peeks[k].el.remove(); peeks.splice(k, 1); }
  // the window on the side facing the middle of the board
  const side = p.h ? (p.r < N / 2 ? 1 : -1) : (p.c < N / 2 ? 1 : -1);
  const el = document.createElement('div'); el.className = 'peek';
  el.innerHTML = `<b>${t.name}</b>${text}`;
  $('fx').appendChild(el);
  const k = { i, t: 0, dur: 2.6, side, el };
  peeks.push(k); placePeek(k);
  play('window', .45);
}
function peekHead(k) {
  const p = pieces[k.i], w = (p.h ? p.len : 1) * CELL, h = (p.h ? 1 : p.len) * CELL;
  const cx = gx(p.c) + w / 2, cy = gy(p.r) + h / 2;
  const out = Math.min(1, k.t / .25, (k.dur - k.t) / .3);   // slides out, stays, slides back
  const e = out <= 0 ? 0 : 1 - (1 - out) ** 3;
  const reach = CELL * .5;
  return p.h ? { x: cx, y: cy + k.side * reach * e, e } : { x: cx + k.side * reach * e, y: cy, e };
}
function placePeek(k) {
  const hd = peekHead(k), d = CELL * .62, bw = k.el.offsetWidth, hw = bw / 2 + 6;
  let y = hd.y - d * .55 - 8, x = Math.max(hw, Math.min(W - hw, hd.x));
  if (y - k.el.offsetHeight < cssPx('var(--safe-t)') + 4) y = hd.y + d * .55 + k.el.offsetHeight + 14;
  k.el.style.left = x + 'px'; k.el.style.top = y + 'px';
  k.el.style.setProperty('--tail', Math.max(14, Math.min(bw - 14, hd.x - x + bw / 2)) + 'px');
}
function tickPeeks(dt) {
  for (let k = peeks.length - 1; k >= 0; k--) { const q = peeks[k]; q.t += dt; if (q.t >= q.dur || !pieces[q.i]) { q.el.remove(); peeks.splice(k, 1); } }
}
function clearPeeks() { while (peeks.length) peeks.pop().el.remove(); }
function show(id) {""")

rep("""  if (tut.on) tut.update();
}""", """  if (tut.on) tut.update();
  tickPeeks(dt);
}""")
rep("""  for (const i of order) drawCar(i, time);
}""", """  for (const i of order) drawCar(i, time);
  for (const k of peeks) drawPeek(k);
}
function drawPeek(k) {
  const p = pieces[k.i], f = IMG['face-' + TEAM[p.id].face], hd = peekHead(k), d = CELL * .62;
  if (!f.complete || !f.naturalWidth || hd.e <= 0) return;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  ctx.beginPath(); ctx.arc(hd.x, hd.y, d / 2 + 2, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.beginPath(); ctx.arc(hd.x, hd.y, d / 2, 0, 7); ctx.clip();
  ctx.drawImage(f, hd.x - d / 2, hd.y - d / 2, d, d); ctx.restore();
}""")
# the roof sticker hides while its owner leans out of the window
rep("""  const f = IMG['face-' + t.face];
  if (f.complete && f.naturalWidth) {""", """  const f = IMG['face-' + t.face];
  if (f.complete && f.naturalWidth && !peeks.some((k) => k.i === i && peekHead(k).e > .15)) {""")

# triggers: moved / bumped / blocking
rep("""    drag.bumped = want < drag.b.lo ? -1 : 1; play('bump', .55);
    if (drag.i === 0 && over >= 0) say(pickNo(LINES.blocked, 'bl').replace('{n}', TEAM[pieces[over].id].name), 'sad', pieces[over].id);
    else if (over >= 0 && Math.random() < .35) play('honk', .4);""",
    """    drag.bumped = want < drag.b.lo ? -1 : 1; play('bump', .6);
    if (drag.i === 0 && over >= 0) { say(pickNo(LINES.blocked, 'bl').replace('{n}', TEAM[pieces[over].id].name), 'sad', pieces[over].id); peek(over, 'blocking'); }
    else if (over > 0) peek(over, 'bumped');""")
rep("""    if (i !== 0 && Math.random() < .3) say(pickNo(TEAM[p.id].lines, p.id), 'explain', p.id);""",
    """    if (i !== 0) peek(i, 'moved');""")
rep("""  tagAt(i); play(i === 0 ? 'pick' : 'honk', i === 0 ? .6 : .45);""", """  tagAt(i); play(i === 0 ? 'pick' : 'honk', i === 0 ? .6 : .3);""")
rep("""  play('win', .6);
  $('lotH')""", """  play('win', .6); clearPeeks();
  $('lotH')""")
rep("""  pieces = makePieces(lot, `${SLUG}|${today()}|${i}|cars`);""", """  clearPeeks();
  pieces = makePieces(lot, `${SLUG}|${today()}|${i}|cars`);""")
io.open(P, 'w', encoding='utf-8').write(s)
print('ok')
