// Noa lip sync engine - the SAME code makes the profile (Node, from Noa's calibration clips)
// and listens live in the browser. Sound -> fingerprint (MFCC) -> nearest mouth sounds -> viseme weights.
//   Node:    node tools/lipsync.js calibrate voice/calib web/profile.json   (needs ffmpeg)
//   Browser: const ls = NoaLipSync.create(profile); every frame: ls.update(float32Samples16k) -> {vol, w:{A:..}}
(function (root) {
  const SR = 16000, N = 1024, MEL = 30, NC = 12;

  // ---- fingerprint of one frame of 1024 samples at 16 kHz
  const fftRe = new Float32Array(N), fftIm = new Float32Array(N);
  const ham = new Float32Array(N).map((_, i) => 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (N - 1)));
  const melBank = (() => {
    const mel = (f) => 1127 * Math.log(1 + f / 700), inv = (m) => 700 * (Math.exp(m / 1127) - 1);
    const lo = mel(80), hi = mel(SR / 2), pts = [];
    for (let i = 0; i < MEL + 2; i++) pts.push(Math.round((inv(lo + ((hi - lo) * i) / (MEL + 1)) / SR) * N));
    return Array.from({ length: MEL }, (_, c) => [pts[c], pts[c + 1], pts[c + 2]]);
  })();
  function fft(re, im) {
    for (let i = 1, j = 0; i < N; i++) {
      let bit = N >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= N; len <<= 1) {
      const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
      for (let i = 0; i < N; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ur = re[i + k], ui = im[i + k];
          const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }
  function features(x) { // x: Float32Array(N) at 16 kHz -> { vol, mfcc[12] }
    let s = 0, peak = 1e-9;
    for (let i = 0; i < N; i++) s += x[i] * x[i];
    const vol = Math.sqrt(s / N);
    let prev = 0;
    for (let i = 0; i < N; i++) { const v = x[i] - 0.97 * prev; prev = x[i]; fftRe[i] = v * ham[i]; fftIm[i] = 0; peak = Math.max(peak, Math.abs(fftRe[i])); }
    for (let i = 0; i < N; i++) fftRe[i] /= peak; // loudness out: only the shape of the sound counts
    fft(fftRe, fftIm);
    const melE = new Float32Array(MEL);
    for (let c = 0; c < MEL; c++) {
      const [a, b, d] = melBank[c];
      let e = 0;
      for (let k = a; k < d; k++) {
        const w = k < b ? (k - a) / Math.max(1, b - a) : (d - k) / Math.max(1, d - b);
        e += w * (fftRe[k] * fftRe[k] + fftIm[k] * fftIm[k]);
      }
      melE[c] = 10 * Math.log10(e + 1e-10);
    }
    const mfcc = new Float32Array(NC);
    for (let k = 1; k <= NC; k++) {
      let v = 0;
      for (let c = 0; c < MEL; c++) v += melE[c] * Math.cos((Math.PI * k * (c + 0.5)) / MEL);
      mfcc[k - 1] = v;
    }
    return { vol, mfcc };
  }

  // ---- profile: per sound the average fingerprint, plus global mean / spread to compare fairly
  function makeProfile(clips) { // clips: { A: Float32Array(16k pcm), ... }
    const frames = {}, all = [];
    for (const [name, pcm] of Object.entries(clips)) {
      const fs = [];
      for (let i = 0; i + N <= pcm.length; i += 160) fs.push(features(pcm.subarray(i, i + N)));
      const top = Math.max(...fs.map((f) => f.vol));
      frames[name] = fs.filter((f) => f.vol > top * 0.35).map((f) => Array.from(f.mfcc));
      all.push(...frames[name]);
    }
    const mean = Array(NC).fill(0), sd = Array(NC).fill(0);
    for (const f of all) f.forEach((v, i) => (mean[i] += v / all.length));
    for (const f of all) f.forEach((v, i) => (sd[i] += (v - mean[i]) ** 2 / all.length));
    sd.forEach((v, i) => (sd[i] = Math.sqrt(v) || 1));
    const sounds = {};
    for (const [name, fs] of Object.entries(frames)) {
      const c = Array(NC).fill(0);
      for (const f of fs) f.forEach((v, i) => (c[i] += (v - mean[i]) / sd[i] / fs.length));
      sounds[name] = c.map((v) => +v.toFixed(4));
    }
    let loud = 0; for (const fs of Object.values(clips)) for (let i = 0; i < fs.length; i++) loud = Math.max(loud, Math.abs(fs[i]));
    return { sr: SR, n: N, mean: mean.map((v) => +v.toFixed(4)), sd: sd.map((v) => +v.toFixed(4)), sounds, counts: Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, v.length])) };
  }

  // ---- live: weights per sound, smoothed
  function create(profile, opt = {}) {
    const names = Object.keys(profile.sounds), sharp = opt.sharp || 1.6, smooth = opt.smooth || 0.45;
    const w = Object.fromEntries(names.map((n) => [n, 0]));
    let volS = 0, volMax = 0.02;
    return {
      w, names,
      get vol() { return volS; },
      update(x) {
        const f = features(x);
        volMax = Math.max(volMax * 0.9995, f.vol);
        const v = Math.min(1, f.vol / (volMax * 0.6));
        volS += (v - volS) * 0.5;
        const z = Array.from(f.mfcc, (val, i) => (val - profile.mean[i]) / profile.sd[i]);
        const d = names.map((n) => Math.sqrt(profile.sounds[n].reduce((s, c, i) => s + (c - z[i]) ** 2, 0)));
        const dmin = Math.min(...d), sc = d.map((di) => Math.exp(-sharp * (di - dmin))), tot = sc.reduce((a, b) => a + b, 0);
        names.forEach((n, i) => (w[n] += ((sc[i] / tot) * (volS > 0.08 ? 1 : 0) - w[n]) * smooth));
        return { vol: volS, w };
      },
    };
  }
  // resample any rate -> 16 kHz (linear), for live audio from an AudioContext at 44.1/48 kHz
  function to16k(src, rate) {
    if (rate === SR) return src;
    const out = new Float32Array(Math.floor((src.length * SR) / rate)), r = rate / SR;
    for (let i = 0; i < out.length; i++) { const p = i * r, a = Math.floor(p), t = p - a; out[i] = src[a] * (1 - t) + (src[a + 1] || 0) * t; }
    return out;
  }
  const api = { features, makeProfile, create, to16k, SR, N };
  if (typeof module !== 'undefined') module.exports = api; else root.NoaLipSync = api;

  // ---- Node CLI: calibrate
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
    const [, , cmd, dir, out] = process.argv;
    const pcm = (f) => { const b = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-']); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); };
    if (cmd === 'calibrate') {
      const clips = {};
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.mp3'))) clips[path.basename(f, '.mp3')] = pcm(path.join(dir, f));
      const p = makeProfile(clips);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, JSON.stringify(p));
      console.log('profile', out, p.counts);
      // self-check: which sound wins on each clip's own frames
      const ls = create(p);
      for (const [name, x] of Object.entries(clips)) {
        const tally = {};
        for (let i = 0; i + N <= x.length; i += 160) { const r = ls.update(x.subarray(i, i + N)); if (r.vol > 0.3) { const best = ls.names.reduce((a, b) => (r.w[a] > r.w[b] ? a : b)); tally[best] = (tally[best] || 0) + 1; } }
        console.log(name, '->', JSON.stringify(tally));
      }
    } else if (cmd === 'trace') { // print the winning sound along a sentence
      const p = JSON.parse(fs.readFileSync(out, 'utf8')), ls = create(p), x = pcm(dir);
      let line = '';
      for (let i = 0; i + N <= x.length; i += 160 * 2) { const r = ls.update(x.subarray(i, i + N)); line += r.vol < 0.1 ? '.' : ls.names.reduce((a, b) => (r.w[a] > r.w[b] ? a : b)); }
      console.log(line);
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
