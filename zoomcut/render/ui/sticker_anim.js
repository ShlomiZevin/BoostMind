// Picture stickers with motion, for the money moments: "pop" (a sticker that pops in on the hit, floats, leaves) and
// "rain" (copies of a picture - banknotes - falling across the frame). One motion for both sides: the editor plays it
// live (StickerLayer in editor.tsx) and the export renders it frame by frame (tools/sticker_frames.mjs).
// overlay: { style: "sticker", image, motion: "pop" | "rain", x, y (centre), w (px), rot (deg), count, start, end }
const clamp = (k) => Math.max(0, Math.min(1, k));
const ease = (k) => 1 - Math.pow(1 - k, 3);
const rnd = (seed) => { const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

/** A popping sticker at time t: {opacity, transform} for an image centred on (x, y). */
export function stickerPop(o, t) {
  if (o.start == null || t < o.start || (o.end != null && t > o.end)) return { opacity: 0, transform: 'none' };
  const k = (t - o.start) / 0.2, e = ease(clamp(k));
  const left = o.end != null ? o.end - t : 99, out = 1 - clamp(left / 0.16);
  const s = (0.35 + 0.65 * e + 0.12 * Math.sin(clamp(k) * Math.PI)) * (1 + 0.012 * Math.sin((t - o.start) * 7)) * (1 - 0.18 * out);
  const r = (o.rot ?? -6) - (1 - e) * 12;
  return { opacity: clamp(k * 3) * (1 - out), transform: `translate(-50%, -50%) rotate(${r.toFixed(2)}deg) scale(${s.toFixed(4)})` };
}

/** The falling copies at time t: [{x, y, w, transform, opacity}] (x, y = the copy's centre in the frame). */
export function rainBills(o, t) {
  if (o.start == null || t < o.start || (o.end != null && t > o.end)) return [];
  const n = o.count || 22, base = o.w || 260, u = t - o.start;
  const fade = o.end != null ? clamp((o.end - t) / 0.35) : 1;
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = i * 7.13 + 3;
    const delay = rnd(s) * 0.9, v = 950 + rnd(s + 1) * 650, k = u - delay;
    if (k < 0) continue;
    const w = base * (0.65 + rnd(s + 2) * 0.55);
    const x = 40 + rnd(s + 3) * 1000 + Math.sin(k * (1.6 + rnd(s + 4)) + i) * 45;
    const y = -w * 0.6 + k * v;
    if (y > 1920 + w) continue;
    const rot = rnd(s + 5) * 360 + k * (rnd(s + 6) - 0.5) * 320;
    const flip = Math.cos(k * (5 + rnd(s + 7) * 5) + i);  // the bill flutters as it falls
    out.push({ x, y, w, opacity: fade, transform: `translate(-50%, -50%) rotate(${rot.toFixed(1)}deg) scaleY(${(0.35 + 0.65 * Math.abs(flip)).toFixed(3)})` });
  }
  return out;
}
