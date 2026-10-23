// The layered project in the editor: load it, change it ONLY through ops (render/src/layers/ops.js), undo / redo.
// A slider being dragged sends a live draft (shown at once, not saved); letting go commits it (saved, undoable).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apply, inverse } from '../../src/layers/ops.js';

export type View = { project: any; urls: Record<string, string>; stems: any[]; output: string | null; outputStale: boolean; job: any };
export type Send = (ops: any[], opts?: { commit?: boolean; label?: string; channel?: string }) => void;

// the ops that turn one version of the project into another (a builder's change on the server, made undoable):
// top-level fields, then each layer (added / removed / replaced / moved), then the assets. Checked: if applying them
// doesn't give exactly `to`, null (no undo step rather than a wrong one).
const strip = (p: any) => { const { rev, saved, ...rest } = p || {}; return JSON.stringify(rest); };  // (rev / saved: the server's own stamps)
export function diffOps(from: any, to: any): any[] | null {
  const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
  const ops: any[] = [];
  const set: any = {};
  for (const k of new Set([...Object.keys(from), ...Object.keys(to)])) if (!['layers', 'assets', 'rev', 'saved'].includes(k) && !same(from[k], to[k])) set[k] = to[k] ?? null;
  let cur = from;
  if (Object.keys(set).length) { ops.push({ op: 'project', set }); cur = apply(cur, ops); }  // (a new duration re-pins items: the layers are compared after it)
  const want = new Map((to.layers || []).map((l: any) => [l.id, l]));
  for (const l of cur.layers || []) if (!want.has(l.id)) ops.push({ op: 'layer.remove', id: l.id });
  const has = new Map((cur.layers || []).map((l: any) => [l.id, l]));
  (to.layers || []).forEach((l: any, i: number) => {
    if (!has.has(l.id)) ops.push({ op: 'layer.add', layer: l, index: i });
    else if (!same(has.get(l.id), l)) ops.push({ op: 'layer.replace', layer: l });
  });
  (to.layers || []).forEach((l: any, i: number) => ops.push({ op: 'layer.move', id: l.id, index: i }));
  for (const [id, a] of Object.entries(to.assets || {})) if (!same(cur.assets?.[id], a)) ops.push({ op: 'asset.add', id, asset: a });
  for (const id of Object.keys(cur.assets || {})) if (!(to.assets || {})[id]) ops.push({ op: 'asset.remove', id });
  try { return strip(apply(from, ops)) === strip(to) ? ops : null; } catch { return null; }
}

const post = async (url: string, body: any) => {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { ok: r.ok, status: r.status, json: await r.json().catch(() => ({})) };
};

export function useLayered(ep: string) {
  const [view, setView] = useState<View | null>(null);
  // live drafts by channel: 'drag' (a slider / block being dragged - replaced as it moves) and 'sync' (edits shown
  // live while a builder catches up in the background - they stack). Both show; only a commit clears 'drag'.
  const [drafts, setDrafts] = useState<Record<string, any[]>>({});
  const [undo, setUndo] = useState<{ ops: any[]; inv: any[]; label?: string }[]>([]);
  const [redo, setRedo] = useState<{ ops: any[]; inv: any[]; label?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(0);
  const queue = useRef<Promise<any>>(Promise.resolve());
  const rev = useRef<number | null>(null);  // the server's rev (set straight from each answer: saves run back to back)

  const load = useCallback(async () => {
    const r = await fetch(`/api/p/${ep}`);
    if (!r.ok) { setView(null); return null; }
    const v = await r.json();
    rev.current = v.project?.rev ?? null;
    setView(v);
    return v;
  }, [ep]);
  useEffect(() => { setView(null); setUndo([]); setRedo([]); setDrafts({}); load(); }, [ep]);

  // saves go one after the other (each carries the rev it was made on)
  const save = (ops: any[]) => {
    setSaving((n) => n + 1);
    queue.current = queue.current.then(async () => {
      const r = await post(`/api/p/${ep}/ops`, { rev: rev.current, ops });
      setSaving((n) => n - 1);
      if (!r.ok) { setError(r.json?.problems?.join('\n') || r.json?.error || 'not saved'); await load(); return; }
      rev.current = r.json.rev;
      setError(r.json.soundError ? `sound: ${r.json.soundError}` : null);
      setView((v) => (v ? { ...v, project: { ...v.project, rev: r.json.rev } } : v));
      // a new sound's prepared source is made behind (soundBusy): it plays as it is meanwhile, the prepared one
      // comes in when ready - never a wait
      const fresh = async () => {
        const v = await (await fetch(`/api/p/${ep}`)).json();
        setView((o) => (o ? { ...o, urls: v.urls, stems: v.stems, gainDb: v.gainDb, levels: v.levels } as any : v));
        return v;
      };
      (async () => {  // (detached: the next saves never wait on it)
        let v = await fresh();
        for (let i = 0; v?.soundBusy && i < 120; i++) { await new Promise((res) => setTimeout(res, 1500)); v = await fresh(); }
      })();
    });
  };

  const send: Send = (ops, opts = {}) => {
    if (!view) return;
    if (opts.commit === false) { const ch = opts.channel || 'drag'; setDrafts((d) => ({ ...d, [ch]: ops })); return; }  // (no ops: that draft goes)
    if (!ops.length) return;
    let inv: any[];
    try { inv = inverse(view.project, ops); } catch (e: any) { setError(e.message); return; }
    const next = apply(view.project, ops);
    setView({ ...view, project: next });
    setDrafts((d) => ({ ...d, drag: [] }));
    setUndo((u) => [...u.slice(-199), { ops, inv, label: opts.label }]);
    setRedo([]);
    save(ops);
  };
  const doUndo = () => {
    const c = undo.at(-1); if (!c || !view) return;
    setUndo(undo.slice(0, -1)); setRedo([...redo, c]);
    setView({ ...view, project: apply(view.project, c.inv) }); save(c.inv);
  };
  const doRedo = () => {
    const c = redo.at(-1); if (!c || !view) return;
    setRedo(redo.slice(0, -1)); setUndo([...undo, c]);
    setView({ ...view, project: apply(view.project, c.ops) }); save(c.ops);
  };
  // a change a builder made on the server (a cut re-made from the take, a line fix): already saved and loaded - it
  // only goes on the undo list, as the ops between the version before it and now
  const record = (before: any, after: any, label = 'edit') => {
    if (!before || !after || strip(before) === strip(after)) return;
    const ops = diffOps(before, after), inv = diffOps(after, before);
    if (!ops || !inv) return;
    setUndo((u) => [...u.slice(-199), { ops, inv, label }]);
    setRedo([]);
  };
  // what the preview shows: the saved project + the draft being dragged
  const live = useMemo(() => {
    if (!view) return null;
    const all = [...(drafts.sync || []), ...(drafts.drag || [])];
    if (!all.length) return view.project;
    try { return apply(view.project, all); } catch { return view.project; }
  }, [view?.project, drafts]);
  return { view, live, send, load, record, undo: doUndo, redo: doRedo, canUndo: !!undo.length, canRedo: !!redo.length, error, setError, saving: saving > 0 };
}

export const upload = async (ep: string, file: File) => {
  const r = await fetch(`/api/p/${ep}/assets?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file });
  return r.json();
};
export const build = (ep: string, body: any) => post(`/api/p/${ep}/build`, body).then((r) => r.json);

export const KIND_LABEL: Record<string, string> = {
  video: 'Video', backdrop: 'Background', image: 'Picture', text: 'Text', subtitles: 'Subtitles', shape: 'Shape', audio: 'Sound', effect: 'Effect',
};
export const KIND_COLOR: Record<string, string> = {
  video: '#4a86e8', backdrop: '#5c6b7a', image: '#c2507a', text: '#e9c46a', subtitles: '#8a8580', shape: '#6b6560', audio: '#45a86a', effect: '#8a5cd6',
};
export const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s % 1) * 10)}`;
