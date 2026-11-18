# polish round 2: behaviour (obstacles, bounce, bubbles), animation + effects (edits game.js in place)
import os, re
D = os.path.dirname(__file__)
p = os.path.join(D, '..', '..', '..', '..', 'public', 'night-guy-games', 'garden', 'game.js')
s = open(p, encoding='utf-8').read()
def rep(a, b):
    global s
    assert a in s, 'MISSING: ' + a[:100]
    s = s.replace(a, b, 1)

# ---- short story lines for the bubble beside his head, and his openers
rep("const UNLOCK = ['phone', 'shake', 'dog', 'laptop'];",
"""// the same stories, short - in the bubble beside his head
const SHORT = {
  phone: ['את אוהבת רילסים?', 'אני שולח לחברה שלי. חתולים, AI...', 'היא לא אוהבת. אז קניתי לה מסך ענק.', 'רק קשרתי אותה לכי—'],
  shake: ['את לוקחת תוספים?', 'קריאטין! זה מחזק! ממש מחזק!', 'היא רוצה גם. אני לא נותן.', 'למקום! למקום!'],
  dog: ['איך הם יודעים שאני האדון?', 'יש לי בבית מקרה קשה. קשה מאוד.', 'נובחים, נושכים, אוכלים מהזבל...', 'אין לי כלב. זה על חברה שלי.'],
  laptop: ['את לא מפחדת מה-AI?', 'אני לא עובד. היא מפרנסת.', 'היא צורחת עליי... טונים גבוהים.', '״מה, תלית אותי?!״'],
};
const OPENERS = ['סליחה!', 'אפשר לשאול אותך שאלה?', 'סליחה, רגע...', 'תגידי...', 'סליחה, אפשר שאלה קטנה?'];
const UNLOCK = ['phone', 'shake', 'dog', 'laptop'];""")
rep("  other: ['סליחה, אפשר לשאול אותך משהו? ...לאן את רצה?', 'רגע, רק שאלה קטנה!'],",
    "  other: ['סליחה, אפשר לשאול אותך משהו? ...לאן את רצה?', 'רגע, רק שאלה קטנה!'],\n  done: ['טוב, לילה טוב!', 'נדבר מחר, באותה שעה!', 'היה נעים! אני פה כל לילה.'],")

# ---- the park per night / the tutorial's stage
rep("setRows(); buildPark(); homeBlock(); resetPlayer();\n  R = rng(`${SLUG}|${today()}|${night}`);",
    "setRows(); buildPark(`${SLUG}|${today()}|${arena().id}|${ROWS}`); homeBlock(); resetPlayer();\n  R = rng(`${SLUG}|${today()}|${night}`);")
rep("say(night === 1 ? 'לילה בגינה. בואו נראה מי מסתובבת פה...' : `לילה ${night}. ${kinds().length > night ? '' : ''}עוד שאלות קטנות.`, 3);",
    "say(night === 1 ? 'לילה בגינה. בואו נראה מי מסתובבת פה...' : `${arena().name}. עוד לילה, עוד שאלות קטנות.`, 3); banner(arena().name);")
rep("setRows(); buildPark(); homeBlock(); resetPlayer(); R = rng('tutorial');",
    "setRows(); buildPark('tutorial|' + ROWS, START().r - 9); homeBlock(); resetPlayer(); R = rng('tutorial');")

# ---- nobody walks through things
rep("const walkable = (c, r) => inside(c, r) && !owner[idx(c, r)] && !zone[idx(c, r)];",
    "const walkable = (c, r) => inside(c, r) && !owner[idx(c, r)] && !zone[idx(c, r)] && !block[idx(c, r)];")
rep("let opts = DIR4.filter((q) => inside(o.c + q.x, o.r + q.y) && !(q.x === -o.d.x && q.y === -o.d.y));\n    if (!opts.length) opts = DIR4.filter((q) => inside(o.c + q.x, o.r + q.y));",
    "let opts = DIR4.filter((q) => !blocked(o.c + q.x, o.r + q.y) && !(q.x === -o.d.x && q.y === -o.d.y));\n    if (!opts.length) opts = DIR4.filter((q) => !blocked(o.c + q.x, o.r + q.y));")
rep("const p = freeCell((c, r) => (c === 0 || c === COLS - 1 || r === 0 || r === ROWS - 1) && Math.hypot(c - pp.x, r - pp.y) > 9) || { c: 0, r: 0 };",
    "const p = freeCell((c, r) => (c === 0 || c === COLS - 1 || r === 0 || r === ROWS - 1) && !blocked(c, r) && Math.hypot(c - pp.x, r - pp.y) > 9) || { c: 0, r: ROWS - 1 };")
rep("  if (!inside(nc, nr)) { player.prog = 1; return false; }             // the park's edge: he waits for a turn",
    "  if (blocked(nc, nr)) {                                               // the edge, a bench, a bin: he waits for a turn\n    player.prog = 1; if (!player.bump) { player.bump = 0.25; if (inside(nc, nr)) play('bump', .35); } return false;\n  }")
rep("player = { c: s.c, r: s.r, pc: s.c, pr: s.r, prog: 1, face: 1, idle: true };",
    "player = { c: s.c, r: s.r, pc: s.c, pr: s.r, prog: 1, face: 1, idle: true, walk: 0, bump: 0, view: 'f' };")

# ---- girls: animation state, fleeing around things, trapped ones bounce off his ground's edge
rep("const g = { kind: kind || pick(kinds(), R), x: p.c, y: p.r, c: p.c, r: p.r, tc: p.c, tr: p.r, spd: spd || (1.1 + R() * 0.4), state: 'walk', t: 0, cool: 0, flip: false, goal: null, k: 0 };",
    "const g = { kind: kind || pick(kinds(), R), x: p.c, y: p.r, c: p.c, r: p.r, tc: p.c, tr: p.r, spd: spd || (1.1 + R() * 0.4), state: 'walk', t: 0, cool: 0, flip: false, goal: null, k: 0, view: 'f', walk: 0, moving: false, sq: 0 };")
a = s.index("function girlStep(g, dt) {")
b = s.index("// ───────────────────────── the small talk")
s = s[:a] + r"""function girlStep(g, dt) {
  if (g.sq > 0) g.sq = Math.max(0, g.sq - dt * 4);
  if (g.state === 'stuck') {
    // trapped in his ground: she runs for it and bounces off the edge, again and again, till he's done
    g.t -= dt;
    if (g.t <= 0) { g.state = 'flee'; g.out = null; play('scream', .55); guySays(pickNo(LINES.done, 'done'), 1.8); return; }
  }
  const fleeing = g.state === 'flee', stuck = g.state === 'stuck';
  const spd = stuck ? 3.4 : fleeing ? 4.4 : g.state === 'talk' ? g.spd * 0.55 : g.spd;
  const dx = g.tc - g.x, dy = g.tr - g.y, d = Math.hypot(dx, dy);
  if (d > 0.001) {
    const m = Math.min(d, spd * dt); g.x += dx / d * m; g.y += dy / d * m; g.walk += m; g.moving = true;
    if (Math.abs(dx) > Math.abs(dy)) { g.view = 's'; g.flip = dx < 0; } else g.view = dy > 0 ? 'f' : 'b';
    return;
  }
  g.c = g.tc; g.r = g.tr; g.moving = false;
  if (stuck) {
    if (!g.run) g.run = pick(DIR4);
    let nc = g.c + g.run.x, nr = g.r + g.run.y;
    if (!inside(nc, nr) || !owner[idx(nc, nr)] || block[idx(nc, nr)]) {
      // the edge of his ground: bump, bounce back, try another way
      g.sq = 1; play('bump', .4); if (Math.random() < 0.5) popText(px(g.x), py(g.y) - B.t * 3.2, pick(['!!', 'הצילו!', 'אין יציאה!']), 'bad');
      const back = { x: -g.run.x, y: -g.run.y }, opts = DIR4.filter((q) => { const x = g.c + q.x, y = g.r + q.y; return inside(x, y) && owner[idx(x, y)] && !block[idx(x, y)]; });
      g.run = opts.length ? (opts.find((q) => q.x === back.x && q.y === back.y && Math.random() < 0.6) || pick(opts)) : back;
      nc = g.c + g.run.x; nr = g.r + g.run.y;
      if (!inside(nc, nr) || !owner[idx(nc, nr)] || block[idx(nc, nr)]) return;
      g.tc = nc; g.tr = nr; g.pause = 0.15; return;
    }
    g.tc = nc; g.tr = nr; return;
  }
  if (fleeing) {                                          // to the nearest edge, around things, then gone
    if (!inside(g.c, g.r)) { g.gone = true; return; }
    if (!g.out) g.out = [[g.c + 1, -1, 0], [COLS - g.c, 1, 0], [g.r + 1, 0, -1], [ROWS - g.r, 0, 1]].sort((a, b) => a[0] - b[0])[0];
    let nx = g.c + g.out[1], ny = g.r + g.out[2];
    if (inside(nx, ny) && block[idx(nx, ny)]) {
      const side = [{ x: g.out[2], y: g.out[1] }, { x: -g.out[2], y: -g.out[1] }].find((q) => !blocked(g.c + q.x, g.r + q.y));
      if (side) { nx = g.c + side.x; ny = g.r + side.y; }
    }
    g.tc = nx; g.tr = ny;
    return;
  }
  if (!g.goal || (g.goal.c === g.c && g.goal.r === g.r) || R() < 0.04) girlGoal(g);
  const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([ox, oy]) => ({ c: g.c + ox, r: g.r + oy }))
    .filter((q) => walkable(q.c, q.r)).sort((a, b) => Math.hypot(a.c - g.goal.c, a.r - g.goal.r) - Math.hypot(b.c - g.goal.c, b.r - g.goal.r));
  if (!opts.length) return;                               // boxed in by his ground: she waits (and gets trapped by the next loop)
  if (R() < 0.15 && opts.length > 1) opts.shift();          // a little wandering
  const n = opts[0];
  g.tc = n.c; g.tr = n.r;
}

""" + s[b:]
rep("// ───────────────────────── police ─────────────────────────\nconst DIR4 = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];\n", "// ───────────────────────── police ─────────────────────────\n")
rep("// ───────────────────────── strangers ─────────────────────────", "// ───────────────────────── strangers ─────────────────────────\nconst DIR4 = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];")

# ---- his bubbles: an opener, then each line short
rep("say(STORIES[g.kind][0], 99); pips(1);\n  play('talk', .8); guySays('סליחה!', 1.2);",
    "say(STORIES[g.kind][0], 99); pips(1);\n  play('talk', .8); guySays(pickNo(OPENERS, 'open'), 1.3);\n  setTimeout(() => { if (talk && talk.g === g && talk.step === 0) guySays(SHORT[g.kind][0], stepDur() * 0.85); }, 1300);")
rep("say(STORIES[g.kind][talk.step], 99); pips(talk.step + 1);",
    "say(STORIES[g.kind][talk.step], 99); pips(talk.step + 1); guySays(SHORT[g.kind][talk.step], stepDur() * 0.9);")
rep("say(STORIES[g.kind][3], 3.4, 'loud'); pips(4);", "say(STORIES[g.kind][3], 3.4, 'loud'); pips(4); guySays(SHORT[g.kind][3], 2.4);")
rep("g.state = 'stuck'; g.t = 2.4;\n  if (was) { say(STORIES[g.kind][3], 3.6, 'reveal'); pips(4); talk = null; }\n  else say(pickNo(LINES.other, 'oth'), 2.4);",
    "g.state = 'stuck'; g.t = 3.6; g.run = null; g.tc = Math.round(g.x); g.tr = Math.round(g.y); g.x = g.tc; g.y = g.tr;\n  if (was) { say(STORIES[g.kind][3], 3.8, 'reveal'); pips(4); talk = null; guySays(SHORT[g.kind][3], 2.6); }\n  else { say(pickNo(LINES.other, 'oth'), 2.4); guySays(pickNo(OPENERS, 'open'), 1.6); }")

# ---- claim: a ripple of new ground + sparkles
rep("  let gained = trail.length;\n  for (let i = 0; i < owner.length; i++) if (!owner[i] && !out[i]) { owner[i] = 1; gained++; }",
    "  let gained = trail.length; const fresh = trail.map((t) => idx(t.c, t.r));\n  for (let i = 0; i < owner.length; i++) if (!owner[i] && !out[i]) { owner[i] = 1; if (!block[i]) gained++; fresh.push(i); }\n  ripple = { cells: fresh, c: player.c, r: player.r, t: 0 };\n  for (let k = 0; k < Math.min(40, fresh.length); k++) { const i = pick(fresh); sparkle(i % COLS + Math.random(), ((i / COLS) | 0) + Math.random(), '#e9d5ff'); }")

# ---- step: timers for the new effects
rep("  if (bubble && (bubble.t -= dt) <= 0) bubble = null;\n}",
    "  if (bubble && (bubble.t -= dt) <= 0) bubble = null;\n  fxStep(dt);\n}")
rep("    player.prog += dt * SPEED;", "    player.prog += dt * SPEED; if (player.prog < 1.001) player.walk += dt * SPEED;")
rep("  if (freeze > 0) { freeze -= dt; if (freeze <= 0) afterCaught(); return; }",
    "  if (freeze > 0) { freeze -= dt; fxStep(dt); if (freeze <= 0) afterCaught(); return; }\n  if (player.bump > 0) player.bump = Math.max(0, player.bump - dt);")
rep("  lives--; freeze = 1.3; invuln = 1.3 + 1.6; loop('trail', 0);", "  lives--; freeze = 1.3; invuln = 1.3 + 1.6; loop('trail', 0); shake = 0.5;")

# ---- the night card names the next park
rep("$('nightGoal').textContent = `יעד: ${goal()}% מהגינה${nk}`;", "$('nightGoal').textContent = `${arena().name} · יעד: ${goal()}%${nk}`;")

# ---- drawing: replace sprite..draw with the new renderer
a = s.index("function sprite(im, cx, bottom, h, flip, alpha = 1, sq = 1) {")
b = s.index("// ───────────────────────── HUD + screens")
s = s[:a] + open(os.path.join(D, 'polish-draw.js'), encoding='utf-8').read() + "\n" + s[b:]
# old drawZone / drawTrail stay above; remove the old map draw dependency already handled in new draw
open(p, 'w', encoding='utf-8').write(s)
print('ok')
