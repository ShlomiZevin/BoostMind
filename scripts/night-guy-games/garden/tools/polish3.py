# polish 3: smooth walk playback (no mirrored frames, no stop on each tile, steady cadence); trapped girls never escape
import os
p = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'public', 'night-guy-games', 'garden', 'game.js')
s = open(p, encoding='utf-8').read()
def rep(a, b):
    global s
    assert a in s, 'MISSING: ' + a[:100]
    s = s.replace(a, b, 1)

# walk cycle: stride, pass, stride, pass - never mirrored (mirroring swapped the phone / shaker between hands = a blink);
# the cadence per set (steps per tile walked)
rep("""function animFrame(set, view, walk, moving, mirrorOK) {
  if (!moving) return { key: `${set}-${view}2`, mirror: false };
  const ph = Math.floor(walk * 2.2) % 4;
  const n = ph % 2 ? 2 : 1, mirror = mirrorOK && view !== 's' && ph === 2;
  return { key: `${set}-${view}${n}`, mirror };
}""", """function animFrame(set, view, walk, moving, rate = 2.2) {
  if (!moving) return { key: `${set}-${view}2`, mirror: false };
  return { key: `${set}-${view}${Math.floor(walk * rate) % 2 ? 2 : 1}`, mirror: false };
}""")
rep("const fr = animFrame(set, g.view, g.walk, g.moving || run, g.kind !== 'dog');", "const fr = animFrame(set, g.view, g.walk, g.moving || run, run ? 2.6 : 3.4);")
rep("drawAnim(set, fr, cx, by - (g.moving ? Math.abs(Math.sin(g.walk * Math.PI * 2.2)) * t * 0.06 : 0),", "drawAnim(set, fr, cx, by - (g.moving ? Math.abs(Math.sin(g.walk * Math.PI * 3.4)) * t * 0.05 : 0),")
rep("const fr = animFrame('guy', view, player.walk, moving, true);", "const fr = animFrame('guy', view, player.walk, moving, 2.2);")

# girls: keep walking through tile centres (no one-frame stop = no pose flash), carry the leftover distance
a = s.index("  const dx = g.tc - g.x, dy = g.tr - g.y, d = Math.hypot(dx, dy);\n  if (d > 0.001) {\n    const m = Math.min(d, spd * dt);")
b = s.index("  if (stuck) {\n    if (!g.run) g.run = pick(DIR4);")
s = s[:a] + """  let budget = spd * dt;
  for (let guard = 0; guard < 3; guard++) {
    const dx = g.tc - g.x, dy = g.tr - g.y, d = Math.hypot(dx, dy);
    if (d > 0.0005) {
      const m = Math.min(d, budget); g.x += dx / d * m; g.y += dy / d * m; g.walk += m; budget -= m; g.moving = true;
      if (Math.abs(dx) > Math.abs(dy)) { g.view = 's'; g.flip = dx < 0; } else g.view = dy > 0 ? 'f' : 'b';
      if (budget <= 0.0001) return;
    }
    g.c = g.tc; g.r = g.tr;
    girlRoute(g);
    if (g.gone || (g.tc === g.c && g.tr === g.r)) { g.moving = false; return; }
  }
}
// she reached a tile centre: where to next
function girlRoute(g) {
  const fleeing = g.state === 'flee', stuck = g.state === 'stuck' || g.state === 'kept';
""" + s[b:]
# the old tail of girlStep (after "g.c = g.tc; g.r = g.tr; g.moving = false;") is now inside girlNext: remove the leftover line
# trapped: after the story she stays inside his ground for the rest of the night, pacing scared, quietly
rep("""    if (g.t <= 0) { g.state = 'flee'; g.out = null; play('scream', .55); guySays(pickNo(LINES.done, 'done'), 1.8); return; }""",
    """    if (g.t <= 0) { g.state = 'kept'; guySays(pickNo(LINES.done, 'done'), 1.8); }""")
rep("const fleeing = g.state === 'flee', stuck = g.state === 'stuck';\n  const spd = stuck ? 3.4 : fleeing ? 4.4 : g.state === 'talk' ? g.spd * 0.55 : g.spd;",
    "const fleeing = g.state === 'flee', stuck = g.state === 'stuck', kept = g.state === 'kept';\n  const spd = stuck ? 3.4 : kept ? 1.2 : fleeing ? 4.4 : g.state === 'talk' ? g.spd * 0.55 : g.spd;")
rep("""      g.sq = 1; play('bump', .4); if (Math.random() < 0.5) popText(px(g.x), py(g.y) - B.t * 3.2, pick(['!!', 'הצילו!', 'אין יציאה!']), 'bad');""",
    """      g.sq = 1; if (g.state === 'stuck') { play('bump', .4); if (Math.random() < 0.5) popText(px(g.x), py(g.y) - B.t * 3.2, pick(['!!', 'הצילו!', 'אין יציאה!']), 'bad'); }""")
# a kept girl walks (scared face), a trapped one runs
rep("const cx = px(g.x), by = py(g.y) + t * 0.45, run = g.state === 'flee' || g.state === 'stuck';",
    "const cx = px(g.x), by = py(g.y) + t * 0.45, run = g.state === 'flee' || g.state === 'stuck', kept = g.state === 'kept';")
rep("    else if (run) f = 'horror';", "    else if (run || kept) f = 'horror';")
open(p, 'w', encoding='utf-8').write(s)
print('ok')
