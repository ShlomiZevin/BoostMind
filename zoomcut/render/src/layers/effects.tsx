// Film effects in the editor: the picture below the top-most effect layer, moved and coloured live (effect_curve.js ->
// render/ui/fx.js), with the vignette / grain / flash / black over it and under the texts. The export does the same
// with the same curve on the composited frames (pipeline/film_fx.py), in the same order:
//   ghost (the picture `lag` frames back, laid over at its strength) -> camera -> colour + light -> vignette -> grain
//   -> flash -> black
// Layers.tsx: <EffectWrap p={p} f={frame} below={(lag) => the layers below the top effect, drawn `lag` frames back} />
import React, { useEffect, useRef } from 'react';
import { AbsoluteFill } from 'remotion';
import { effectCss, glitchPlan } from './effect_curve.js';
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

// the screen glitch (effect_curve.js glitchPlan - the export applies the same plan in film_fx.py): the red and the blue
// of the picture pulled apart, bands of it torn sideways, a few lines of static
const ONLY = { R: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', G: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', B: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0' };
const STATIC = 'repeating-linear-gradient(90deg, #fff 0 3px, #777 3px 5px, #111 5px 9px, #ccc 9px 11px, #333 11px 16px)';

export const EffectWrap: React.FC<{ p: LayersProps; f: number; below: (lag: number) => React.ReactNode }> = ({ p, f, below }) => {
  const c = effectCss(p.project, f), s = c.s, H = p.project.canvas.h;
  const gp = s.glitch > 0.002 ? glitchPlan(f, s.glitch, p.project.canvas.w, H) : null;
  return <AbsoluteFill>
    <AbsoluteFill style={{ transformOrigin: c.transformOrigin, transform: c.transform, filter: c.filter }}>
      {below(0)}
      {s.ghost > 0.002 && <AbsoluteFill style={{ opacity: s.ghost, pointerEvents: 'none' }}>{below(c.lag)}</AbsoluteFill>}
      {gp && <>
        <svg width="0" height="0" style={{ position: 'absolute' }}>{Object.entries(ONLY).map(([k, v]) => (
          <filter key={k} id={`zc_gl_${k}`} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values={v} /></filter>))}</svg>
        {gp.split > 0 && <AbsoluteFill style={{ background: '#000', isolation: 'isolate', pointerEvents: 'none' }}>
          {(['G', 'R', 'B'] as const).map((k) => <AbsoluteFill key={k} style={{ filter: `url(#zc_gl_${k})`, mixBlendMode: k === 'G' ? 'normal' : 'screen',
            transform: `translateX(${k === 'R' ? -gp.split : k === 'B' ? gp.split : 0}px)` }}>{below(0)}</AbsoluteFill>)}
        </AbsoluteFill>}
        {gp.bands.map((b, i) => <AbsoluteFill key={i} style={{ clipPath: `inset(${b.y}px 0 ${Math.max(0, H - b.y - b.h)}px 0)`, transform: `translateX(${b.dx}px)`, pointerEvents: 'none' }}>{below(0)}</AbsoluteFill>)}
        {gp.lines.map((l, i) => <div key={'l' + i} style={{ position: 'absolute', left: 0, right: 0, top: l.y, height: l.h, background: STATIC, backgroundPosition: `${(f * 37 + i * 11) % 16}px 0`, opacity: l.o, pointerEvents: 'none' }} />)}
      </>}
    </AbsoluteFill>
    {s.vig > 0.001 && <AbsoluteFill style={{ pointerEvents: 'none', opacity: s.vig, background: 'radial-gradient(ellipse farthest-corner at center, rgba(0,0,0,0) 45%, rgba(0,0,0,1) 100%)' }} />}
    {s.grain > 0.001 && <Grain f={f} opacity={Math.min(1, s.grain * 0.55)} />}
    {s.flash > 0.002 && <AbsoluteFill style={{ background: '#fff', opacity: Math.min(1, s.flash), pointerEvents: 'none' }} />}
    {s.black > 0 && <AbsoluteFill style={{ background: '#000' }} />}
  </AbsoluteFill>;
};
