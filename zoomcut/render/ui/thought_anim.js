// Movie-style thought text: the words drift in one by one (blur to sharp, a little scale and tilt), some big and some
// small, the line floats slowly up, then everything blurs and drifts away. One motion for both sides: the editor plays
// it live (ThoughtText in editor.tsx) and the export renders it frame by frame (tools/thought_frames.mjs).
const BIG = ['וואט', 'רגע', 'אמאלה', 'מה', 'וואו', 'אוי'];
const rnd = (seed) => { const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const clamp = (k) => Math.max(0, Math.min(1, k));
const ease = (k) => 1 - Math.pow(1 - k, 3);

export const THOUGHT_STYLE = {  // (stroke: a black outline around every letter - readable on any picture)
  color: '#ffffff', fontWeight: 800, lineHeight: 1.15,
  textShadow: '0 4px 22px rgba(0,0,0,0.7), 0 0 3px rgba(0,0,0,0.65)', WebkitTextStroke: '9px #000', paintOrder: 'stroke fill',
};

/** The words of a thought with their own size, tilt and offset (always the same for the same text). */
export function thoughtWords(text, base = 70) {
  const words = String(text).split(/\s+/).filter(Boolean);
  return words.map((w, i) => {
    const bare = w.replace(/[.,?!…:"׳״-]/g, '');
    let s = 0.68 + rnd(i + words.length * 3.1) * 0.26;  // most words small, the exclamations big
    if (BIG.includes(bare)) s = 1.6;
    else if (/[?!]$/.test(w)) s = 1.12;
    return { w, size: Math.round(base * s), rot: (rnd(i * 7.3 + 1) - 0.5) * 7, dy: Math.round((rnd(i * 3.7 + 2) - 0.5) * 22) };
  });
}

/** One word at time t (seconds of the video) of a thought shown from start to end.
 *  motion "horror": the words slam in as he says them (a flicker, a scale-down, sharp), shiver while held, a glitch
 *  frame now and then, and dissolve into the dark at the end. */
export function wordState(i, n, t, start, end, motion, hold) {
  if (motion === 'horror') return horrorWord(i, n, t, start, end, hold);
  const dur = Math.max(0.6, end - start);
  const spread = Math.min(0.55 * dur, 0.12 * n + 0.15);  // the words arrive over the first part of the thought
  const a = start + (n > 1 ? (i / (n - 1)) * spread : 0);
  const e = ease(clamp((t - a) / 0.34));
  const out = clamp((t - (end - 0.45)) / 0.45);
  const blur = (1 - e) * 9 + out * 7;
  return {
    opacity: e * (1 - out),
    transform: `translateY(${((1 - e) * 28 - out * 34).toFixed(1)}px) scale(${(0.72 + 0.28 * e + 0.08 * out).toFixed(3)})`,
    filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none',
  };
}

// a horror thought: the words land as he says them; when he has said it the whole line grows big (to read it), stays,
// then dissolves word by word (a wave) into atoms over EXIT seconds. "hold" = how long it stays after his voice.
const EXIT = 0.7;
const exitAt = (i, n, start, end) => Math.max(start + 0.4, end - EXIT - 0.06 * (n - 1) + 0.06 * i);
const voiceEnd = (start, end, hold) => Math.max(start + 0.3, end - (hold ?? 0.35));

function horrorWord(i, n, t, start, end, hold) {
  const dur = Math.max(0.6, voiceEnd(start, end, hold) - start);
  const spread = Math.min(0.8 * dur, 0.35 * n);  // with his voice: the words arrive about as he says them
  const a = start + (n > 1 ? (i / (n - 1)) * spread : 0);
  const k = (t - a) / 0.16;
  if (k < 0) return { opacity: 0, transform: 'scale(1.35)', filter: 'blur(10px)' };
  const e = ease(clamp(k));
  const f = Math.floor(t * 30);
  const flick = k < 1.6 && (f % 3 === 1) ? 0.35 : 1;  // two frames of flicker as it lands
  // the dissolve: the word grows and blurs away while its atoms fly off (wordDust / dustState)
  const u = clamp((t - exitAt(i, n, start, end)) / EXIT), ue = u * u;
  const glitch = u === 0 && rnd(f * 0.37 + i * 5.1) > 0.975 ? 1 : 0;
  const jx = (rnd(Math.floor(t * 15) + i * 9.7) - 0.5) * 5 + glitch * 14, jy = (rnd(Math.floor(t * 15) * 1.3 + i * 4.1) - 0.5) * 4;
  const blur = (1 - e) * 10 + u * 7;
  return {
    opacity: e * flick * (1 - ue) * (glitch ? 0.6 : 1),
    transform: `translate(${jx.toFixed(1)}px, ${(jy - u * 26).toFixed(1)}px) scale(${(1.35 - 0.35 * e + 0.55 * u).toFixed(3)})`,
    filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none',
  };
}

/** The atoms a word of a horror thought falls apart into: [{x, y (% of the word box), dx, dy (px), size}] - the same
 *  every time for the same word. */
export function wordDust(i, w = '') {
  const n = 9 + Math.min(10, String(w).length * 2);
  return Array.from({ length: n }, (_, k) => {
    const s = i * 31.7 + k * 7.3 + String(w).length;
    const ang = rnd(s) * Math.PI * 2, dist = 50 + rnd(s + 1) * 150;
    return { x: 8 + rnd(s + 2) * 84, y: 25 + rnd(s + 3) * 55, dx: Math.cos(ang) * dist, dy: Math.sin(ang) * dist * 0.75 - 40, size: 3 + rnd(s + 4) * 6, lag: rnd(s + 5) * 0.25 };
  });
}

/** One atom at time t: it shows as the word starts to dissolve, flies out and fades. */
export function dustState(p, i, n, t, start, end, motion) {
  if (motion !== 'horror') return { opacity: 0, transform: 'none' };
  const u = clamp((t - exitAt(i, n, start, end) - p.lag * EXIT) / (EXIT * 0.9));
  if (u <= 0 || u >= 1) return { opacity: 0, transform: 'none' };
  const m = 1 - Math.pow(1 - u, 2);
  return { opacity: Math.min(1, u * 6) * (1 - u), transform: `translate(${(p.dx * m).toFixed(1)}px, ${(p.dy * m).toFixed(1)}px) scale(${(1 - 0.6 * u).toFixed(3)})` };
}

/** Each thought in its own spot (a little left / right, higher / lower), floating up while it is heard. */
export function lineDrift(t, start, text = '', motion, placed = false, end = null, hold = null, grow = 1) {
  const n = String(text).length;
  if (motion === 'horror') {  // a little shiver; when he has said it, the whole line grows to `grow` and stays big
    const dx = (rnd(n * 1.7 + 4) - 0.5) * (placed ? 24 : 90), dy = (rnd(n * 2.3 + 9) - 0.5) * (placed ? 24 : 110);
    const g = end == null ? 0 : ease(clamp((t - (voiceEnd(start, end, hold) - 0.15)) / 0.45));
    const sc = (1 + Math.min(0.06, Math.max(0, t - start) * 0.012)) * (1 + (grow - 1) * g);
    return `translate(${dx.toFixed(1)}px, ${(dy - Math.max(0, t - start) * 5).toFixed(1)}px) scale(${sc.toFixed(4)})`;
  }
  const dx = (rnd(n * 1.7 + 4) - 0.5) * 170, dy = (rnd(n * 2.3 + 9) - 0.5) * 190;
  return `translate(${dx.toFixed(1)}px, ${(dy - Math.max(0, t - start) * 9).toFixed(1)}px)`;
}
