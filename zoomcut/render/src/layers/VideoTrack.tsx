// A video layer in the EDITOR, played the way the editor needs it: seamless cuts and every edit live.
// Not one <OffthreadVideo> per item (every cut would mount and seek a new element - an empty or old frame at each
// cut): each asset gets two persistent <video> copies (clock.js decides which plays which item), kept on screen and
// hidden by opacity (never unmounted / visibility:hidden - Chrome drops a hidden video's frame), the next item's copy
// waits already seeked, and a copy is shown only once its frame is decoded - till then the last frame holds.
// The copies follow the Player's frame: playing = they play (corrected when they drift), paused / a jump = an exact
// seek. Every asset is downloaded once into memory (ui/preload.ts) - no empty frame where the browser hadn't fetched.
// The export never uses this (its videos go through ffmpeg); a still rendered by Remotion gets OffthreadVideo.
import React, { useEffect, useMemo, useRef } from 'react';
import { Img, OffthreadVideo, Sequence, getRemotionEnvironment, staticFile, useCurrentFrame } from 'remotion';
import { fitBox, backdropBox, itemOpacity } from './geometry.js';
import { partsOf, activeAt, activeParts, nextUses, copiesOf, srcAt } from './clock.js';
import { usePreloaded } from '../../ui/preload';
import type { LayersProps } from '../Layers';

const lookFilter = (l?: any) => (l && Object.keys(l).length ? `saturate(${l.saturate ?? 1}) contrast(${l.contrast ?? 1}) brightness(${l.brightness ?? 1})` : undefined);

// lag: drawn that many frames back (the Ghost trail effect lays such a copy over the picture - its own copies)
export const VideoTrack: React.FC<{ p: LayersProps; layer: any; backdrop: any; lag?: number }> = ({ p, layer, backdrop, lag = 0 }) => {
  const f = Math.max(0, useCurrentFrame() - lag);
  const fps = p.project.canvas.fps;
  const assets = p.project.assets || {};
  // a cut-out over its photo (the backdrop) plays the transparent "fg" file; otherwise the preview (or the source)
  const bdImg = backdrop?.props?.asset && assets[backdrop.props.asset] ? backdrop : null;
  // eye contact (props.eyes, default on when the take has it): the corrected copy of the same frames - "eyes" / "eyes_fg"
  const variantOf = (it: any) => {
    const r = { ...(layer.props || {}), ...it };
    const cut = bdImg && r.cutout !== false && p.urls[`${it.asset}:fg`];
    const eyes = r.eyes !== false && p.urls[`${it.asset}:${cut ? 'eyes_fg' : 'eyes'}`];
    return cut ? (eyes ? 'eyes_fg' : 'fg') : (eyes ? 'eyes' : 'preview');
  };
  const parts = useMemo(() => partsOf(layer.items, fps, variantOf), [layer.items, layer.props, fps, !!bdImg, p.urls]);
  const copies = useMemo(() => copiesOf(parts), [parts]);
  const urlOf = (key: string) => {  // "asset:variant" -> the file
    const [asset, variant] = key.split(':');
    return p.urls[`${asset}:${variant}`] || p.urls[asset] || '';
  };
  // (the other eyes version is held in memory too, so Original / Corrected switches without a wait)
  const other = (key: string) => { const [a, v] = key.split(':'); const o = { eyes: 'preview', preview: 'eyes', eyes_fg: 'fg', fg: 'eyes_fg' }[v]; return o && p.urls[`${a}:${o}`] ? `${a}:${o}` : ''; };
  const [blobs] = usePreloaded(useMemo(() => [...new Set(Object.values(copies).flatMap((k: string) => [urlOf(k), other(k) && urlOf(other(k))]).filter(Boolean))], [copies, p.urls]));

  const els = useRef<Record<string, HTMLVideoElement | null>>({});
  const boxes = useRef<Record<string, HTMLDivElement | null>>({});
  const lit = useRef<Record<string, any>>({});  // the copies on screen now -> the item each shows
  const litOpacity = (it: any, f: number) => itemOpacity(it, layer.props || {}, Math.min(f, it.from + it.dur - 1), fps);
  // stacking: an item's z first, then its order (the later of two overlapping items is on top - it fades in over)
  const stackOf = (it: any, parts: any[]) => (it.z ?? 0) * 10000 + parts.indexOf(parts.find((x: any) => x.id === it.id)) + 1;
  const live = useRef<any>({});
  live.current = { parts, f, playing: !!(p as any).playing, rate: (p as any).playbackRate || 1 };  // (LayersProps.playing / playbackRate: the editor sets them)

  // keep each copy where it should be, and light the ones on screen (direct DOM: no extra React render per frame).
  // Items may overlap (a dissolve: the next one fades in over the one ending) - every item at this frame plays,
  // each in its copy, the later one on top.
  const sync = () => {
    const { parts, f, playing, rate } = live.current;
    const act = activeParts(parts, f);
    const waits = nextUses(parts, f);
    for (const copy of Object.keys(copies)) {
      const el = els.current[copy];
      if (!el) continue;
      const A = act[copy];
      if (A) {
        const want = Math.min(srcAt(A, f, fps), (el.duration || Infinity) - 0.04);
        const r = rate * (A.rate ?? 1);
        if (el.playbackRate !== r) el.playbackRate = r;
        if (!el.seeking && Math.abs(el.currentTime - want) > (playing ? 0.25 : 0.5 / fps)) el.currentTime = want;
        if (playing) { if (el.paused) el.play().catch(() => {}); } else if (!el.paused) el.pause();
      } else {
        if (!el.paused) el.pause();  // (an old copy freezes on its last frame - never plays on past its cut)
        const n = waits[copy];
        if (n && !el.seeking && Math.abs(el.currentTime - (n.in ?? 0)) > 0.04) el.currentTime = n.in ?? 0;
      }
    }
    // on screen: an active copy once its frame is there (one already lit stays lit while it seeks); while a new one is
    // still coming and nothing of the layer is lit, the copies lit before hold their last frame
    const before = lit.current, now: Record<string, any> = {};
    for (const [copy, A] of Object.entries(act)) {
      const el = els.current[copy];
      if (before[copy] || (el && el.readyState >= 2 && !el.seeking)) now[copy] = A;
    }
    if (Object.keys(act).length && !Object.keys(now).length) Object.assign(now, before);
    lit.current = now;
    const dbg = (window as any).__vtDebug;  // (tools/flicker_test.mjs: what it meant to show)
    if (dbg) dbg[layer.id] = { f, active: Object.keys(act).join(','), lit: Object.keys(now).join(','), playing };
    for (const copy of Object.keys(copies)) {
      const b = boxes.current[copy];
      if (!b) continue;
      const it = now[copy];
      b.style.opacity = it ? String(litOpacity(it, f)) : '0';
      if (it) b.style.zIndex = String(stackOf(it, parts));
    }
  };
  useEffect(sync);  // every frame the Player draws
  // one ref callback per copy (a new one each frame would re-attach listeners every frame); listeners once per element
  const refFns = useRef<Record<string, (el: HTMLVideoElement | null) => void>>({});
  const hooked = useRef(new WeakSet<HTMLVideoElement>());
  const syncRef = useRef(sync);
  syncRef.current = sync;
  const refEl = (copy: string) => (refFns.current[copy] ??= (el) => {
    if (el && !hooked.current.has(el)) {
      hooked.current.add(el);
      for (const ev of ['loadeddata', 'seeked', 'canplay']) el.addEventListener(ev, () => syncRef.current());
    }
    els.current[copy] = el;
  });

  if (getRemotionEnvironment().isRendering) return <StillRun p={p} layer={layer} parts={parts} f={f} bd={bdImg} />;

  // each copy sits in the box of the item it plays now (or waits for); its geometry is that item's
  const act = activeParts(parts, f);
  const waits = nextUses(parts, f);
  return <>
    {Object.entries(copies).map(([copy, key]) => {
      const it = act[copy] || waits[copy] || parts.filter((x: any) => x.copy === copy).at(-1);
      const props = { ...(layer.props || {}), ...it };
      const asset = assets[it.asset];
      const box = it.box || layer.props?.box;
      if (!asset || !box) return null;
      const b = fitBox(asset, box, props);
      const src = blobs[urlOf(key)] || urlOf(key);
      const fg = key.endsWith(':fg');
      return (
        <div key={copy} data-layer={layer.id} data-copy={copy} ref={(el) => { boxes.current[copy] = el; }} style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h,
          overflow: 'hidden', borderRadius: props.radius ?? 0, pointerEvents: 'none',
          // (React draws what the clock decided last - a re-render never puts out a lit copy; sync() then corrects it)
          zIndex: lit.current[copy] ? stackOf(lit.current[copy], parts) : (it.z ?? 0) * 10000,
          opacity: lit.current[copy] ? litOpacity(lit.current[copy], f) : 0 }}>
          {fg ? (
            <div style={{ position: 'absolute', left: b.left, top: b.top, width: b.width, height: b.height, overflow: 'hidden', filter: lookFilter(props.look) }}>
              {(() => {
                const img = assets[bdImg.props.asset];
                const g = backdropBox(img, b.width, b.height, bdImg.props, { x0: -b.left, y0: -b.top, w: box.w, h: box.h });
                const u = p.urls[bdImg.props.asset];
                return <img src={u} alt="" style={{ position: 'absolute', left: g.left, top: g.top, width: g.width, height: g.height, maxWidth: 'none' }} />;
              })()}
              <video ref={refEl(copy)} src={src} muted playsInline preload="auto"
                style={{ position: 'absolute', left: 0, top: 0, width: b.width, height: b.height, maxWidth: 'none' }} />
            </div>
          ) : (
            <video ref={refEl(copy)} src={src} muted playsInline preload="auto"
              style={{ position: 'absolute', left: b.left, top: b.top, width: b.width, height: b.height, maxWidth: 'none', filter: lookFilter(props.look) }} />
          )}
        </div>
      );
    })}
  </>;
};

// a still rendered by Remotion (not the editor, not the export's videos): the item at this frame, frame-exact
const StillRun: React.FC<{ p: LayersProps; layer: any; parts: any[]; f: number; bd: any }> = ({ p, layer, parts, f, bd }) => {
  const ai = activeAt(parts, f);
  if (ai < 0) return null;
  const it = parts[ai], props = { ...(layer.props || {}), ...it };
  const asset = p.project.assets[it.asset], box = it.box || layer.props?.box;
  if (!asset || !box) return null;
  const b = fitBox(asset, box, props);
  const u = (k: string) => (p.urls[k] ? (p.static ? staticFile(p.urls[k]) : p.urls[k]) : '');
  const startFrom = Math.round((it.in ?? 0) * p.project.canvas.fps);
  return (
    <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, overflow: 'hidden', borderRadius: props.radius ?? 0,
      opacity: itemOpacity(it, layer.props || {}, f, p.project.canvas.fps), zIndex: it.z ?? 0 }}>
      {it.key.endsWith(':fg') ? (
        <div style={{ position: 'absolute', left: b.left, top: b.top, width: b.width, height: b.height, overflow: 'hidden', filter: lookFilter(props.look) }}>
          {(() => { const img = p.project.assets[bd.props.asset]; const g = backdropBox(img, b.width, b.height, bd.props, { x0: -b.left, y0: -b.top, w: box.w, h: box.h });
            return <Img src={u(bd.props.asset)} style={{ position: 'absolute', left: g.left, top: g.top, width: g.width, height: g.height, maxWidth: 'none' }} />; })()}
          <Sequence from={it.from} layout="none"><OffthreadVideo src={u(`${it.asset}:fg`)} transparent startFrom={startFrom} muted playbackRate={it.rate ?? 1}
            style={{ position: 'absolute', left: 0, top: 0, width: b.width, height: b.height, maxWidth: 'none' }} /></Sequence>
        </div>
      ) : (
        <Sequence from={it.from} layout="none"><OffthreadVideo src={u(`${it.asset}:preview`) || u(it.asset)} startFrom={startFrom} muted playbackRate={it.rate ?? 1}
          style={{ position: 'absolute', left: b.left, top: b.top, width: b.width, height: b.height, maxWidth: 'none', filter: lookFilter(props.look) }} /></Sequence>
      )}
    </div>
  );
};
