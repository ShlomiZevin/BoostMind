// The one way a project changes: a list of ops applied to project.json (the editor, the studio API and any AI tool
// all send these). Plain JS so the server (Node) and the editor (browser) share it. The format is in
// skill/edit-video/layers.md; validate() is its checker - the server refuses a write that breaks it.

export const FORMAT = 'sketch-studio/1';
export const LAYER_KINDS = ['video', 'backdrop', 'image', 'text', 'subtitles', 'shape', 'audio', 'effect'];
export const ASSET_KINDS = ['video', 'image', 'audio', 'font'];
// which layer kinds make sound / pictures (the export splits the stack by these)
export const SOUND = new Set(['audio']);
export const VIDEO = new Set(['video', 'backdrop']);

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** {a: 1, b: null} merged into o: null deletes the key (one level deep for plain objects named in `deep`) */
function merge(o, set, deep = []) {
  for (const [k, v] of Object.entries(set || {})) {
    if (v === null) delete o[k];
    else if (deep.includes(k) && v && typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object') merge(o[k], v);
    else o[k] = clone(v);
  }
  return o;
}

export const layerOf = (p, id) => (p.layers || []).find((l) => l.id === id);
export const itemOf = (l, id) => (l?.items || []).find((i) => i.id === id);

let seq = 0;
export const newId = (prefix = 'x') => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

/** The ops that undo `ops` on project `p` (call before applying). */
export function inverse(p, ops) {
  const out = [];
  let cur = clone(p);
  for (const op of ops) {
    out.unshift(...inverseOne(cur, op));
    cur = apply(cur, [op]);
  }
  return out;
}
function inverseOne(p, op) {
  const L = op.layer ? layerOf(p, op.layer) : op.id ? layerOf(p, op.id) : null;
  switch (op.op) {
    case 'project': return [{ op: 'project', set: Object.fromEntries(Object.keys(op.set || {}).map((k) => [k, clone(p[k]) ?? null])) }];
    case 'layer.add': return [{ op: 'layer.remove', id: op.layer.id }];
    case 'layer.remove': return L ? [{ op: 'layer.add', layer: clone(L), index: p.layers.indexOf(L) }] : [];
    case 'layer.move': return L ? [{ op: 'layer.move', id: op.id, index: p.layers.indexOf(L) }] : [];
    case 'layer.update': return L ? [{ op: 'layer.replace', layer: clone(L) }] : [];
    case 'layer.replace': { const o = layerOf(p, op.layer.id); return o ? [{ op: 'layer.replace', layer: clone(o) }] : []; }
    case 'item.add': return [{ op: 'item.remove', layer: op.layer, id: op.item.id }];
    case 'item.remove': { const it = itemOf(L, op.id); return it ? [{ op: 'item.add', layer: op.layer, item: clone(it), index: L.items.indexOf(it) }] : []; }
    case 'item.update': { const it = itemOf(L, op.id); return it ? [{ op: 'item.replace', layer: op.layer, item: clone(it) }] : []; }
    case 'item.replace': { const it = itemOf(L, op.item.id); return it ? [{ op: 'item.replace', layer: op.layer, item: clone(it) }] : []; }
    case 'asset.add': return p.assets?.[op.id] ? [{ op: 'asset.add', id: op.id, asset: clone(p.assets[op.id]) }] : [{ op: 'asset.remove', id: op.id }];
    case 'asset.remove': return p.assets?.[op.id] ? [{ op: 'asset.add', id: op.id, asset: clone(p.assets[op.id]) }] : [];
    default: return [];
  }
}

/**
 * Apply ops to a copy of the project and return it. Throws on an op that can't apply (unknown layer / item).
 * Ops:
 *   {op: 'project', set: {title?, speed?, canvas?, duration?}}
 *   {op: 'layer.add', layer: {...}, index?}          {op: 'layer.remove', id}         {op: 'layer.move', id, index}
 *   {op: 'layer.update', id, set?: {name, group, hidden, locked, muted}, props?: {...}}   (null deletes a key)
 *   {op: 'item.add', layer, item, index?}            {op: 'item.remove', layer, id}
 *   {op: 'item.update', layer, id, set: {...}}       (an item of a builder layer changed by hand is marked user: true)
 *   {op: 'asset.add', id, asset}                     {op: 'asset.remove', id}
 */
export function apply(project, ops) {
  const p = clone(project);
  p.layers = p.layers || [];
  p.assets = p.assets || {};
  for (const op of ops) {
    const need = (id) => { const l = layerOf(p, id); if (!l) throw new Error(`no layer "${id}"`); l.items = l.items || []; return l; };
    switch (op.op) {
      case 'project': {
        const before = p.duration;
        merge(p, op.set, ['canvas']);
        if (isNum(before) && isNum(p.duration) && p.duration !== before) repin(p, before, p.duration);
        break;
      }
      case 'layer.add': {
        if (layerOf(p, op.layer.id)) throw new Error(`layer "${op.layer.id}" exists`);
        const l = { items: [], props: {}, ...clone(op.layer) };
        const at = isNum(op.index) ? Math.max(0, Math.min(p.layers.length, op.index)) : p.layers.length;
        p.layers.splice(at, 0, l);
        break;
      }
      case 'layer.remove': p.layers = p.layers.filter((l) => l.id !== op.id); break;
      case 'layer.move': {
        const l = need(op.id);
        p.layers = p.layers.filter((x) => x !== l);
        p.layers.splice(Math.max(0, Math.min(p.layers.length, op.index)), 0, l);
        break;
      }
      case 'layer.update': {
        const l = need(op.id);
        merge(l, op.set);
        l.props = merge(l.props || {}, op.props, ['look', 'box']);
        break;
      }
      case 'layer.replace': { const l = need(op.layer.id); p.layers[p.layers.indexOf(l)] = clone(op.layer); break; }
      case 'item.add': {
        const l = need(op.layer);
        const it = clone(op.item);
        if (!it.id) it.id = newId('i');
        if (itemOf(l, it.id)) throw new Error(`item "${it.id}" exists on "${l.id}"`);
        if (l.owner === 'builder' && op.user !== false) it.user = true;
        const at = isNum(op.index) ? Math.max(0, Math.min(l.items.length, op.index)) : l.items.length;
        l.items.splice(at, 0, it);
        break;
      }
      case 'item.remove': {
        const l = need(op.layer);
        const it = itemOf(l, op.id);
        if (it && l.owner === 'builder' && it.ref) l.removed = [...new Set([...(l.removed || []), refKey(it.ref)])];  // a rebuild won't bring it back
        l.items = l.items.filter((i) => i.id !== op.id);
        break;
      }
      case 'item.update': {
        const l = need(op.layer);
        const it = itemOf(l, op.id);
        if (!it) throw new Error(`no item "${op.id}" on "${op.layer}"`);
        merge(it, op.set, ['box', 'anim', 'look']);
        if (l.owner === 'builder' && op.user !== false) it.user = true;
        break;
      }
      case 'item.replace': { const l = need(op.layer); const i = l.items.findIndex((x) => x.id === op.item.id); if (i >= 0) l.items[i] = clone(op.item); break; }
      case 'asset.add': p.assets[op.id] = clone(op.asset); break;
      case 'asset.remove': delete p.assets[op.id]; break;
      default: throw new Error(`unknown op "${op.op}"`);
    }
  }
  return p;
}

/** The length changed: "pin": "end" items keep their distance to the end, "span" ones still run to it
 * (the same rule as pipeline/project.py repin). */
function repin(p, before, after) {
  for (const l of p.layers || []) for (const it of l.items || []) {
    if (it.pin === 'end') { it.from = Math.max(0, it.from + after - before); it.dur = Math.max(1, Math.min(it.dur, after - it.from)); }
    else if (it.pin === 'span') it.dur = Math.max(1, after - it.from);
  }
}

export const refKey =(ref) => JSON.stringify(ref, Object.keys(ref || {}).sort());

/** Problems that make a project unusable (the server refuses the write). [] = fine. */
export function validate(p) {
  const e = [];
  const at = (where, msg) => e.push(`${where}: ${msg}`);
  if (p.format !== FORMAT) at('format', `must be "${FORMAT}"`);
  const c = p.canvas || {};
  if (!isNum(c.w) || !isNum(c.h) || !isNum(c.fps) || c.w < 16 || c.h < 16 || c.fps < 1) at('canvas', 'needs w, h, fps');
  if (!isNum(p.duration) || p.duration < 1) at('duration', 'frames at 1x, a positive number');
  if (p.speed != null && (!isNum(p.speed) || p.speed < 0.25 || p.speed > 4)) at('speed', '0.25 .. 4');
  for (const [id, a] of Object.entries(p.assets || {})) {
    if (!ASSET_KINDS.includes(a.kind)) at(`assets.${id}`, `kind must be one of ${ASSET_KINDS.join(', ')}`);
    if (!a.src || typeof a.src !== 'string') at(`assets.${id}`, 'needs src (a path relative to the project folder)');
    if ((a.kind === 'video' || a.kind === 'image') && (!isNum(a.w) || !isNum(a.h))) at(`assets.${id}`, 'a picture / video needs w and h');
  }
  const ids = new Set();
  for (const l of p.layers || []) {
    const w = `layer ${l.id}`;
    if (!l.id) { at('layers', 'every layer needs an id'); continue; }
    if (ids.has(l.id)) at(w, 'id used twice');
    ids.add(l.id);
    if (!LAYER_KINDS.includes(l.kind)) at(w, `kind must be one of ${LAYER_KINDS.join(', ')}`);
    if (l.kind === 'backdrop') {
      const t = (p.layers || []).find((x) => x.id === l.props?.target);
      if (!t || t.kind !== 'video') at(w, 'props.target must name a video layer');
      if (l.props?.asset && p.assets?.[l.props.asset]?.kind !== 'image') at(w, 'props.asset must be an image asset');
    }
    const iids = new Set();
    for (const it of l.items || []) {
      const wi = `${w} item ${it.id}`;
      if (!it.id) at(w, 'every item needs an id');
      if (iids.has(it.id)) at(wi, 'id used twice');
      iids.add(it.id);
      if (!isNum(it.from) || it.from < 0) at(wi, 'from: a frame >= 0');
      if (!isNum(it.dur) || it.dur < 1) at(wi, 'dur: frames >= 1');
      const asset = it.asset ?? l.props?.asset;
      if (['video', 'image', 'audio'].includes(l.kind)) {
        if (!asset || !p.assets?.[asset]) at(wi, `asset "${asset}" is not in assets`);
        else if (l.kind === 'video' && p.assets[asset].kind !== 'video') at(wi, 'a video layer plays video assets');
        else if (l.kind === 'image' && p.assets[asset].kind !== 'image') at(wi, 'an image layer shows image assets');
      }
      if ((l.kind === 'video' || l.kind === 'shape') && !(it.box || l.props?.box)) at(wi, 'needs a box {x, y, w, h}');
      if ((l.kind === 'text' || l.kind === 'subtitles') && typeof it.text !== 'string') at(wi, 'needs text');
      if (it.in != null && (!isNum(it.in) || it.in < 0)) at(wi, 'in: seconds into the source, >= 0');
    }
  }
  return e;
}

/** A layer's items at frame f (inclusive start, exclusive end), hidden layers / items excluded. */
export const visibleAt = (l, f) => (l.hidden ? [] : (l.items || []).filter((i) => !i.hidden && f >= i.from && f < i.from + i.dur));

/** Item with its layer's props underneath (an item overrides any prop). */
export const resolved = (l, it) => ({ ...(l.props || {}), ...it, box: it.box || l.props?.box, look: it.look || l.props?.look });
