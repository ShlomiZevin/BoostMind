// An audio layer in the EDITOR, live: moving, trimming, muting, a gain or a fade shows up at once - no stems made
// again. Like VideoTrack: each source gets two persistent <audio> copies (clock.js - the next item's copy waits
// already seeked), following the Player's frame; every source is downloaded once into memory (ui/preload.ts).
// Each copy -> its own gain (the item's gain x fade in x fade out, ramped so a cut never clicks) -> the layer's gain
// (volume, muted / hidden) -> the speakers, through one shared Web Audio context (made on the first play).
// A voice layer (props.voice) goes through the one-camera voice chain of render/ui/sound.ts on the way - the same code
// the export renders it with (tools/voice_chain.mjs), at the same level: the prepared sources carry the mix's shared
// gain, so the chain gets them back at the track's own level (x 1/gain) and hands them on at the shared gain (x gain).
// A clip marked `soften` plays its prepared piece (urls['<layer>|<asset>@<item>'], softened like the export).
// The source: urls['<layer>|<asset>'] = the studio's prepared file (cleaning x level x master, pipeline/layers_audio.py),
// else urls['<asset>:audio'] (the take's own sound). The export mixes in python (layers_audio.py) - same gains.
import React, { useEffect, useMemo, useRef } from 'react';
import { useCurrentFrame } from 'remotion';
import { partsOf, activeParts, nextUses, copiesOf, srcAt } from './clock.js';
import { usePreloaded } from '../../ui/preload';
import { buildVoice, applyVoice, VoiceNodes } from '../../ui/sound';
import type { LayersProps } from '../Layers';

let shared: AudioContext | null = null;
const audioCtx = () => (shared ??= new AudioContext());

/** An item's gain at frame f: its own gain x a short fade in (default 12 ms, so a cut never clicks) x its fade out (curve ^1.5). */
export function itemGain(it: any, f: number, fps: number) {
  const t = (f - it.from) / fps, d = it.dur / fps;
  const fi = it.fade_in ?? 0.012, fo = it.fade_out ?? 0;
  const a = fi > 0 ? Math.min(1, Math.max(0, t / fi)) : 1;
  const b = fo > 0 ? Math.min(1, Math.max(0, (d - t) / fo)) ** 1.5 : 1;
  return (it.gain ?? 1) * a * b;
}

export const AudioTrack: React.FC<{ p: LayersProps; layer: any }> = ({ p, layer }) => {
  const f = useCurrentFrame();
  const fps = p.project.canvas.fps;
  const soft = (it: any) => (it.soften && p.urls[`${layer.id}|${it.asset}@${it.id}`] ? `soft@${it.id}` : 'audio');
  const urlOf = (key: string) => {  // "asset:variant" -> the file
    const [asset, variant] = key.split(':');
    if (variant?.startsWith('soft@')) return p.urls[`${layer.id}|${asset}@${variant.slice(5)}`] || '';
    return p.urls[`${layer.id}|${asset}`] || p.urls[`${asset}:audio`] || '';
  };
  const parts = useMemo(() => partsOf(layer.items, fps, soft), [layer.items, fps, p.urls]);
  const copies = useMemo(() => copiesOf(parts), [parts]);
  const [blobs] = usePreloaded(useMemo(() => [...new Set(Object.values(copies).map((k: string) => urlOf(k)).filter(Boolean))], [copies, p.urls]));
  /** where in the copy's file the part is at frame f (a softened piece starts at the clip's own start) */
  const at = (A: any, f: number) => srcAt(A, f, fps) - (A.key.includes(':soft@') ? A.in ?? 0 : 0);

  type Node = { el: HTMLAudioElement; gain?: GainNode; src: string };
  const nodes = useRef<Record<string, Node>>({});
  const layerGain = useRef<GainNode | null>(null);
  const chain = useRef<{ inG: GainNode; outG: GainNode; v: VoiceNodes } | null>(null);
  const live = useRef<any>({});
  const on = !layer.hidden && !layer.muted;
  live.current = { parts, f, playing: !!(p as any).playing, rate: (p as any).playbackRate || 1, volume: on ? Math.max(0, layer.props?.volume ?? 1) : 0,
    voice: layer.props?.voice || null, g: Math.pow(10, ((p as any).gainDb ?? 0) / 20) };

  // the copies: made / pointed at their (in-memory) file as the items change; gone with the layer
  useEffect(() => {
    for (const [copy, key] of Object.entries(copies)) {
      const u = urlOf(key as string);
      const src = blobs[u] || u;
      const n = nodes.current[copy];
      if (!n) { const el = new Audio(); el.preload = 'auto'; el.crossOrigin = 'anonymous'; el.src = src; nodes.current[copy] = { el, src }; }
      else if (n.src !== src && src) { n.el.src = src; n.src = src; }
    }
    for (const copy of Object.keys(nodes.current)) if (!(copy in copies)) { nodes.current[copy].el.pause(); nodes.current[copy].el.src = ''; delete nodes.current[copy]; }
  }, [copies, blobs]);
  useEffect(() => () => { for (const n of Object.values(nodes.current)) { n.el.pause(); n.el.src = ''; } nodes.current = {}; layerGain.current?.disconnect(); chain.current?.outG.disconnect(); }, []);

  // into Web Audio once it may start (a browser starts sound only after a click - the first Play is one)
  const wire = () => {
    const ctx = audioCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (!layerGain.current) {  // copies -> [x 1/gain -> voice chain -> x gain] -> volume -> speakers
      layerGain.current = ctx.createGain(); layerGain.current.connect(ctx.destination);
      const inG = ctx.createGain(), outG = ctx.createGain();
      chain.current = { inG, outG, v: buildVoice(ctx, inG, outG) };
      outG.connect(layerGain.current);
      (window as any).__atTap?.(ctx, layer.id, layerGain.current);  // (tests: listen to one layer)
    }
    for (const n of Object.values(nodes.current)) {
      if (n.gain) continue;
      try { const g = ctx.createGain(); g.gain.value = 0; ctx.createMediaElementSource(n.el).connect(g); g.connect(chain.current!.inG); n.gain = g; } catch {}
    }
    return ctx;
  };

  useEffect(() => {
    const { parts, f, playing, rate, volume, voice, g } = live.current;
    const act = activeParts(parts, f), waits = nextUses(parts, f);
    const ctx = playing || shared ? wire() : null;
    if (ctx && layerGain.current) layerGain.current.gain.setTargetAtTime(volume, ctx.currentTime, 0.01);
    const c = chain.current, sig = JSON.stringify(voice) + g;
    if (ctx && c && (c as any).sig !== sig) {  // (only when the settings change: each change glides)
      (c as any).sig = sig;
      c.inG.gain.setTargetAtTime(voice ? 1 / g : 1, ctx.currentTime, 0.01);
      c.outG.gain.setTargetAtTime(voice ? g : 1, ctx.currentTime, 0.01);
      applyVoice(ctx, c.v, voice || { bypass: true });
    }
    for (const [copy, n] of Object.entries(nodes.current)) {
      const A = act[copy], el = n.el;
      if (A && playing) {
        const want = at(A, f);
        const r = rate * (A.rate ?? 1);
        if (el.playbackRate !== r) el.playbackRate = r;
        const keep = (A.rate ?? 1) === 1;  // a slowed piece sounds slower AND lower, as lesson.py made it; the project speed keeps the pitch
        if ((el as any).preservesPitch !== keep) (el as any).preservesPitch = keep;
        if (Math.abs(el.currentTime - want) > 0.08) el.currentTime = want;  // (sound drifts are heard sooner than picture)
        if (el.paused) el.play().catch(() => {});
        if (ctx && n.gain) n.gain.gain.setTargetAtTime(itemGain(A, f, fps), ctx.currentTime, 0.006);
      } else {
        if (ctx && n.gain) n.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.004);  // (out, without a click)
        if (!el.paused) el.pause();
        const w = A || waits[copy];  // paused: waits where it will play
        const to = A ? at(A, f) : w ? at(w, w.from) : 0;
        if (w && !el.seeking && Math.abs(el.currentTime - to) > 0.04) el.currentTime = to;
      }
    }
    const dbg = (window as any).__atDebug;  // (the test bench: is each item at this frame heard, in time?)
    if (dbg) dbg[layer.id] = Object.entries(act).map(([copy, A]: any) => { const n = nodes.current[copy];
      return { copy, item: A.id, want: +at(A, f).toFixed(3), at: n ? +n.el.currentTime.toFixed(3) : -1, playing: n ? !n.el.paused : false,
        gain: n?.gain ? +n.gain.gain.value.toFixed(3) : -1, ready: n ? n.el.readyState : -1 }; });
  });
  return null;
};
