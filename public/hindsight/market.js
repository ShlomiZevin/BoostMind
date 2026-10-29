// A finance-news market panel (a coin's card + its chart drawing in), drawn on a canvas in the frame's own pixels
// (1080x1920). One drawing for both sides: the editor plays it live (MarketPanel in editor.tsx) and the export renders
// it frame by frame (tools/market_frames.mjs).
// overlay: { style: "market", text (headline), symbol, pair, name, price, change (%), dump, draw (s), updated, call, x, y, w, start, end }
const clamp = (k) => Math.max(0, Math.min(1, k));
const ease = (k) => 1 - Math.pow(1 - k, 3);
const rnd = (seed) => { const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

export const MARKET_H = 640;  // the panel's height at w 960 (it scales with w)
const C = { bg: '#0d1117', head: '#161b22', line: 'rgba(255,255,255,0.12)', grid: 'rgba(255,255,255,0.07)', text: '#e6edf3',
  dim: '#8b949e', up: '#16c784', upFill: 'rgba(22,199,132,0.16)', down: '#ea3943', tag: '#d0121b', call: '#f0b90b', coin: '#f0b90b' };

/** Where the panel sits on the frame: {x, y, w, h, s} (s = scale against w 960). */
export function marketBox(o) {
  const w = Math.max(500, Math.min(1080, o.w || 960)), s = w / 960;
  return { x: o.x != null ? o.x - w / 2 : (1080 - w) / 2, y: o.y ?? 300, w, h: Math.round(MARKET_H * s), s };
}

/** The chart: three days (the day before yesterday flat, yesterday the rise, today after "the call" a slow slide). */
export function marketSeries(o) {
  const n = 40, up = 1 + (Number(o.change) || 95.4) / 100, dump = o.dump ?? 0.07, seed = String(o.symbol || 'X').length * 3.7;
  const v = [];
  for (let i = 0; i < 3 * n; i++) {
    const z = (rnd(seed + i * 1.31) - 0.5);
    if (i < n) v.push(1 + z * 0.035 + Math.sin(i * 0.5) * 0.01);
    else if (i < 2 * n) { const k = (i - n) / (n - 1), sm = k * k * (3 - 2 * k); v.push(1 + (up - 1) * sm + z * 0.05 * Math.sin(k * Math.PI)); }
    else { const k = (i - 2 * n) / (n - 1); v.push(up * (1 - dump * Math.pow(k, 0.8)) + z * 0.03); }
  }
  v[2 * n - 1] = up;  // the peak is exactly the change it shows
  return { v, n, up };
}

const font = (fam, wgt, px) => `${wgt} ${Math.round(px)}px ${fam}`;

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function txt(ctx, s, x, y, f, color, align = 'right', dir = 'rtl') {
  ctx.font = f; ctx.fillStyle = color; ctx.textAlign = align; ctx.direction = dir; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
}

/** Draw the panel at time t (seconds of the video). Nothing outside start..end. */
export function drawMarket(ctx, o, t, fam = '"zc-assistant", "Segoe UI", sans-serif') {
  if (o.start == null || t < o.start || (o.end != null && t > o.end)) return;
  const u = t - o.start, left = o.end != null ? o.end - t : 99;
  const a = ease(clamp(u / 0.35)) * clamp(left / 0.3);
  if (a <= 0) return;
  const { x, w, h, s } = marketBox(o), y = marketBox(o).y + (1 - ease(clamp(u / 0.35))) * 26 * s - (1 - clamp(left / 0.3)) * 18 * s;
  const { v, n, up } = marketSeries(o);
  const change = Number(o.change) || 95.4, price = Number(o.price) || 0.0847;
  ctx.save(); ctx.globalAlpha = a;

  // the card
  rrect(ctx, x, y, w, h, 14 * s); ctx.fillStyle = C.bg; ctx.fill(); ctx.lineWidth = 1.5 * s; ctx.strokeStyle = C.line; ctx.stroke();
  ctx.save(); rrect(ctx, x, y, w, h, 14 * s); ctx.clip();
  ctx.fillStyle = C.head; ctx.fillRect(x, y, w, 70 * s);
  ctx.fillStyle = C.line; ctx.fillRect(x, y + 70 * s, w, 1.5 * s);
  ctx.restore();

  // header: the red tag and the section (right), LIVE (left)
  ctx.font = font(fam, 800, 32 * s);
  const tag = o.tag || 'מבזק', tw = ctx.measureText(tag).width + 36 * s;
  rrect(ctx, x + w - 18 * s - tw, y + 15 * s, tw, 40 * s, 6 * s); ctx.fillStyle = C.tag; ctx.fill();
  txt(ctx, tag, x + w - 36 * s, y + 36 * s, font(fam, 800, 30 * s), '#fff');
  txt(ctx, o.text || 'שוק הקריפטו', x + w - 36 * s - tw, y + 36 * s, font(fam, 700, 30 * s), C.text);
  const blink = 0.45 + 0.55 * (0.5 + 0.5 * Math.cos(u * Math.PI * 2 / 1.2));
  ctx.globalAlpha = a * blink; ctx.beginPath(); ctx.arc(x + 34 * s, y + 35 * s, 8 * s, 0, Math.PI * 2); ctx.fillStyle = C.down; ctx.fill(); ctx.globalAlpha = a;
  txt(ctx, 'LIVE', x + 50 * s, y + 36 * s, font(fam, 800, 26 * s), C.text, 'left', 'ltr');
  txt(ctx, o.updated || 'עודכן: אתמול', x + 128 * s, y + 36 * s, font(fam, 600, 24 * s), C.dim, 'left', 'rtl');

  // the coin: its round mark, the pair and its name (right); price and the change (left)
  const cx = x + w - 64 * s, cy = y + 140 * s;
  ctx.beginPath(); ctx.arc(cx, cy, 36 * s, 0, Math.PI * 2); ctx.fillStyle = C.coin; ctx.fill();
  txt(ctx, String(o.symbol || 'LMTS').slice(0, 1), cx, cy + 2 * s, font(fam, 800, 40 * s), '#1a1300', 'center', 'ltr');
  txt(ctx, o.pair || `${o.symbol || 'LMTS'} / USDT`, cx - 54 * s, cy - 18 * s, font(fam, 800, 46 * s), C.text, 'right', 'ltr');
  txt(ctx, o.name || 'מטבע קריפטו', cx - 54 * s, cy + 26 * s, font(fam, 600, 26 * s), C.dim);

  const k = clamp((u - (o.draw ?? 0.3)) / 2.6), p = k * k * (3 - 2 * k);  // how much of the chart is drawn ("draw": when it starts; the rise lands mid-way)
  const head = Math.max(1, Math.round(p * (v.length - 1)));
  const rise = clamp((head - n) / (n - 1));  // the change counts up while yesterday draws
  const pct = change * rise, cur = (price / up) * v[head];
  txt(ctx, '$' + cur.toFixed(price < 1 ? 4 : 2), x + 36 * s, cy - 18 * s, font(fam, 800, 50 * s), C.text, 'left', 'ltr');
  const pill = `▲ +${pct.toFixed(1)}%`;
  ctx.font = font(fam, 800, 30 * s); const pw = ctx.measureText(pill).width + 28 * s;
  rrect(ctx, x + 36 * s, cy + 10 * s, pw, 40 * s, 6 * s); ctx.fillStyle = C.up; ctx.fill();
  txt(ctx, pill, x + 50 * s, cy + 31 * s, font(fam, 800, 30 * s), '#04160e', 'left', 'ltr');
  txt(ctx, o.span || '24 שעות', x + 50 * s + pw, cy + 31 * s, font(fam, 600, 24 * s), C.dim, 'left', 'rtl');

  // the chart (time runs left to right, as on every trading screen)
  const L = x + 36 * s, R = x + w - 36 * s, T = y + 225 * s, B = y + 520 * s;
  const lo = 0.9, hi = up * 1.2, X = (i) => L + (R - L) * i / (v.length - 1), Y = (k) => B - (B - T) * (k - lo) / (hi - lo);
  ctx.lineWidth = 1 * s; ctx.strokeStyle = C.grid;
  for (let g = 0; g <= 4; g++) { const gy = T + (B - T) * g / 4; ctx.beginPath(); ctx.moveTo(L, gy); ctx.lineTo(R, gy); ctx.stroke(); }
  const days = o.days || ['שלשום', 'אתמול', 'היום'];
  ctx.setLineDash([6 * s, 6 * s]); ctx.strokeStyle = C.line;
  for (let d = 1; d < 3; d++) { const dx = X(d * n - 0.5); ctx.beginPath(); ctx.moveTo(dx, T - 10 * s); ctx.lineTo(dx, B); ctx.stroke(); }
  ctx.setLineDash([]);
  days.forEach((d, k) => txt(ctx, d, (X(k * n) + X(Math.min(v.length - 1, (k + 1) * n - 1))) / 2, B + 34 * s, font(fam, 700, 28 * s), k === 1 ? C.text : C.dim, 'center'));

  // the line and the area under it, up to the head
  ctx.beginPath(); ctx.moveTo(X(0), Y(v[0]));
  for (let i = 1; i <= head; i++) ctx.lineTo(X(i), Y(v[i]));
  ctx.lineTo(X(head), B); ctx.lineTo(X(0), B); ctx.closePath(); ctx.fillStyle = C.upFill; ctx.fill();
  ctx.beginPath(); ctx.moveTo(X(0), Y(v[0]));
  for (let i = 1; i <= head; i++) ctx.lineTo(X(i), Y(v[i]));
  ctx.lineWidth = 4 * s; ctx.lineJoin = 'round'; ctx.strokeStyle = C.up; ctx.stroke();
  ctx.beginPath(); ctx.arc(X(head), Y(v[head]), 9 * s, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 4 * s; ctx.strokeStyle = C.up; ctx.stroke();

  // yesterday's rise, measured: the change beside the climb once the line has passed it
  const rk = ease(clamp((head - (2 * n - 6)) / 6));
  if (rk > 0) {
    ctx.globalAlpha = a * rk;
    txt(ctx, `+${change}%`, X(n + 0.36 * n), Y((1 + up) / 2) - 34 * s, font(fam, 800, 52 * s), C.up, 'right', 'ltr');
    txt(ctx, o.rise || 'ביום אחד', X(n + 0.36 * n), Y((1 + up) / 2) + 12 * s, font(fam, 700, 28 * s), C.text, 'right');
    ctx.globalAlpha = a;
  }

  // "the call": a pin that drops in at the start of today - after the coin already went up
  const ci = 2 * n + 2, pk = ease(clamp((head - ci) / 5));
  if (pk > 0) {
    ctx.globalAlpha = a * pk;
    const px = X(ci), py = Y(v[ci]), top = T - 4 * s + (1 - pk) * -20 * s;
    ctx.strokeStyle = C.call; ctx.lineWidth = 3 * s; ctx.setLineDash([5 * s, 5 * s]);
    ctx.beginPath(); ctx.moveTo(px, top + 44 * s); ctx.lineTo(px, py - 12 * s); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(px, py, 10 * s, 0, Math.PI * 2); ctx.fillStyle = C.call; ctx.fill();
    const call = o.call || 'ההמלצה יצאה';
    ctx.font = font(fam, 800, 28 * s); const cw = ctx.measureText(call).width + 30 * s;
    const bx = Math.min(R - cw, Math.max(L, px - cw / 2));
    rrect(ctx, bx, top, cw, 44 * s, 8 * s); ctx.fillStyle = C.call; ctx.fill();
    txt(ctx, call, bx + cw / 2, top + 23 * s, font(fam, 800, 28 * s), '#1a1300', 'center');
    ctx.globalAlpha = a;
  }

  // the fine print, as on every ad of its kind
  txt(ctx, o.fine || 'אין לראות באמור ייעוץ השקעות · ביצועי עבר מבטיחים ביצועי עבר', x + w / 2, y + h - 30 * s, font(fam, 500, 22 * s), C.dim, 'center');
  ctx.restore();
}
