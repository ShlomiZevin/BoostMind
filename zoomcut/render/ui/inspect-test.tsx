// A bench for the layered editor's inspectors (render/ui/layers/inspect): ?id=<a "_" project>&show=<layer>[.<item>],...
// Ops are applied locally (never saved); window.__ops = what they sent.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { apply } from '../src/layers/ops.js';
import { INSPECTORS } from './layers/inspect';

function Bench() {
  const q = new URLSearchParams(location.search);
  const id = q.get('id') || '_gl';
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetch(`/api/p/${id}`).then((r) => r.json()).then(setD); }, []);
  if (!d) return null;
  const send = (ops: any[], o?: any) => { (window as any).__ops = [...((window as any).__ops || []), { ops, commit: o?.commit !== false }]; setD((x: any) => ({ ...x, project: apply(x.project, ops) })); };
  const shows = (q.get('show') || 'amir.picture').split(',');
  return <>{shows.map((s) => {
    const [lid, iid] = s.split('@');
    const layer = d.project.layers.find((l: any) => l.id === lid);
    if (!layer) return <div key={s}>no {lid}</div>;
    const item = iid ? (iid === 'first' ? layer.items[0] : layer.items.find((i: any) => i.id === iid)) : null;
    const C = INSPECTORS[layer.kind];
    return <div className="pane-t" key={s}><C project={d.project} layer={layer} item={item || null} urls={d.urls} send={send} fps={d.project.canvas.fps}
      frame={item ? item.from + Math.floor(item.dur / 2) : 0} pickAsset={(k, cb) => console.log('pick', k)} /></div>;
  })}</>;
}
createRoot(document.getElementById('root')!).render(<Bench />);
