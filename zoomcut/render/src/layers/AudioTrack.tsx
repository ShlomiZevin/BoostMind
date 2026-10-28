// An audio layer in the EDITOR, live: moving, trimming, muting, gain, fades, the cleaning, clarity, speech level, the
// voice chain and every sound effect (filter, pitch, soften, room - render/ui/soundfx.ts) are heard at once; nothing
// is rebuilt. The graph is render/ui/layergraph.ts - the export renders the very same one offline (tools/audio_layers.mjs).
// Sound from memory on one clock: each source decoded once into an AudioBuffer (sped up by the studio, pitch kept, when
// the project speed applies), every clip scheduled on the audio clock from Play / a jump / an edit; clock.js still
// splits the items into copies (each copy = one clip graph its sources play into).
// Sources (pipeline/layers_audio.py): urls['<layer>|<asset>|<clean>'] = the take's sound cleaned only (off / mild /
// strong / fft / nn), at the mix's shared gain; levels[...] = its speech-level gain. The Noise switch picks one - instant.
// (An older project with only urls['<layer>|<asset>'] - cleaning x level x clarity baked in - plays that, as before.)
// Levels: sources come at the shared gain g; each clip is brought back to the track's own level (x 1/g) before its
// fx and the voice chain (they are level-dependent, the export runs them at that level) and the layer goes out x g.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCurrentFrame } from 'remotion';
import { partsOf, activeParts, nextUses, copiesOf, srcAt } from './clock.js';
// a clip's source time when the project's speed doesn't apply to it: the timeline runs `speed` x faster than real time
const ownAt = (A: any, f: number, fps: number, speed: number) => (A.in ?? 0) + ((f - A.from) / fps) * (A.rate ?? 1) / (speed || 1);
import { loadFx } from '../../ui/soundfx';
import { buildLayer, applyLayer, buildClip, applyClip, clipGainAt, LayerNodes, ClipNodes } from '../../ui/layergraph';
import { prepare, layerGainAt } from './automation.js';
import type { LayersProps } from '../Layers';

let shared: AudioContext | null = null;
let fxReady = false;
// 'playback' (2026-10-28): Chrome's larger output buffers - the smallest ('interactive', the default) kept the audio
// thread on a ~10 ms deadline and the shared Windows output underran: his Google Meet in another tab broke up. The
// picture already allows for the delay (LayersEditor: the clock minus baseLatency + outputLatency).
const audioCtx = () => {
  if (!shared) { shared = new AudioContext({ latencyHint: 'playback' }); (window as any).__zcCtx = shared; loadFx(shared).then(() => { fxReady = true; }); rest(); }
  return shared;
};
// the context runs only while something plays: woken by Play, put to sleep a second after the last layer stops. It
// ran forever after the first Play before - every layer's and clip's graph rendered silence on the audio thread,
// paused or not
const playingLayers = new Set<string>();
let idleT = 0;
const wake = (ctx: AudioContext) => { clearTimeout(idleT); if (ctx.state === 'suspended') ctx.resume().catch(() => {}); };
function rest() {
  clearTimeout(idleT);
  idleT = window.setTimeout(() => { if (!playingLayers.size && shared?.state === 'running') shared.suspend().catch(() => {}); }, 1000);
}
// an AudioParam glides to v only when that is a new target (sync runs every frame for every clip: the same target
// again and again was a stream of automation events to the audio thread)
const glide = (p: AudioParam, v: number, at: number, tc: number) => { const q = p as any; if (q._zcT === v) return; q._zcT = v; p.setTargetAtTime(v, at, tc); };
const forget = (p: AudioParam, at: number) => { p.cancelScheduledValues(at); (p as any)._zcT = undefined; };
// every sound layer into ONE bus with a safety limiter before the speakers - as the export has. Layers straight to the
// speakers summed over full scale and clipped: crackle ("snow") with a few layers on, measured 176 samples over 1.0 in
// 12 s of haredit-1 (2026-10-27). Same settings as the one-camera editor's (ui/sound.ts buildMix)
let bus: AudioNode | null = null;
const masterBus = (ctx: AudioContext) => {
  if (!bus) {
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -3.5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
    lim.connect(ctx.destination);
    bus = lim;
  }
  return bus;
};

// THE clock while playing: the sound's (the audio clock runs true; the picture falls behind when the computer is busy
// and catches up in bursts). Every layer schedules from it; the editor keeps the picture on it (LayersEditor) - the
// way a video player keeps the picture on the sound.
export const soundClock = { on: false, t0: 0, f0: 0, perSec: 0, jump: 0, jumpF: 0 };
/** The frame the sound is at now, while playing (null when stopped). */
export const clockFrame = () => (soundClock.on && shared ? soundClock.f0 + Math.max(0, shared.currentTime - soundClock.t0) * soundClock.perSec : null);
/** HIS jump to frame f (the bar, the arrows, a note): the only thing that moves the sound while it plays. The clock is
 *  there at once (the picture follows it) and every layer re-schedules from f. Before, the sound re-synced to the
 *  picture whenever they were 15 frames apart - a picture held up by decoding pulled the sound back: a jump heard. */
export const soundJump = (f: number) => {
  soundClock.jump++; soundClock.jumpF = f;
  if (soundClock.on && shared) Object.assign(soundClock, { f0: f, t0: shared.currentTime + 0.03 });
};

// decoded sound files, shared by every layer, kept while a layer uses them (a 6-minute voice is ~70 MB decoded)
const buffers = new Map<string, Promise<AudioBuffer | null>>();
const users = new Map<string, number>();
// what his browser does with the sound - LayersEditor sends it to the studio each second while playing (the sound
// report, episodes/_sound.jsonl): which files are in, re-schedules and why, failed files
// why = events (one Play / jump / edit, however many layers it re-schedules); starts = per layer (as before 2026-10-28)
export const soundDiag = { layers: {} as Record<string, { need: number; ready: number; clips: number }>, why: {} as Record<string, number>,
  starts: {} as Record<string, number>, failed: [] as string[] };
let lastEv = '';
const count = (why: string, f: number) => {
  soundDiag.starts[why] = (soundDiag.starts[why] || 0) + 1;
  const k = `${why}@${Math.round(f)}@${soundClock.jump}`;
  if (k !== lastEv) { lastEv = k; soundDiag.why[why] = (soundDiag.why[why] || 0) + 1; }
};
const loadBuffer = (u: string) => {
  if (!buffers.has(u)) buffers.set(u, fetch(u).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
    .then((a) => audioCtx().decodeAudioData(a)).catch((e) => { soundDiag.failed.push(`${String(u).replace(/^.*[?&]p=/, '').slice(0, 80)}: ${e}`); setTimeout(() => buffers.delete(u), 3000); return null; }));
  return buffers.get(u)!;
};
const hold = (us: string[]) => { for (const u of us) users.set(u, (users.get(u) || 0) + 1); };
const release = (us: string[]) => {
  for (const u of us) users.set(u, (users.get(u) || 1) - 1);
  setTimeout(() => { for (const u of us) if (!users.get(u)) { users.delete(u); buffers.delete(u); } }, 30000);
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
  // sound from MEMORY on ONE clock (2026-10-27, his: "I can't work with an editor which can't play multiple audio layers
  // normally"): every file decoded once into an AudioBuffer - at the project's speed, pitch kept, made by the studio
  // (/pm-tempo - ffmpeg atempo, the filter the export speeds its mix with) - and every clip SCHEDULED on the audio clock
  // when Play starts (and again after a jump or an edit). The old way - an <audio> per clip chased by a sync loop - went
  // silent whenever one had to load or catch up. The graph (layergraph.ts: gains, fades, fx, voice chain) is the same.
  const speed = (p as any).playbackRate || 1;
  const own = !!layer.props?.own_pace;
  const bufUrl = (asset: string) => {  // the file this layer plays an asset from: sped up when the project speed applies
    const u = srcOf(asset).url;
    return !u || own || speed === 1 || !u.includes('/pm/') ? u : `${u.replace('/pm/', '/pm-tempo/')}&s=${speed}`;
  };
  const stretch = (asset: string) => (bufUrl(asset) !== srcOf(asset).url ? speed : 1);  // the buffer's own speed
  const [bufs, setBufs] = useState<Record<string, AudioBuffer | null>>({});
  const want = useMemo(() => [...new Set(Object.values(copies).map((k: string) => bufUrl(k.split(':')[0])).filter(Boolean))], [copies, p.urls, clean, speed, own]);
  useEffect(() => {
    let alive = true;
    for (const u of want) if (!bufs[u]) loadBuffer(u).then((b) => alive && setBufs((o) => ({ ...o, [u]: b })));
    hold(want);
    return () => { alive = false; release(want); };
  }, [want.join('|')]);

  type Node = { clip?: ClipNodes };
  const nodes = useRef<Record<string, Node>>({});
  const out = useRef<{ L: LayerNodes; gOut: GainNode; vol: GainNode } | null>(null);
  const sched = useRef<{ t0: number; f0: number; sig: string; jump: number; srcs: AudioBufferSourceNode[] } | null>(null);
  // the buffer each asset last played from: a new source (the cleaning switched, a sound re-made) keeps playing the old
  // one until it is decoded - the layer went silent for that wait before
  const lastBuf = useRef<Record<string, { b: AudioBuffer; sb: number }>>({});
  const live = useRef<any>({});
  const on = !layer.hidden && !layer.muted;
  const levels = (p as any).levels || {};
  const auto = useMemo(() => prepare(p.project, layer), [p.project.layers, layer]);  // ducks / lift, live from the other layers
  // what the schedule depends on: a change of any of it while playing re-schedules from where it is
  const sig = useMemo(() => JSON.stringify([parts.map((x: any) => [x.copy, x.from, x.dur, x.in, x.rate, x.asset]), want.map((u) => !!bufs[u]), speed, own]), [parts, want, bufs, speed, own]);
  live.current = { parts, f, playing: !!(p as any).playing, rate: speed, volume: on ? Math.max(0, layer.props?.volume ?? 1) : 0,
    props: layer.props || {}, g: Math.pow(10, ((p as any).gainDb ?? 0) / 20), sig };

  useEffect(() => {
    for (const copy of Object.keys(nodes.current)) if (!(copy in copies)) delete nodes.current[copy];
  }, [copies]);
  useEffect(() => () => { stopAll(); nodes.current = {}; out.current?.vol.disconnect(); }, []);

  // into Web Audio once it may start (a browser starts sound only after a click - the first Play is one) and the
  // effects' worklet is loaded: the layer's graph, and each copy's clip graph (its gain + fx) the sources go into
  // (wiring never wakes the context - only Play does, in sync)
  const wire = () => {
    const ctx = audioCtx();
    if (!fxReady) return null;
    if (!out.current) {
      const vol = ctx.createGain(), gOut = ctx.createGain();
      gOut.connect(vol); vol.connect(masterBus(ctx));
      out.current = { L: buildLayer(ctx, gOut), gOut, vol };
      (window as any).__atTap?.(ctx, layer.id, vol);  // (tests: listen to one layer)
    }
    for (const copy of Object.keys(copies)) {
      const n = (nodes.current[copy] ||= {});
      if (!n.clip) n.clip = buildClip(ctx, out.current.L);
    }
    return ctx;
  };
  function stopAll() {
    const s = sched.current;
    sched.current = null;
    soundClock.on = false;  (window as any).__atSched?.push({ layer: layer.id, why: 'stop', playing: live.current.playing });
    if (playingLayers.delete(layer.id) && !playingLayers.size) rest();
    if (!s) return;
    const ctx = audioCtx();
    for (const n of Object.values(nodes.current)) if (n.clip) { forget(n.clip.gain.gain, ctx.currentTime); glide(n.clip.gain.gain, 0, ctx.currentTime, 0.004); }
    for (const x of s.srcs) { try { x.stop(ctx.currentTime + 0.02); } catch {} }  // (after the gain is down: no click)
  }
  // every clip from frame f on, on the audio clock: when it starts, where in its buffer, at what rate, for how long
  const schedule = (ctx: AudioContext, f: number) => {
    const { parts, rate, props, g } = live.current;
    const old = sched.current?.srcs || [];
    const now = ctx.currentTime + 0.03;
    const srcs: AudioBufferSourceNode[] = [];
    for (const n of Object.values(nodes.current)) if (n.clip) forget(n.clip.gain.gain, now);
    for (const P of parts as any[]) {
      const end = P.from + P.dur, pr = P.rate ?? 1, n = nodes.current[P.copy];
      if (end <= f || pr <= 1e-6 || !n?.clip) continue;
      const sb = stretch(P.asset), was = lastBuf.current[P.asset];
      const b = bufs[bufUrl(P.asset)] || (was && was.sb === sb ? was.b : null);
      if (!b) continue;  // (still loading: it joins when it lands - the sig changes)
      lastBuf.current[P.asset] = { b, sb };
      const sf = Math.max(P.from, f);
      const when = now + (sf - f) / fps / rate;  // the timeline runs `rate` x faster than real time
      let off: number, r: number, len: number;
      if (props.own_pace && rate !== 1) { off = ownAt(P, sf, fps, rate); r = pr; len = ((end - sf) / fps / rate) * pr; }
      else { off = srcAt(P, sf, fps) / sb; r = pr * (rate / sb); len = ((end - sf) / fps) * pr / sb; }
      if (off >= b.duration || len <= 0) continue;
      const x = ctx.createBufferSource();
      x.buffer = b; x.playbackRate.value = r;
      x.connect(n.clip.gain);
      x.start(when, Math.max(0, off), len);
      srcs.push(x);
      if (P.from > f) {  // its gain opens exactly when it starts (the per-frame gain follows from the next frame)
        const s = srcOf(P.asset), lv = s.fresh && props.level === 'speech' ? levels[s.key] ?? 1 : 1;
        n.clip.gain.gain.setTargetAtTime(itemGain(P, P.from, fps) * lv / (s.scaled ? g : 1), when, 0.003);
      }
    }
    for (const x of old) { try { x.stop(now); } catch {} }  // (the new ones take over at the same moment)
    sched.current = { t0: now, f0: f, sig: live.current.sig, jump: soundClock.jump, srcs };
    playingLayers.add(layer.id);
    soundDiag.layers[layer.id] = { need: want.length, ready: want.filter((u) => bufs[u]).length, clips: srcs.length };
    Object.assign(soundClock, { on: true, t0: now, f0: f, perSec: fps * rate });
  };

  const sync = () => {
    const { parts, f, playing, rate, volume, props, g, sig } = live.current;
    const act = activeParts(parts, f), waits = nextUses(parts, f);
    const ctx = playing || shared ? wire() : null;
    if (ctx && playing) wake(ctx);
    const o = out.current;
    const anyFresh = Object.values(copies).some((k: any) => srcOf(k.split(':')[0]).fresh);
    if (ctx && o) {
      glide(o.vol.gain, volume * layerGainAt(auto, f / fps), ctx.currentTime, 0.01);
      glide(o.gOut.gain, g, ctx.currentTime, 0.01);
      // clarity is live only over the cleaned-only sources (the older baked ones carry it already)
      applyLayer(o.L, { ...props, presence: anyFresh ? props.presence : 0 });
    }
    if (ctx && playing && ctx.state === 'running') {
      // (re)schedule: Play, his jump (soundJump - from where he jumped to), an edit, a file that landed. The picture
      // never moves the sound: LayersEditor keeps it on the sound. Only a gap of 3 s+ (the picture lost for good) re-syncs
      const s = sched.current;
      const at = s ? s.f0 + Math.max(0, ctx.currentTime - s.t0) * fps * rate : NaN;
      const jumped = !!s && s.jump !== soundClock.jump;
      if (!s || s.sig !== sig || jumped || !(Math.abs(at - f) <= fps * 3)) {
        const why = !s ? 'play' : jumped ? 'jump' : s.sig !== sig ? 'change' : 'drift';
        const from = jumped ? soundClock.jumpF : f;
        count(why, from);
        (window as any).__atSched?.push({ layer: layer.id, why, f: from, at: Math.round(at) });  // (the test bench)
        schedule(ctx, from);
      }
    } else if (!playing && sched.current) stopAll();
    for (const [copy, n] of Object.entries(nodes.current)) {
      const A = act[copy];
      if (!ctx || !n.clip) continue;
      if (A && playing) {
        const s = srcOf(A.asset);
        const lv = s.fresh && props.level === 'speech' ? levels[s.key] ?? 1 : 1;
        applyClip(n.clip, A);
        glide(n.clip.gain.gain, itemGain(A, f, fps) * lv / (s.scaled ? g : 1), ctx.currentTime, 0.006);
      } else {
        if (playing) glide(n.clip.gain.gain, 0, ctx.currentTime, 0.004);  // (out, without a click)
        const w = A || waits[copy];
        if (w) applyClip(n.clip, w);  // (its fx ready before it starts)
      }
    }
    const dbg = (window as any).__atDebug;  // (the test bench: is each item at this frame heard?)
    if (dbg) dbg[layer.id] = Object.entries(act).map(([copy, A]: any) => { const n = nodes.current[copy];
      return { copy, item: A.id, want: +srcAt(A, f, fps).toFixed(3), playing: !!(playing && sched.current), ready: bufs[bufUrl(A.asset)] ? 4 : 0,
        gain: n?.clip ? +n.clip.gain.gain.value.toFixed(3) : -1 }; });
  };
  useEffect(sync);
  return null;
};
