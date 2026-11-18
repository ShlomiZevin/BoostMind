// ───────────────────────── effects ─────────────────────────
let ripple = null, shake = 0, parts = [], flies = [], trailEmit = 0;
function sparkle(x, y, col) { parts.push({ x, y, vx: (Math.random() - 0.5) * 1.2, vy: -0.6 - Math.random() * 1.2, life: 0.9 + Math.random() * 0.5, max: 1.4, col, kind: 'star' }); }
function dust(x, y) { parts.push({ x, y, vx: (Math.random() - 0.5) * 0.4, vy: -0.1, life: 0.5, max: 0.5, kind: 'dust' }); }
function fxStep(dt) {
  if (ripple) { ripple.t += dt; if (ripple.t > 2.5) ripple = null; }
  if (shake > 0) shake = Math.max(0, shake - dt);
  for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.kind === 'star' ? 1.4 : 0) * dt; q.life -= dt; }
  parts = parts.filter((q) => q.life > 0);
  if (!flies.length) for (let i = 0; i < 16; i++) flies.push({ x: Math.random() * COLS, y: Math.random() * ROWS, ph: Math.random() * 6, sp: 0.3 + Math.random() * 0.4 });
  for (const f of flies) { f.ph += dt * f.sp; f.x += Math.cos(f.ph * 1.3) * dt * 0.5; f.y += Math.sin(f.ph) * dt * 0.4; if (f.x < 0) f.x += COLS; if (f.x > COLS) f.x -= COLS; if (f.y < 0) f.y += ROWS; if (f.y > ROWS) f.y -= ROWS; }
  // sparkles along the trail while he draws it, dust under his feet
  if (player && trail.length && !player.idle && freeze <= 0) { trailEmit -= dt; if (trailEmit <= 0) { trailEmit = 0.06; const pp = ppos(); sparkle(pp.x + 0.5 + (Math.random() - 0.5) * 0.4, pp.y + 0.7, '#f5d0fe'); } }
  if (player && !player.idle && freeze <= 0) { const st = Math.floor(player.walk * 2.2); if (st !== player.lastStep) { player.lastStep = st; const pp = ppos(); dust(pp.x + 0.5, pp.y + 0.95); } }
  if (parts.length > 220) parts.splice(0, parts.length - 220);
}

// ───────────────────────── drawing ─────────────────────────
function shadow(cx, cy, w) { ctx.save(); ctx.fillStyle = '#0007'; ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, w / 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
function sprite(im, cx, bottom, h, flip, alpha = 1, sq = 1) {
  if (!ok(im)) return;
  const w = h * im.naturalWidth / im.naturalHeight;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, bottom); ctx.scale(flip ? -1 / sq : 1 / sq, sq);
  ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
}
// a walk-cycle frame: stride, pass, stride (mirrored front / back), pass; feet anchored where the sheet put them
function animFrame(set, view, walk, moving, mirrorOK) {
  if (!moving) return { key: `${set}-${view}2`, mirror: false };
  const ph = Math.floor(walk * 2.2) % 4;
  const n = ph % 2 ? 2 : 1, mirror = mirrorOK && view !== 's' && ph === 2;
  return { key: `${set}-${view}${n}`, mirror };
}
function drawAnim(set, fr, cx, bottom, h, flipSide, alpha = 1, sqx = 1, sqy = 1) {
  const im = IMG[fr.key]; if (!ok(im)) return false;
  const w = h * im.naturalWidth / im.naturalHeight, fx = FEET[set] ?? 0.5;
  const flip = (!!flipSide) !== fr.mirror;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, bottom); ctx.scale((flip ? -1 : 1) * sqx, sqy);
  ctx.drawImage(im, -fx * w, -h, w, h); ctx.restore();
  return true;
}
function drawBubble(text, hx, hy, alpha) {
  const fs = clamp(Math.round(B.t * 0.62), 12, 15), pad = fs * 0.5, maxW = Math.min(W * 0.55, fs * 11);
  ctx.save(); ctx.font = `700 ${fs}px Rubik, system-ui, sans-serif`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const words = text.split(' '), rows = []; let row = '';
  for (const w of words) { const t = row ? row + ' ' + w : w; if (ctx.measureText(t).width > maxW && row) { rows.push(row); row = w; } else row = t; }
  rows.push(row);
  const bw = Math.max(...rows.map((t) => ctx.measureText(t).width)) + pad * 2, bh = rows.length * fs * 1.25 + pad * 1.2;
  const right = hx < W / 2;
  let bx = right ? hx + B.t * 0.6 : hx - B.t * 0.6 - bw, by = hy - bh;
  bx = clamp(bx, 6, W - bw - 6); by = clamp(by, B.y + 2, H - bh - 80);
  ctx.globalAlpha = alpha; ctx.fillStyle = '#fffffff2'; ctx.strokeStyle = '#140d2477'; ctx.lineWidth = 2;
  ctx.shadowColor = '#0008'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, Math.min(14, bh / 2)); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.stroke();
  // the tail toward his head
  const tx0 = clamp(hx, bx + 12, bx + bw - 12); ctx.fillStyle = '#fffffff2'; ctx.beginPath(); ctx.moveTo(tx0 - 6, by + bh - 1); ctx.lineTo(hx + (right ? -2 : 2), by + bh + 9); ctx.lineTo(tx0 + 6, by + bh - 1); ctx.fill();
  ctx.fillStyle = '#140d24'; rows.forEach((t, i) => ctx.fillText(t, bx + bw / 2, by + pad * 0.6 + fs * 1.25 * (i + 0.5)));
  ctx.restore();
}
function glow(x, y, r, col, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
function draw(now) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#0d0818'; ctx.fillRect(0, 0, W, H);
  if (state === 'menu' || !player) return;
  const t = B.t;
  if (shake > 0) { const k = shake * 12; ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k); }
  ctx.save(); ctx.beginPath(); ctx.roundRect(B.x, B.y, B.w, B.h, 10); ctx.clip();
  const gim = IMG['ground-' + arena().id];
  if (ok(gim)) { const m = mapRect(); ctx.drawImage(gim, B.x + m.x * t, B.y + m.y * t, m.w * t, m.h * t); }
  ctx.fillStyle = '#0d081833'; ctx.fillRect(B.x, B.y, B.w, B.h);
  // lamp light pools on the ground
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const L of lights) glow(px(L.x - 0.5), py(L.y + 0.9), t * 3.2, 'rgba(255,190,90,A)', 0.2 + Math.sin(now * 3 + L.ph) * 0.03 + (Math.random() < 0.01 ? -0.08 : 0));
  // police lights on the ground
  for (const o of police) glow(px(o.x), py(o.y), t * 2.4, Math.floor(now * 5 + o.x) % 2 ? 'rgba(255,40,60,A)' : 'rgba(40,110,255,A)', o.chase > 0 ? 0.42 : 0.26);
  ctx.restore();
  drawZone(now); drawTerritory();
  // the ripple over new ground
  if (ripple) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const i of ripple.cells) {
      const c = i % COLS, r = (i / COLS) | 0, d = Math.hypot(c - ripple.c, r - ripple.r), k = 1 - Math.abs(ripple.t * 16 - d) / 2.5;
      if (k > 0) { ctx.fillStyle = `rgba(216,180,254,${k * 0.55})`; ctx.fillRect(B.x + c * t, B.y + r * t, t + 0.5, t + 0.5); }
    }
    ctx.restore();
  }
  drawTrail(now);
  // dust (under everyone)
  for (const q of parts) if (q.kind === 'dust') { const k = q.life / q.max; ctx.fillStyle = `rgba(220,210,230,${k * 0.35})`; ctx.beginPath(); ctx.ellipse(px(q.x - 0.5), py(q.y - 0.5), t * (0.5 - k * 0.3), t * (0.22 - k * 0.12), 0, 0, Math.PI * 2); ctx.fill(); }
  // everyone and everything, back to front
  const items = [];
  for (const p of props) {
    const P = PROP[p.k];
    items.push({ y: p.r + P.h - 0.55, f: () => {
      const im = IMG['prop-' + p.k]; if (!ok(im)) return;
      const cx = B.x + (p.c + P.w / 2) * t, by = B.y + (p.r + P.h) * t - t * 0.15, w = P.dw * t, h = w * im.naturalHeight / im.naturalWidth;
      shadow(cx, by - t * 0.05, w * 0.8);
      ctx.drawImage(im, cx - w / 2, by - h, w, h);
    } });
  }
  for (const g of girls) items.push({ y: g.y, f: () => {
    const cx = px(g.x), by = py(g.y) + t * 0.45, run = g.state === 'flee' || g.state === 'stuck';
    const set = `${g.kind}-${run ? 'run' : 'walk'}`;
    const fr = animFrame(set, g.view, g.walk, g.moving || run, g.kind !== 'dog');
    const away = g.state === 'flee' && !inside(Math.round(g.x), Math.round(g.y));
    shadow(cx, by, t * 1.2);
    const sq = g.sq || 0;
    drawAnim(set, fr, cx, by - (g.moving ? Math.abs(Math.sin(g.walk * Math.PI * 2.2)) * t * 0.06 : 0), t * 2.95, g.view === 's' && g.flip, away ? 0.5 : 1, 1 + sq * 0.18, 1 - sq * 0.15);
    // her face over her head: how the talk is going
    let f = null;
    if (g.state === 'talk') f = talk && talk.g === g && talk.step >= 2 ? 'unsure' : 'polite';
    else if (run) f = 'horror';
    else if (g.cool > 0) f = 'unsure';
    if (f) { const s2 = t * 1.9, pulse = 1 + (g.state === 'talk' ? Math.sin(now * 6) * 0.05 : run ? Math.sin(now * 20) * 0.04 : 0); const im = IMG['face-' + f]; if (ok(im)) ctx.drawImage(im, cx - s2 * pulse / 2, by - t * 2.95 - s2 * pulse - t * 0.05, s2 * pulse, s2 * pulse); }
    if (g.state === 'stuck') { ctx.fillStyle = '#7dd3fc'; for (let k = 0; k < 2; k++) { const a = now * 6 + k * 3; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * t * 0.7, by - t * 2.2 + Math.abs(Math.sin(a)) * t * 0.3, t * 0.08, t * 0.13, 0, 0, Math.PI * 2); ctx.fill(); } }
  } });
  for (const o of police) items.push({ y: o.y, f: () => {
    const im = IMG.police; if (!ok(im)) return; const L = t * 2.0, w = L * im.naturalWidth / im.naturalHeight;
    ctx.save(); ctx.translate(px(o.x), py(o.y)); ctx.rotate(o.ang + Math.PI / 2);
    ctx.fillStyle = '#0006'; ctx.beginPath(); ctx.ellipse(t * 0.12, t * 0.18, w * 0.55, L * 0.52, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(im, -w / 2, -L / 2, w, L);
    ctx.restore();
  } });
  const pp = ppos();
  items.push({ y: pp.y + 0.01, f: () => {
    const cx = px(pp.x), by = py(pp.y) + t * 0.45;
    const blink = invuln > 0 && freeze <= 0 && Math.floor(now * 10) % 2;
    shadow(cx, by, t * 1.25);
    if (freeze > 0) { sprite(IMG['guy-caught'], cx + Math.sin(now * 50) * 2, by, t * 2.9, false); return; }
    const moving = !player.idle && player.prog < 1 && state !== 'count';
    const view = dir.x ? 's' : dir.y > 0 ? 'f' : 'b';
    if (!moving && talk) { sprite(IMG['guy-talk'], cx, by, t * 2.9, player.face < 0, blink ? 0.4 : 1, 1 + Math.sin(now * 8) * 0.02); return; }
    const fr = animFrame('guy', view, player.walk, moving, true);
    const bq = player.bump > 0 ? Math.sin(player.bump * 40) * 0.08 : 0;
    const bob = moving ? Math.abs(Math.sin(player.walk * Math.PI * 2.2)) * t * 0.07 : 0;
    if (!drawAnim('guy', fr, cx, by - bob, t * 3.05, view === 's' && dir.x < 0, blink ? 0.4 : 1, 1 + bq, 1 - bq)) sprite(IMG['guy-talk'], cx, by, t * 2.9, player.face < 0);
  } });
  items.sort((a, b) => a.y - b.y).forEach((it) => it.f());
  // the lamps' heads glow, fireflies, sparkles
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const L of lights) glow(px(L.x - 0.5), B.y + (L.y + 0.6) * t - t * 1.75, t * 1.1, 'rgba(255,210,120,A)', 0.55 + Math.sin(now * 3 + L.ph) * 0.08);
  for (const f of flies) glow(px(f.x), py(f.y), t * 0.35, 'rgba(210,255,140,A)', 0.35 + Math.sin(f.ph * 4) * 0.3);
  for (const q of parts) if (q.kind === 'star') {
    const k = q.life / q.max, x = px(q.x - 0.5), y = py(q.y - 0.5), r = t * 0.22 * k + 1;
    ctx.strokeStyle = q.col; ctx.globalAlpha = k; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
  }
  ctx.restore();
  // a soft night vignette
  const vg = ctx.createRadialGradient(B.x + B.w / 2, B.y + B.h * 0.55, Math.min(B.w, B.h) * 0.35, B.x + B.w / 2, B.y + B.h / 2, Math.max(B.w, B.h) * 0.75);
  vg.addColorStop(0, 'rgba(8,4,20,0)'); vg.addColorStop(1, 'rgba(8,4,20,0.5)'); ctx.fillStyle = vg; ctx.fillRect(B.x, B.y, B.w, B.h);
  ctx.restore();
  if (bubble) drawBubble(bubble.text, px(pp.x), py(pp.y) - t * 2.8, clamp(bubble.t * 3, 0, 1));
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (joy.on) {
    ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.fillStyle = '#140d2466';
    ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 46, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 0.85; ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(joy.x, joy.y, 18, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
}
