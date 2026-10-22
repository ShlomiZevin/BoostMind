// Film effects in the editor: the picture below the top-most effect layer, moved and coloured live (effect_curve.js ->
// render/ui/fx.js), with the vignette / grain / flash / black over it and under the texts. The export does the same
// with the same curve on the composited frames (pipeline/film_fx.py), in the same order:
//   ghost (the picture `lag` frames back, laid over at its strength) -> camera -> colour + light -> vignette -> grain
//   -> flash -> black
// Layers.tsx: <EffectWrap p={p} f={frame} below={(lag) => the layers below the top effect, drawn `lag` frames back} />
import React, { useEffect, useRef } from 'react';
import { AbsoluteFill } from 'remotion';
import { effectCss } from './effect_curve.js';
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

export const EffectWrap: React.FC<{ p: LayersProps; f: number; below: (lag: number) => React.ReactNode }> = ({ p, f, below }) => {
  const c = effectCss(p.project, f), s = c.s;
  return <AbsoluteFill>
    <AbsoluteFill style={{ transformOrigin: c.transformOrigin, transform: c.transform, filter: c.filter }}>
      {below(0)}
      {s.ghost > 0.002 && <AbsoluteFill style={{ opacity: s.ghost, pointerEvents: 'none' }}>{below(c.lag)}</AbsoluteFill>}
    </AbsoluteFill>
    {s.vig > 0.001 && <AbsoluteFill style={{ pointerEvents: 'none', opacity: s.vig, background: 'radial-gradient(ellipse farthest-corner at center, rgba(0,0,0,0) 45%, rgba(0,0,0,1) 100%)' }} />}
    {s.grain > 0.001 && <Grain f={f} opacity={Math.min(1, s.grain * 0.55)} />}
    {s.flash > 0.002 && <AbsoluteFill style={{ background: '#fff', opacity: Math.min(1, s.flash), pointerEvents: 'none' }} />}
    {s.black > 0 && <AbsoluteFill style={{ background: '#000' }} />}
  </AbsoluteFill>;
};
