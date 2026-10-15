import { voiceChain } from './fx.js';

// Signal processing for the karaoke recorder: sync detection, the vocal chain, mixing, encoding.

// ---------- FFT (radix-2, in place) ----------
function fft(re, im, inverse) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (2 * Math.PI / len) * (inverse ? 1 : -1);
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

function downsample(x, from, to) {
  const r = from / to, n = Math.floor(x.length / r), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    const a = Math.floor(i * r), b = Math.floor((i + 1) * r);
    for (let k = a; k < b; k++) s += x[k];
    out[i] = s / (b - a);
  }
  return out;
}

export function mono(buf) {
  if (buf.numberOfChannels === 1) return buf.getChannelData(0);
  const a = buf.getChannelData(0), b = buf.getChannelData(1), out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = (a[i] + b[i]) / 2;
  return out;
}

/**
 * Where does the song sit inside the vocal recording? The earbuds leak a little of the backing
 * track into the mic; GCC-PHAT (cross-correlation with the magnitudes flattened) finds that faint
 * copy under the much louder voice. Returns { lag (seconds the song is late in the recording), confidence }.
 * expected: the lag we'd assume from the clocks; we search expected - 0.15 .. expected + 0.6 s.
 */
export function detectSync(vocal, song, sr, expected, before = 0.15, after = 0.6) {
  const R = 8000;
  const win = 40; // seconds analysed
  const v = downsample(vocal, sr, R), s = downsample(song, sr, R);
  const lagMin = Math.floor((expected - before) * R), lagMax = Math.ceil((expected + after) * R);
  const n = Math.min(v.length, Math.floor(win * R) + lagMax, s.length + lagMax);
  let N = 1; while (N < n + Math.abs(lagMin) + 1) N <<= 1;
  const ar = new Float64Array(N), ai = new Float64Array(N), br = new Float64Array(N), bi = new Float64Array(N);
  for (let i = 0; i < n; i++) ar[i] = v[i];
  for (let i = 0; i < Math.min(s.length, n); i++) br[i] = s[i];
  fft(ar, ai, false); fft(br, bi, false);
  // cross spectrum V * conj(S), whitened (PHAT)
  for (let k = 0; k < N; k++) {
    const r = ar[k] * br[k] + ai[k] * bi[k], i = ai[k] * br[k] - ar[k] * bi[k];
    const m = Math.hypot(r, i) + 1e-12;
    ar[k] = r / m; ai[k] = i / m;
  }
  fft(ar, ai, true);
  let best = -Infinity, bestLag = 0, second = -Infinity;
  const at = (lag) => ar[(lag + N) % N];
  for (let lag = lagMin; lag <= lagMax; lag++) {
    const c = at(lag);
    if (c > best) { best = c; bestLag = lag; }
  }
  for (let lag = lagMin; lag <= lagMax; lag++) {
    if (Math.abs(lag - bestLag) > R * 0.01 && at(lag) > second) second = at(lag);
  }
  return { lag: bestLag / R, confidence: second > 0 ? best / second : 10 };
}

// ---------- the vocal chain + mix (same graph for live preview and for export) ----------
let irCache = null;
function impulse(ctx, seconds = 2.2) {
  if (irCache && irCache.sampleRate === ctx.sampleRate) return irCache;
  const len = Math.floor(ctx.sampleRate * seconds), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < 120 ? i / 120 : 1);
  }
  return (irCache = ir);
}

/** Loudness of the sung parts (RMS of the loudest 30% of 50 ms windows), in dBFS. */
export function vocalLevel(x, sr) {
  const w = Math.floor(sr * 0.05), vals = [];
  for (let i = 0; i + w < x.length; i += w) {
    let s = 0;
    for (let k = i; k < i + w; k++) s += x[k] * x[k];
    vals.push(s / w);
  }
  vals.sort((a, b) => b - a);
  const top = vals.slice(0, Math.max(1, Math.floor(vals.length * 0.3)));
  return 10 * Math.log10(top.reduce((a, b) => a + b, 0) / top.length + 1e-12);
}

/**
 * Builds: vocal → high-pass → presence EQ → compressor → level → (dry + reverb) ─┐
 *         song  → level ─────────────────────────────────────────────────────────┴→ bus → limiter → out
 * opts: { offset (s: where the song starts inside the vocal recording), vocalGain, songGain (linear), reverb (0..1), auto (bool), autoGain (linear) }
 */
export function buildMix(ctx, songBuf, vocalBuf, opts, when = 0, from = 0) {
  const out = ctx.createDynamicsCompressor();  // a soft limiter on the bus
  out.threshold.value = -3; out.knee.value = 3; out.ratio.value = 20; out.attack.value = 0.002; out.release.value = 0.15;
  out.connect(ctx.destination);
  const bus = ctx.createGain(); bus.connect(out);

  const song = ctx.createBufferSource(); song.buffer = songBuf;
  const sg = ctx.createGain(); sg.gain.value = opts.songGain; song.connect(sg).connect(bus);

  const voc = ctx.createBufferSource(); voc.buffer = vocalBuf;
  let node = voc;
  if (opts.auto) {
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90; hp.Q.value = 0.7;
    const mud = ctx.createBiquadFilter(); mud.type = 'peaking'; mud.frequency.value = 300; mud.gain.value = -2; mud.Q.value = 1;
    const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 3200; pres.gain.value = 2.5; pres.Q.value = 0.8;
    const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 9000; air.gain.value = 2;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -22; comp.knee.value = 8; comp.ratio.value = 3.5; comp.attack.value = 0.006; comp.release.value = 0.18;
    node.connect(hp); hp.connect(mud); mud.connect(pres); pres.connect(air); air.connect(comp);
    node = comp;
  }
  const vg = ctx.createGain(); vg.gain.value = opts.vocalGain * (opts.auto ? opts.autoGain : 1);
  node.connect(vg); vg.connect(bus);
  if (opts.reverb > 0) {
    const conv = ctx.createConvolver(); conv.buffer = impulse(ctx);
    const wet = ctx.createGain(); wet.gain.value = opts.reverb * 0.55;
    const pre = ctx.createDelay(0.2); pre.delayTime.value = 0.025;
    vg.connect(pre); pre.connect(conv); conv.connect(wet); wet.connect(bus);
  }
  // timing: opts.offset = where the song begins inside the vocal recording (count-in + device latency),
  // so when the song is at `from`, the vocal is at `from + offset`
  const vStart = from + opts.offset;
  song.start(when, from);
  if (vStart >= 0) voc.start(when, vStart);
  else voc.start(when - vStart, 0);
  return { stop: () => { try { song.stop(); voc.stop(); } catch {} }, song };
}

export async function renderMix(songBuf, vocalBuf, opts, tail = 1.5) {
  const sr = songBuf.sampleRate;
  const len = Math.ceil((Math.max(songBuf.duration, vocalBuf.duration - opts.offset) + tail) * sr);
  const ctx = new OfflineAudioContext(2, len, sr);
  buildMix(ctx, songBuf, vocalBuf, opts, 0, 0);
  const res = await ctx.startRendering();
  // normalise the final mix to -1 dBFS peak
  let peak = 0;
  for (let c = 0; c < res.numberOfChannels; c++) { const d = res.getChannelData(c); for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i])); }
  const g = peak > 0 ? Math.pow(10, -1 / 20) / peak : 1;
  for (let c = 0; c < res.numberOfChannels; c++) { const d = res.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= g; }
  return res;
}

/** The vocal alone, aligned to the song (silence padded/trimmed), processed but without the backing. */
export async function renderVocal(songBuf, vocalBuf, opts) {
  return renderMix(songBuf, vocalBuf, { ...opts, songGain: 0 }, 1.5);
}

// ---------- encoders ----------
export function wav(buf) {
  const ch = buf.numberOfChannels, sr = buf.sampleRate, n = buf.length;
  const dv = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true); dv.setUint32(24, sr, true);
  dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n * ch * 2, true);
  const chans = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  return new Blob([dv.buffer], { type: 'audio/wav' });
}

/** MP3 via lamejs (loaded on demand) — small enough for WhatsApp. */
export async function mp3(buf, kbps = 192) {
  if (!window.lamejs) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
      s.onload = res; s.onerror = () => rej(new Error('could not load the MP3 encoder'));
      document.head.appendChild(s);
    });
  }
  const sr = buf.sampleRate, enc = new window.lamejs.Mp3Encoder(2, sr, kbps);
  const toI16 = (d) => { const o = new Int16Array(d.length); for (let i = 0; i < d.length; i++) { const v = Math.max(-1, Math.min(1, d[i])); o[i] = v < 0 ? v * 0x8000 : v * 0x7fff; } return o; };
  const L = toI16(buf.getChannelData(0)), R = toI16(buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0));
  const parts = [];
  for (let i = 0; i < L.length; i += 1152) {
    const b = enc.encodeBuffer(L.subarray(i, i + 1152), R.subarray(i, i + 1152));
    if (b.length) parts.push(new Uint8Array(b));
    if (i % (1152 * 400) === 0) await new Promise((r) => setTimeout(r, 0)); // keep the page responsive
  }
  const end = enc.flush(); if (end.length) parts.push(new Uint8Array(end));
  return new Blob(parts, { type: 'audio/mpeg' });
}

// =====================================================================================
// Autotune: key detection on the backing track, pitch tracking on the voice, and pitch
// correction by TD-PSOLA (moves each glottal period, so the voice keeps its own timbre).
// =====================================================================================

const KEY_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];  // Krumhansl-Kessler
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
export const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
export const keyName = (k) => (k.mode === 'chromatic' ? 'Chromatic (all notes)' : `${KEY_NAMES[k.tonic]} ${k.mode}`);
export const allKeys = () => [{ tonic: 0, mode: 'chromatic' },
  ...KEY_NAMES.flatMap((_, t) => [{ tonic: t, mode: 'major' }, { tonic: t, mode: 'minor' }])];

/** Key of the backing track from its pitch-class profile. */
export function detectKey(song, sr) {
  const R = 11025, x = downsample(song, sr, R), N = 4096, hop = 2048;
  const chroma = new Float64Array(12), re = new Float64Array(N), im = new Float64Array(N);
  const win = new Float64Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  const pc = new Int8Array(N / 2).map((_, k) => {
    const f = (k * R) / N;
    return f < 60 || f > 2000 ? -1 : ((Math.round(12 * Math.log2(f / 440)) + 69) % 12 + 12) % 12;
  });
  for (let s = 0; s + N < x.length; s += hop) {
    for (let i = 0; i < N; i++) { re[i] = x[s + i] * win[i]; im[i] = 0; }
    fft(re, im, false);
    for (let k = 1; k < N / 2; k++) if (pc[k] >= 0) chroma[pc[k]] += Math.hypot(re[k], im[k]);
  }
  const corr = (p, t) => {
    const a = [...Array(12)].map((_, i) => chroma[(i + t) % 12]);
    const ma = a.reduce((s, v) => s + v, 0) / 12, mp = p.reduce((s, v) => s + v, 0) / 12;
    let num = 0, da = 0, dp = 0;
    for (let i = 0; i < 12; i++) { num += (a[i] - ma) * (p[i] - mp); da += (a[i] - ma) ** 2; dp += (p[i] - mp) ** 2; }
    return num / Math.sqrt(da * dp + 1e-12);
  };
  let best = { tonic: 0, mode: 'major', score: -2 };
  for (let t = 0; t < 12; t++) {
    for (const [mode, prof] of [['major', MAJOR], ['minor', MINOR]]) {
      const c = corr(prof, t);
      if (c > best.score) best = { tonic: t, mode, score: c };
    }
  }
  return best;
}

/** Pitch track (YIN on an 8 kHz copy, 10 ms hop). Returns { hop (s), f0: Float32Array (0 = unvoiced) }. */
export function trackPitch(x, sr) {
  const R = 8000, y = downsample(x, sr, R), W = 256, hop = 80, tMin = Math.floor(R / 1000), tMax = Math.ceil(R / 70);
  const frames = Math.max(0, Math.floor((y.length - W - tMax) / hop));
  const f0 = new Float32Array(frames), rms = new Float32Array(frames), d = new Float32Array(tMax + 1);
  let maxR = 0;
  for (let f = 0; f < frames; f++) {
    const o = f * hop;
    let e = 0;
    for (let j = 0; j < W; j++) e += y[o + j] * y[o + j];
    rms[f] = Math.sqrt(e / W); maxR = Math.max(maxR, rms[f]);
  }
  for (let f = 0; f < frames; f++) {
    if (rms[f] < maxR * 0.04) continue;  // silence / breath
    const o = f * hop;
    let run = 0, tau = -1;
    d[0] = 1;
    for (let t = 1; t <= tMax; t++) {
      let s = 0;
      for (let j = 0; j < W; j++) { const v = y[o + j] - y[o + j + t]; s += v * v; }
      run += s; d[t] = run > 0 ? (s * t) / run : 1;  // cumulative mean normalised difference
      if (tau < 0 && t >= tMin && t > 2 && d[t - 1] < 0.15 && d[t - 1] < d[t] && d[t - 1] <= d[t - 2]) tau = t - 1;
    }
    if (tau < 0) continue;
    const a = d[tau - 1], b = d[tau], c = d[tau + 1], den = a - 2 * b + c;
    const t = tau + (den ? (0.5 * (a - c)) / den : 0);  // parabolic refinement
    f0[f] = R / t;
  }
  // 5-frame median against octave jumps, and drop isolated voiced frames
  const out = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const win = [];
    for (let k = -2; k <= 2; k++) if (f + k >= 0 && f + k < frames && f0[f + k] > 0) win.push(f0[f + k]);
    out[f] = f0[f] > 0 && win.length >= 3 ? win.sort((p, q) => p - q)[win.length >> 1] : 0;
  }
  return { hop: hop / R, f0: out };
}

/**
 * Pull the voice to the notes of the key.
 * opts: key {tonic, mode}, strength 0..1 (how far to pull), speed seconds (0 = instant robot snap,
 *       0.1+ = natural glide), humanize keeps vibrato: deviations under `keep` semitones are left alone.
 */
export function autotune(x, sr, pitch, opts) {
  const { key, strength = 0.8, speed = 0.06 } = opts;
  const allowed = key.mode === 'chromatic' ? [...Array(12).keys()] : SCALES[key.mode].map((s) => (s + key.tonic) % 12);
  const snap = (m) => {
    let best = Math.round(m), bd = 99;
    for (let n = Math.floor(m) - 2; n <= Math.ceil(m) + 2; n++) {
      if (allowed.includes(((n % 12) + 12) % 12) && Math.abs(n - m) < bd) { bd = Math.abs(n - m); best = n; }
    }
    return best;
  };
  const f0At = (i) => { const k = Math.min(pitch.f0.length - 1, Math.max(0, Math.round(i / sr / pitch.hop))); return pitch.f0[k]; };

  // 1. analysis marks: one per glottal period in voiced parts, every 10 ms elsewhere
  const marks = [], periods = [], ratios = [];
  const unv = Math.round(sr * 0.01);
  let i = 0, corr = 0, lastT = 0;
  while (i < x.length) {
    const f = f0At(i);
    if (f > 0) {
      const T = Math.round(sr / f);
      // refine the mark onto the waveform peak near the expected spot
      let m = i, best = -Infinity;
      for (let k = Math.max(0, i - (T >> 2)); k < Math.min(x.length, i + (T >> 2)); k++) if (x[k] > best) { best = x[k]; m = k; }
      if (marks.length && m <= marks[marks.length - 1]) m = marks[marks.length - 1] + Math.max(1, T >> 1);
      const midi = 69 + 12 * Math.log2(f / 440);
      const want = (snap(midi) - midi) * strength;
      // retune speed: follow the wanted correction with a time constant (0 = jump straight to it)
      const dt = lastT ? (m - lastT) / sr : 0;
      corr = speed <= 0 || !lastT ? want : corr + (want - corr) * Math.min(1, dt / speed);
      lastT = m;
      marks.push(m); periods.push(T); ratios.push(Math.pow(2, corr / 12));
      i = m + T;
    } else {
      marks.push(i); periods.push(unv); ratios.push(1);
      lastT = 0; corr = 0;
      i += unv;
    }
  }

  // 2. synthesis: place each period at the new spacing (period / ratio), overlap-add with Hann windows
  const y = new Float32Array(x.length + sr), w = new Float32Array(x.length + sr);
  let ts = marks[0] || 0, k = 0;
  while (ts < x.length && marks.length) {
    while (k + 1 < marks.length && Math.abs(marks[k + 1] - ts) < Math.abs(marks[k] - ts)) k++;  // nearest analysis mark
    const P = periods[k], c = marks[k], start = Math.round(ts) - P;
    for (let n = -P; n < P; n++) {
      const src = c + n, dst = start + P + n;
      if (src < 0 || src >= x.length || dst < 0 || dst >= y.length) continue;
      const h = 0.5 + 0.5 * Math.cos((Math.PI * n) / P);
      y[dst] += x[src] * h; w[dst] += h;
    }
    ts += P / ratios[k];
  }
  const out = new Float32Array(x.length);
  for (let n = 0; n < out.length; n++) out[n] = w[n] > 0.05 ? y[n] / w[n] : 0;
  return out;
}

// =====================================================================================
// Multitrack: the backing track plus any number of vocal layers. Every layer is stored
// song-aligned (sample 0 = the song's first sample), so mixing is just "start everything together".
// layers: [{ buf: AudioBuffer, gain: linear, shift: seconds (+ = later) }]
// =====================================================================================
function vocalChain(ctx, input, auto) {
  if (!auto) return input;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90; hp.Q.value = 0.7;
  const mud = ctx.createBiquadFilter(); mud.type = 'peaking'; mud.frequency.value = 300; mud.gain.value = -2; mud.Q.value = 1;
  const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 3200; pres.gain.value = 2.5; pres.Q.value = 0.8;
  const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 9000; air.gain.value = 2;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -22; comp.knee.value = 8; comp.ratio.value = 3.5; comp.attack.value = 0.006; comp.release.value = 0.18;
  input.connect(hp); hp.connect(mud); mud.connect(pres); pres.connect(air); air.connect(comp);
  return comp;
}

export function buildSession(ctx, songBuf, layers, opts, when = 0, from = 0) {
  const out = ctx.createDynamicsCompressor();
  out.threshold.value = -3; out.knee.value = 3; out.ratio.value = 20; out.attack.value = 0.002; out.release.value = 0.15;
  out.connect(ctx.destination);
  const bus = ctx.createGain(); bus.gain.value = 0.85; bus.connect(out);   // headroom: a wide, wet style never clips live
  const sources = [];
  if (songBuf && from < songBuf.duration && opts.songGain > 0) {
    const s = ctx.createBufferSource(); s.buffer = songBuf;
    const g = ctx.createGain(); g.gain.value = opts.songGain; s.connect(g).connect(bus);
    s.start(when, from); sources.push(s);
  }
  let rev = null;
  if (opts.reverb > 0) {
    const conv = ctx.createConvolver(); conv.buffer = impulse(ctx);
    const wet = ctx.createGain(); wet.gain.value = opts.reverb * 0.55;
    rev = ctx.createDelay(0.2); rev.delayTime.value = 0.025;
    rev.connect(conv); conv.connect(wet); wet.connect(bus);
  }
  for (const l of layers) {
    if (!l.buf) continue;
    const pos = from - l.shift;                     // where this layer is when the song is at `from`
    if (pos >= l.buf.duration) continue;
    const s = ctx.createBufferSource(); s.buffer = l.buf;
    const g = ctx.createGain(); g.gain.value = l.gain;
    // a layer with a voice style gets the full song chain; the singers' guide track plays untouched
    const chain = l.raw ? s : l.fx ? voiceChain(ctx, s, l.fx) : vocalChain(ctx, s, opts.auto);
    chain.connect(g); g.connect(bus);
    if (rev && !l.raw && !l.fx) g.connect(rev);
    if (pos >= 0) s.start(when, pos); else s.start(when - pos, 0);
    sources.push(s);
  }
  return { stop: () => sources.forEach((s) => { try { s.stop(); } catch {} }) };
}

export async function renderSession(songBuf, layers, opts, tail = 1.5, normalise = true) {
  const sr = songBuf.sampleRate;
  const end = Math.max(opts.songGain > 0 ? songBuf.duration : 0, ...layers.filter((l) => l.buf).map((l) => l.buf.duration + l.shift), 1);
  const ctx = new OfflineAudioContext(2, Math.ceil((end + tail) * sr), sr);
  buildSession(ctx, songBuf, layers, opts, 0, 0);
  const res = await ctx.startRendering();
  if (!normalise) return res;
  let peak = 0;
  for (let c = 0; c < 2; c++) { const d = res.getChannelData(c); for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i])); }
  const g = peak > 0 ? Math.pow(10, -1 / 20) / peak : 1;
  for (let c = 0; c < 2; c++) { const d = res.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= g; }
  return res;
}

/** Clap calibration: click times (s, capture clock) and the recording → median clap delay, or null. */
export function clapLatency(rec, sr, clicks) {
  const hop = Math.round(sr * 0.002), n = Math.floor(rec.length / hop), env = new Float32Array(n);
  for (let i = 0; i < n; i++) { let m = 0; for (let k = i * hop; k < (i + 1) * hop; k++) m = Math.max(m, Math.abs(rec[k])); env[i] = m; }
  const sorted = [...env].sort((a, b) => a - b), floor = sorted[Math.floor(n * 0.5)], top = sorted[Math.floor(n * 0.995)];
  const thr = floor + (top - floor) * 0.35;
  const onsets = [];
  for (let i = 1; i < n; i++) if (env[i] > thr && env[i - 1] <= thr && (!onsets.length || i * hop / sr - onsets[onsets.length - 1] > 0.18)) onsets.push(i * hop / sr);
  const d = [];
  for (const c of clicks) {
    const o = onsets.find((t) => t > c - 0.12 && t < c + 0.6);
    if (o !== undefined) d.push(o - c);
  }
  if (d.length < 4) return null;
  d.sort((a, b) => a - b);
  const med = d[d.length >> 1];
  const spread = d[Math.floor(d.length * 0.8)] - d[Math.floor(d.length * 0.2)];
  return { latency: med, spread, matched: d.length };
}

// =====================================================================================
// Noise reduction (spectral gating): learn the room's noise from the quietest moments of the
// take, then pull every frequency down toward silence wherever it's not clearly above that floor.
// Laptop fans, hum and room hiss go; the voice keeps its body. amount 0..1.
// =====================================================================================
export function denoise(x, sr, amount = 0.8) {
  if (amount <= 0 || x.length < sr) return x;
  const N = 1024, H = 256, bins = N / 2 + 1;
  const win = new Float64Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  const frames = Math.floor((x.length - N) / H) + 1;
  // 1. per-frame energy → the quietest 10% of frames are "room noise"
  const energy = new Float64Array(frames);
  for (let f = 0; f < frames; f++) { let e = 0; for (let i = 0; i < N; i += 4) e += x[f * H + i] ** 2; energy[f] = e; }
  const quiet = [...energy.keys()].sort((a, b) => energy[a] - energy[b]).slice(0, Math.max(8, Math.floor(frames * 0.1)));
  const noise = new Float64Array(bins), re = new Float64Array(N), im = new Float64Array(N);
  for (const f of quiet) {
    for (let i = 0; i < N; i++) { re[i] = x[f * H + i] * win[i]; im[i] = 0; }
    fft(re, im, false);
    for (let k = 0; k < bins; k++) noise[k] += Math.hypot(re[k], im[k]) / quiet.length;
  }
  // 2. gate every frame against that profile, with smoothed gains (no "musical noise" chirps)
  const out = new Float32Array(x.length), norm = new Float32Array(x.length);
  const prev = new Float64Array(bins).fill(1), floor = 1 - 0.9 * amount, over = 1.5 + 1.5 * amount;
  for (let f = 0; f < frames; f++) {
    const o = f * H;
    for (let i = 0; i < N; i++) { re[i] = x[o + i] * win[i]; im[i] = 0; }
    fft(re, im, false);
    for (let k = 0; k < bins; k++) {
      const mag = Math.hypot(re[k], im[k]) + 1e-12;
      let g = Math.max(floor, 1 - (over * noise[k]) / mag);
      g = g > prev[k] ? 0.6 * g + 0.4 * prev[k] : 0.3 * g + 0.7 * prev[k];   // fast open, slow close
      prev[k] = g;
      re[k] *= g; im[k] *= g;
      if (k > 0 && k < N / 2) { re[N - k] = re[k]; im[N - k] = -im[k]; }
    }
    fft(re, im, true);
    for (let i = 0; i < N; i++) { out[o + i] += re[i] * win[i]; norm[o + i] += win[i] * win[i]; }
  }
  for (let i = 0; i < out.length; i++) out[i] = norm[i] > 1e-3 ? out[i] / norm[i] : x[i] * floor;
  return out;
}
