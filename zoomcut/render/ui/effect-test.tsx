// A bench for film effects (render/src/layers/effects.tsx): window.__set(imageUrl, project, frame) draws that picture
// through the effect layers at that frame - tools compare it with the export's (pipeline/film_fx.py).
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EffectWrap } from '../src/layers/effects';

function Bench() {
  const [s, set] = useState<any>(null);
  (window as any).__set = (img: string, project: any, f: number) => set({ img, project, f });
  if (!s) return null;
  return <EffectWrap p={{ project: s.project, urls: {} } as any} f={s.f}
    below={() => <img src={s.img} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920 }} />} />;
}
createRoot(document.getElementById('root')!).render(<Bench />);
