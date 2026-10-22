// An audio layer in the EDITOR, live: moving, trimming, muting, a gain or a fade shows up at once - no stems made
// again. Like VideoTrack: each source gets two persistent <audio> copies (clock.js - the next item's copy waits
// already seeked), following the Player's frame; every source is downloaded once into memory (ui/preload.ts).
// Each copy -> its own gain (the item's gain x fade in x fade out, ramped so a cut never clicks) -> the layer's gain
// (volume, muted / hidden) -> the speakers, through one shared Web Audio context (made on the first play).
// The source: urls['<layer>|<asset>'] = the studio's prepared file (cleaning x level x master, pipeline/layers_audio.py),
// else urls['<asset>:audio'] (the take's own sound). The export mixes in python (layers_audio.py) - same gains.
import React, { useEffect, useMemo, useRef } from 'react';
import { useCurrentFrame } from 'remotion';
import { partsOf, activeParts, nextUses, copiesOf, srcAt } from './clock.js';
import { usePreloaded } from '../../ui/preload';
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
  const urlOf = (asset: string) => p.urls[`${layer.id}|${asset}`] || p.urls[`${asset}:audio`] || '';
  const parts = useMemo(() => partsOf(layer.items, fps, () => 'audio'), [layer.items, fps]);
  const copies = useMemo(() => copiesOf(parts), [parts]);
  const [blobs] = usePreloaded(useMemo(() => [...new Set(Object.values(copies).map((k: string) => urlOf(k.split(':')[0])).filter(Boolean))], [copies, p.urls]));

  type Node = { el: HTMLAudioElement; gain?: GainNode; src: string };
  const nodes = useRef<Record<string, Node>>({});
  const layerGain = useRef<GainNode | null>(null);
  const live = useRef<any>({});
  const on = !layer.hidden && !layer.muted;
  live.current = { parts, f, playing: !!(p as any).playing, rate: (p as any).playbackRate || 1, volume: on ? Math.max(0, layer.props?.volume ?? 1) : 0 };

  // the copies: made / pointed at their (in-memory) file as the items change; gone with the layer
  useEffect(() => {
    for (const [copy, key] of Object.entries(copies)) {
      const u = urlOf((key as string).split(':')[0]);
      const src = blobs[u] || u;
      const n = nodes.current[copy];
      if (!n) { const el = new Audio(); el.preload = 'auto'; el.crossOrigin = 'anonymous'; el.src = src; nodes.current[copy] = { el, src }; }
      else if (n.src !== src && src) { n.el.src = src; n.src = src; }
    }
    for (const copy of Object.keys(nodes.current)) if (!(copy in copies)) { nodes.current[copy].el.pause(); nodes.current[copy].el.src = ''; delete nodes.current[copy]; }
  }, [copies, blobs]);
  useEffect(() => () => { for (const n of Object.values(nodes.current)) { n.el.pause(); n.el.src = ''; } nodes.current = {}; layerGain.current?.disconnect(); }, []);

  // into Web Audio once it may start (a browser starts sound only after a click - the first Play is one)
  const wire = () => {
    const ctx = audioCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (!layerGain.current) { layerGain.current = ctx.createGain(); layerGain.current.connect(ctx.destination); }
    for (const n of Object.values(nodes.current)) {
      if (n.gain) continue;
      try { const g = ctx.createGain(); g.gain.value = 0; ctx.createMediaElementSource(n.el).connect(g); g.connect(layerGain.current); n.gain = g; } catch {}
    }
    return ctx;
  };

  useEffect(() => {
    const { parts, f, playing, rate, volume } = live.current;
    const act = activeParts(parts, f), waits = nextUses(parts, f);
    const ctx = playing || shared ? wire() : null;
    if (ctx && layerGain.current) layerGain.current.gain.setTargetAtTime(volume, ctx.currentTime, 0.01);
    for (const [copy, n] of Object.entries(nodes.current)) {
      const A = act[copy], el = n.el;
      if (A && playing) {
        const want = srcAt(A, f, fps);
        const r = rate * (A.rate ?? 1);
        if (el.playbackRate !== r) el.playbackRate = r;
        if (Math.abs(el.currentTime - want) > 0.08) el.currentTime = want;  // (sound drifts are heard sooner than picture)
        if (el.paused) el.play().catch(() => {});
        if (ctx && n.gain) n.gain.gain.setTargetAtTime(itemGain(A, f, fps), ctx.currentTime, 0.006);
      } else {
        if (ctx && n.gain) n.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.004);  // (out, without a click)
        if (!el.paused) el.pause();
        const w = A || waits[copy];  // paused: waits where it will play
        const at = A ? srcAt(A, f, fps) : (w?.in ?? 0);
        if (w && !el.seeking && Math.abs(el.currentTime - at) > 0.04) el.currentTime = at;
      }
    }
    const dbg = (window as any).__atDebug;  // (the test bench: is each item at this frame heard, in time?)
    if (dbg) dbg[layer.id] = Object.entries(act).map(([copy, A]: any) => { const n = nodes.current[copy];
      return { copy, item: A.id, want: +srcAt(A, f, fps).toFixed(3), at: n ? +n.el.currentTime.toFixed(3) : -1, playing: n ? !n.el.paused : false,
        gain: n?.gain ? +n.gain.gain.value.toFixed(3) : -1, ready: n ? n.el.readyState : -1 }; });
  });
  return null;
};
