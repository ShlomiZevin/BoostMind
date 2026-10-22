// Sound effects for any audio clip or layer - LIVE: a change is heard at once, nothing is rebuilt. The editor plays
// them (render/src/layers/AudioTrack.tsx) and the export renders the very same nodes offline (tools/audio_layers.mjs),
// so the file sounds like the editor.
//
//   fx: { filter: 'phone' | 'speakerphone' | 'speaker' | 'thought' | 'echo' | 'muffled' | null,
//         echo: 0..2 (the echo filter's hall - 1 = as tuned), room: 0..1 + roomSize (his room around it),
//         pitch: semitones (timing kept), level: dB (the filter's own level step - set once by the builder),
//         soften: true (a shouted line made easier on the ear: pipeline/audio.soften - less 2-5 kHz, the top rounded,
//         the peaks evened out, the level kept) }
//   An item's speed (`rate`, tape: pitch follows) is the player's playback rate; `pitch` shifts on top of it, so
//   "tempo" (faster, same pitch) = rate r + pitch -12*log2(r).
//
// The filters are lesson.py's SOUND_FILTERS (ffmpeg) rebuilt from Web Audio nodes: the same corners, bands, gains,
// compressors and echo taps. The pitch shifter is a two-grain delay-line shifter in an AudioWorklet (runs offline too).
import { roomIR } from './sound';

type Stage =
  | { hp: number } | { lp: number } | { eq: [number, number, number] }  // [freq, width (octaves ~ q), gain dB]
  | { comp: [number, number, number, number, number?] }               // threshold dB, ratio, attack ms, release ms, makeup dB
  | { echo: [number, number, number[], number[]] }                    // in gain, out gain, delays ms, decays
  | { clip: number } | { crush: [number, number] };                   // softclip threshold; bits, mix

// lesson.py SOUND_FILTERS, stage for stage ("loudnorm" = the builder's per-sound `level`)
export const FILTERS: Record<string, { label: string; stages: Stage[] }> = {
  phone: { label: 'Phone', stages: [{ hp: 380 }, { lp: 3000 }, { comp: [-20, 2, 20, 250] }] },
  speakerphone: { label: 'Speakerphone', stages: [{ hp: 480 }, { hp: 480 }, { lp: 3300 }, { lp: 3300 }, { eq: [1700, 1.1, 7] }, { eq: [800, 1, -3] },
    { comp: [-24, 5, 3, 60, 4] }, { crush: [9, 0.3] }, { clip: 0.5 }, { echo: [0.85, 0.45, [17, 31, 53, 89], [0.28, 0.2, 0.13, 0.08]] }] },
  speaker: { label: 'Laptop speaker', stages: [{ hp: 330 }, { hp: 330 }, { lp: 7000 }, { eq: [1200, 1.1, 5] }, { eq: [3200, 1.4, 3] }, { eq: [500, 1, -3] },
    { comp: [-22, 5, 4, 60] }, { clip: 0.85 }, { echo: [0.85, 0.5, [17, 29], [0.16, 0.09]] }] },
  thought: { label: 'Thought', stages: [{ hp: 95 }, { lp: 9000 }, { eq: [220, 1, 2] }, { eq: [3000, 1.2, 1.5] }, { comp: [-22, 3, 5, 80] },
    { echo: [0.85, 0.6, [38, 77, 121], [0.24, 0.14, 0.08]] }] },
  echo: { label: 'Dark echo', stages: [{ hp: 90 }, { lp: 7500 }, { eq: [180, 1, 2.5] }, { eq: [2600, 1.2, 1.5] }, { comp: [-22, 3, 5, 80] },
    { echo: [0.8, 0.72, [70, 150, 260, 410, 620], [0.32, 0.24, 0.17, 0.11, 0.07]] }] },
  muffled: { label: 'Muffled', stages: [{ hp: 110 }, { lp: 420 }, { lp: 420 }, { eq: [250, 1, 3] }, { comp: [-24, 3, 10, 120] },
    { echo: [0.8, 0.55, [45, 95, 170], [0.3, 0.2, 0.12]] }] },
};

// ---- the pitch shifter: two read heads sweep a delay line in opposite phase, each faded in / out (sin^2), so the
// sound plays `ratio` times faster through each grain while the grains keep the timing. Window 60 ms (speech).
const PITCH_WORKLET = `
class ZcPitch extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: 'ratio', defaultValue: 1, minValue: 0.25, maxValue: 4 }]; }
  constructor() { super(); this.n = 8192; this.buf = new Float32Array(this.n); this.w = 0; this.ph = 0; this.win = Math.round(0.06 * sampleRate); }
  process(ins, outs, p) {
    const i = ins[0][0], o = outs[0][0];
    if (!o) return true;
    const rs = p.ratio, N = this.n, W = this.win;
    for (let k = 0; k < o.length; k++) {
      const r = rs.length > 1 ? rs[k] : rs[0];
      this.buf[this.w] = i ? i[k] : 0;
      // the phase runs 0..1 over one window; each head's delay = (1 - phase) * W (rising pitch) or phase * W (falling)
      this.ph += (1 - r) / W;
      this.ph -= Math.floor(this.ph);
      let y = 0;
      for (const off of [0, 0.5]) {
        const q = (this.ph + off) % 1;
        const d = q * W + 2;
        let pos = this.w - d; if (pos < 0) pos += N;
        const a = Math.floor(pos), f = pos - a, s0 = this.buf[a % N], s1 = this.buf[(a + 1) % N];
        const g = Math.sin(Math.PI * q);
        y += (s0 + (s1 - s0) * f) * g * g;
      }
      o[k] = y;
      this.w = (this.w + 1) % N;
    }
    return true;
  }
}
registerProcessor('zc-pitch', ZcPitch);`;
const loaded = new WeakMap<BaseAudioContext, Promise<void>>();
/** Make the pitch shifter available in this context (once). Await before building chains that may shift pitch. */
export function loadFx(ctx: BaseAudioContext) {
  if (!loaded.has(ctx)) {
    const url = URL.createObjectURL(new Blob([PITCH_WORKLET], { type: 'application/javascript' }));
    loaded.set(ctx, ctx.audioWorklet.addModule(url).catch(() => {}));
  }
  return loaded.get(ctx)!;
}

const db = (x: number) => Math.pow(10, x / 20);
function stage(ctx: BaseAudioContext, s: Stage): { in: AudioNode; out: AudioNode } {
  if ('hp' in s || 'lp' in s) { const b = ctx.createBiquadFilter(); b.type = 'hp' in s ? 'highpass' : 'lowpass'; b.frequency.value = 'hp' in s ? s.hp : (s as any).lp; b.Q.value = 0.707; return { in: b, out: b }; }
  if ('eq' in s) { const b = ctx.createBiquadFilter(); b.type = 'peaking'; b.frequency.value = s.eq[0]; b.Q.value = 1 / Math.max(0.1, s.eq[1]) * 1.41; b.gain.value = s.eq[2]; return { in: b, out: b }; }
  if ('comp' in s) {
    const c = ctx.createDynamicsCompressor(), m = ctx.createGain();
    c.threshold.value = s.comp[0]; c.ratio.value = s.comp[1]; c.attack.value = s.comp[2] / 1000; c.release.value = s.comp[3] / 1000; c.knee.value = 3;
    m.gain.value = db(s.comp[4] || 0); c.connect(m); return { in: c, out: m };
  }
  if ('clip' in s || 'crush' in s) {
    const w = ctx.createWaveShaper(), n = 2048, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      if ('clip' in s) curve[i] = s.clip * Math.tanh(x / s.clip);
      else { const lv = Math.pow(2, s.crush[0] - 1), q = Math.sign(x) * Math.round(Math.log1p(Math.abs(x) * 255) / Math.log(256) * lv) / lv; const back = Math.sign(q) * (Math.pow(256, Math.abs(q)) - 1) / 255; curve[i] = x * (1 - s.crush[1]) + back * s.crush[1]; }
    }
    w.curve = curve; w.oversample = '2x'; return { in: w, out: w };
  }
  const [ig, og, ds, gs] = (s as any).echo as [number, number, number[], number[]];
  const inp = ctx.createGain(), out = ctx.createGain(), dry = ctx.createGain();
  inp.gain.value = 1; dry.gain.value = ig; out.gain.value = og;
  inp.connect(dry); dry.connect(out);
  ds.forEach((ms, k) => { const d = ctx.createDelay(1); d.delayTime.value = ms / 1000; const g = ctx.createGain(); g.gain.value = gs[k] * ig; inp.connect(d); d.connect(g); g.connect(out); });
  return { in: inp, out };
}

// audio.soften: peak -5 dB at 3.2 kHz (q 0.9), shelf -5 dB at 7 kHz, ~2:1 above the line's typical level, level kept
const SOFTEN: Stage[] = [{ eq: [3200, 1.1, -5] }, { comp: [-26, 2, 5, 120, 3.5] }];

export type FxNodes = { input: GainNode; output: GainNode; dry: GainNode; wet: GainNode; pitchIn: GainNode; pitchOut: GainNode; pitch: AudioWorkletNode | null;
  roomDry: GainNode; roomWet: GainNode; rev: ConvolverNode; level: GainNode; sig: string; irSize: number; ctx: BaseAudioContext; chainIn: GainNode; chainOut: GainNode };

/** An fx chain: input -> [pitch] -> [filter stages] -> level -> [room] -> output. Rebuilt only when the filter changes
 *  (applyFx); everything else glides. */
export function buildFx(ctx: BaseAudioContext, input?: AudioNode, output?: AudioNode): FxNodes {
  const n: any = { ctx, input: ctx.createGain(), output: ctx.createGain(), sig: '', irSize: 0 };
  n.pitchIn = ctx.createGain(); n.pitchOut = ctx.createGain(); n.dry = ctx.createGain(); n.wet = ctx.createGain();
  n.chainIn = ctx.createGain(); n.chainOut = ctx.createGain(); n.level = ctx.createGain();
  n.roomDry = ctx.createGain(); n.roomWet = ctx.createGain(); n.rev = ctx.createConvolver(); n.rev.normalize = false;
  try { n.pitch = new AudioWorkletNode(ctx, 'zc-pitch'); } catch { n.pitch = null; }
  // pitch: dry (no shift) or through the shifter
  n.input.connect(n.dry); n.dry.connect(n.chainIn);
  if (n.pitch) { n.input.connect(n.wet); n.wet.connect(n.pitch); n.pitch.connect(n.chainIn); }
  n.wet.gain.value = 0;
  n.chainIn.connect(n.chainOut);  // (no filter: straight through - applyFx puts the stages in between)
  n.chainOut.connect(n.level);
  n.level.connect(n.roomDry); n.roomDry.connect(n.output);
  n.level.connect(n.rev); n.rev.connect(n.roomWet); n.roomWet.connect(n.output);
  n.roomWet.gain.value = 0;
  input?.connect(n.input);
  if (output) n.output.connect(output);
  return n as FxNodes;
}

const echoScaled = (amount: number): Stage[] => FILTERS.echo.stages.map((s) => ('echo' in s ? { echo: [s.echo[0], s.echo[1], s.echo[2], s.echo[3].map((d) => Math.min(0.95, d * amount))] } as Stage : s));

/** fx settings -> the chain (glide = live: changes glide ~40 ms; the filter's stages are swapped when it changes). */
export function applyFx(n: FxNodes, fx: any, glide = true) {
  const ctx = n.ctx, at = ctx.currentTime;
  const set = (p: AudioParam, v: number) => (glide ? p.setTargetAtTime(v, at, 0.04) : (p.value = v));
  fx = fx || {};
  const f = fx.filter && FILTERS[fx.filter] ? fx.filter : null;
  const sig = `${f}|${f === 'echo' ? +(fx.echo ?? 1) : ''}|${fx.soften ? 1 : 0}`;
  if (sig !== n.sig) {  // the filter changed: new stages between chainIn and chainOut
    n.chainIn.disconnect();
    let last: AudioNode = n.chainIn;
    const stages = [...(fx.soften ? SOFTEN : []), ...(f ? (f === 'echo' && fx.echo != null ? echoScaled(+fx.echo) : FILTERS[f].stages) : [])];
    for (const s of stages) {
      const st = stage(ctx, s); last.connect(st.in); last = st.out;
      if (fx.soften && s === SOFTEN[0]) { const sh = ctx.createBiquadFilter(); sh.type = 'highshelf'; sh.frequency.value = 7000; sh.gain.value = -5; last.connect(sh); last = sh; }
    }
    last.connect(n.chainOut);
    n.sig = sig;
  }
  const semis = +(fx.pitch || 0);
  const shift = Math.abs(semis) > 0.01 && !!n.pitch;
  set(n.dry.gain, shift ? 0 : 1); set(n.wet.gain, shift ? 1 : 0);
  if (n.pitch) set((n.pitch.parameters as any).get('ratio'), Math.pow(2, semis / 12));
  set(n.level.gain, db(+(fx.level || 0)));
  const room = Math.max(0, Math.min(1, +(fx.room || 0))), size = Math.max(0.3, Math.min(3.5, +(fx.roomSize || 1.6)));
  if (room > 0 && n.irSize !== size) { n.rev.buffer = roomIR(ctx, size); n.irSize = size; }
  set(n.roomDry.gain, 1 - 0.45 * room); set(n.roomWet.gain, room > 0 ? 1.1 * room : 0);
}

/** Does this fx do anything (so a plain clip skips the chain's cost)? */
export const hasFx = (fx: any) => !!fx && (!!fx.filter || !!fx.soften || Math.abs(+(fx.pitch || 0)) > 0.01 || +(fx.room || 0) > 0 || Math.abs(+(fx.level || 0)) > 0.01);
