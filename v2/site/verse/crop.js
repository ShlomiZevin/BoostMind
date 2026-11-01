// Their face for the Shlomiverse: a photo from the phone, moved and zoomed into the circle, out as a square JPEG.
// Drag to move, pinch / wheel / the slider to zoom; the photo always covers the circle.
import { T } from './copy.js';
import { I, esc, toast } from './ui.js';

const OUT = 480; // px, the stored square

export function pickAndCrop() {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*' });
    input.onchange = () => { const f = input.files?.[0]; f ? cropFile(f).then(resolve) : resolve(null); };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

function cropFile(file) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/') || file.size > 30e6) { toast(T.photoBig); return resolve(null); }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); toast(T.photoBig); resolve(null); };
    img.onload = () => open(img, url, resolve);
    img.src = url;
  });
}

function open(img, url, resolve) {
  const el = document.createElement('div');
  el.className = 'crop';
  el.innerHTML = `<div class="crop-in">
      <h2 class="vx-h">${esc(T.cropTitle)}</h2><p class="vx-sub">${esc(T.cropHint)}</p>
      <div class="crop-stage"><img alt="" draggable="false"><div class="crop-ring"></div></div>
      <div class="crop-zoom"><span>${I.minus}</span><input type="range" min="1" max="4" step="0.01" value="1" aria-label="זום"><span>${I.plus}</span></div>
      <button class="vx-btn main block" data-save>${esc(T.cropSave)}</button>
      <button class="vx-link" data-cancel>${esc(T.cropCancel)}</button></div>`;
  document.body.append(el);
  const stage = el.querySelector('.crop-stage'), pic = stage.querySelector('img'), range = el.querySelector('input');
  pic.src = url;
  const W = img.naturalWidth, H = img.naturalHeight;
  let S = stage.clientWidth, z = 1, x = 0, y = 0;
  const base = () => S / Math.min(W, H);
  const clamp = () => {
    const sc = base() * z, mx = Math.max(0, (W * sc - S) / 2), my = Math.max(0, (H * sc - S) / 2);
    x = Math.min(mx, Math.max(-mx, x)); y = Math.min(my, Math.max(-my, y));
  };
  const draw = () => {
    clamp();
    const sc = base() * z;
    Object.assign(pic.style, { width: `${W * sc}px`, height: `${H * sc}px`, left: `${S / 2 - (W * sc) / 2 + x}px`, top: `${S / 2 - (H * sc) / 2 + y}px` });
    range.value = z;
  };
  const zoomTo = (nz, cx = 0, cy = 0) => { // keep the point under the fingers / cursor in place
    nz = Math.min(4, Math.max(1, nz));
    x = cx - ((cx - x) * nz) / z; y = cy - ((cy - y) * nz) / z; z = nz; draw();
  };
  draw();
  new ResizeObserver(() => { S = stage.clientWidth; draw(); }).observe(stage);

  const pts = new Map();
  let last = null;
  const rel = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left - S / 2, e.clientY - r.top - S / 2]; };
  const spread = () => { const [a, b] = [...pts.values()]; return { d: Math.hypot(a[0] - b[0], a[1] - b[1]), c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; };
  stage.addEventListener('pointerdown', (e) => { stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, rel(e)); last = pts.size === 2 ? { ...spread(), z } : null; });
  stage.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId), now = rel(e);
    pts.set(e.pointerId, now);
    if (pts.size === 1) { x += now[0] - prev[0]; y += now[1] - prev[1]; draw(); }
    else if (pts.size === 2 && last) { const s = spread(); zoomTo(last.z * (s.d / last.d), s.c[0], s.c[1]); }
  });
  const up = (e) => { pts.delete(e.pointerId); last = null; };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('wheel', (e) => { e.preventDefault(); const [cx, cy] = rel(e); zoomTo(z * Math.exp(-e.deltaY / 400), cx, cy); }, { passive: false });
  range.oninput = () => zoomTo(Number(range.value));

  const done = (v) => { URL.revokeObjectURL(url); el.remove(); resolve(v); };
  el.querySelector('[data-cancel]').onclick = () => done(null);
  el.querySelector('[data-save]').onclick = () => {
    const sc = base() * z;
    const c = Object.assign(document.createElement('canvas'), { width: OUT, height: OUT });
    const g = c.getContext('2d');
    g.fillStyle = '#111'; g.fillRect(0, 0, OUT, OUT);
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, ((W * sc - S) / 2 - x) / sc, ((H * sc - S) / 2 - y) / sc, S / sc, S / sc, 0, 0, OUT, OUT);
    done(c.toDataURL('image/jpeg', 0.88));
  };
}
