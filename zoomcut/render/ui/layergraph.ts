// One audio layer's sound graph - the SAME code live in the editor (render/src/layers/AudioTrack.tsx) and offline in
// the export (tools/audio_layers.mjs), so what he hears while editing is the file. Every setting glides live; nothing
// is rebuilt.
//
//   each clip:  its source -> gain (the clip's gain x its fades x the source's level) -> fx (soundfx.ts: filter / pitch
//               / soften / room - the row's, with the clip's own replacing them key by key) -> the layer
//   the layer:  sum -> clarity (presence: peaking 2.8 kHz) -> the voice chain (sound.ts, when props.voice) -> out
//   a clip with its OWN voice or clarity (item.voice - false = none - / item.presence) skips the row's chain: its own
//               clarity -> its own voice chain -> the layer's out.
// THE CLIP WINS (his rule, 2026-11-03): a setting a clip has of its own replaces the row's for that clip; the rest comes
// from the row. Only loudness adds up (the row's volume x the clip's gain).
import { buildVoice, applyVoice, VoiceNodes } from './sound';
import { buildFx, applyFx, FxNodes, hasFx } from './soundfx';
export { loadFx } from './soundfx';
export { prepare as autoPrepare, layerGainAt } from '../src/layers/automation.js';  // (ducks / lift from the other layers)

export type LayerNodes = { ctx: BaseAudioContext; input: GainNode; fx: FxNodes; pres: BiquadFilterNode; voice: VoiceNodes; vIn: GainNode; out: GainNode; sig: string };
export type ClipNodes = { gain: GainNode; fx: FxNodes; sig: string; ctx: BaseAudioContext; layer: LayerNodes; toRow: GainNode;
  own: { toOwn: GainNode; pres: BiquadFilterNode; voice: VoiceNodes } | null };

/** What one clip plays with: the row's settings with the clip's own replacing them (fx key by key; voice / clarity /
 *  cleaning / speech level whole). own = the clip has its own voice or clarity (it gets its own chain). */
export function soundOf(props: any, it: any) {
  props = props || {};
  const fx = { ...(props.fx || {}), ...(it?.fx || {}), ...(it?.soften ? { soften: true } : {}) };
  const ownVoice = !!it && it.voice !== undefined && it.voice !== null, ownPres = !!it && it.presence != null;
  return {
    fx, own: ownVoice || ownPres,
    voice: ownVoice ? it.voice || null : props.voice || null,
    presence: ownPres ? +it.presence : +(props.presence || 0),
    clean: it?.clean ?? props.clean ?? 'off',
    level: it?.level ?? props.level ?? null,
  };
}

export function buildLayer(ctx: BaseAudioContext, out: AudioNode): LayerNodes {
  const input = ctx.createGain(), vIn = ctx.createGain(), o = ctx.createGain();
  const fx = buildFx(ctx, input);
  const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 2800; pres.Q.value = 1.2; pres.gain.value = 0;
  fx.output.connect(pres); pres.connect(vIn);
  const voice = buildVoice(ctx, vIn, o);
  o.connect(out);
  return { ctx, input, fx, pres, voice, vIn, out: o, sig: '' };
}

/** The layer's settings: props.presence (dB, live clarity), props.voice (the chain; none = bypassed). The row's fx are
 *  played by each clip (soundOf), so a clip's own fx replace them instead of stacking on top. */
export function applyLayer(n: LayerNodes, props: any, glide = true) {
  const sig = JSON.stringify([props?.presence || 0, props?.voice || null]);
  if (sig === n.sig) return;
  n.sig = sig;
  applyFx(n.fx, null, glide);
  const at = n.ctx.currentTime, pr = +(props?.presence || 0);
  if (glide) n.pres.gain.setTargetAtTime(pr, at, 0.04); else n.pres.gain.value = pr;
  applyVoice(n.ctx, n.voice, props?.voice || { bypass: true }, glide);
}

export function buildClip(ctx: BaseAudioContext, layer: LayerNodes, input?: AudioNode): ClipNodes {
  const gain = ctx.createGain(); gain.gain.value = 0;
  const toRow = ctx.createGain();
  const fx = buildFx(ctx, gain, toRow);
  toRow.connect(layer.input);
  input?.connect(gain);
  return { gain, fx, sig: '', ctx, layer, toRow, own: null };
}

// a clip's own chain (made the first time it needs one): fx -> clarity -> voice chain -> the layer's out
const ownChain = (n: ClipNodes) => {
  if (n.own) return n.own;
  const ctx = n.ctx, toOwn = ctx.createGain(), vOut = ctx.createGain();
  const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 2800; pres.Q.value = 1.2; pres.gain.value = 0;
  toOwn.gain.value = 0;
  n.fx.output.connect(toOwn); toOwn.connect(pres);
  const voice = buildVoice(ctx, pres, vOut);
  vOut.connect(n.layer.out);
  return (n.own = { toOwn, pres, voice });
};

/** The clip's sound (soundOf: the row's settings, its own replacing them). `props` = its row's props. */
export function applyClip(n: ClipNodes, it: any, props: any = {}, glide = true) {
  const S = soundOf(props, it), sig = JSON.stringify([S.fx, S.own, S.own ? [S.voice, S.presence] : 0]);
  if (sig === n.sig) return;
  n.sig = sig;
  applyFx(n.fx, hasFx(S.fx) ? S.fx : null, glide);
  const at = n.ctx.currentTime, set = (p: AudioParam, v: number) => (glide ? p.setTargetAtTime(v, at, 0.01) : (p.value = v));
  if (S.own) {
    const o = ownChain(n);
    set(o.pres.gain, S.presence);
    applyVoice(n.ctx, o.voice, S.voice || { bypass: true }, glide);
    set(o.toOwn.gain, 1); set(n.toRow.gain, 0);
  } else {
    set(n.toRow.gain, 1);
    if (n.own) set(n.own.toOwn.gain, 0);
  }
}

/** A clip's gain at t seconds into it: its gain x a short fade in (default 12 ms, so a cut never clicks) x its fade
 *  out (curve ^1.5). */
export function clipGainAt(it: any, t: number, fps: number) {
  const d = it.dur / fps;
  const fi = it.fade_in ?? 0.012, fo = it.fade_out ?? 0;
  const a = fi > 0 ? Math.min(1, Math.max(0, t / fi)) : 1;
  const b = fo > 0 ? Math.min(1, Math.max(0, (d - t) / fo)) ** 1.5 : 1;
  return (it.gain ?? 1) * a * b;
}
