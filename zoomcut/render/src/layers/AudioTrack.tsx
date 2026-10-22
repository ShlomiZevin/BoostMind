// An audio layer in the EDITOR, live: moving, trimming, muting, gain, fades, the cleaning, clarity, speech level, the
// voice chain and every sound effect (filter, pitch, soften, room - render/ui/soundfx.ts) are heard at once; nothing
// is rebuilt. The graph is render/ui/layergraph.ts - the export renders the very same one offline (tools/audio_layers.mjs).
// Like VideoTrack: each source gets two persistent <audio> copies (clock.js - the next item's copy waits already
// seeked), following the Player's frame; the sources are downloaded once into memory (ui/preload.ts).
// Sources (pipeline/layers_audio.py): urls['<layer>|<asset>|<clean>'] = the take's sound cleaned only (off / mild /
// strong / fft / nn), at the mix's shared gain; levels[...] = its speech-level gain. The Noise switch picks one - instant.
// (An older project with only urls['<layer>|<asset>'] - cleaning x level x clarity baked in - plays that, as before.)
// Levels: sources come at the shared gain g; each clip is brought back to the track's own level (x 1/g) before its
// fx and the voice chain (they are level-dependent, the export runs them at that level) and the layer goes out x g.
import React, { useEffect, useMemo, useRef } from 'react';
import { useCurrentFrame } from 'remotion';
import { partsOf, activeParts, nextUses, copiesOf, srcAt } from './clock.js';
import { usePreloaded } from '../../ui/preload';
import { loadFx } from '../../ui/soundfx';
import { buildLayer, applyLayer, buildClip, applyClip, clipGainAt, LayerNodes, ClipNodes } from '../../ui/layergraph';
import { prepare, layerGainAt } from './automation.js';
import type { LayersProps } from '../Layers';

let shared: AudioContext | null = null;
let fxReady = false;
const audioCtx = () => {
  if (!shared) { shared = new AudioContext(); loadFx(shared).then(() => { fxReady = true; }); }
  return shared;
};

/** An item's gain at frame f (layergraph.ts clipGainAt). */
export const itemGain = (it: any, f: number, fps: number) => clipGainAt(it, (f - it.from) / fps, fps);

export const AudioTrack: React.FC<{ p: LayersProps; layer: any }> = ({ p, layer }) => {
  const f = useCurrentFrame();
  const fps = p.project.canvas.fps;
  const clean = layer.props?.clean || 'off';
  /** an asset's source for this layer: the cleaned-only file (new) or the older baked one */
  // (scaled: the studio's prepared sources carry the mix's shared gain; a take's own sound / a sound file as it is do not)
  const srcOf = (asset: string, c = clean) => {
    const k = `${layer.id}|${asset}|${c}`;
    if (p.urls[k]) return { url: p.urls[k], key: k, fresh: true, scaled: true };
    if (p.urls[`${layer.id}|${asset}`]) return { url: p.urls[`${layer.id}|${asset}`], key: '', fresh: false, scaled: true };
    return { url: p.urls[`${asset}:audio`] || p.urls[asset] || '', key: '', fresh: false, scaled: false };
  };
  const parts = useMemo(() => partsOf(layer.items, fps, () => 'audio'), [layer.items, fps]);
  const copies = useMemo(() => copiesOf(parts), [parts]);
  // in memory: the current cleaning of every asset in use, and the plain / RNNoise ones (the usual switches)
  const [blobs] = usePreloaded(useMemo(() => {
    const assets = [...new Set(Object.values(copies).map((k: string) => k.split(':')[0]))];
    return [...new Set(assets.flatMap((a) => [clean, 'off', 'nn'].map((c) => srcOf(a, c).url)).filter(Boolean))];
  }, [copies, p.urls, clean]));

  type Node = { el: HTMLAudioElement; clip?: ClipNodes; src: string; item?: string };
  const nodes = useRef<Record<string, Node>>({});
  const out = useRef<{ L: LayerNodes; gOut: GainNode; vol: GainNode } | null>(null);
  const live = useRef<any>({});
  const on = !layer.hidden && !layer.muted;
  const levels = (p as any).levels || {};
  const auto = useMemo(() => prepare(p.project, layer), [p.project.layers, layer]);  // ducks / lift, live from the other layers
  live.current = { parts, f, playing: !!(p as any).playing, rate: (p as any).playbackRate || 1, volume: on ? Math.max(0, layer.props?.volume ?? 1) : 0,
    props: layer.props || {}, g: Math.pow(10, ((p as any).gainDb ?? 0) / 20) };

  // the copies: made / pointed at their (in-memory) file as the items or the cleaning change; gone with the layer
  useEffect(() => {
    for (const [copy, key] of Object.entries(copies)) {
      const s = srcOf((key as string).split(':')[0]);
      const src = blobs[s.url] || s.url;
      const n = nodes.current[copy];
      if (!n) { const el = new Audio(); el.preload = 'auto'; el.crossOrigin = 'anonymous'; el.src = src; nodes.current[copy] = { el, src }; }
      else if (n.src !== src && src) { const t = n.el.currentTime; n.el.src = src; n.src = src; n.el.currentTime = t; }  // (the Noise switch: same place, other file)
    }
    for (const copy of Object.keys(nodes.current)) if (!(copy in copies)) { nodes.current[copy].el.pause(); nodes.current[copy].el.src = ''; delete nodes.current[copy]; }
  }, [copies, blobs]);
  useEffect(() => () => { for (const n of Object.values(nodes.current)) { n.el.pause(); n.el.src = ''; } nodes.current = {}; out.current?.vol.disconnect(); }, []);

  // into Web Audio once it may start (a browser starts sound only after a click - the first Play is one) and the
  // effects' worklet is loaded
  const wire = () => {
    const ctx = audioCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (!fxReady) return null;
    if (!out.current) {
      const vol = ctx.createGain(), gOut = ctx.createGain();
      gOut.connect(vol); vol.connect(ctx.destination);
      out.current = { L: buildLayer(ctx, gOut), gOut, vol };
      (window as any).__atTap?.(ctx, layer.id, vol);  // (tests: listen to one layer)
    }
    for (const n of Object.values(nodes.current)) {
      if (n.clip) continue;
      try { const c = buildClip(ctx, out.current.L); ctx.createMediaElementSource(n.el).connect(c.gain); n.clip = c; } catch {}
    }
    return ctx;
  };

  const sync = () => {
    const { parts, f, playing, rate, volume, props, g } = live.current;
    const act = activeParts(parts, f), waits = nextUses(parts, f);
    const ctx = playing || shared ? wire() : null;
    const o = out.current;
    const anyFresh = Object.values(copies).some((k: any) => srcOf(k.split(':')[0]).fresh);
    if (ctx && o) {
      o.vol.gain.setTargetAtTime(volume * layerGainAt(auto, f / fps), ctx.currentTime, 0.01);
      o.gOut.gain.setTargetAtTime(g, ctx.currentTime, 0.01);
      // clarity is live only over the cleaned-only sources (the older baked ones carry it already)
      applyLayer(o.L, { ...props, presence: anyFresh ? props.presence : 0 });
    }
    for (const [copy, n] of Object.entries(nodes.current)) {
      const A = act[copy], el = n.el;
      if (A && playing) {
        const want = srcAt(A, f, fps);
        const r = rate * (A.rate ?? 1);
        if (el.playbackRate !== r) el.playbackRate = r;
        const keep = (A.rate ?? 1) === 1;  // a sped-up / slowed clip is a tape (pitch follows); the project speed keeps the pitch
        if ((el as any).preservesPitch !== keep) (el as any).preservesPitch = keep;
        if (Math.abs(el.currentTime - want) > 0.08) el.currentTime = want;  // (sound drifts are heard sooner than picture)
        if (el.paused) el.play().catch(() => {});
        if (ctx && n.clip) {
          const s = srcOf(A.asset);
          const lv = s.fresh && props.level === 'speech' ? levels[s.key] ?? 1 : 1;
          applyClip(n.clip, A);
          n.clip.gain.gain.setTargetAtTime(itemGain(A, f, fps) * lv / (s.scaled ? g : 1), ctx.currentTime, 0.006);
        }
      } else {
        if (ctx && n.clip) n.clip.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.004);  // (out, without a click)
        if (!el.paused) el.pause();
        const w = A || waits[copy];  // paused: waits where it will play
        if (w && n.clip) applyClip(n.clip, w);  // (its fx ready before it starts)
        const to = A ? srcAt(A, f, fps) : w ? srcAt(w, w.from, fps) : 0;
        if (w && !el.seeking && Math.abs(el.currentTime - to) > 0.04) el.currentTime = to;
      }
    }
    const dbg = (window as any).__atDebug;  // (the test bench: is each item at this frame heard, in time?)
    if (dbg) dbg[layer.id] = Object.entries(act).map(([copy, A]: any) => { const n = nodes.current[copy];
      return { copy, item: A.id, want: +srcAt(A, f, fps).toFixed(3), at: n ? +n.el.currentTime.toFixed(3) : -1, playing: n ? !n.el.paused : false,
        gain: n?.clip ? +n.clip.gain.gain.value.toFixed(3) : -1, ready: n ? n.el.readyState : -1 }; });
  };
  useEffect(sync);
  return null;
};
