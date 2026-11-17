// Film effects in the editor: the picture below the top-most effect layer, moved and coloured live (effect_curve.js ->
// render/ui/fx.js), with the vignette / grain / flash / black over it and under the texts. The export does the same
// with the same curve on the composited frames (pipeline/film_fx.py), in the same order:
//   ghost (the picture `lag` frames back, laid over at its strength) -> camera -> colour + light -> vignette -> grain
//   -> flash -> black
// Layers.tsx: <EffectWrap p={p} f={frame} below={(lag) => the layers below the top effect, drawn `lag` frames back} />
import React, { useEffect, useRef } from 'react';
import { AbsoluteFill } from 'remotion';
import { effectCss, glitchPlan, pixelBlock } from './effect_curve.js';
import type { LayersProps } from '../Layers';

function Grain({ f, opacity }: { f: number; opacity: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {  // a fresh field every other frame, the same field for the same frame (seeded)
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d')!, img = g.createImageData(c.width, c.height);
    let s = (Math.floor(f / 2) * 2654435761) >>> 0;
    const r = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    for (let i = 0; i < img.data.length; i += 4) { const v = 128 + (r() + r() + r() - 1.5) * 120; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
  }, [Math.floor(f / 2)]);
  return <canvas ref={ref} width={270} height={480} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', mixBlendMode: 'overlay', opacity }} />;
}

// the screen glitch (effect_curve.js glitchPlan - the export applies the same plan in film_fx.py _glitch): ONE SVG filter
// on the picture - the red pulled one way and the blue the other, then bands of that torn sideways - plus a few lines of
// static over it. Never copies of the picture: each copy of the layers below starts its own video players, and a glitch
// that mounted them frame by frame froze the editor while playing (the signal-lost ending, 2026-11-17).
const ONLY = { R: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', G: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', B: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0' };
const STATIC = 'repeating-linear-gradient(90deg, #fff 0 3px, #777 3px 5px, #111 5px 9px, #ccc 9px 11px, #333 11px 16px)';
const GlitchFilter: React.FC<{ gp: any; W: number; H: number }> = ({ gp, W, H }) => (
  <svg width="0" height="0" style={{ position: 'absolute' }}>
    <filter id="zc_gl" x="0" y="0" width={W} height={H} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feColorMatrix in="SourceGraphic" type="matrix" values={ONLY.R} result="r0" />
      <feOffset in="r0" dx={-gp.split} dy="0" result="r" />
      <feColorMatrix in="SourceGraphic" type="matrix" values={ONLY.G} result="g" />
      <feColorMatrix in="SourceGraphic" type="matrix" values={ONLY.B} result="b0" />
      <feOffset in="b0" dx={gp.split} dy="0" result="b" />
      <feComposite in="r" in2="g" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="rg" />
      <feComposite in="rg" in2="b" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="sp" />
      {gp.bands.map((b: any, i: number) => <feOffset key={i} in="sp" dx={b.dx} dy="0" x="0" y={b.y} width={W} height={b.h} result={`band${i}`} />)}
      <feMerge><feMergeNode in="sp" />{gp.bands.map((_: any, i: number) => <feMergeNode key={i} in={`band${i}`} />)}</feMerge>
    </filter></svg>);

export const EffectWrap: React.FC<{ p: LayersProps; f: number; below: (lag: number) => React.ReactNode }> = ({ p, f, below }) => {
  const c = effectCss(p.project, f), s = c.s, H = p.project.canvas.h;
  const gp = s.glitch > 0.002 ? glitchPlan(f, s.glitch, p.project.canvas.w, H) : null;
  // pixelate: the pixel at the centre of every block spread over the block (film_fx._pixel samples the same pixels)
  const b = s.pixel > 0.002 ? pixelBlock(s.pixel, p.project.canvas.w) : 0, hb = Math.floor(b / 2);
  return <AbsoluteFill>
    {b > 0 && <svg width="0" height="0" style={{ position: 'absolute' }}>
      <filter id="zc_px" x="0" y="0" width={p.project.canvas.w} height={H} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood x={hb} y={hb} width="1" height="1" floodColor="#000" />
        <feComposite x="0" y="0" width={b} height={b} />
        <feTile result="dots" />
        <feComposite in="SourceGraphic" in2="dots" operator="in" />
        <feMorphology operator="dilate" radius={b / 2} />
      </filter></svg>}
    {gp && <GlitchFilter gp={gp} W={p.project.canvas.w} H={H} />}
    <AbsoluteFill style={{ transformOrigin: c.transformOrigin, transform: c.transform, filter: c.filter + (gp ? ' url(#zc_gl)' : '') + (b > 0 ? ' url(#zc_px)' : '') }}>
      {below(0)}
      {s.ghost > 0.002 && <AbsoluteFill style={{ opacity: s.ghost, pointerEvents: 'none' }}>{below(c.lag)}</AbsoluteFill>}
      {gp && gp.lines.map((l: any, i: number) => <div key={'l' + i} style={{ position: 'absolute', left: 0, right: 0, top: l.y, height: l.h, background: STATIC, backgroundPosition: `${(f * 37 + i * 11) % 16}px 0`, opacity: l.o, pointerEvents: 'none' }} />)}
    </AbsoluteFill>
    {s.vig > 0.001 && <AbsoluteFill style={{ pointerEvents: 'none', opacity: s.vig, background: 'radial-gradient(ellipse farthest-corner at center, rgba(0,0,0,0) 45%, rgba(0,0,0,1) 100%)' }} />}
    {s.grain > 0.001 && <Grain f={f} opacity={Math.min(1, s.grain * 0.55)} />}
    {s.flash > 0.002 && <AbsoluteFill style={{ background: '#fff', opacity: Math.min(1, s.flash), pointerEvents: 'none' }} />}
    {s.black > 0 && <AbsoluteFill style={{ background: '#000' }} />}
  </AbsoluteFill>;
};
