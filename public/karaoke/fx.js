// Voice effects for Karaoke Booth: the chain that turns a karaoke vocal into a song vocal, and the
// "voice styles" (one-click combinations). Same graph live and in the offline export.
//
// chain per vocal layer:
//   source → clean-up EQ (rumble, mud) → warmth / brightness EQ → [lo-fi / phone band]
//          → de-esser (only the "s" band is compressed) → compressor → saturation → dry ─┐
//   (after the compressor) → doubler (two detuned, delayed copies, wide) ─────────────────┤→ out
//                          → echo (filtered feedback delay, stereo) ──────────────────────┤
//                          → reverb (room / plate / hall / stadium) ───────────────────────┘

// The simple knobs (0..1) are what the user moves; every style sets them plus its own character.
export const KNOBS = [
  ['reverb', 'Reverb', 'Adds space — like singing in a bigger room'],
  ['echo', 'Echo', 'Repeats your voice — a short delay behind it'],
  ['warmth', 'Warmth', 'Fuller, rounder, a bit of tape-like grit'],
  ['bright', 'Brightness', 'Clearer and more present — cuts through the music'],
  ['double', 'Double', 'A second voice beside you — thicker and wider'],
  ['tune', 'Autotune', 'Pulls notes into tune — high = the robotic effect'],
];

const ICON = {
  pop: '<path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4"/>',
  star: '<path d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.6 6.7 19.5l1.1-6L3.4 9.3l6-.8z"/>',
  cap: '<path d="M4 14a8 8 0 0 1 16 0"/><path d="M2 14h20M8 14V8M16 14V8"/>',
  note: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  guitar: '<path d="M14 3l7 7M17.5 6.5l-6 6"/><path d="M11 10.5a4 4 0 0 0-5.6 0 3 3 0 0 0-.4 3.6L3 16.1a3 3 0 0 0 4.2 4.2l2-2a3 3 0 0 0 3.6-.4 4 4 0 0 0 0-5.6"/>',
  tape: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="8.5" cy="12" r="2"/><circle cx="15.5" cy="12" r="2"/><path d="M10.5 12h3"/>',
  radio: '<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>',
};
export const icon = (k) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;

// style = knob defaults + character the knobs don't expose
export const STYLES = {
  natural: { name: 'Natural', icon: 'pop', hint: 'Just cleaned up — your voice as it is',
    knobs: { reverb: 0.15, echo: 0, warmth: 0.25, bright: 0.3, double: 0, tune: 0 },
    room: 'room', echoMs: 240, echoFb: 0.25, comp: 0.4, sat: 0, tuneSpeed: 0.12 },
  pop: { name: 'Modern Pop', icon: 'pop', hint: 'Tight, bright, polished — today\'s radio vocal',
    knobs: { reverb: 0.3, echo: 0.18, warmth: 0.3, bright: 0.65, double: 0.25, tune: 0.55 },
    room: 'plate', echoMs: 230, echoFb: 0.25, comp: 0.85, sat: 0.1, tuneSpeed: 0.025 },
  eighties: { name: '80s Power Ballad', icon: 'star', hint: 'Huge hall, chorus shimmer, long echoes',
    knobs: { reverb: 0.6, echo: 0.32, warmth: 0.4, bright: 0.45, double: 0.3, tune: 0.2 },
    room: 'hall', echoMs: 380, echoFb: 0.38, comp: 0.6, sat: 0.1, chorus: 0.55, tuneSpeed: 0.1 },
  hiphop: { name: 'Hip-Hop', icon: 'cap', hint: 'Hard autotune, slap echo, doubled and upfront',
    knobs: { reverb: 0.12, echo: 0.28, warmth: 0.35, bright: 0.55, double: 0.45, tune: 1 },
    room: 'room', echoMs: 115, echoFb: 0.12, comp: 1, sat: 0.3, tuneSpeed: 0 },
  mizrahi: { name: 'Mizrahi', icon: 'note', hint: 'Big warm hall and echo, smooth tuning',
    knobs: { reverb: 0.55, echo: 0.38, warmth: 0.45, bright: 0.5, double: 0.15, tune: 0.7 },
    room: 'hall', echoMs: 310, echoFb: 0.42, comp: 0.7, sat: 0.12, tuneSpeed: 0.04 },
  rock: { name: 'Rock', icon: 'bolt', hint: 'Gritty, punchy, short room and slap',
    knobs: { reverb: 0.2, echo: 0.3, warmth: 0.6, bright: 0.5, double: 0.35, tune: 0.15 },
    room: 'room', echoMs: 95, echoFb: 0.15, comp: 0.9, sat: 0.6, tuneSpeed: 0.1 },
  acoustic: { name: 'Acoustic', icon: 'guitar', hint: 'Intimate and natural, a little room',
    knobs: { reverb: 0.25, echo: 0, warmth: 0.35, bright: 0.35, double: 0, tune: 0.15 },
    room: 'room', echoMs: 240, echoFb: 0.2, comp: 0.45, sat: 0.05, tuneSpeed: 0.12 },
  lofi: { name: 'Lo-fi', icon: 'tape', hint: 'Dusty, narrow, cassette warmth',
    knobs: { reverb: 0.2, echo: 0.22, warmth: 0.7, bright: 0.1, double: 0.1, tune: 0 },
    room: 'room', echoMs: 280, echoFb: 0.3, comp: 0.7, sat: 0.5, band: [280, 3800], crush: 0.35, tuneSpeed: 0.1 },
  radio: { name: 'Radio', icon: 'radio', hint: 'Old radio / phone call — for a funny bit',
    knobs: { reverb: 0, echo: 0, warmth: 0.5, bright: 0.5, double: 0, tune: 0 },
    room: 'room', echoMs: 200, echoFb: 0.2, comp: 0.9, sat: 0.45, band: [550, 3000], tuneSpeed: 0.1 },
};
export const STYLE_GRID = ['pop', 'eighties', 'hiphop', 'mizrahi', 'rock', 'acoustic', 'lofi', 'radio'];
export const defaultFx = (style = 'natural') => ({ style, ...STYLES[style].knobs });

// ---------- reverb impulses (synthetic, cached per type) ----------
const IRS = {};
const ROOMS = { room: [0.7, 0.55], plate: [1.8, 0.15], hall: [3.0, 0.45], stadium: [4.6, 0.6] };  // [seconds, high-frequency damping]
function ir(ctx, type) {
  const key = `${type}|${ctx.sampleRate}`;
  if (IRS[key]) return IRS[key];
  const [sec, damp] = ROOMS[type] || ROOMS.room, sr = ctx.sampleRate, len = Math.floor(sr * sec);
  const buf = ctx.createBuffer(2, len, sr);
  let seed = type.length * 7919 + 13;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const a = 1 - damp * Math.min(1, t * 1.6);                 // later = darker
      lp = lp + (rnd() - lp) * Math.max(0.05, a);
      const early = i < sr * 0.08 && (i % Math.floor(sr * (0.011 + 0.004 * c)) < 3) ? 0.6 : 0;   // a few early reflections
      d[i] = (lp + early) * Math.pow(1 - t, 2.2) * (i < 64 ? i / 64 : 1);
    }
  }
  return (IRS[key] = buf);
}

function shaper(ctx, drive) {
  const ws = ctx.createWaveShaper(), n = 2048, curve = new Float32Array(n), k = 1 + drive * 8;
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(k * x) / Math.tanh(k); }
  ws.curve = curve; ws.oversample = '2x';
  return ws;
}
function crusher(ctx, amount) {
  const ws = ctx.createWaveShaper(), n = 4096, curve = new Float32Array(n), steps = Math.round(64 - amount * 52);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.round(x * steps) / steps; }
  ws.curve = curve;
  return ws;
}
const biquad = (ctx, type, f, gain = 0, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.gain.value = gain; b.Q.value = q; return b; };

/** Wires the vocal chain onto `input`; returns the stereo output node. */
export function voiceChain(ctx, input, fx) {
  const st = STYLES[fx.style] || STYLES.natural;
  const out = ctx.createGain();
  // clean-up + tone
  const hp = biquad(ctx, 'highpass', 95, 0, 0.7);
  const mud = biquad(ctx, 'peaking', 320, -2.5, 1.1);
  const warm = biquad(ctx, 'peaking', 210, fx.warmth * 5, 0.8);
  const pres = biquad(ctx, 'peaking', 3300, -1 + fx.bright * 6, 0.9);
  const air = biquad(ctx, 'highshelf', 10000, -2 + fx.bright * 8);
  let node = input;
  for (const f of [hp, mud, warm, pres, air]) { node.connect(f); node = f; }
  if (st.band) { const a = biquad(ctx, 'highpass', st.band[0], 0, 0.9), b = biquad(ctx, 'lowpass', st.band[1], 0, 0.9); node.connect(a); a.connect(b); node = b; }
  // de-esser: compress only the sibilance band, leave the rest
  const lowBand = biquad(ctx, 'lowpass', 6500, 0, 0.6), sBand = biquad(ctx, 'highpass', 6500, 0, 0.6);
  const ess = ctx.createDynamicsCompressor(); ess.threshold.value = -32; ess.ratio.value = 8; ess.attack.value = 0.001; ess.release.value = 0.06; ess.knee.value = 4;
  const deess = ctx.createGain();
  node.connect(lowBand); lowBand.connect(deess); node.connect(sBand); sBand.connect(ess); ess.connect(deess);
  // compressor (style decides how hard)
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14 - st.comp * 14; comp.ratio.value = 2 + st.comp * 4; comp.knee.value = 6; comp.attack.value = 0.004; comp.release.value = 0.16;
  deess.connect(comp);
  const makeup = ctx.createGain(); makeup.gain.value = 1 + st.comp * 0.8;
  comp.connect(makeup);
  // saturation / crush
  let body = makeup;
  const drive = st.sat + fx.warmth * 0.25;
  if (drive > 0.02) { const s = shaper(ctx, drive); body.connect(s); body = s; }
  if (st.crush) { const c = crusher(ctx, st.crush); body.connect(c); body = c; }
  const dry = ctx.createGain(); dry.gain.value = 1; body.connect(dry); dry.connect(out);
  // doubler + chorus: detuned, delayed copies left and right
  const voices = [];
  if (fx.double > 0.01) voices.push([0.019, 0.0016, -0.75, fx.double * 0.55], [0.027, 0.0019, 0.75, fx.double * 0.55]);
  if (st.chorus) voices.push([0.012, 0.0035, -0.4, st.chorus * 0.35], [0.015, 0.0035, 0.4, st.chorus * 0.35]);
  voices.forEach(([d, depth, pan, gain], i) => {
    const dl = ctx.createDelay(0.1); dl.delayTime.value = d;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.33 + i * 0.17;
    const lg = ctx.createGain(); lg.gain.value = depth; lfo.connect(lg); lg.connect(dl.delayTime); lfo.start();
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    const g = ctx.createGain(); g.gain.value = gain;
    body.connect(dl); dl.connect(p); p.connect(g); g.connect(out);
  });
  // echo: darkening feedback delay, bouncing left/right
  if (fx.echo > 0.01) {
    const l = ctx.createDelay(2), r = ctx.createDelay(2), fb = ctx.createGain(), tone = biquad(ctx, 'lowpass', 3800, 0, 0.5);
    l.delayTime.value = st.echoMs / 1000; r.delayTime.value = st.echoMs / 1000; fb.gain.value = st.echoFb;
    const pl = ctx.createStereoPanner(), pr = ctx.createStereoPanner(); pl.pan.value = -0.55; pr.pan.value = 0.55;
    const send = ctx.createGain(); send.gain.value = fx.echo * 0.65;
    body.connect(send); send.connect(l); l.connect(tone); tone.connect(pl); tone.connect(r); r.connect(pr); r.connect(fb); fb.connect(l);
    pl.connect(out); pr.connect(out);
  }
  // reverb
  if (fx.reverb > 0.01) {
    const pre = ctx.createDelay(0.2); pre.delayTime.value = st.room === 'room' ? 0.012 : 0.03;
    const conv = ctx.createConvolver(); conv.buffer = ir(ctx, st.room);
    const wet = ctx.createGain(); wet.gain.value = fx.reverb * (st.room === 'room' ? 0.9 : 0.7);
    body.connect(pre); pre.connect(conv); conv.connect(wet); wet.connect(out);
  }
  return out;
}
