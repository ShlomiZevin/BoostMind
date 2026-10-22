// One audio layer's sound graph - the SAME code live in the editor (render/src/layers/AudioTrack.tsx) and offline in
// the export (tools/audio_layers.mjs), so what he hears while editing is the file. Every setting glides live; nothing
// is rebuilt.
//
//   each clip:  its source -> gain (the clip's gain x its fades x the source's level) -> the clip's fx (soundfx.ts:
//               filter / pitch / soften / room) -> the layer
//   the layer:  sum -> the layer's fx -> clarity (presence: peaking 2.8 kHz) -> the voice chain (sound.ts, when
//               props.voice) -> out
import { buildVoice, applyVoice, VoiceNodes } from './sound';
import { buildFx, applyFx, FxNodes, hasFx } from './soundfx';
export { loadFx } from './soundfx';
export { prepare as autoPrepare, layerGainAt } from '../src/layers/automation.js';  // (ducks / lift from the other layers)

export type LayerNodes = { ctx: BaseAudioContext; input: GainNode; fx: FxNodes; pres: BiquadFilterNode; voice: VoiceNodes; vIn: GainNode; out: GainNode; sig: string };
export type ClipNodes = { gain: GainNode; fx: FxNodes; sig: string };

export function buildLayer(ctx: BaseAudioContext, out: AudioNode): LayerNodes {
  const input = ctx.createGain(), vIn = ctx.createGain(), o = ctx.createGain();
  const fx = buildFx(ctx, input);
  const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 2800; pres.Q.value = 1.2; pres.gain.value = 0;
  fx.output.connect(pres); pres.connect(vIn);
  const voice = buildVoice(ctx, vIn, o);
  o.connect(out);
  return { ctx, input, fx, pres, voice, vIn, out: o, sig: '' };
}

/** The layer's settings: props.fx, props.presence (dB, live clarity), props.voice (the chain; none = bypassed). */
export function applyLayer(n: LayerNodes, props: any, glide = true) {
  const sig = JSON.stringify([props?.fx || null, props?.presence || 0, props?.voice || null]);
  if (sig === n.sig) return;
  n.sig = sig;
  applyFx(n.fx, props?.fx || null, glide);
  const at = n.ctx.currentTime, pr = +(props?.presence || 0);
  if (glide) n.pres.gain.setTargetAtTime(pr, at, 0.04); else n.pres.gain.value = pr;
  applyVoice(n.ctx, n.voice, props?.voice || { bypass: true }, glide);
}

export function buildClip(ctx: BaseAudioContext, layer: LayerNodes, input?: AudioNode): ClipNodes {
  const gain = ctx.createGain(); gain.gain.value = 0;
  const fx = buildFx(ctx, gain, layer.input);
  input?.connect(gain);
  return { gain, fx, sig: '' };
}

/** The clip's own fx: item.fx + item.soften (an item's fx wins over nothing; the layer's fx come after). */
export const clipFx = (it: any) => (it ? { ...(it.fx || {}), ...(it.soften ? { soften: true } : {}) } : null);

export function applyClip(n: ClipNodes, it: any, glide = true) {
  const fx = clipFx(it), sig = JSON.stringify(fx);
  if (sig === n.sig) return;
  n.sig = sig;
  applyFx(n.fx, hasFx(fx) ? fx : null, glide);
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
