// Work ON the video: the picked item gets a frame you drag (move), a corner (size), and on a background or a video the
// wheel zooms it; clicking anything on the video picks it. Every drag is live (a draft) and saved on release - an op
// like any other, so Ctrl+Z undoes it.
import React, { useLayoutEffect, useRef, useState } from 'react';
import { fitBox, backdropBox, imageBox } from '../../src/layers/geometry.js';
import { Send } from './api';

type Box = { x: number; y: number; w: number; h: number };
type Sel = { layer: string; item?: string } | null;

const visible = (it: any, f: number) => it && !it.hidden && f >= it.from && f < it.from + it.dur;

/** The picked thing's box on the canvas now (null when it isn't on screen at this frame). */
function boxOf(project: any, sel: Sel, f: number, host: HTMLElement | null, scale: number): { box: Box; layer: any; item: any; target?: any } | null {
  if (!sel) return null;
  const layer = project.layers.find((l: any) => l.id === sel.layer);
  if (!layer || layer.hidden) return null;
  if (layer.kind === 'backdrop') {  // the background: the tile of its person that is on screen now
    const t = project.layers.find((l: any) => l.id === layer.props?.target);
    const it = (t?.items || []).filter((i: any) => visible(i, f)).sort((a: any, b: any) => (b.z ?? 0) - (a.z ?? 0))[0];
    const box = it?.box || t?.props?.box;
    return it && box ? { box, layer, item: it, target: t } : null;
  }
  const item = sel.item ? (layer.items || []).find((i: any) => i.id === sel.item) : (layer.items || []).find((i: any) => visible(i, f));
  if (!visible(item, f)) return null;
  const pbox = item.box || layer.props?.box;
  if (layer.kind === 'video' || layer.kind === 'shape') return pbox ? { box: pbox, layer, item } : null;
  if (layer.kind === 'image') {
    const a = project.assets[item.asset ?? layer.props?.asset];
    if (!a) return null;
    const b = imageBox(a, pbox || { x: 0, y: 0, w: project.canvas.w });
    return { box: b, layer, item };
  }
  // text / subtitles: measured where the composition drew it
  const el = host?.querySelector(`[data-l="${CSS.escape(layer.id)}"][data-i="${CSS.escape(item.id)}"]`) as HTMLElement | null;
  if (!el || !host) return null;
  const r = el.getBoundingClientRect(), h = host.getBoundingClientRect();
  return { box: { x: (r.left - h.left) / scale, y: (r.top - h.top) / scale, w: r.width / scale, h: r.height / scale }, layer, item };
}

export function Handles({ project, sel, frame, host, send, onPick }: {
  project: any; sel: Sel; frame: number; host: HTMLElement | null; send: Send; onPick: (s: Sel) => void;
}) {
  const [, tick] = useState(0);
  const scale = host ? host.clientWidth / project.canvas.w : 1;
  const hit = boxOf(project, sel, frame, host, scale);
  // text is measured from the drawn page: look again after it paints
  useLayoutEffect(() => { const r = requestAnimationFrame(() => tick((n) => n + 1)); return () => cancelAnimationFrame(r); }, [frame, sel?.layer, sel?.item, project]);
  const drag = useRef<any>(null);

  const opsFor = (mode: 'move' | 'size', dx: number, dy: number) => {
    if (!hit) return [];
    const { layer, item } = hit;
    if (layer.kind === 'backdrop') {  // pan the photo inside its tile (x / y = -0.5..0.5 of the slack)
      const a = project.assets[item.asset];
      const img = project.assets[layer.props?.asset];
      if (!a || !img) return [];
      const b = fitBox(a, hit.box, { ...(hit.target.props || {}), ...item });
      const g = backdropBox(img, b.width, b.height, layer.props, { x0: -b.left, y0: -b.top, w: hit.box.w, h: hit.box.h });
      const sx = b.width - g.width, sy = b.height - g.height;
      const nx = sx ? (layer.props?.x ?? 0) + dx / sx : layer.props?.x ?? 0, ny = sy ? (layer.props?.y ?? 0) + dy / sy : layer.props?.y ?? 0;
      return [{ op: 'layer.update', id: layer.id, props: { x: +Math.max(-0.5, Math.min(0.5, nx)).toFixed(4), y: +Math.max(-0.5, Math.min(0.5, ny)).toFixed(4) } }];
    }
    const box = item.box || layer.props?.box || {};
    const where = item.box ? 'item' : 'layer';
    let nb: any;
    if (mode === 'move') nb = { ...box, x: Math.round((box.x ?? 0) + dx), y: Math.round((box.y ?? 0) + dy) };
    else if (layer.kind === 'text' || layer.kind === 'subtitles') {  // a text's corner = its letter size
      const size = item.size ?? layer.props?.size ?? 46;
      const ns = Math.max(10, Math.round(size * (1 + dy / Math.max(20, hit.box.h))));
      return [{ op: 'item.update', layer: layer.id, id: item.id, set: { size: ns } }];
    } else if (layer.kind === 'image') nb = { ...box, w: Math.max(20, Math.round((box.w ?? hit.box.w) + dx * (box.anchor === 'c' ? 2 : 1))) };
    else nb = { ...box, w: Math.max(20, Math.round(box.w + dx)), h: Math.max(20, Math.round(box.h + dy)) };
    return where === 'item' ? [{ op: 'item.update', layer: layer.id, id: item.id, set: { box: nb } }] : [{ op: 'layer.update', id: layer.id, props: { box: nb } }];
  };
  const start = (e: React.PointerEvent, mode: 'move' | 'size') => {
    e.stopPropagation(); e.preventDefault();
    if (!hit || hit.layer.locked) return;
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
    const mv = (m: PointerEvent) => {
      const d = drag.current; if (!d) return;
      const dx = (m.clientX - d.x) / scale, dy = (m.clientY - d.y) / scale;
      if (Math.abs(dx) + Math.abs(dy) < 1.5 && !d.moved) return;
      d.moved = true; d.dx = dx; d.dy = dy;
      send(opsFor(mode, dx, dy), { commit: false });
    };
    const up = () => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      const d = drag.current; drag.current = null;
      if (d?.moved) send(opsFor(mode, d.dx, d.dy), { label: mode === 'move' ? 'move on video' : 'size on video' });
      else send([], { commit: false });
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  };
  // the wheel on a background or a video zooms it
  const wheel = (e: React.WheelEvent) => {
    if (!hit || !(hit.layer.kind === 'backdrop' || hit.layer.kind === 'video')) return;
    e.preventDefault();
    const z0 = hit.layer.props?.zoom ?? 1, z = +Math.max(hit.layer.kind === 'video' ? 1 : 0.3, Math.min(4, z0 * (e.deltaY < 0 ? 1.04 : 0.96))).toFixed(3);
    send([{ op: 'layer.update', id: hit.layer.id, props: { zoom: z } }], { label: 'zoom' });
  };

  if (!hit) return null;
  const b = hit.box;
  const sizeable = hit.layer.kind !== 'backdrop';
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30 }}>
      <div onPointerDown={(e) => start(e, 'move')} onWheel={wheel} title={hit.layer.kind === 'backdrop' ? 'Drag to move the background, wheel to zoom it' : 'Drag to move'}
        style={{ position: 'absolute', left: b.x * scale - 1, top: b.y * scale - 1, width: b.w * scale + 2, height: b.h * scale + 2, pointerEvents: 'auto',
          border: '1.5px solid var(--accent)', borderRadius: 3, cursor: 'move', boxShadow: '0 0 0 1px rgba(0,0,0,.5)' }}>
        <span style={{ position: 'absolute', left: -1, top: -20, background: 'var(--accent)', color: '#fff', fontSize: 10.5, fontWeight: 600, padding: '2px 6px',
          borderRadius: 3, whiteSpace: 'nowrap', pointerEvents: 'none' }}>{hit.layer.name || hit.layer.id}</span>
        {sizeable && <div onPointerDown={(e) => start(e, 'size')} title={hit.layer.kind === 'text' || hit.layer.kind === 'subtitles' ? 'Drag to change the letter size' : 'Drag to resize'}
          style={{ position: 'absolute', right: -6, bottom: -6, width: 11, height: 11, background: '#fff', border: '1.5px solid var(--accent)', borderRadius: 2, cursor: 'nwse-resize' }} />}
      </div>
    </div>
  );
}

/** What's under a click on the video: whatever is drawn on top at that point (locked layers are skipped). */
export function pickAt(project: any, frame: number, host: HTMLElement, clientX: number, clientY: number): Sel {
  const scale = host.clientWidth / project.canvas.w;
  const h = host.getBoundingClientRect();
  const x = (clientX - h.left) / scale, y = (clientY - h.top) / scale;
  const order = (id: string) => project.layers.findIndex((l: any) => l.id === id);
  const usable = (id: string) => { const l = project.layers.find((x: any) => x.id === id); return l && !l.locked && !l.hidden; };
  // the topmost drawn graphic (text, picture, filled shape) at the point
  let g: any = null;
  for (const el of document.elementsFromPoint(clientX, clientY)) {
    const p = (el as HTMLElement).closest?.('[data-l][data-i]') as HTMLElement | null;
    if (p && host.contains(p) && usable(p.dataset.l!)) { g = { sel: { layer: p.dataset.l!, item: p.dataset.i! }, rank: order(p.dataset.l!) }; break; }
  }
  // the video on top there (its z lifts it inside its run of video layers)
  let v: any = null;
  project.layers.forEach((l: any, li: number) => {
    if (l.kind !== 'video' || l.hidden || l.locked) return;
    for (const i of l.items || []) {
      const b = i.box || l.props?.box;
      if (!b || !visible(i, frame) || x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) continue;
      const k = (i.z ?? 0) * 1000 + li;
      if (!v || k > v.k) v = { k, rank: li, sel: { layer: l.id, item: i.id } };
    }
  });
  if (g && v) return g.rank > v.rank ? g.sel : v.sel;
  return (g || v)?.sel || null;
}
