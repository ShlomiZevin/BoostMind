// The lesson's sound, one chain for both places: the editor plays it live, and the export renders it offline with the
// very same code (tools/mixdown.mjs runs this file in headless Chrome). So what you hear in the editor is the export.
//
//   voice (raw | noise-reduced) -> low cut -> warmth -> boxiness -> presence -> soft s's -> compressor -> make-up ┐
//   effects ────────────────────────────────────────────────────────────────────────────────────────────────────┤-> master -> limiter -> out
//   music  -> volume ───────────────────────────────────────────────────────────────────────────────────────────┘

export const VOICE_PRESETS: Record<string, any> = {
  natural: { denoise: false, lowcut: 60, warmth: 0, box: 0, presence: 0, deess: 0, comp: 0 },
  podcast: { denoise: true, lowcut: 85, warmth: 1.5, box: -2.5, presence: 2.5, deess: 0.4, comp: 0.6 },
  radio: { denoise: true, lowcut: 120, warmth: 3, box: -3, presence: 4, deess: 0.5, comp: 0.9 },
  warm: { denoise: true, lowcut: 70, warmth: 3, box: -1.5, presence: 1, deess: 0.3, comp: 0.4 },
  bright: { denoise: true, lowcut: 100, warmth: 0, box: -2, presence: 5, deess: 0.6, comp: 0.5 },
  news: { denoise: true, lowcut: 95, warmth: 2, box: -3, presence: 3.5, deess: 0.45, comp: 0.75 },  // a studio anchor
};

/** episode.json "voice" (a preset name, the editor's settings, or nothing) -> the full settings. */
export function voiceSettings(v0: any) {
  return typeof v0 === 'string' ? { preset: v0, ...(VOICE_PRESETS[v0] || VOICE_PRESETS.natural) }
    : v0 ? { ...VOICE_PRESETS[v0.preset || 'natural'], ...v0 } : { preset: 'natural', ...VOICE_PRESETS.natural };
}

/** episode.json "music" -> its volume (the same default everywhere). */
export const musicVolume = (m: any) => (m ? m.gain ?? 0.3 : 0);

export const TARGET_LUFS = -14;  // the finished file's loudness (TikTok / Reels level)

type Inputs = { voice?: AudioNode | null; voice_dn?: AudioNode | null; fx?: AudioNode | null; music?: AudioNode | null };

export function buildMix(ctx: BaseAudioContext, inp: Inputs) {
  const gRaw = ctx.createGain(), gDn = ctx.createGain();
  inp.voice?.connect(gRaw); inp.voice_dn?.connect(gDn);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass';
  const warm = ctx.createBiquadFilter(); warm.type = 'peaking'; warm.frequency.value = 140; warm.Q.value = 1.1;
  const box = ctx.createBiquadFilter(); box.type = 'peaking'; box.frequency.value = 320; box.Q.value = 1.2;
  const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 3200; pres.Q.value = 1.0;
  const ess = ctx.createBiquadFilter(); ess.type = 'highshelf'; ess.frequency.value = 6500;
  const comp = ctx.createDynamicsCompressor(); comp.attack.value = 0.006; comp.release.value = 0.09; comp.knee.value = 6;
  const makeup = ctx.createGain();
  const mg = ctx.createGain();
  const master = ctx.createGain();
  // a safety limiter: catches the odd peak the loudness gain pushes over -1 dB
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -3.5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
  gRaw.connect(hp); gDn.connect(hp); hp.connect(warm); warm.connect(box); box.connect(pres); pres.connect(ess); ess.connect(comp); comp.connect(makeup);
  makeup.connect(master); inp.fx?.connect(master);
  inp.music?.connect(mg); mg.connect(master);
  master.connect(lim); lim.connect(ctx.destination);
  return { gRaw, gDn, hp, warm, box, pres, ess, comp, makeup, mg, master, lim };
}
export type MixNodes = ReturnType<typeof buildMix>;

/** settings -> the chain. Live (glide = true) every change glides ~40 ms, so moving a slider doesn't crackle. */
export function applyMix(ctx: BaseAudioContext, n: MixNodes, voice: any, musicGain: number, masterGain: number, glide = true) {
  const at = ctx.currentTime;
  const set = (p: AudioParam, v: number) => (glide ? p.setTargetAtTime(v, at, 0.04) : (p.value = v));
  set(n.gRaw.gain, voice.denoise ? 0 : 1); set(n.gDn.gain, voice.denoise ? 1 : 0);
  set(n.hp.frequency, voice.lowcut || 60);
  set(n.warm.gain, voice.warmth || 0); set(n.box.gain, voice.box || 0); set(n.pres.gain, voice.presence || 0);
  set(n.ess.gain, -8 * (voice.deess || 0));
  const c = voice.comp || 0;
  set(n.comp.threshold, c > 0.02 ? -12 - 14 * c : 0); set(n.comp.ratio, 1 + 3 * c);
  set(n.makeup.gain, Math.pow(10, ((c > 0.02 ? 1 + 3 * c : 0) + (voice.boost || 0)) / 20) * 1.6);  // the raw take is quiet: a little lift
  set(n.mg.gain, musicGain);
  set(n.master.gain, masterGain);
}

/** Integrated loudness (ITU BS.1770: K-weighting, 400 ms blocks, gated) of mono 48 kHz samples, and the peak. */
export function loudness(x: Float32Array): { lufs: number; peak: number } {
  const f = (b: number[], a: number[], s: Float32Array) => {
    const y = new Float32Array(s.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < s.length; i++) {
      const v = b[0] * s[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
      x2 = x1; x1 = s[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  };
  const k = f([1, -2, 1], [1, -1.99004745483398, 0.99007225036621],
    f([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585], x));
  const win = 19200, hop = 4800, z: number[] = [];
  for (let s = 0; s + win <= k.length; s += hop) {
    let e = 0;
    for (let i = s; i < s + win; i++) e += k[i] * k[i];
    z.push(e / win);
  }
  const L = (m: number) => -0.691 + 10 * Math.log10(m);
  const mean = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(1, a.length);
  const abs = z.filter((e) => L(e) > -70);
  const rel = L(mean(abs)) - 10;
  const gated = abs.filter((e) => L(e) > rel);
  let peak = 0;
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  return { lufs: gated.length ? L(mean(gated)) : -70, peak };
}

/** The master gain that brings the mix to TARGET_LUFS (never pushing peaks more than 6 dB into the limiter). */
export function masterFor(m: { lufs: number; peak: number }) {
  if (m.lufs <= -69 || !m.peak) return 1;
  return Math.min(Math.pow(10, (TARGET_LUFS - m.lufs) / 20), Math.pow(10, (-3.5 + 6) / 20) / m.peak);
}

type Bufs = { voice?: AudioBuffer | null; voice_dn?: AudioBuffer | null; fx?: AudioBuffer | null; music?: AudioBuffer | null; musicLoop?: boolean };

/** The mix rendered offline, before (master = 1, to measure) or after the master gain. */
export async function renderMix(b: Bufs, length: number, voice: any, musicGain: number, masterGain: number) {
  const ctx = new OfflineAudioContext(1, length, 48000);
  const src = (buf?: AudioBuffer | null, loop = false) => {
    if (!buf) return null;
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = loop; s.start(0);
    return s;
  };
  const n = buildMix(ctx, { voice: src(b.voice), voice_dn: src(b.voice_dn), fx: src(b.fx), music: src(b.music, !!b.musicLoop) });
  applyMix(ctx, n, voice, musicGain, masterGain, false);
  return ctx.startRendering();
}

/** The full mix as the export makes it: measured, then brought to the target through the master + limiter. */
export async function finalMix(b: Bufs, length: number, voice: any, musicGain: number) {
  const pre = await renderMix(b, length, voice, musicGain, 1);
  const master = masterFor(loudness(pre.getChannelData(0)));
  // NB: measured with the limiter in (it never acts at master 1 on these levels), so the two renders agree
  return { master, out: await renderMix(b, length, voice, musicGain, master) };
}
