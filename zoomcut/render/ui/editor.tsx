import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Player, PlayerRef } from '@remotion/player';
import { ZoomCall, ovBoxStyle } from '../src/ZoomCall';
import { thoughtWords, wordState, lineDrift, THOUGHT_STYLE } from './thought_anim.js';
import { VOICE_PRESETS, voiceSettings, musicVolume, buildMix, applyMix, renderMix, loudness, masterFor } from './sound';

// ---------- types ----------------------------------------------------------------------
type Fix = { clip?: string; in?: number; out?: number; cut?: number; layout?: string; pause_before?: number; skip?: boolean; shift?: number; gain?: number; soften?: boolean };
type Take = { clip: string; in: number; out: number; cut?: number; score?: number; heard?: string };
type Line = {
  n: number; speaker: string; name: string; text: string; interrupted: boolean;
  status: 'ok' | 'check' | 'missing' | 'skipped'; score: number | null; heard: string;
  auto: Take | null; alternatives: Take[]; clip: string | null; in: number | null; out: number | null;
  cut: number | null; start: number | null; fix: Fix;
};
type Overlay = { text: string; start: number; end: number | null; style: string; font?: string; theme?: string; opacity?: number; y?: number | null; size?: number };
type FontDef = { id: string; name: string; file: string | null };
let FONT_LIST: FontDef[] = [];
fetch('/api/fonts').then((r) => r.json()).then((l: FontDef[]) => {
  FONT_LIST = l;
  const css = l.filter((f) => f.file).map((f) => `@font-face{font-family:"zc-${f.id}";src:url(/fonts/${f.file});font-weight:100 900;}`).join('');
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
}).catch(() => {});
const fontCss = (id?: string) => (!id || id === 'system' ? '"Segoe UI", Arial, sans-serif' : `"zc-${id}", "Segoe UI", sans-serif`);
type Job = { running: boolean; kind: string; log: string[]; code: number | null; send?: string[] };
type Data = {
  episode: any; state: { lines: Line[]; total: number; takes: string[] } | null; edit: any;
  footage: { clips: { rel: string; char: string; kind: string }[]; unassigned: string[] } | null;
  audioVersion: number | null; output: string | null; job: Job | null;
};
type Sel = { kind: 'line'; n: number } | { kind: 'text'; i: number } | null;
// one undoable change: a line's fix, or project settings
type Change = { kind: 'line'; n: number; before: Fix; after: Fix } | { kind: 'settings'; before: any; after: any } | { kind: 'overlays'; before: Overlay[]; after: Overlay[] };

// ---------- helpers --------------------------------------------------------------------
const api = async (url: string, body?: any) =>
  (await fetch(url, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined)).json();
const COLOR: Record<string, string> = { amir: 'var(--amir)', ofer: 'var(--ofer)', daniel: 'var(--daniel)' };
const PALETTE = ['var(--amir)', 'var(--ofer)', 'var(--daniel)', '#d9822b', '#c2507a'];
const colorOf = (id: string, chars: any[]) => COLOR[id] || PALETTE[Math.max(0, chars.findIndex((c) => c.id === id)) % PALETTE.length];
const LAYOUTS: [string, string, string][] = [
  ['', 'Auto', 'The editor picks: interruptions, reactions and back-and-forth decide the view.'],
  ['gallery', 'Gallery', 'Everyone in the meeting, stacked vertically.'],
  ['speaker', 'Speaker', 'The speaker big, the others in a strip underneath.'],
  ['duo', 'Duo', 'Two people big, the third floating in the corner.'],
];
const LAYOUT_NAME: Record<string, string> = { gallery: 'Gallery', speaker: 'Speaker', duo: 'Duo' };
const STATUS: Record<string, string> = { ok: 'Matched', check: 'Check', missing: 'Missing', skipped: 'Dropped' };
const DOT: Record<string, string> = { ok: 'var(--ok)', check: 'var(--warn)', missing: 'var(--bad)', skipped: 'var(--faint)' };
const f2 = (t?: number | null) => (t == null ? '' : t.toFixed(2));
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} } };
const clean = (f: any) => Object.fromEntries(Object.entries(f || {}).filter(([, v]) => v !== undefined && v !== null && v !== ''));

const I = {
  play: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>,
  pause: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1" /><rect x="14" y="4.5" width="4" height="15" rx="1" /></svg>,
  prev: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="2.4" height="14" rx="1" /><path d="M19 5v14L8.5 12z" /></svg>,
  next: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="16.6" y="5" width="2.4" height="14" rx="1" /><path d="M5 5v14l10.5-7z" /></svg>,
  undo: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 010 11H11" /></svg>,
  redo: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 000 11H13" /></svg>,
  zoomOut: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M8 11h6M16 16l4 4" /></svg>,
  zoomIn: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M8 11h6M11 8v6M16 16l4 4" /></svg>,
  search: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>,
  export: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" /><path d="M5 14v4.5A1.5 1.5 0 006.5 20h11a1.5 1.5 0 001.5-1.5V14" /></svg>,
  stop: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>,
  drop: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 7h14M10 11v6M14 11v6M6.5 7l1 12.5h9L17.5 7M9.5 7V4.5h5V7" /></svg>,
  reset: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12a8 8 0 108-8 8.5 8.5 0 00-6 2.5L4 8.5" /><path d="M4 4v4.5h4.5" /></svg>,
  layout: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="4" width="16" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>,
  cc: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M10.5 10.2a2.3 2.3 0 100 3.6M17 10.2a2.3 2.3 0 100 3.6" /></svg>,
  text: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 6V4.5h14V6M12 4.5v15M9 19.5h6" /></svg>,
  up: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 15l6-6 6 6" /></svg>,
  down: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>,
  mail: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5l8.5 6.5 8.5-6.5" /></svg>,
  tg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M21 4L3 11.2l6.3 2.3L19 7l-7.6 8.1.2 4.9 3.1-3.4 3.9 2.9z" /></svg>,
  phone: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="7" y="3" width="10" height="18" rx="2" /></svg>,
};

// ---------- app ------------------------------------------------------------------------
function Editor() {
  const [eps, setEps] = useState<Proj[]>([]);
  const setDone = async (id: string, done: boolean) => {
    setEps((l) => l.map((e) => (e.id === id ? { ...e, done } : e)));
    await api(`/api/ep/${id}/done`, { done });
  };
  const projSel = useRef<HTMLSelectElement>(null);
  useEffect(() => {  // the shared menu's ✓
    const el = projSel.current; if (!el) return;
    const on = (e: any) => setDone(e.detail.value, e.detail.done);
    el.addEventListener('studio-done', on);
    return () => el.removeEventListener('studio-done', on);
  });
  const [ep, setEp] = useState(store.get('zc-ep') || '');
  const [data, setData] = useState<Data | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [sel, setSel] = useState<Sel>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<'script' | 'media' | 'templates'>('script');
  const [query, setQuery] = useState<string | null>(null);
  const [tlH, setTlH] = useState(+(store.get('zc-tlh2') || 330));
  const [undo, setUndo] = useState<Change[]>([]);
  const [redo, setRedo] = useState<Change[]>([]);
  const player = useRef<PlayerRef>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => { api('/api/episodes').then((l) => { setEps(l); if (!l.find((e: any) => e.id === ep)) setEp(l.find((e: any) => !e.id.endsWith('-test'))?.id || l[0]?.id); }); }, []);
  const load = useCallback(async () => { if (!ep) return; const d: Data = await api(`/api/ep/${ep}`); setData(d); setJob(d.job); }, [ep]);
  useEffect(() => { if (ep) { store.set('zc-ep', ep); setData(null); setSel(null); setUndo([]); setRedo([]); load(); } }, [ep]);
  useEffect(() => {  // one project for every tool: picked in the Reader or Karaoke -> opened here too
    const on = (e: StorageEvent) => { if (e.key === 'zc-ep' && e.newValue) setEp(e.newValue); };
    addEventListener('storage', on);
    return () => removeEventListener('storage', on);
  }, []);
  useEffect(() => {
    if (!job?.running) return;
    const t = setInterval(async () => { const j: Job = await api(`/api/ep/${ep}/job`); setJob(j); if (!j.running) { clearInterval(t); load(); if (!j.code && j.send?.length) followSends(j.send); } }, 700);
    return () => clearInterval(t);
  }, [job?.running, ep]);

  const fps = data?.edit?.fps || 30;
  const total = data?.edit ? data.edit.durationInFrames / fps : 0;
  const lines = data?.state?.lines || [];
  const chars: any[] = data?.episode?.characters || [];
  // text on video is edited live: a local draft drives the preview, saved in the background
  const [ovDraft, setOvDraft] = useState<Overlay[]>([]);
  useEffect(() => setOvDraft(data?.episode?.overlays || []), [data?.episode]);
  const [speed, setSpeed] = useState(1);
  useEffect(() => setSpeed(data?.episode?.speed || 1), [data?.episode]);
  const changeSpeed = (v: number) => { setSpeed(v); api(`/api/ep/${ep}/speed`, { speed: v }); };  // no rebuild needed
  const saveTimer = useRef<any>(null);
  const saveOverlays = (next: Overlay[]) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => api(`/api/ep/${ep}/overlays`, { overlays: next }), 350);
  };
  const ovBase = useRef<Overlay[] | null>(null);
  const changeOverlays = (next: Overlay[], commit = true) => {
    if (!ovBase.current) ovBase.current = ovDraft;
    setOvDraft(next); saveOverlays(next);
    if (commit) { setUndo([...undo, { kind: 'overlays', before: ovBase.current, after: next }]); setRedo([]); ovBase.current = null; }
  };
  const liveOverlays = useMemo(() => {
    const total = data?.edit?.durationInFrames || 0;
    return ovDraft.filter((o) => (o.text || '').trim()).map((o) => {
      const from = Math.round((o.start || 0) * fps), end = o.end ? Math.min(total, Math.round(o.end * fps)) : total;
      return { text: o.text, style: o.style || 'pov', from, dur: Math.max(1, end - from), font: o.font || 'system', theme: o.theme || 'light', opacity: o.opacity ?? 1, y: o.y ?? null };
    });
  }, [ovDraft, data?.edit, fps]);
  const [charDraft, setCharDraft] = useState<Record<string, { look?: any; frame?: any }>>({});
  useEffect(() => setCharDraft({}), [data?.episode]);
  const charTimer = useRef<any>(null);
  const changeChar = (id: string, patch: { look?: any; frame?: any }) => {
    const curC = chars.find((c) => c.id === id) || {};
    const next = { look: { ...(curC.look || {}), ...(charDraft[id]?.look || {}), ...(patch.look || {}) },
                   frame: { ...(curC.frame || {}), ...(charDraft[id]?.frame || {}), ...(patch.frame || {}) } };
    setCharDraft({ ...charDraft, [id]: next });
    clearTimeout(charTimer.current);
    charTimer.current = setTimeout(() => api(`/api/ep/${ep}/character`, { id, ...next }), 350);
  };
  const liveParticipants = useMemo(() => (data?.edit?.participants || []).map((pp: any) => charDraft[pp.id] ? { ...pp, ...charDraft[pp.id] } : pp), [data?.edit, charDraft]);
  const props = useMemo(() => data?.edit && ({ ...data.edit, participants: liveParticipants, overlays: liveOverlays, mediaBase: `/media/${ep}/`,
    audioSrc: data.audioVersion ? `/media/${ep}/dialogue.wav?v=${data.audioVersion}` : undefined }), [data?.edit, data?.audioVersion, ep, liveOverlays, liveParticipants]);

  useEffect(() => {
    const p = player.current; if (!p) return;
    const fu = (e: any) => setFrame(e.detail.frame), pl = () => setPlaying(true), pa = () => setPlaying(false);
    p.addEventListener('frameupdate', fu); p.addEventListener('play', pl); p.addEventListener('pause', pa);
    return () => { p.removeEventListener('frameupdate', fu); p.removeEventListener('play', pl); p.removeEventListener('pause', pa); };
  }, [props]);

  const seek = (t: number) => { const f = Math.max(0, Math.min(Math.round(t * fps), (data?.edit?.durationInFrames || 1) - 1)); player.current?.seekTo(f); setFrame(f); };
  const toggle = () => player.current?.toggle();
  const placed = lines.filter((l) => l.start != null);
  const nowLine = useMemo(() => { let c: number | null = null; for (const l of placed) if (l.start! <= frame / fps + 0.01) c = l.n; return c; }, [frame, placed, fps]);
  const jump = (dir: 1 | -1) => {
    const t = frame / fps;
    const target = dir > 0 ? placed.find((l) => l.start! > t + 0.05) : [...placed].reverse().find((l) => l.start! < t - 0.3);
    if (target) { seek(target.start!); setSel({ kind: 'line', n: target.n }); }
  };
  const selectLine = (n: number, go = true) => { setSel({ kind: 'line', n }); const l = lines.find((x) => x.n === n); if (go && l?.start != null) seek(Math.max(0, l.start - 0.3)); };

  // ---- changes (all undoable) ----
  const applyLine = async (n: number, fix: Fix) => setJob(await api(`/api/ep/${ep}/line`, { n, fix: clean(fix) }));
  const applySettings = async (patch: any) => setJob(await api(`/api/ep/${ep}/settings`, patch));
  const changeLine = (n: number, after: Fix) => {
    const before = lines.find((l) => l.n === n)?.fix || {};
    setUndo([...undo, { kind: 'line', n, before, after: clean(after) }]); setRedo([]);
    applyLine(n, after);
  };
  const changeSettings = (patch: any) => {
    const before = Object.fromEntries(Object.keys(patch).map((k) => [k, data?.episode?.[k] ?? null]));
    setUndo([...undo, { kind: 'settings', before, after: patch }]); setRedo([]);
    applySettings(patch);
  };
  // timeline edge drag: side 'l' moves the line's start in the take, 'r' its end (or cut-off point)
  const trim = (n: number, side: 'l' | 'r' | 'm', d: number) => {
    const l = lines.find((x) => x.n === n); if (!l || l.in == null || Math.abs(d) < 0.02) return;
    const fx = l.fix || {};
    if (side === 'm') { changeLine(n, { ...fx, shift: +((fx.shift || 0) + d).toFixed(3) }); return; }
    const base: Fix = { ...fx, clip: fx.clip ?? l.clip!, in: fx.in ?? l.in };
    if (side === 'l') changeLine(n, l.interrupted
      ? { ...base, in: Math.max(0, +(base.in! + d).toFixed(3)), out: undefined, cut: fx.cut ?? l.cut ?? undefined }
      : { ...base, in: Math.max(0, +(base.in! + d).toFixed(3)), out: fx.out ?? l.out! });
    else if (l.interrupted) changeLine(n, { ...base, out: undefined, cut: +((fx.cut ?? l.cut!) + d).toFixed(3) });
    else changeLine(n, { ...base, out: +((fx.out ?? l.out!) + d).toFixed(3) });
  };
  const apply = (c: Change, which: 'before' | 'after') => {
    if (c.kind === 'line') applyLine(c.n, c[which]);
    else if (c.kind === 'overlays') { setOvDraft(c[which]); saveOverlays(c[which]); }
    else applySettings(c[which]);
  };
  const doUndo = () => { const c = undo[undo.length - 1]; if (!c || (job?.running && c.kind !== 'overlays')) return; setUndo(undo.slice(0, -1)); setRedo([...redo, c]); apply(c, 'before'); };
  const doRedo = () => { const c = redo[redo.length - 1]; if (!c || (job?.running && c.kind !== 'overlays')) return; setRedo(redo.slice(0, -1)); setUndo([...undo, c]); apply(c, 'after'); };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); }
      else if (e.code === 'Space') { e.preventDefault(); toggle(); }
      else if (e.key === 'Home') { e.preventDefault(); seek(0); }
      else if (e.key === 'End') { e.preventDefault(); seek(total); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); jump(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); jump(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); seek((frame + (e.shiftKey ? fps : 1)) / fps); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); seek((frame - (e.shiftKey ? fps : 1)) / fps); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  // ---- share the exported video ----
  const [share, setShare] = useState<{ channel: string; running: boolean; ok: boolean | null; log: string[]; error: string | null } | null>(null);
  const send = async (channel: 'email' | 'telegram') => {
    let j = await api(`/api/ep/${ep}/share`, { channel });
    if (j.error && !j.channel) { setShare({ channel, running: false, ok: false, log: [], error: j.error }); return; }
    setShare(j);
    while (j?.running) { await new Promise((r) => setTimeout(r, 1000)); j = await api(`/api/ep/${ep}/share/${channel}`); setShare(j); }
  };
  const followSends = async (channels: string[]) => {
    for (const ch of channels) {
      let j: any = null;
      for (let i = 0; i < 600; i++) {
        j = await api(`/api/ep/${ep}/share/${ch}`);
        if (j) setShare(j);
        if (j && !j.running) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  };
  const shareText = share && (share.running ? (share.log[share.log.length - 1] || 'Preparing…')
    : share.ok ? (share.channel === 'email' ? '✓ Sent by email' : '✓ Sent to Telegram') : `Send failed: ${share.error}`);

  const busy = !!job?.running;
  const last = (job?.log?.length ? job.log[job.log.length - 1] : '').trim();
  const pct = job?.kind === 'export' && /Rendered (\d+)\/(\d+)/.exec(last);
  const statusText = busy
    ? job!.kind === 'export' ? (pct ? `Exporting · ${Math.round(100 * +pct[1] / +pct[2])}%` : last.includes('interface') ? 'Exporting · drawing the interface…' : 'Exporting…')
      : last.startsWith('cutting out') ? last.replace('cutting out', 'Removing background ·') : last.startsWith('· transcribing') ? last.replace('· transcribing', 'Listening to') : 'Updating preview…'
    : job?.code ? 'Last run failed' : (data?.state || (data as any)?.preview || (data as any)?.output || (data as any)?.layers?.person) ? 'Preview ready' : 'Not analyzed yet';

  const startDrag = (e: React.MouseEvent) => {
    const y0 = e.clientY, h0 = tlH;
    const mv = (m: MouseEvent) => setTlH(Math.max(180, Math.min(window.innerHeight - 300, h0 - (m.clientY - y0))));
    const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  };
  useEffect(() => store.set('zc-tlh2', String(tlH)), [tlH]);
  const shown = query ? lines.filter((l) => (l.text + ' ' + l.name + ' ' + l.n).includes(query)) : lines;

  const lessonData = (data as any)?.episode?.type === 'lesson' ? (data as any) : null;
  const ready = !!data?.state || !!lessonData?.preview || !!lessonData?.output || !!lessonData?.layers?.person;  // a layered preview counts
  const top = (
      <div className="top studio-top">
        {/* @ts-ignore - the shared studio bar (render/studio/bar.js) */}
        <studio-nav app="video"></studio-nav>
        <div className="proj">
          {/* the shared project menu (render/studio/bar.js) draws this - the same one in every tool */}
          <select data-picker="project" ref={projSel} value={ep} onChange={(e) => setEp(e.target.value)}>
            {eps.map((e) => <option key={e.id} value={e.id} data-sub={e.title} data-done={e.done ? '1' : '0'} data-tag={e.test ? 'test' : undefined}
              data-meta={`${e.template || ''} · ${e.created ? new Date(e.created).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}`}>{e.id}</option>)}
          </select>
        </div>
        <div className="state"><span className={`ring ${busy ? 'busy' : job?.code ? 'err' : ''}`} />{statusText}</div>
        <div className="grow" />
        {busy && <button className="btn" onClick={async () => setJob(await api(`/api/ep/${ep}/cancel`, {}))}>{I.stop} Stop</button>}
        <button className="btn" disabled={busy} onClick={async () => setJob(await api(`/api/ep/${ep}/analyze`, {}))}>Re-analyze</button>
        {shareText && <div className="state" style={{ color: share!.ok === false ? 'var(--bad)' : share!.ok ? 'var(--ok)' : 'var(--dim)' }}>{shareText}</div>}
        {data?.output && !busy && <a href={`${data.output}?v=${Date.now()}`} target="_blank"><button className="btn">Open MP4</button></a>}
        {data?.output && !busy && <button className="btn" disabled={!!share?.running} title="Email the video to shlomi@boostart.io" onClick={() => send('email')}>{I.mail} Email</button>}
        {data?.output && !busy && <button className="btn" disabled={!!share?.running} title="Send the video to your Telegram" onClick={() => send('telegram')}>{I.tg} Telegram</button>}
        <button className="btn" disabled={busy || !ready} onClick={async () => setJob(await api(`/api/ep/${ep}/export`, {}))}>{I.export} Export</button>
        <button className="btn primary" disabled={busy || !ready} title="Export, then send it to your email and Telegram"
          onClick={async () => { setShare(null); setJob(await api(`/api/ep/${ep}/export`, { send: ['telegram', 'email'] })); }}>{I.export} Export & send</button>
      </div>
  );
  if (lessonData) return <LessonView ep={ep} data={lessonData} top={top} busy={busy} setJob={setJob} />;

  return (
    <div className="ed" style={{ ['--tl-h' as any]: `${tlH}px` }}>
      {top}

      <div className="work">
        <div className="pane left">
          <div className="tabs">
            {(['script', 'media', 'templates'] as const).map((t) => (
              <div key={t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
                {t === 'script' ? 'Script' : t === 'media' ? `Media${data?.footage?.unassigned?.length ? ' •' : ''}` : '+ New video'}
              </div>))}
            <div className="grow" />
            {tab === 'script' && <button className="btn ghost icon" title="Search lines" onClick={() => setQuery(query == null ? '' : null)}>{I.search}</button>}
          </div>
          {tab === 'script' && query != null && <div className="search"><input autoFocus className="field he" placeholder="חיפוש בתסריט…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>}
          <div className="scroll">
            {tab === 'script' && (
              <div className="lines">
                {shown.map((l) => (
                  <div key={l.n} className={`ln ${sel?.kind === 'line' && sel.n === l.n ? 'on' : ''} ${nowLine === l.n ? 'now' : ''} ${l.status === 'skipped' ? 'dropped' : ''}`}
                    onClick={() => selectLine(l.n)}>
                    <div className="n">{l.n}</div>
                    <div className="av" style={{ background: colorOf(l.speaker, chars) }}>{l.name[0]}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="who he" style={{ textAlign: 'left' }}>{l.name}</div>
                      <div className="t he">{l.text}</div>
                    </div>
                    <div className="sdot" style={{ background: DOT[l.status] }} title={STATUS[l.status]} />
                  </div>))}
                {!lines.length && <div className="empty" style={{ padding: 16 }}>{busy ? 'Analyzing your footage…' : 'Press Re-analyze to start.'}</div>}
              </div>)}
            {tab === 'media' && <Media data={data} ep={ep} busy={busy} onJob={setJob} />}
            {tab === 'templates' && <NewVideo />}
          </div>
        </div>

        <div className="pane viewer">
          <div className="monitor">
            <div className="frame" ref={frameRef} style={{ position: 'relative' }}>
              {sel?.kind === 'text' && ovDraft[sel.i] && <TextHandle o={ovDraft[sel.i]} i={sel.i} scale={(frameRef.current?.clientHeight || 1920) / 1920}
                onMove={(y, done) => changeOverlays(ovDraft.map((x, k) => (k === sel.i ? { ...x, y } : x)), done)} />}
              {props && <Player ref={player} component={ZoomCall as any} inputProps={props} durationInFrames={props.durationInFrames}
                fps={props.fps} compositionWidth={1080} compositionHeight={1920} controls={false} clickToPlay playbackRate={speed}
                style={{ width: '100%', height: '100%' }} />}
            </div>
          </div>
          <div className="transport">
            <div><span className="chip">{I.phone}&nbsp;9:16</span></div>
            <div className="mid">
              <button className="btn ghost icon" title="Previous line (↑)" onClick={() => jump(-1)}>{I.prev}</button>
              <button className="play" title="Play / pause (space)" onClick={toggle}>{playing ? I.pause : I.play}</button>
              <button className="btn ghost icon" title="Next line (↓)" onClick={() => jump(1)}>{I.next}</button>
            </div>
            <div className="tc">{mmss(frame / fps)} <span>/ {mmss(total)}</span></div>
          </div>
        </div>

        <div className="pane right">
          <div className="pane-h">Inspector</div>
          <div className="scroll">
            <Inspector data={data} sel={sel} busy={busy} job={job} chars={chars} onFix={changeLine} onSettings={changeSettings}
              participants={liveParticipants} onChar={changeChar} speed={speed} onSpeed={changeSpeed}
              overlays={ovDraft} onOverlays={changeOverlays} onSelText={(i) => setSel({ kind: 'text', i })} />
          </div>
        </div>
      </div>

      <div className="split" onMouseDown={startDrag} />
      <Timeline data={data && data.edit ? { ...data, edit: { ...data.edit, overlays: liveOverlays } } : data} frame={frame} fps={fps} total={total} sel={sel} playing={playing} chars={chars}
        canUndo={!!undo.length && !busy} canRedo={!!redo.length && !busy} onUndo={doUndo} onRedo={doRedo} busy={busy} onTrim={trim}
        onSeek={seek} onSelLine={(n) => selectLine(n, false)} onSelText={(i) => setSel({ kind: 'text', i })} />
    </div>
  );
}

// ---------- media bin --------------------------------------------------------------------
function Media({ data, ep, busy, onJob }: { data: Data | null; ep: string; busy: boolean; onJob: (j: Job) => void }) {
  const f = data?.footage;
  if (!f) return <div className="empty" style={{ padding: 16 }}>No footage scanned yet.</div>;
  const chars = data!.episode?.characters || [];
  const rows = [...f.unassigned.map((rel) => ({ rel, char: '', kind: 'lines' })), ...f.clips];
  const assign = async (rel: string, char: string, kind: string) => onJob(await api(`/api/ep/${ep}/files`, { files: { [rel]: { char, kind } } }));
  return (
    <>
      {f.unassigned.length > 0 && <div className="note">Pick a character for every file — the edit continues once all are assigned.</div>}
      {rows.map((r) => {
        const c = chars.find((x: any) => x.id === r.char);
        return (
          <div key={r.rel} className="item">
            <div className="av" style={{ background: c ? colorOf(c.id, chars) : 'var(--panel-3)' }}>{c ? c.name[0] : '?'}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="name">{r.rel}</div>
              <div className="ctl">
                <select className="field" disabled={busy} value={r.char} onChange={(e) => assign(r.rel, e.target.value, r.kind)}>
                  <option value="">Who is this?</option>
                  {chars.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <select className="field" disabled={busy || !r.char} value={r.kind} onChange={(e) => assign(r.rel, r.char, e.target.value)}>
                  <option value="lines">Dialogue</option>
                  <option value="listen">Listening</option>
                </select>
              </div>
            </div>
          </div>);
      })}
    </>
  );
}

// ---------- inspector --------------------------------------------------------------------
function Inspector({ data, sel, busy, job, chars, onFix, onSettings, overlays, onOverlays, onSelText, participants, onChar, speed, onSpeed }: {
  participants: any[]; onChar: (id: string, patch: { look?: any; frame?: any }) => void; speed: number; onSpeed: (v: number) => void;
  data: Data | null; sel: Sel; busy: boolean; job: Job | null; chars: any[];
  onFix: (n: number, f: Fix) => void; onSettings: (p: any) => void; onSelText: (i: number) => void;
  overlays: Overlay[]; onOverlays: (o: Overlay[], commit?: boolean) => void;
}) {
  const ov = overlays;
  const runLog = (busy || job?.code) && job?.log?.length
    ? <div className="card"><div className="sec">{busy ? 'Working' : 'Last run'}</div><div className="log">{job!.log.slice(-12).join('\n')}</div></div> : null;
  if (sel?.kind === 'line') {
    const l = data?.state?.lines.find((x) => x.n === sel.n);
    if (l) return <div className="insp"><LineProps key={l.n} l={l} busy={busy} chars={chars} onFix={(f) => onFix(l.n, f)} />
      <CharacterCard who={participants.find((x) => x.id === l.speaker)} onChar={onChar} />{runLog}</div>;
  }
  if (sel?.kind === 'text' && ov[sel.i]) {
    return <div className="insp"><TextProps all={ov} i={sel.i} onChange={onOverlays} />{runLog}</div>;
  }
  const subs = data?.episode?.subtitles !== false;
  return (
    <div className="insp">
      <div className="card">
        <div className="card-h"><div className="title">Project</div></div>
        <div className="check-row"><span>Subtitles</span>
          <div className={`switch ${subs ? 'on' : ''}`} onClick={() => !busy && onSettings({ subtitles: !subs })} /></div>
        <div>
          <div className="sec" style={{ marginBottom: 8 }}>Text on video</div>
          {ov.map((o, i) => <div key={i} className="ln he" style={{ gridTemplateColumns: '1fr', padding: '8px 10px', marginBottom: 4 }} onClick={() => onSelText(i)}><div className="t" style={{ color: 'var(--text)' }}>{o.text}</div></div>)}
          <button className="btn" style={{ marginTop: 4 }} onClick={() => { onOverlays([...ov, { text: 'פוב: ', start: 0, end: null, style: 'pov', font: 'assistant', theme: 'light', opacity: 1 }]); onSelText(ov.length); }}>+ Add text</button>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="sec" style={{ marginBottom: 8 }}>Speed</div>
          <div className="seg" style={{ gridTemplateColumns: `repeat(${SPEEDS.length}, 1fr)` }}>
            {SPEEDS.map((v) => <button key={v} className={speed === v ? 'on' : ''} onClick={() => onSpeed(v)}>{v === 1 ? '1×' : `${v}×`}</button>)}
          </div>
          {data?.state?.total ? <div className="row2" style={{ margin: '8px 0 12px' }}><label>Final video</label>
            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{mmss(data.state.total / speed)}{speed !== 1 ? <span style={{ color: 'var(--faint)', fontWeight: 400 }}> · {mmss(data.state.total)} at 1×</span> : null}</span></div> : null}
          <div className="help">The whole video, every layer together - plays live at this speed (voices keep their pitch); Export makes the file at it.</div>
        </div>
      </div>
      {runLog}
      <div className="empty">Select a line in the script or a clip on the timeline to fine-tune it. Ctrl+Z undoes any change.</div>
    </div>
  );
}

function Num({ value, onCommit, step = 0.05, disabled, placeholder }: { value?: number | null; onCommit: (v: number | undefined) => void; step?: number; disabled?: boolean; placeholder?: string }) {
  const [v, setV] = useState(value == null ? '' : f2(value));
  useEffect(() => setV(value == null ? '' : f2(value)), [value]);
  const commit = (s: string) => { const n = s === '' ? undefined : +(+s).toFixed(3); if (n !== value && !(n !== undefined && isNaN(n))) onCommit(n); };
  const bump = (d: number) => { const n = Math.max(0, +((value ?? 0) + d).toFixed(3)); setV(f2(n)); onCommit(n); };
  return (
    <div className="num">
      <input value={v} disabled={disabled} placeholder={placeholder} onChange={(e) => setV(e.target.value)}
        onBlur={(e) => commit(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
      <div className="arr">
        <button disabled={disabled} onClick={() => bump(step)} tabIndex={-1}>{I.up}</button>
        <button disabled={disabled} onClick={() => bump(-step)} tabIndex={-1}>{I.down}</button>
      </div>
    </div>
  );
}

function LineProps({ l, busy, chars, onFix }: { l: Line; busy: boolean; chars: any[]; onFix: (f: Fix) => void }) {
  const fix = l.fix || {};
  const cur: Take | null = l.clip ? { clip: l.clip, in: l.in!, out: l.out!, cut: l.cut ?? undefined } : null;
  const options: Take[] = [...(l.auto ? [l.auto] : []), ...l.alternatives];
  const key = (t: Take) => `${t.clip}|${t.in}`;
  const match = cur && options.find((o) => o.clip === cur.clip && Math.abs(o.in - cur.in) < 0.5);
  const set = (p: Fix) => onFix({ ...fix, ...p });
  const setTime = (field: 'in' | 'out' | 'cut', v: number | undefined) => {
    if (!cur || v === undefined) return;
    const p: Fix = { clip: fix.clip ?? cur.clip, in: fix.in ?? cur.in };
    if (!l.interrupted) p.out = fix.out ?? cur.out;
    else { p.out = undefined; p.cut = fix.cut ?? cur.cut; }
    (p as any)[field] = v;
    set(p);
  };
  const lay = fix.layout || '';
  const endField = l.interrupted ? 'cut' : 'out';
  return (
    <>
      <div className="card">
        <div className="card-h">
          <div className="av" style={{ background: colorOf(l.speaker, chars) }}>{l.name[0]}</div>
          <div className="title grow">Line {l.n} — <span className="he">{l.name}</span></div>
          <span className={`badge ${l.status}`}>{STATUS[l.status]}{l.score != null && l.status !== 'skipped' ? ` ${Math.round(l.score * 100)}%` : ''}</span>
        </div>
        <div className="quote he">{l.text}</div>
        {l.heard && <div className="heard he">שמעתי: {l.heard}</div>}
        {l.status === 'check' && <div className="help" style={{ marginTop: 0 }}>Not fully sure about this match (English words or mumbling). Play it, then keep it or pick another take.</div>}
        {l.status === 'missing' && <div className="help" style={{ marginTop: 0 }}>Not found in any take. Record it, or drop the line.</div>}
      </div>

      <div className="card">
        <div className="sec">Take & timing{Object.keys(fix).length > 0 && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>edited</span>}</div>
        <div className="row2"><label>Take</label>
          <select className="field" disabled={busy || !options.length} value={match ? key(match) : ''}
            onChange={(e) => {
              const t = options.find((o) => key(o) === e.target.value); if (!t) return;
              if (l.auto && key(t) === key(l.auto)) { const { clip, in: _i, out, cut, ...rest } = fix; onFix(rest); }
              else set({ clip: t.clip, in: t.in, out: t.out, cut: l.interrupted ? t.cut : undefined });
            }}>
            {!match && cur && <option value="">{cur.clip} @ {f2(cur.in)}s (edited)</option>}
            {options.map((o, i) => <option key={key(o)} value={key(o)}>{i === 0 && l.auto ? 'Best — ' : ''}{o.clip} @ {f2(o.in)}s{o.score != null ? ` · ${Math.round(o.score * 100)}%` : ''}</option>)}
          </select></div>
        <div className="pair">
          <label>In</label><Num value={fix.in ?? cur?.in} disabled={busy || !cur} onCommit={(v) => setTime('in', v)} />
          <label>{l.interrupted ? 'Cut' : 'Out'}</label><Num value={(fix as any)[endField] ?? (cur as any)?.[endField]} disabled={busy || !cur} onCommit={(v) => setTime(endField, v)} />
        </div>
        {l.interrupted && <div className="help">"Cut" is the moment the next speaker jumps in — this line is interrupted.</div>}
        <div className="row2"><label>Pause</label><Num value={fix.pause_before} placeholder="auto" step={0.1} disabled={busy} onCommit={(v) => set({ pause_before: v })} /></div>
      </div>

      <LineSound fix={fix} busy={busy} set={set} />

      <div className="card">
        <div className="sec">Layout</div>
        <div className="seg">{LAYOUTS.map(([k, label]) => <button key={k} className={lay === k ? 'on' : ''} disabled={busy} onClick={() => set({ layout: k || undefined })}>{label}</button>)}</div>
        <div className="help">{LAYOUTS.find(([k]) => k === lay)?.[2]}</div>
      </div>

      <div className="actions">
        <button className="btn primary block" disabled={busy} onClick={() => set({ skip: !fix.skip || undefined })}>{I.drop}{fix.skip ? 'Restore line' : 'Drop line'}</button>
        <button className="btn block" disabled={busy || !Object.keys(fix).length} onClick={() => onFix({})}>{I.reset}Reset</button>
      </div>
    </>
  );
}

// a line's sound: its volume and a softener for a shouted / too-close line (applied in the mix, editor and export alike)
function LineSound({ fix, busy, set }: { fix: Fix; busy: boolean; set: (p: Fix) => void }) {
  const [vol, setVol] = useState(Math.round((fix.gain ?? 1) * 100));
  useEffect(() => setVol(Math.round((fix.gain ?? 1) * 100)), [fix.gain]);
  const commit = () => { const g = vol / 100; if (Math.abs(g - (fix.gain ?? 1)) > 0.004) set({ gain: Math.abs(g - 1) < 0.004 ? undefined : g }); };
  return (
    <div className="card">
      <div className="sec">Sound{(fix.gain != null || fix.soften) && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>edited</span>}</div>
      <div className="row2"><label>Volume</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="range" min={0} max={150} step={5} value={vol} disabled={busy} style={{ flex: 1, accentColor: 'var(--accent)' }}
            onChange={(e) => setVol(+e.target.value)} onMouseUp={commit} onKeyUp={commit} onTouchEnd={commit} />
          <span style={{ minWidth: 44, textAlign: 'right', color: 'var(--dim)' }}>{vol}%</span>
        </div></div>
      <div className="check-row"><span>Soften (shouted / too close to the mic)</span>
        <div className={`switch ${fix.soften ? 'on' : ''}`} onClick={() => !busy && set({ soften: fix.soften ? undefined : true })} /></div>
      <div className="help">Rebuilds the sound in a few seconds. Soften takes the harshness out and evens the peaks; Volume turns the line up or down.</div>
    </div>
  );
}

function TextProps({ all, i, onChange }: { all: Overlay[]; i: number; onChange: (o: Overlay[], commit?: boolean) => void }) {
  const o = all[i];
  const set = (patch: Partial<Overlay>, commit = true) => onChange(all.map((x, k) => (k === i ? { ...x, ...patch } : x)), commit);
  const theme = o.theme || 'light', op = o.opacity ?? 1;
  const chipBg = (t: string) => (t === 'light' ? `rgba(255,255,255,${op})` : `rgba(0,0,0,${op})`);
  return (
    <>
      <div className="card">
        <div className="card-h"><div className="av" style={{ background: 'var(--gold)', color: '#2a2000' }}>T</div><div className="title grow">Text on video</div>
          <span className="help" style={{ margin: 0 }}>changes show live</span></div>
        <textarea className="field he" rows={3} value={o.text} onChange={(e) => set({ text: e.target.value }, false)} onBlur={() => set({}, true)}
          style={{ height: 'auto', padding: 10, fontSize: 15, resize: 'vertical', userSelect: 'text', fontFamily: fontCss(o.font) }} />
        <div className="help" style={{ marginTop: -4 }}>Drag the dashed box on the preview to move the text.</div>
      </div>

      <div className="card">
        <div className="sec">Style</div>
        <div className="swatches">
          {(['light', 'dark', 'gold'] as const).map((t) => (
            <button key={t} className={`swatch ${theme === t ? 'on' : ''}`} onClick={() => set({ theme: t })}
              title={t === 'light' ? 'White box, black text' : t === 'dark' ? 'Black box, white text' : 'Yellow text, black outline (religious look)'}>
              <span className="chip-prev he" style={{ background: chipBg(t), color: t === 'gold' ? '#FFD60A' : t === 'dark' ? '#fff' : '#000', fontFamily: fontCss(o.font),
                ...(t === 'gold' ? { WebkitTextStroke: '3px #000', paintOrder: 'stroke fill' } as any : {}) }}>פוב</span>
            </button>))}
        </div>
        <div className="row2"><label>Box</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="range" min={0} max={1} step={0.05} value={op} style={{ flex: 1, accentColor: 'var(--accent)' }}
              onChange={(e) => set({ opacity: +e.target.value }, false)} onMouseUp={() => set({}, true)} />
            <span style={{ width: 40, textAlign: 'right', color: 'var(--dim)' }}>{Math.round(op * 100)}%</span>
          </div></div>
        <div className="row2"><label>Size</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="range" min={30} max={90} step={1} value={o.size || 46} style={{ flex: 1, accentColor: 'var(--accent)' }}
              onChange={(e) => set({ size: +e.target.value }, false)} onMouseUp={() => set({}, true)} />
            <span style={{ width: 40, textAlign: 'right', color: 'var(--dim)' }}>{o.size || 46}</span>
          </div></div>
      </div>

      <div className="card">
        <div className="sec">Font</div>
        <div className="fonts">
          {FONT_LIST.map((f) => (
            <button key={f.id} className={`font-tile ${(o.font || 'system') === f.id ? 'on' : ''}`} onClick={() => set({ font: f.id })}>
              <span className="he" style={{ fontFamily: fontCss(f.id), fontSize: 22, fontWeight: ['system', 'arimo', 'assistant'].includes(f.id) ? 700 : 400 }}>פוב: שיחת הנהלה</span>
              <small>{f.name}</small>
            </button>))}
        </div>
      </div>

      <div className="card">
        <div className="sec">Position & timing</div>
        <div className="seg" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <button className={o.style === 'pov' ? 'on' : ''} onClick={() => set({ style: 'pov', y: null })}>Top (POV)</button>
          <button className={o.style === 'label' ? 'on' : ''} onClick={() => set({ style: 'label', y: null })}>Middle</button>
          <button className={o.style === 'ticker' ? 'on' : ''} onClick={() => set({ style: 'ticker', y: o.y ?? 1560, theme: 'dark', opacity: 0.55 })}>Ticker</button>
        </div>
        {o.style === 'ticker' && <div className="row2"><label>Speed</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="range" min={40} max={300} step={5} value={(o as any).speed || 120} style={{ flex: 1, accentColor: 'var(--accent)' }}
              onChange={(e) => set({ speed: +e.target.value } as any, false)} onMouseUp={() => set({}, true)} />
            <span style={{ width: 40, textAlign: 'right', color: 'var(--dim)' }}>{(o as any).speed || 120}</span>
          </div></div>}
        <div className="pair">
          <label>From</label><Num value={o.start} step={0.5} onCommit={(v) => set({ start: v ?? 0 })} />
          <label>Until</label><Num value={o.end} step={0.5} placeholder="end" onCommit={(v) => set({ end: v ?? null })} />
        </div>
        <button className="btn" onClick={() => onChange(all.filter((_, k) => k !== i))}>{I.drop}Delete text</button>
      </div>
    </>
  );
}

// a draggable outline over the selected text, in preview coordinates
function TextHandle({ o, i, scale, onMove }: { o: Overlay; i: number; scale: number; onMove: (y: number, done: boolean) => void }) {
  const y = o.y ?? (o.style === 'label' ? 1180 : 270 + i * 150);
  const down = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const y0 = e.clientY, start = y;
    let cur = start;
    const mv = (m: MouseEvent) => { cur = Math.max(0, Math.min(1700, Math.round(start + (m.clientY - y0) / scale))); onMove(cur, false); };
    const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); onMove(cur, true); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  };
  return <div className="text-handle" style={{ top: y * scale - 6, height: 150 * scale }} onMouseDown={down} title="Drag to move" />;
}

// the live look: the same colour matrix as lesson.py look_matrix, and the same soft focus (sigma, mix)
function lookMatrix(lk: any): number[][] {
  const w = lk?.warm || 0, b = lk?.brightness || 0, s = lk?.saturation ?? 1;
  const L = [0.2126, 0.7152, 0.0722], g = [1 + w, 1 + w / 3, 1 - w];
  return [0, 1, 2].map((i) => [0, 1, 2].map((j) => (1 + b) * g[i] * ((1 - s) * L[j] + (i === j ? s : 0))));
}
function LookFilter({ id, lk }: { id: string; lk: any }) {
  const m = lookMatrix(lk), sm = lk?.smooth || 0, sigma = 4 * sm, amt = 0.65 * sm;
  const vals = `${m[0].join(' ')} 0 0 ${m[1].join(' ')} 0 0 ${m[2].join(' ')} 0 0 0 0 0 1 0`;
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <filter id={id} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
        <feColorMatrix in="SourceGraphic" type="matrix" values={vals} result="c" />
        <feGaussianBlur in="c" stdDeviation={sigma} result="b" />
        <feComposite in="b" in2="c" operator="arithmetic" k1={0} k2={amt} k3={1 - amt} k4={0} result="mix" />
        <feComposite in="mix" in2="SourceAlpha" operator="in" />
      </filter>
    </svg>
  );
}

function Slider({ label, v, min, max, step, fmt, onChange }: { label: string; v: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div className="row2"><label>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input type="range" min={min} max={max} step={step} value={v} style={{ flex: 1, accentColor: 'var(--accent)' }} onChange={(e) => onChange(+e.target.value)}
          onDoubleClick={() => onChange(min <= 0 && max >= 0 && min < 0 ? 0 : 1)} />
        <span style={{ minWidth: 52, textAlign: 'right', color: 'var(--dim)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(v)}</span>
      </div></div>
  );
}

// how one person looks in every tile: framing and colour, live
function CharacterCard({ who, onChar }: { who: any; onChar: (id: string, patch: { look?: any; frame?: any }) => void }) {
  if (!who) return null;
  const fr = who.frame || {}, lk = who.look || {};
  const pct = (v: number) => `${Math.round(v * 100)}%`, sgn = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}`;
  return (
    <div className="card">
      <div className="card-h"><div className="title grow">{who.name} — look</div><span className="help" style={{ margin: 0 }}>all their shots · live</span></div>
      <Slider label="Zoom" v={fr.zoom ?? 1} min={1} max={1.8} step={0.02} fmt={pct} onChange={(v) => onChar(who.id, { frame: { zoom: v } })} />
      <Slider label="Up / down" v={fr.y ?? 0} min={-0.2} max={0.2} step={0.01} fmt={sgn} onChange={(v) => onChar(who.id, { frame: { y: v } })} />
      <Slider label="Left / right" v={fr.x ?? 0} min={-0.25} max={0.25} step={0.01} fmt={sgn} onChange={(v) => onChar(who.id, { frame: { x: v } })} />
      <Slider label="Color" v={lk.saturate ?? 1} min={0.5} max={2} step={0.05} fmt={pct} onChange={(v) => onChar(who.id, { look: { saturate: v } })} />
      <Slider label="Brightness" v={lk.brightness ?? 1} min={0.7} max={1.4} step={0.02} fmt={pct} onChange={(v) => onChar(who.id, { look: { brightness: v } })} />
      <Slider label="Contrast" v={lk.contrast ?? 1} min={0.7} max={1.4} step={0.02} fmt={pct} onChange={(v) => onChar(who.id, { look: { contrast: v } })} />
      <div className="help">Double-click a slider to reset it.</div>
    </div>
  );
}

// ---------- timeline ---------------------------------------------------------------------
function Timeline({ data, frame, fps, total, sel, playing, chars, canUndo, canRedo, onUndo, onRedo, busy, onTrim, onSeek, onSelLine, onSelText }: {
  data: Data | null; frame: number; fps: number; total: number; sel: Sel; playing: boolean; chars: any[];
  canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void; busy: boolean; onTrim: (n: number, side: 'l' | 'r' | 'm', d: number) => void;
  onSeek: (t: number) => void; onSelLine: (n: number) => void; onSelText: (i: number) => void;
}) {
  const lanesRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ n: number; side: 'l' | 'r' | 'm'; d: number } | null>(null);
  const anchor = useRef<{ t: number; px: number } | null>(null);
  const [width, setWidth] = useState(1000);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = lanesRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth)); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pps = total ? ((width - 24) / total) * zoom : 10;
  // Ctrl/Cmd + wheel zooms around the mouse; plain wheel scrolls the timeline sideways
  useEffect(() => {
    const el = lanesRef.current; if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const r = el.getBoundingClientRect(), px = e.clientX - r.left;
        anchor.current = { t: (px + el.scrollLeft - 8) / pps, px };
        setZoom((z) => Math.max(1, Math.min(40, z * (e.deltaY < 0 ? 1.25 : 0.8))));
      } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [pps]);
  useEffect(() => {
    const el = lanesRef.current, a = anchor.current; if (!el || !a) return;
    el.scrollLeft = a.t * pps + 8 - a.px;
    anchor.current = null;
  }, [zoom]);
  const W = Math.max(width, total * pps + 40);
  const x = (t: number) => t * pps + 8;
  const edit = data?.edit;
  const lines = data?.state?.lines || [];
  useEffect(() => {
    const el = lanesRef.current; if (!el || !playing) return;
    const px = x(frame / fps);
    if (px < el.scrollLeft || px > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = px - 80;
  }, [frame, playing]);
  const scrub = (e: React.MouseEvent) => {
    const el = lanesRef.current!; const r = el.getBoundingClientRect();
    const at = (cx: number) => onSeek((cx - r.left + el.scrollLeft - 8) / pps);
    at(e.clientX);
    const mv = (m: MouseEvent) => at(m.clientX);
    const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  };
  const step = pps > 60 ? 1 : pps > 25 ? 2 : pps > 10 ? 5 : 10;
  const ticks: React.ReactNode[] = [];
  for (let t = 0; t <= total + 0.001; t += step) {
    ticks.push(<div key={t} className="tick" style={{ left: x(t) }}><span>{mmss(t)}</span></div>);
    for (let k = 1; k < 5; k++) ticks.push(<div key={`${t}-${k}`} className="tick minor" style={{ left: x(t + (k * step) / 5) }} />);
  }
  const TH = 40;
  const tracks = ['layout', ...chars.map((c) => c.id), 'captions', 'text'];
  const onlyBg = (e: React.MouseEvent) => e.target === e.currentTarget && scrub(e);
  // drag an edge to trim (take more/less of the recording), drag the body to move the line in time;
  // a press without movement just selects
  const startTrim = (e: React.MouseEvent, n: number, side: 'l' | 'r' | 'm') => {
    e.stopPropagation(); e.preventDefault();
    const x0 = e.clientX;
    let d = 0, moved = false;
    const mv = (m: MouseEvent) => {
      if (Math.abs(m.clientX - x0) > 3) moved = true;
      if (!moved || busy) return;
      d = (m.clientX - x0) / pps; setDrag({ n, side, d });
    };
    const up = () => {
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); setDrag(null);
      if (moved && !busy) onTrim(n, side, d); else onSelLine(n);
    };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  };

  return (
    <div className="tl" style={{ ['--th' as any]: `${TH}px` }}>
      <div className="tl-bar">
        <button className="btn ghost icon" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>{I.undo}</button>
        <button className="btn ghost icon" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={onRedo}>{I.redo}</button>
        <div className="grow" />
        <button className="btn ghost icon" title="Zoom out" onClick={() => setZoom(Math.max(1, zoom / 1.5))}>{I.zoomOut}</button>
        <input type="range" min={1} max={40} step={0.1} value={zoom} onChange={(e) => setZoom(+e.target.value)} title="Ctrl + mouse wheel on the timeline zooms too" />
        <button className="btn ghost icon" title="Zoom in" onClick={() => setZoom(Math.min(40, zoom * 1.5))}>{I.zoomIn}</button>
        <button className="btn" style={{ marginLeft: 6 }} onClick={() => setZoom(1)}>Fit</button>
      </div>
      <div className="tl-body">
        <div className="heads">
          <div className="h ruler" />
          {tracks.map((t) => {
            const c = chars.find((x) => x.id === t);
            return <div key={t} className="h">
              {c ? <><div className="av sm" style={{ background: colorOf(t, chars) }}>{c.name[0]}</div><span className="he">{c.name}</span></>
                : t === 'layout' ? <>{I.layout}Layout</> : t === 'captions' ? <>{I.cc}Captions</> : <>{I.text}Text</>}
            </div>;
          })}
        </div>
        <div className="lanes" ref={lanesRef}>
          <div className="lanes-in" style={{ width: W }}>
            <div className="ruler" onMouseDown={scrub}>{ticks}</div>
            {edit && <>
              <div className="lane" onMouseDown={scrub}>
                {edit.shots.map((s: any, i: number) => (
                  <div key={i} className="shot" data-l={s.layout} style={{ left: x(s.from / fps), width: Math.max(2, s.dur / fps * pps - 3) }}>
                    {(() => {
                      const w = s.dur / fps * pps, name = chars.find((c) => c.id === s.order?.[0])?.name || '';
                      const full = LAYOUT_NAME[s.layout] || s.layout;
                      if (w < 34) return '';
                      if (w < 70) return full[0];
                      return w > 120 && s.layout !== 'gallery' ? `${full} · ${name}` : full;
                    })()}
                  </div>))}
                {edit.events.map((e: any, i: number) => <div key={`e${i}`} className="marker" style={{ left: x(e.at / fps) }}><span className="he">{e.name} הוסר</span></div>)}
              </div>
              {chars.map((c) => (
                <div key={c.id} className="lane" onMouseDown={onlyBg}>
                  {(edit.tiles[c.id] || []).map((s: any, i: number) => <div key={i} className="idle" style={{ left: x(s.from / fps), width: Math.max(1, s.dur / fps * pps - 1) }} />)}
                  {lines.filter((l) => l.speaker === c.id && l.start != null && l.in != null).map((l) => {
                    const dl = drag?.n === l.n && drag.side === 'l' ? drag.d : 0, dr = drag?.n === l.n && drag.side === 'r' ? drag.d : 0;
                    const dm = drag?.n === l.n && drag.side === 'm' ? drag.d : 0;
                    return (
                      <div key={l.n} className={`blk ${sel?.kind === 'line' && sel.n === l.n ? 'sel' : ''} ${l.status === 'check' ? 'check' : ''} ${drag?.n === l.n ? 'dragging' : ''}`}
                        style={{ left: x(l.start! + dl + dm), width: Math.max(14, (l.out! - l.in! - dl + dr) * pps - 2), background: colorOf(c.id, chars) }}
                        onMouseDown={(e) => startTrim(e, l.n, 'm')}
                        title={`${l.text}
Drag the middle to move it · drag an edge to take more or less of the recording`}>
                        <div className="hd l" onMouseDown={(e) => startTrim(e, l.n, 'l')} />
                        #{l.n}{drag?.n === l.n ? ` ${drag.side === 'm' ? 'move ' : ''}${(drag.d >= 0 ? '+' : '')}${drag.d.toFixed(2)}s` : ''}
                        <div className="hd r" onMouseDown={(e) => startTrim(e, l.n, 'r')} />
                      </div>);
                  })}
                </div>
              ))}
              <div className="lane" onMouseDown={scrub}>
                {edit.subtitles && edit.captions.map((c: any, i: number) => (
                  <div key={i} className="cap he" style={{ left: x(c.from / fps), width: Math.max(2, c.dur / fps * pps - 2) }}>{c.text}</div>))}
              </div>
              <div className="lane" onMouseDown={onlyBg}>
                {(edit.overlays || []).map((o: any, i: number) => (
                  <div key={i} className={`txt he ${sel?.kind === 'text' && sel.i === i ? 'sel' : ''}`}
                    style={{ left: x(o.from / fps), width: Math.max(10, o.dur / fps * pps - 2) }}
                    onMouseDown={(e) => e.stopPropagation()} onClick={() => onSelText(i)}>
                  {(o as any).image ? `🖼 ${String((o as any).image).split('/').pop()}` : (o as any).asker ? `${(o as any).asker} שואלת · ${o.text}` : o.text}</div>))}
              </div>
            </>}
            <div className="playhead" style={{ left: x(frame / fps), height: 30 + tracks.length * TH }} />
          </div>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Editor />);

// ---------- lesson template: one speaker, takes in order — same editor, same panes ---------
const SPEEDS = [1, 1.05, 1.1, 1.2, 1.3];

function LessonView({ ep, data, top, busy, setJob }: { ep: string; data: any; top: React.ReactNode; busy: boolean; setJob: (j: Job) => void }) {
  const fps = 30;
  const edit = data.lesson?.edit;
  const [speed, setSpeed] = useState<number>(data.episode.speed || 1);
  useEffect(() => { if (video.current) video.current.playbackRate = speed; });  // live: the browser keeps the voice's pitch
  const k = (edit?.speed || 1);  // the preview was built at this speed: timeline positions shrink with it
  const total = edit ? edit.total / fps / k : 0;
  const video = useRef<HTMLVideoElement>(null);
  const rawVideo = useRef<HTMLVideoElement>(null);  // the original (no eye correction), for the live switch
  const frameRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<'script' | 'media' | 'templates'>('media');
  const [subView, setSubView] = useState<'read' | 'lines'>('read');
  const [wide, setWide] = useState(false);
  type Layer = 'captions' | 'speaker' | 'background' | 'music';
  const [sel, setSel] = useState<{ kind: 'take'; k: number } | { kind: 'text'; i: number } | { kind: 'layer'; id: Layer } | null>(null);
  const [caps, setCaps] = useState<string>(data.lesson?.captions || '');
  const [plaque, setPlaque] = useState<string>((data.episode.plaque || []).join('\n'));
  const [ov, setOv] = useState<Overlay[]>(data.episode.overlays || []);
  const [fh, setFh] = useState(800);
  useEffect(() => { setCaps(data.lesson?.captions || ''); setPlaque((data.episode.plaque || []).join('\n')); setOv(data.episode.overlays || []); },
    [ep, data.outputVersion, data.previewVersion]);
  useEffect(() => {
    const el = frameRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setFh(el.clientHeight)); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const dirty = caps !== (data.lesson?.captions || '') || plaque !== (data.episode.plaque || []).join('\n');
  const save = async (extra: any = {}) => setJob(await api(`/api/ep/${ep}/lesson`, { captions: caps, plaque: plaque.split('\n').filter((x) => x.trim()), ...extra }));
  // text on video: saved as you edit, drawn live over the preview, burnt in on Export (no rebuild needed)
  const ovTimer = useRef<any>(null);
  const changeOv = (next: Overlay[], commit = true) => {
    setOv(next);
    clearTimeout(ovTimer.current);
    ovTimer.current = setTimeout(() => api(`/api/ep/${ep}/overlays`, { overlays: next }), commit ? 50 : 400);
  };
  const addText = () => { const next = [...ov, { text: 'טקסט חדש', start: 0, end: null, style: 'pov', font: 'stam-ashkenaz', theme: 'gold', opacity: 0, y: 300, size: 58 }]; changeOv(next); setSel({ kind: 'text', i: next.length - 1 }); };

  // the script = the takes, in order, with their subtitle text
  const head = caps.split(/^== /m)[0];
  const blocks = caps.split(/^== /m).slice(1).map((b) => { const i = b.indexOf('\n'); return { take: b.slice(0, i).trim(), text: b.slice(i + 1).trim() }; });
  const setBlock = (n: number, text: string) => setCaps(head + blocks.map((b, i) => `== ${b.take}\n${i === n ? text : b.text}\n`).join(''));
  const items: any[] = edit?.items || [];
  const takeStart = (take: string) => { const it = items.find((x) => x.take === take); return it ? it.out / fps / k : 0; };
  const nowTake = [...items].reverse().find((x) => x.out / fps / k <= t + 0.01)?.take;

  const seek = (s: number) => { const v = video.current; if (v) v.currentTime = Math.max(0, Math.min(total, s)); setT(s); };
  const toggle = () => { const v = video.current; if (!v) return; v.paused ? v.play() : v.pause(); };
  const jump = (d: number) => {
    const n = blocks.findIndex((b) => b.take === nowTake) + d;
    if (blocks[n]) { setSel({ kind: 'take', k: n }); seek(takeStart(blocks[n].take)); }
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (['TEXTAREA', 'INPUT'].includes((e.target as HTMLElement)?.tagName)) return;
      // the same keys as the Zoom editor
      if (e.key === 'Escape') { setSel(null); return; }
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      else if (e.key === 'Home') { e.preventDefault(); seek(0); }
      else if (e.key === 'End') { e.preventDefault(); seek(total); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); jump(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); jump(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); seek(t + (e.shiftKey ? 1 : 1 / fps)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); seek(t - (e.shiftKey ? 1 : 1 / fps)); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  const scale = fh / 1920;
  const LAYER_NAMES: Record<string, string> = { captions: 'Captions', speaker: 'Speaker', background: 'Background', music: 'Music & sounds' };
  const inspTitle = !sel ? 'Project' : sel.kind === 'text' ? 'Text' : sel.kind === 'take' ? 'Subtitles' : LAYER_NAMES[sel.id];
  const inspIcon = !sel ? I.layout : sel.kind === 'text' ? I.text : sel.kind === 'take' ? I.cc
    : sel.id === 'captions' ? I.cc : sel.id === 'speaker' ? I.phone : sel.id === 'background' ? I.layout : <span>♪</span>;
  const clock = useCallback(() => video.current?.currentTime ?? 0, []);
  const layered = !!(data.layers?.person && data.layers?.scene && edit?.photo);
  const [bgL, setBgL] = useState<{ zoom: number; x: number; y: number }>({ zoom: 1, x: 0, y: 0, ...(data.episode.bg || {}) });
  const [pL, setPL] = useState<{ scale: number; x: number; y: number }>({ scale: 1, x: 0, y: 0, ...(data.episode.person || {}) });
  const [capY, setCapY] = useState<number>(data.episode.captions_y ?? 1330);
  // Enhance - everything live: voice filters (Web Audio), noise reduction / eye contact (switch between prepared
  // versions), music level, subtitle style. Saved as you go; Export uses the same settings.
  const CAP_STYLES: Record<string, any> = {
    holy: null,  // the yellow Stam with a black outline
    clean: { font: 'assistant', weight: 800, size: 70, color: '#ffffff', stroke: 10 },
  };
  const [voice, setVoice] = useState<any>(voiceSettings(data.episode.voice));
  const [eyeOn, setEyeOn] = useState<boolean>(!!data.episode.eye_contact && data.episode.eye_contact.on !== false);
  const [look, setLook] = useState<any>(data.episode.look || null);  // live: drawn by the editor, applied by Export
  const changeLook = (patch: any) => { const v = { warm: 0, brightness: 0, saturation: 1, smooth: 0, ...(look || {}), ...patch }; setLook(v); saveOpt({ look: v }); };
  const [musicGain, setMusicGain] = useState<number>(musicVolume(data.episode.music));
  const [musicSrc, setMusicSrc] = useState<string | null>(null);  // a track picked here (played raw, looped)
  // the music choices (every track in the series' music folder) - switching is live
  const [tracks, setTracks] = useState<any[]>([]);
  useEffect(() => { if (data.episode.music) api(`/api/ep/${ep}/music`).then((ts: any[]) => setTracks(ts.filter((x) => !/\.(mp3|m4a|ogg|wav)$/i.test(x.name)))).catch(() => setTracks([])); }, [ep]);
  // listen to a track (or an effect) on its own, without switching to it
  const [hearing, setHearing] = useState<string | null>(null);
  const hearRef = useRef<HTMLAudioElement | null>(null);
  const hear = (url: string) => {
    hearRef.current?.pause();
    if (hearing === url) { setHearing(null); return; }
    const a = new Audio(url); hearRef.current = a; a.onended = () => setHearing(null);
    a.play().catch(() => setHearing(null)); setHearing(url);
  };
  useEffect(() => () => hearRef.current?.pause(), []);
  const pickTrack = (tr: any) => {
    setTracks((ts) => ts.map((x) => ({ ...x, on: x.sound === tr.sound })));
    saveOpt({ music_sound: tr.sound });
    const A = audioRef.current, v = video.current;
    const m = A?.els?.music;
    if (!m) return;
    const playing = v && !v.paused;
    setMusicSrc(tr.url);
    m.src = tr.url; m.loop = true; m.dataset.loop = '1';  // the raw track, looped, in place of the prepared bed
    m.onloadedmetadata = () => { if (v) m.currentTime = v.currentTime % (m.duration || 22); if (playing) m.play().catch(() => {}); };
  };
  const [capStyle, setCapStyle] = useState<any>(data.episode.captions_style || null);
  const optTimer = useRef<any>(null);
  const saveOpt = (body: any) => { clearTimeout(optTimer.current); optTimer.current = setTimeout(() => api(`/api/ep/${ep}/options`, body), 250); };
  // tool buttons that change how the layers are made: saved, then the layers are rebuilt (a slider waits until you stop)
  const cfgTimer = useRef<any>(null);
  const setConfig = (patch: any, rebuild = true, wait = 0) => {
    clearTimeout(cfgTimer.current);
    cfgTimer.current = setTimeout(async () => { const j = await api(`/api/ep/${ep}/config`, { patch, rebuild }); if (rebuild && j) setJob(j); }, wait);
  };
  const [lib, setLib] = useState<{ sets: any[]; effects: any[] }>({ sets: [], effects: [] });
  useEffect(() => { api('/api/library').then((l) => l && setLib(l)); }, []);
  const [fx, setFx] = useState<any[]>(data.episode.sounds || []);
  useEffect(() => setFx(data.episode.sounds || []), [ep]);
  const changeFx = (next: any[]) => { setFx(next); setConfig({ sounds: next }, true, 900); };
  const [addingFx, setAddingFx] = useState(false);
  const takeAt = (sec: number) => {  // a moment of the video -> the take and its own time (effects are pinned to the take)
    const f = sec * fps * k;
    const it = (edit?.items || []).find((x: any) => x.kind === 'clip' && f >= x.out && f < x.out + x.n) || (edit?.items || []).find((x: any) => x.kind === 'clip');
    return it ? { take: it.take, t: +(it.a + Math.max(0, f - it.out) / fps).toFixed(2) } : null;
  };
  const cutPreset = (() => { const c = data.episode.cut || {}; return c.whole ? 'whole' : c.silence === false ? 'keep' : (c.pad_out ?? 0.1) >= 0.3 ? 'light' : 'tight'; })();
  const CUTS: Record<string, any> = { tight: { merge: 0.25, pad_in: 0.05, pad_out: 0.1, join: 0.18 }, light: { merge: 0.6, pad_in: 0.08, pad_out: 0.35, join: 0.08 },
    keep: { silence: false }, whole: { whole: true } };
  const setCut = (name: string) => {
    const c = { ...(data.episode.cut || {}) };
    for (const key of ['merge', 'pad_in', 'pad_out', 'join', 'silence', 'whole']) delete c[key];
    setConfig({ cut: { ...c, ...CUTS[name] } });
  };
  const keepFrac = (() => { const kp = data.episode.keep?.['*']; return kp ? Math.round((1 - (kp.below_frac ?? 1)) * 100) : 0; })();
  const [keepPct, setKeepPct] = useState(keepFrac);
  const noise = !voice.denoise ? 'off' : data.episode.denoise?.rnn ? 'strong' : 'standard';
  const setNoise = (m: string) => {
    changeVoice({ denoise: m !== 'off' });
    if (m === 'strong' && !data.episode.denoise?.rnn) setConfig({ denoise: { rnn: 'models/rnnoise/cb.rnnn' } });
    if (m === 'standard' && data.episode.denoise?.rnn) setConfig({ denoise: null });
  };
  const addOverlay = (kind: string) => {
    const now = +t.toFixed(2);
    const base: Record<string, any> = {
      hook: { text: 'פוב: ', style: 'pov', font: 'assistant', theme: 'dark', opacity: 0.75, y: 270, size: 48, padX: 40, padY: 14, start: 0, end: null },
      question: { text: 'השאלה של העוקבת', style: 'question', label: 'יש לכן שאלות? אני כאן', y: 240, w: 820, size: 34, label_size: 32, start: now, end: +(now + 6).toFixed(2) },
      thought: { text: 'מחשבה...', style: 'thought', y: 1150, size: 70, start: now, end: +(now + 3).toFixed(2) },
      band: { text: 'כותרת | טקסט', style: 'band', y: 1500, size: 44, opacity: 0.94, start: now, end: +(now + 5).toFixed(2) },
      ticker: { text: 'טקסט רץ ●', style: 'ticker', font: 'assistant', theme: 'dark', opacity: 0.55, y: 1560, size: 40, speed: 130, start: 0, end: null },
    };
    const next = [...ov, base[kind] as any];
    changeOv(next); setSel({ kind: 'text', i: next.length - 1 });
  };
  // one subtitle line edited in place: its words are swapped inside its take's text, then the layers rebuild
  const [capEdit, setCapEdit] = useState<{ i: number; text: string } | null>(null);
  const editCaption = async (ci: number, text: string) => {
    const c = edit?.captions?.[ci];
    const n = blocks.findIndex((b) => b.take === c?.take);
    if (!c || n < 0 || !text.trim() || text.trim() === c.text) { setCapEdit(null); return; }
    const toks = blocks[n].text.split(/\s+/), want = c.text.split(' ');
    const same = (edit.captions as any[]).filter((x, j) => j < ci && x.take === c.take && x.text === c.text).length;  // the n-th time these words appear
    let hit = -1, seen = 0;
    for (let i = 0; i + want.length <= toks.length; i++) {
      if (toks.slice(i, i + want.length).join(' ') === c.text) { if (seen === same) { hit = i; break; } seen++; }
    }
    if (hit < 0) { setCapEdit(null); return; }
    const nextText = [...toks.slice(0, hit), text.trim(), ...toks.slice(hit + want.length)].join(' ');
    const next = head + blocks.map((b, i) => `== ${b.take}\n${i === n ? nextText : b.text}\n`).join('');
    setCaps(next); setCapEdit(null);
    setJob(await api(`/api/ep/${ep}/lesson`, { captions: next, plaque: plaque.split('\n').filter((x) => x.trim()) }));
  };
  const capRef = useRef<HTMLDivElement>(null);
  const [txtEdit, setTxtEdit] = useState<{ n: number; text: string } | null>(null);
  const nowCap = (edit?.captions || []).findIndex((c: any) => !c.over && t * fps * k >= c.from && t * fps * k < c.to);
  useEffect(() => {  // the reading view follows the video
    const el = document.querySelector('.rd-w.now, .sl-row.now');
    if (el && playing) (el as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [nowCap]);
  const saveTake = async (n: number, text: string) => {
    const next = head + blocks.map((b, i) => `== ${b.take}\n${i === n ? text.trim() : b.text}\n`).join('');
    setCaps(next); setTxtEdit(null);
    setJob(await api(`/api/ep/${ep}/lesson`, { captions: next, plaque: plaque.split('\n').filter((x) => x.trim()) }));
  };
  // the project's own media (logos, pictures): add a file, put one on the video
  const [media, setMedia] = useState<string[]>(data.episode.media || []);
  useEffect(() => setMedia(data.episode.media || []), [ep]);
  const addMedia = async (files: FileList | null) => {
    for (const f of Array.from(files || [])) {
      const r = await fetch(`/api/ep/${ep}/media?name=${encodeURIComponent(f.name)}`, { method: 'POST', body: f }).then((x) => x.json()).catch(() => null);
      if (r?.media) setMedia(r.media);
    }
  };
  const removeMedia = async (m: string) => { const r = await api(`/api/ep/${ep}/media/remove`, { path: m }); if (r?.media) setMedia(r.media); };
  const logoAt = ov.findIndex((o: any) => o.style === 'image' && o.plain);
  const [bigMedia, setBigMedia] = useState<string | null>(null);
  const useOnVideo = (m: string) => {  // a logo already on the video: swap the picture in place; else put it on
    if (logoAt < 0) return putOnVideo(m);
    changeOv(ov.map((o: any, i) => (i === logoAt ? { ...o, image: m } : o)));
  };
  const putOnVideo = (m: string) => {  // a corner logo: drag it on the preview, size it in Text
    const next = [...ov, { style: 'image', image: m, plain: true, x: 800, y: 300, w: 230, h: 230, start: 0, end: null, text: '' } as any];
    changeOv(next); setSel({ kind: 'text', i: next.length - 1 });
  };
  const STYLE_NAMES: Record<string, string> = { pov: 'Hook text', question: 'Question card', thought: 'Thought', band: 'Lower third', ticker: 'Ticker', image: 'Picture' };
  const changeVoice = (patch: any) => { const v = { ...voice, ...patch }; setVoice(v); saveOpt({ voice: v }); };

  // the live sound: the video is the clock; voice (raw + noise-reduced), effects and music play beside it
  const audioRef = useRef<any>(null);
  const L = data.layers || {};
  useEffect(() => {
    if (!L.voice) return;
    const mk = (l: any) => { if (!l) return null; const a = new Audio(`${l.url}?v=${l.v}`); a.preload = 'auto'; a.crossOrigin = 'anonymous'; return a; };
    const els = { voice: mk(L.voice), voice_dn: mk(L.voice_dn), fx: mk(L.fx), music: mk(L.music) };
    audioRef.current = { els, ctx: null, nodes: null };
    return () => { Object.values(els).forEach((a: any) => a && (a.pause(), (a.src = ''))); audioRef.current?.ctx?.close(); audioRef.current = null; };
  }, [L.voice?.v, L.fx?.v, L.music?.v]);
  const graph = () => {  // built on the first play (browsers need a click to start sound)
    const A = audioRef.current;
    if (!A || A.ctx) return A;
    const ctx = new AudioContext();
    const src = (a: any) => (a ? ctx.createMediaElementSource(a) : null);
    A.ctx = ctx;
    A.nodes = buildMix(ctx, { voice: src(A.els.voice), voice_dn: src(A.els.voice_dn), fx: src(A.els.fx), music: src(A.els.music) });
    return A;
  };
  // the export's loudness step, worked out here by the same code: the mix rendered offline, measured, one gain
  const [master, setMaster] = useState(1);
  const bufs = useRef<Record<string, Promise<AudioBuffer | null>>>({});
  const decode = (url?: string) => {
    if (!url) return Promise.resolve(null);
    return (bufs.current[url] ??= fetch(url).then((r) => r.arrayBuffer())
      .then((b) => new OfflineAudioContext(1, 1, 48000).decodeAudioData(b)).catch(() => null));
  };
  useEffect(() => {
    if (!L.voice || !edit?.total) return;
    let live = true;
    const id = setTimeout(async () => {
      const u = (l: any) => (l ? `${l.url}?v=${l.v}` : undefined);
      const [voiceB, dnB, fxB, musB] = await Promise.all([decode(u(L.voice)), decode(u(L.voice_dn)), decode(u(L.fx)), decode(musicSrc || u(L.music))]);
      const pre = await renderMix({ voice: voiceB, voice_dn: dnB, fx: fxB, music: musB, musicLoop: !!musicSrc },
        Math.round(edit.total / fps * 48000), voice, musicGain, 1);
      if (live) { const m = masterFor(loudness(pre.getChannelData(0))); (window as any).__master = m; setMaster(m); }
    }, 400);
    return () => { live = false; clearTimeout(id); };
  }, [voice, musicGain, musicSrc, L.voice?.v, edit?.total]);
  const applyAudio = () => {
    const A = audioRef.current;
    if (A?.nodes) applyMix(A.ctx, A.nodes, voice, musicGain, master);
  };
  useEffect(applyAudio, [voice, musicGain, master]);
  const syncAudio = (play?: boolean) => {
    const A = audioRef.current, v = video.current;
    if (!A || !v) return;
    for (const a of Object.values(A.els) as any[]) {
      if (!a) continue;
      const want = a.dataset?.loop === '1' ? v.currentTime % (a.duration || 22) : v.currentTime;  // a looped track repeats
      if (Math.abs(a.currentTime - want) > 0.08 && !(a.dataset?.loop === '1' && Math.abs(a.currentTime - want) < 0.5)) a.currentTime = want;
      a.playbackRate = v.playbackRate;
      if (play === true) a.play().catch(() => {}); else if (play === false) a.pause();
    }
  };
  useEffect(() => { const t = setInterval(() => { if (video.current && !video.current.paused) syncAudio(); }, 500); return () => clearInterval(t); }, []);
  const bgBox = (() => {
    const [bw, bh] = edit?.photo || [1080, 1920];
    const c = Math.max(1080 / bw, 1920 / bh) * (bgL.zoom || 1), sw = bw * c, sh = bh * c;
    const clamp = (v: number, hi: number) => Math.min(Math.max(0, v), hi);
    return { sw, sh, cx: clamp((sw - 1080) / 2 - (bgL.x || 0), sw - 1080), cy: clamp((sh - 1920) / 2 - (bgL.y || 0), sh - 1920) };
  })();
  const pBox = (() => { const w = 1080 * pL.scale, h = 1920 * pL.scale; return { w, h, x: (1080 - w) / 2 + (pL.x || 0), y: 1920 - h + (pL.y || 0) }; })();
  const capNow = (edit?.captions || []).find((c: any) => !c.over && t * fps >= c.from && t * fps < c.to);
  const capOver = (edit?.captions || []).find((c: any) => c.over && t * fps >= c.from && t * fps < c.to);  // said over him (the other side)
  const layoutTimer = useRef<any>(null);
  const saveLayout = (patch: any) => { clearTimeout(layoutTimer.current); layoutTimer.current = setTimeout(() => api(`/api/ep/${ep}/layout`, patch), 300); };
  const setBg = (v: any) => { setBgL(v); saveLayout({ bg: v }); };
  const setP = (v: any) => { setPL(v); saveLayout({ person: v }); };
  // drag him / the set directly on the preview; a click without moving plays / pauses
  const dragLayer = (e: React.MouseEvent, which: 'bg' | 'person') => {
    e.preventDefault(); e.stopPropagation();
    setSel({ kind: 'layer', id: which === 'bg' ? 'background' : 'speaker' });
    const x0 = e.clientX, y0 = e.clientY, start = which === 'bg' ? bgL : pL;
    let moved = false, cur: any = start;
    const mv = (m: MouseEvent) => {
      const dx = (m.clientX - x0) / scale, dy = (m.clientY - y0) / scale;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      if (!moved) return;
      cur = { ...start, x: Math.round((start.x || 0) + dx), y: Math.round((start.y || 0) + dy) };
      which === 'bg' ? setBgL(cur) : setPL(cur);
    };
    const up = () => {
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up);
      if (moved) (which === 'bg' ? setBg : setP)(cur); else toggle();
    };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  };
  const dragCap = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setSel({ kind: 'layer', id: 'captions' });
    const y0 = e.clientY, start = capY;
    let cur = start;
    const mv = (m: MouseEvent) => { cur = Math.max(900, Math.min(1700, Math.round(start + (m.clientY - y0) / scale))); setCapY(cur); };
    const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); if (cur !== start) saveLayout({ captions_y: cur }); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  };
  const dragText = (e: React.MouseEvent, i: number) => {
    e.preventDefault(); e.stopPropagation();
    setSel({ kind: 'text', i });
    const y0 = e.clientY, start = ov[i].y ?? 270;
    let cur = start, moved = false;
    const mv = (m: MouseEvent) => {
      if (Math.abs(m.clientY - y0) > 2) moved = true;
      cur = Math.max(0, Math.min(1800, Math.round(start + (m.clientY - y0) / scale)));
      if (moved) setOv((all) => all.map((x, n) => (n === i ? { ...x, y: cur } : x)));
    };
    const up = () => {
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up);
      if (moved) changeOv(ov.map((x, n) => (n === i ? { ...x, y: cur } : x)));
    };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  };
  const untimed = (o: any) => (o.from_words || o.sound != null) && o.start == null;  // tied to words / a sound: shown once a build has placed it
  const liveOv = ov.filter((o) => ((o.text || '').trim() || (o as any).image) && !untimed(o) && t >= (o.start || 0) && (o.end == null || t < o.end));
  // the opening video: full frame over the set, under the texts, in step with the clock
  const introRef = useRef<HTMLVideoElement>(null);
  const introSecs = data.episode.intro_video?.seconds ?? 5;
  const introFade = data.episode.intro_video?.fade ?? 0;
  useEffect(() => {
    const v = introRef.current;
    if (!v) return;
    if (Math.abs(v.currentTime - t) > 0.15) v.currentTime = Math.min(t, introSecs);
    if (playing && t < introSecs) v.play().catch(() => {}); else v.pause();
  }, [t, playing]);

  return (
    <div className="ed" style={{ ['--tl-h' as any]: '290px' }}>
      {top}
      <div className={`work ${wide && tab === 'script' ? 'wide' : ''}`}>
        <div className="pane left">
          <div className="tabs">
            {(['media', 'script', 'templates'] as const).map((x) => (
              <div key={x} className={`tab ${tab === x ? 'on' : ''}`} onClick={() => setTab(x)}>{x === 'script' ? 'Subtitles' : x === 'media' ? 'Media' : '+ New video'}</div>))}
            <div className="grow" />
          </div>
          {tab === 'script' && <div className="sub-bar">
            <div className="seg" style={{ gridTemplateColumns: '1fr 1fr', width: 170 }}>
              <button className={subView === 'read' ? 'on' : ''} onClick={() => setSubView('read')}>Read</button>
              <button className={subView === 'lines' ? 'on' : ''} onClick={() => setSubView('lines')}>Lines</button>
            </div>
            <span className="sub-count">{(edit?.captions || []).length} lines</span>
            <button className="btn ghost icon" title={wide ? 'Narrow' : 'Widen the dock'} onClick={() => setWide(!wide)}>{wide ? '⇤' : '⇥'}</button>
          </div>}
          <div className="scroll">
            {tab === 'script' && subView === 'lines' && (
              <div className="sl">
                {(edit?.captions || []).map((c: any, ci: number) => { const on = t * fps * k >= c.from && t * fps * k < c.to;
                  return <div key={ci} className={`sl-row rd-w-line ${on ? 'now' : ''} ${c.over || c.who ? 'other' : ''}`} onClick={() => capEdit?.i !== ci && seek(c.from / fps / k)}>
                    <span className="sl-t">{mmss(c.from / fps / k)}</span>
                    {capEdit?.i === ci
                      ? <input className="field he" dir="rtl" autoFocus value={capEdit.text} onChange={(e) => setCapEdit({ i: ci, text: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') editCaption(ci, capEdit.text); if (e.key === 'Escape') setCapEdit(null); }} onBlur={() => setCapEdit(null)} />
                      : <span className="sl-x he">{c.text}</span>}
                    {!(c.over || c.who) && capEdit?.i !== ci && <button className="cap-ed" title="Fix the words of this line" disabled={busy}
                      onClick={(e) => { e.stopPropagation(); setCapEdit({ i: ci, text: c.text }); }}>✎</button>}
                  </div>; })}
                <div className="help" style={{ padding: '10px 18px' }}>Click a line to go there · ✎ fixes its words (Enter saves; the timing follows your voice) · blue = the other side.</div>
              </div>)}
            {tab === 'script' && subView === 'read' && (
              <div className="rd">
                {blocks.map((b, n) => {
                  const its = (edit?.items || []).filter((x: any) => x.take === b.take && x.kind === 'clip');
                  const o0 = its.length ? its[0].out : 0, o1 = its.length ? its[its.length - 1].out + its[its.length - 1].n : 0;
                  const lines = (edit?.captions || []).map((c: any, ci: number) => ({ c, ci }))
                    .filter(({ c }: any) => c.take === b.take || (c.over && c.from >= o0 && c.from < o1));
                  return <div key={b.take} className={`rd-take ${nowTake === b.take ? 'now' : ''}`}>
                    <div className="rd-h">
                      <span className="rd-n">{n + 1}</span>
                      <span className="rd-name he" onClick={() => seek(takeStart(b.take))}>{b.take}</span>
                      <span className="rd-len">{mmss(its.reduce((s: number, x: any) => s + x.n, 0) / fps)}</span>
                      {txtEdit?.n !== n && <button className="btn ghost rd-ed" disabled={busy} onClick={() => setTxtEdit({ n, text: b.text })}>Edit</button>}
                    </div>
                    {txtEdit?.n === n ? <>
                      <textarea className="field he rd-area" dir="rtl" autoFocus value={txtEdit.text} onChange={(e) => setTxtEdit({ n, text: e.target.value })} />
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button className="btn primary" style={{ flex: 1 }} disabled={busy || txtEdit.text.trim() === b.text} onClick={() => saveTake(n, txtEdit.text)}>Save & rebuild</button>
                        <button className="btn ghost" onClick={() => setTxtEdit(null)}>Cancel</button>
                      </div>
                      <div className="help" style={{ marginTop: 8 }}>Words only - the timing follows your voice.</div>
                    </> : <p className="rd-p he" dir="rtl">
                      {lines.length ? lines.map(({ c, ci }: any) => <span key={ci} className={`rd-w ${ci === nowCap ? 'now' : ''} ${c.over || c.who ? 'other' : ''}`}
                        onClick={() => seek(c.from / fps / k)}>{c.text} </span>) : b.text}
                    </p>}
                  </div>; })}
                {!blocks.length && <div className="empty" style={{ padding: 16 }}>No subtitles yet - press Re-analyze.</div>}
              </div>)}
            {tab === 'media' && (
              <div className="media">
                <div className="m-sec">Footage <span>{data.episode.input_dir?.split('/').pop()}</span></div>
                {blocks.map((b, n) => { const its = (edit?.items || []).filter((x: any) => x.take === b.take && x.kind === 'clip');
                  const used = its.reduce((s: number, x: any) => s + x.n, 0) / fps;
                  return <div key={b.take} className="m-row" onClick={() => { setSel({ kind: 'take', k: n }); seek(takeStart(b.take)); }}>
                    <div className="m-ic">{I.phone}</div>
                    <div className="m-main"><div className="m-name he">{b.take}</div><div className="m-sub">uses {mmss(used)} · {its.length} pieces</div></div>
                  </div>; })}
                <div className="m-sec">Set</div>
                <div className="m-row" onClick={() => setSel({ kind: 'layer', id: 'background' as Layer })}>
                  {data.episode.cutout === false ? <><div className="m-ic">{I.layout}</div><div className="m-main"><div className="m-name">Original place</div><div className="m-sub">no background swap</div></div></>
                    : <><img className="m-thumb" src={`/api/ep/${ep}/file?p=${encodeURIComponent(data.episode.background || '')}`} />
                      <div className="m-main"><div className="m-name">{(data.episode.background || '').split('/').pop()}</div><div className="m-sub">change it in Background</div></div></>}
                </div>
                <div className="m-sec">Sound</div>
                <div className="m-row" onClick={() => setSel({ kind: 'layer', id: 'music' as Layer })}>
                  <div className="m-ic">♪</div>
                  <div className="m-main"><div className="m-name">{data.episode.music ? String(data.episode.music.sound).split('/').pop() : 'No music'}</div>
                    <div className="m-sub">{data.episode.music ? `${Math.round(musicGain * 100)}% · ` : ''}{(data.episode.sounds || []).length} effects / voices</div></div>
                </div>
                {(data.episode.sounds || []).map((s: any, n: number) => <div key={n} className="m-row sm" onClick={() => setSel({ kind: 'layer', id: 'music' as Layer })}>
                  <div className="m-dot" /><div className="m-main"><div className="m-sub" style={{ color: 'var(--dim)' }}>{String(s.sound).split('/').pop()}{s.filter ? ` · ${s.filter}` : ''}</div></div></div>)}
                <div className="m-sec">Logos &amp; pictures <span>{media.length}</span></div>
                <div className="pm-grid">
                  {media.map((m) => { const on = ov.some((o: any) => o.image === m);
                    return <div key={m} className={`pm ${on ? 'on' : ''}`} title={m.split('/').pop()}>
                      <button className="pm-img" onClick={() => setBigMedia(m)}><img src={`/api/ep/${ep}/file?p=${encodeURIComponent(m)}`} loading="lazy" /></button>
                      {on ? <span className="pm-on">On video</span>
                        : <button className="pm-use" onClick={() => useOnVideo(m)}>{logoAt >= 0 ? 'Swap in' : 'Use'}</button>}
                    </div>; })}
                  <label className="pm pm-add" title="Add a logo or picture from your computer">
                    <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { addMedia(e.target.files); e.target.value = ''; }} />
                    <span>+ Add file</span>
                  </label>
                </div>
                {bigMedia && <div className="pm-modal" onClick={() => setBigMedia(null)}>
                  <div className="pm-box" onClick={(e) => e.stopPropagation()}>
                    <img src={`/api/ep/${ep}/file?p=${encodeURIComponent(bigMedia)}`} />
                    <div className="pm-bar">
                      <span className="pm-bn">{bigMedia.split('/').pop()}</span>
                      {ov.some((o: any) => o.image === bigMedia) ? <span className="pm-on">On the video</span>
                        : <button className="btn primary" onClick={() => { useOnVideo(bigMedia); setBigMedia(null); }}>{logoAt >= 0 ? 'Swap it in on the video' : 'Use on the video'}</button>}
                      <button className="btn ghost" title="Take it off this project's list" onClick={() => { removeMedia(bigMedia); setBigMedia(null); }}>Remove</button>
                      <button className="btn ghost" onClick={() => setBigMedia(null)}>Close</button>
                    </div>
                  </div>
                </div>}
                <div className="m-sec">Library <span>{lib.sets.length} sets · {lib.effects.length} effects</span></div>
                <div className="help" style={{ padding: '0 12px' }}>Everything made for earlier videos is here for this one: sets in Background, effects in Music &amp; sounds.</div>
              </div>)}
            {tab === 'templates' && <NewVideo />}
          </div>
        </div>

        <div className="pane viewer">
          <div className="monitor">
            <div className="frame" ref={frameRef} style={{ position: 'relative', background: '#000', overflow: 'hidden' }}>
              {layered ? (
                // layers, put together live: the set photo, him (transparent video, carries the sound), subtitles
                <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: `scale(${scale})`, transformOrigin: '0 0', overflow: 'hidden' }}
                  onMouseDown={(e) => { if (e.target === e.currentTarget) { if (sel?.kind === 'text') setSel(null); else toggle(); } }}>
                  <img src={`${data.layers.scene.url}?v=${data.layers.scene.v}`} draggable={false} onMouseDown={(e) => dragLayer(e, 'bg')}
                    style={{ position: 'absolute', left: -bgBox.cx, top: -bgBox.cy, width: bgBox.sw, height: bgBox.sh, cursor: 'grab',
                      filter: 'blur(2.2px) brightness(0.96) saturate(0.95)' }} />
                  {data.layers.plaque && <img src={`${data.layers.plaque.url}?v=${data.layers.plaque.v}`} draggable={false}
                    style={{ position: 'absolute', left: -bgBox.cx, top: -bgBox.cy, width: bgBox.sw, height: bgBox.sh, pointerEvents: 'none' }} />}
                  {ov.map((o: any, i) => liveOv.includes(o) && o.style === 'image' && o.behind && (
                    // a story's picture on the studio's screen, behind him - the same look as the export
                    <img key={'b' + i} src={`/api/ep/${ep}/file?p=${encodeURIComponent(o.image)}`} draggable={false}
                      style={{ position: 'absolute', left: o.x ?? 60, top: o.y ?? 380, width: o.w ?? 960, height: o.h ?? 540, objectFit: o.plain ? 'contain' : 'cover',
                        ...(o.plain ? {} : { borderRadius: 4, filter: 'blur(1.2px) brightness(0.93) saturate(1.05)' }), pointerEvents: 'none' }} />))}
                  {ov.map((o: any, i) => liveOv.includes(o) && o.style === 'image' && o.behind && o.tag && (
                    <div key={'t' + i} style={{ position: 'absolute', left: (o.x ?? 60) + 12, top: (o.y ?? 380) + 12, background: 'rgba(0,0,0,0.6)', color: '#fff',
                      font: `700 22px ${fontCss('assistant')}`, padding: '3px 10px', borderRadius: 6, direction: 'rtl', pointerEvents: 'none' }}>{o.tag}</div>))}
                  {look && <LookFilter id="zc-look" lk={look} />}
                  <video ref={video} key={data.layers.person.v} src={`${data.layers.person.url}?v=${data.layers.person.v}`} onMouseDown={(e) => dragLayer(e, 'person')} muted={!!L.voice}
                    style={{ position: 'absolute', left: pBox.x, top: pBox.y, width: pBox.w, height: pBox.h, cursor: 'grab', opacity: !L.person_raw || eyeOn ? 1 : 0,
                      filter: look ? 'url(#zc-look)' : undefined }}
                    onTimeUpdate={(e) => { setT(e.currentTarget.currentTime); const r = rawVideo.current; if (r && Math.abs(r.currentTime - e.currentTarget.currentTime) > 0.1) r.currentTime = e.currentTarget.currentTime; }}
                    onPlay={() => { setPlaying(true); graph(); applyAudio(); audioRef.current?.ctx?.resume(); syncAudio(true); rawVideo.current?.play().catch(() => {}); }}
                    onPause={() => { setPlaying(false); syncAudio(false); rawVideo.current?.pause(); }}
                    onSeeked={() => { syncAudio(); if (rawVideo.current && video.current) rawVideo.current.currentTime = video.current.currentTime; }} />
                  {L.person_raw && <video ref={rawVideo} key={'raw' + L.person_raw.v} src={`${L.person_raw.url}?v=${L.person_raw.v}`} muted
                    style={{ position: 'absolute', left: pBox.x, top: pBox.y, width: pBox.w, height: pBox.h, pointerEvents: 'none', opacity: eyeOn ? 0 : 1,
                      filter: look ? 'url(#zc-look)' : undefined }} />}
                  {L.intro && t < introSecs && <video ref={introRef} key={'intro' + L.intro.v} src={`${L.intro.url}?v=${L.intro.v}`} muted playsInline
                    style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, objectFit: 'cover', pointerEvents: 'none',
                      opacity: introFade > 0 && t > introSecs - introFade ? Math.max(0, (introSecs - t) / introFade) : 1 }} />}
                  {capOver && (() => {
                    const st = { ...(capStyle || {}), ...(data.episode.captions_other || {}) };
                    return <div className="he" style={{ position: 'absolute', top: data.episode.captions_other?.y ?? capY - 150, left: 50, right: 50, textAlign: 'center', direction: 'rtl', pointerEvents: 'none',
                      font: `${st.weight || 400} ${st.size || 84}px/1.18 ${fontCss(st.font || 'stam-ashkenaz')}`, color: st.color || '#FFD60A',
                      WebkitTextStroke: `${st.stroke ?? 14}px #000`, paintOrder: 'stroke fill',
                      textShadow: '0 6px 14px rgba(0,0,0,0.55)', letterSpacing: st.font ? 0 : '0.045em' } as any}>{capOver.text}</div>;
                  })()}
                  {capNow && (() => {
                    const st = { ...(capStyle || {}), ...(capNow.who === 'other' ? data.episode.captions_other || {} : {}) };  // the series' look; the other side's in its colour
                    return <div className="he" onMouseDown={dragCap} style={{ position: 'absolute', top: capY, left: 50, right: 50, textAlign: 'center', direction: 'rtl', cursor: 'ns-resize',
                      outline: sel?.kind === 'layer' && sel.id === 'captions' ? `${Math.round(3 / scale)}px dashed var(--accent)` : 'none',
                      font: `${st.weight || 400} ${st.size || 84}px/1.18 ${fontCss(st.font || 'stam-ashkenaz')}`, color: st.color || '#FFD60A',
                      WebkitTextStroke: `${st.stroke ?? 14}px #000`, paintOrder: 'stroke fill',
                      textShadow: '0 6px 14px rgba(0,0,0,0.55)', letterSpacing: st.font ? 0 : '0.045em' } as any}>{capNow.text}</div>;
                  })()}
                </div>
              ) : (data.preview || data.output)
                ? <video ref={video} key={data.previewVersion || data.outputVersion} src={data.preview ? `${data.preview}?v=${data.previewVersion}` : `${data.output}?v=${data.outputVersion}`}
                    style={{ width: '100%', height: '100%' }}
                    onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
                    onClick={() => (sel?.kind === 'text' ? setSel(null) : toggle())} />
                : <div className="empty" style={{ padding: 24 }}>{busy ? 'Building the video…' : 'Press Re-analyze to build it.'}</div>}
              {/* text on video, drawn live at the export's size and place */}
              <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: `scale(${scale})`, transformOrigin: '0 0', pointerEvents: 'none' }}>
                {ov.map((o, i) => liveOv.includes(o) && o.style === 'ticker' && (
                  // a ticker: the band across the frame, the strip scrolling to the right in step with the video's time
                  <div key={i} style={{ position: 'absolute', top: (o.y ?? 1560) - 10, left: 0, width: 1080, overflow: 'hidden',
                    background: `rgba(0,0,0,${o.opacity ?? 0.55})`, pointerEvents: 'auto', cursor: 'move',
                    outline: sel?.kind === 'text' && sel.i === i ? `${Math.round(3 / scale)}px dashed var(--accent)` : 'none' }}
                    onMouseDown={(e) => dragText(e, i)}>
                    <TickerStrip o={o} clock={clock} />
                  </div>))}
                {ov.map((o: any, i) => liveOv.includes(o) && o.style === 'image' && !o.behind && (
                  // a story's picture in a framed box - the same look as the export (lesson_text.mjs)
                  <img key={i} src={`/api/ep/${ep}/file?p=${encodeURIComponent(o.image)}`} draggable={false} onMouseDown={(e) => dragText(e, i)}
                    style={{ position: 'absolute', left: o.x ?? 60, top: o.y ?? 380, width: o.w ?? 960, height: o.h ?? 540, objectFit: o.plain ? 'contain' : 'cover',
                      ...(o.plain ? { opacity: o.opacity ?? 1 } : { border: '6px solid #fff', borderRadius: 14, boxShadow: '0 12px 34px rgba(0,0,0,0.55)' }), boxSizing: 'border-box',
                      pointerEvents: 'auto', cursor: 'move', outline: sel?.kind === 'text' && sel.i === i ? `${Math.round(3 / scale)}px dashed var(--accent)` : 'none' }} />))}
                {ov.map((o: any, i) => liveOv.includes(o) && o.style === 'band' && (() => {
                  // a news lower third: red tag (before "|"), deep-blue band (after it)
                  const [tag, ...rest] = String(o.text).split('|'), size = o.size || 46;
                  return <div key={i} className="he" onMouseDown={(e) => dragText(e, i)} style={{ position: 'absolute', top: o.y ?? 1450, left: 0, right: 0,
                    height: Math.round(size * 1.9), display: 'flex', direction: 'rtl', font: `800 ${size}px ${fontCss('assistant')}`, color: '#fff',
                    borderTop: '4px solid #fff', pointerEvents: 'auto', cursor: 'move',
                    outline: sel?.kind === 'text' && sel.i === i ? `${Math.round(3 / scale)}px dashed var(--accent)` : 'none' }}>
                    {rest.length > 0 && <div style={{ background: '#d0121b', padding: `0 ${Math.round(size * 0.6)}px`, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>{tag.trim()}</div>}
                    <div style={{ background: `rgba(10,38,92,${o.opacity ?? 0.94})`, flex: 1, padding: `0 ${Math.round(size * 0.55)}px`, display: 'flex', alignItems: 'center',
                      whiteSpace: 'nowrap', overflow: 'hidden' }}>{(rest.length ? rest.join('|') : tag).trim()}</div>
                  </div>;
                })())}
                {ov.map((o: any, i) => o.style === 'thought' && <ThoughtText key={'th' + i} o={o} clock={clock} />)}
                {ov.map((o: any, i) => liveOv.includes(o) && o.style === 'question' && (() => {
                  // a follower's question as Instagram's question sticker - the same card as the export (lesson_text.mjs)
                  const w = o.w || 860, size = o.size || 44;
                  if (o.variant === 'tiktok') return <div key={i} className="he" onMouseDown={(e) => dragText(e, i)} style={{ position: 'absolute', top: o.y ?? 300,
                    left: o.x ?? (1080 - w) / 2, width: w, background: '#fff', borderRadius: Math.round(size * 0.6), textAlign: 'right', direction: 'rtl',
                    padding: `${Math.round(size * 0.55)}px ${Math.round(size * 0.7)}px ${Math.round(size * 0.65)}px`, boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
                    fontFamily: `"Segoe UI", ${fontCss('assistant')}`, pointerEvents: 'auto', cursor: 'move', boxSizing: 'border-box',
                    outline: sel?.kind === 'text' && sel.i === i ? `${Math.round(3 / scale)}px dashed var(--accent)` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 0.35), marginBottom: Math.round(size * 0.35) }}>
                      <div style={{ width: Math.round(size * 1.5), height: Math.round(size * 1.5), borderRadius: '50%', flex: 'none', background: o.avatar_color || '#c58b6b', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: Math.round(size * 0.75) }}>{(o.user || 'ש').replace('@', '').slice(0, 1).toUpperCase()}</div>
                      <div style={{ color: '#8a8b91', fontWeight: 500, fontSize: Math.round(size * 0.72) }}>השבה לתגובה של {o.asker || o.user || '@user'}</div>
                    </div>
                    <div style={{ color: '#161823', fontWeight: 600, fontSize: size, lineHeight: 1.32 }}>{o.text}</div>
                  </div>;
                  return <div key={i} className="he" onMouseDown={(e) => dragText(e, i)} style={{ position: 'absolute', top: o.y ?? 300, left: o.x ?? (1080 - w) / 2, width: w,
                    borderRadius: Math.round(size * 0.5), overflow: 'hidden', textAlign: 'center', direction: 'rtl', boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
                    fontFamily: `"Segoe UI", ${fontCss('assistant')}`, pointerEvents: 'auto', cursor: 'move',
                    outline: sel?.kind === 'text' && sel.i === i ? `${Math.round(3 / scale)}px dashed var(--accent)` : 'none', outlineOffset: Math.round(6 / scale) }}>
                    <div style={{ background: hexA(o.accent || '#262626', o.opacity ?? 1), color: '#fff', fontWeight: 600, fontSize: o.label_size || Math.round(size * 0.85),
                      padding: `${Math.round((o.label_size || Math.round(size * 0.85)) * 0.62)}px ${Math.round((o.label_size || Math.round(size * 0.85)) * 0.7)}px` }}>{o.label || 'שאלו אותי שאלה'}</div>
                    <div style={{ background: `rgba(255,255,255,${o.opacity ?? 1})`, color: '#262626', fontWeight: 500, fontSize: size, lineHeight: 1.32,
                      textShadow: (o.opacity ?? 1) < 0.6 ? '0 0 6px rgba(255,255,255,0.9)' : undefined,
                      padding: `${Math.round(size * 0.85)}px ${Math.round(size * 1.0)}px ${Math.round(size * 0.95)}px` }}>
                      {o.asker && <div style={{ fontWeight: 700, fontSize: Math.round(size * 0.8), color: '#8e8e8e', marginBottom: Math.round(size * 0.25) }}>{o.asker} שואלת:</div>}
                      {o.text}</div>
                  </div>;
                })())}
                {ov.map((o, i) => liveOv.includes(o) && o.style !== 'ticker' && o.style !== 'image' && o.style !== 'band' && o.style !== 'question' && o.style !== 'thought' && (
                  <div key={i} style={{ position: 'absolute', top: o.y ?? 270, left: 60, right: 60, display: 'flex', justifyContent: 'center' }}>
                    {/* click to select, drag to move; the outline hugs the text whatever its size */}
                    <div className="he" onMouseDown={(e) => dragText(e, i)}
                      style={{ ...ovBoxStyle(o, { fontFamily: fontCss(o.font), fontWeight: ['system', 'arimo', 'assistant'].includes(o.font || 'system') ? 800 : 400 }),
                        pointerEvents: 'auto', cursor: 'move',
                        outline: sel?.kind === 'text' && sel.i === i ? `${Math.round(3 / scale)}px dashed var(--accent)` : 'none', outlineOffset: Math.round(6 / scale) }}>{o.text}</div>
                  </div>))}
              </div>
            </div>
          </div>
          <div className="transport">
            <div><span className="chip">{I.phone}&nbsp;9:16</span></div>
            <div className="mid">
              <button className="btn ghost icon" title="Previous take (↑)" onClick={() => jump(-1)}>{I.prev}</button>
              <button className="play" title="Play / pause (space)" onClick={toggle}>{playing ? I.pause : I.play}</button>
              <button className="btn ghost icon" title="Next take (↓)" onClick={() => jump(1)}>{I.next}</button>
            </div>
            <div className="tc">{mmss(t)} <span>/ {mmss(total)}</span></div>
          </div>
        </div>

        <div className="pane right">
          {/* the Inspector follows the selection: click a layer on the timeline (or the preview) to see its options */}
          <div className="pane-h" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'flex', width: 18, color: 'var(--accent)' }}>{inspIcon}</span>
            <span className="grow">{inspTitle}</span>
            {sel && <button className="btn ghost icon" title="Back to the project (Esc)" onClick={() => setSel(null)}>✕</button>}
          </div>
          <div className="scroll">
            {sel?.kind === 'text' && (ov[sel.i] as any)?.style === 'image' && (ov[sel.i] as any)?.plain && (() => { const o: any = ov[sel.i];
              const set = (patch: any, commit = true) => changeOv(ov.map((x: any, j) => (j === sel.i ? { ...x, ...patch } : x)), commit);
              return <>
                <div className="card">
                  <div className="card-h"><div className="title grow">Logo</div><span className="help" style={{ margin: 0 }}>click one to swap</span></div>
                  <div className="pm-strip">
                    {media.filter((m) => /\.(png|jpe?g|webp|gif)$/i.test(m)).map((m) => <button key={m} className={`pm-sw ${o.image === m ? 'on' : ''}`} title={m.split('/').pop()} onClick={() => set({ image: m })}>
                      <img src={`/api/ep/${ep}/file?p=${encodeURIComponent(m)}`} /></button>)}
                  </div>
                  <Slider label="Size" v={o.w || 230} min={80} max={700} step={5} fmt={(v) => `${v}px`} onChange={(v) => set({ w: v, h: v }, false)} />
                  <Slider label="Opacity" v={o.opacity ?? 1} min={0.1} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ opacity: v }, false)} />
                  <div className="sec" style={{ marginTop: 4 }}>Place</div>
                  <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    {([['tl', 'Top left'], ['tr', 'Top right'], ['bl', 'Bottom left'], ['br', 'Bottom right']] as const).map(([k, nm]) => {
                      const w = o.w || 230, h = o.h || w;  // inside the safe area: the app's own buttons cover the edges
                      const pos = { x: k[1] === 'l' ? 40 : 1080 - 40 - w, y: k[0] === 't' ? 290 : 1920 - 330 - h };
                      const on = Math.abs((o.x ?? 0) - pos.x) < 4 && Math.abs((o.y ?? 0) - pos.y) < 4;
                      return <button key={k} className={on ? 'on' : ''} onClick={() => set(pos)}>{nm}</button>; })}
                  </div>
                  <Slider label="Left / right" v={o.x ?? 800} min={0} max={1080 - (o.w || 230)} step={2} fmt={(v) => `${v}`} onChange={(v) => set({ x: v }, false)} />
                  <Slider label="Up / down" v={o.y ?? 300} min={0} max={1920 - (o.h || o.w || 230)} step={2} fmt={(v) => `${v}`} onChange={(v) => set({ y: v }, false)} />
                  <div className="help">Or drag it on the preview.</div>
                  <button className="btn ghost" style={{ width: '100%' }} onClick={() => { changeOv(ov.filter((_: any, j) => j !== sel.i)); setSel(null); }}>Remove the logo from the video</button>
                </div>
              </>; })()}
            {sel?.kind === 'text' && ov[sel.i] && !((ov[sel.i] as any).style === 'image' && (ov[sel.i] as any).plain) && (
              <TextProps all={ov} i={sel.i} onChange={(next, commit) => { changeOv(next, commit); if (next.length < ov.length) setSel(null); }} />)}

            {sel?.kind === 'layer' && sel.id === 'captions' && <>
              <div className="card">
                <div className="card-h"><div className="title grow">Style</div><span className="help" style={{ margin: 0 }}>live</span></div>
                <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <button className={!capStyle ? 'on' : ''} onClick={() => { setCapStyle(null); saveOpt({ captions_style: null }); }}>Yellow · Stam</button>
                  <button className={capStyle ? 'on' : ''} onClick={() => { setCapStyle(CAP_STYLES.clean); saveOpt({ captions_style: CAP_STYLES.clean }); }}>White · Assistant</button>
                </div>
                {capStyle && <>
                  <div className="row2" style={{ marginTop: 10 }}><label>Font</label>
                    <select className="field" value={capStyle.font || 'assistant'} onChange={(e) => { const v = { ...capStyle, font: e.target.value }; setCapStyle(v); saveOpt({ captions_style: v }); }}>
                      {['assistant', 'arimo', 'abraham', 'stam-ashkenaz', 'stam-sefarad'].map((f) => <option key={f} value={f}>{f.replace('-', ' ')}</option>)}
                    </select></div>
                  <Slider label="Size" v={capStyle.size || 64} min={40} max={100} step={2} fmt={(v) => `${v}px`} onChange={(v) => { const n = { ...capStyle, size: v }; setCapStyle(n); saveOpt({ captions_style: n }); }} />
                  <div className="row2"><label>Colour</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['#ffffff', '#FFD60A', '#8fd3ff', '#ff8fb1'].map((c) => <button key={c} title={c} onClick={() => { const n = { ...capStyle, color: c }; setCapStyle(n); saveOpt({ captions_style: n }); }}
                        style={{ width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer', border: (capStyle.color || '#ffffff').toLowerCase() === c.toLowerCase() ? '2px solid var(--accent)' : '1px solid var(--edge-2)', outline: 'none' }} />)}
                    </div></div>
                </>}
              </div>
              <div className="card">
                <div className="sec">Position</div>
                <Slider label="Height" v={capY} min={900} max={1700} step={5} fmt={(v) => `${v}`} onChange={(v) => { setCapY(v); saveLayout({ captions_y: v }); }} />
              </div>
              <div className="card">
                <button className="btn" style={{ width: '100%' }} onClick={() => { setTab('script'); setSubView('lines'); }}>Review all subtitles ({(edit?.captions || []).length} lines) →</button>
              </div>
              {false && <div className="card">
                <div className="cap-list" ref={capRef}>
                  {(edit?.captions || []).map((c: any, ci: number) => { const on = t * fps * k >= c.from && t * fps * k < c.to;
                    return <div key={ci} className={`cap-row ${on ? 'on' : ''} ${c.who ? 'other' : ''}`} onClick={() => capEdit?.i !== ci && seek(c.from / fps / k)}>
                      <span className="cap-t">{mmss(c.from / fps / k)}</span>
                      {capEdit?.i === ci
                        ? <input className="field he" dir="rtl" autoFocus value={capEdit.text} onChange={(e) => setCapEdit({ i: ci, text: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Enter') editCaption(ci, capEdit.text); if (e.key === 'Escape') setCapEdit(null); }} onBlur={() => setCapEdit(null)} />
                        : <span className="cap-x he">{c.text}</span>}
                      {!c.who && capEdit?.i !== ci && <button className="cap-ed" title="Fix the words of this line" disabled={busy}
                        onClick={(e) => { e.stopPropagation(); setCapEdit({ i: ci, text: c.text }); }}>✎</button>}
                    </div>; })}
                </div>
              </div>}
              <div className="card">
                <div className="sec">Wording</div>
                <div className="help" style={{ marginBottom: 8 }}>The subtitles follow your script, timed to your voice. Pick a take to edit its words.</div>
                {blocks.map((b, n) => <button key={b.take} className="btn" style={{ justifyContent: 'flex-start', width: '100%', marginBottom: 4 }}
                  onClick={() => { setSel({ kind: 'take', k: n }); seek(takeStart(b.take)); }}>{n + 1} · {b.take}</button>)}
              </div>
            </>}

            {sel?.kind === 'take' && blocks[sel.k] && <>
              <div className="card">
                <div className="sec">Subtitles of take {sel.k + 1} · {blocks[sel.k].take}</div>
                <textarea className="field he" dir="rtl" rows={10} style={{ width: '100%', resize: 'vertical', height: 'auto', userSelect: 'text' }}
                  value={blocks[sel.k].text} onChange={(e) => setBlock(sel.k, e.target.value)} />
                <button className="btn primary" style={{ width: '100%', marginTop: 8 }} disabled={busy || !dirty} onClick={() => save()}>Save & rebuild</button>
                <div className="help" style={{ marginTop: 6 }}>Words only — the timing follows the audio by itself.</div>
              </div>
            </>}

            {sel?.kind === 'layer' && sel.id === 'speaker' && <>
              <div className="card">
                <div className="sec">Picture</div>
                <Slider label="Size" v={pL.scale} min={0.5} max={1.4} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setP({ ...pL, scale: v })} />
                <Slider label="Left / right" v={pL.x} min={-600} max={600} step={2} fmt={(v) => `${v}`} onChange={(v) => setP({ ...pL, x: v })} />
                <Slider label="Up / down" v={pL.y} min={-600} max={1000} step={2} fmt={(v) => `${v}`} onChange={(v) => setP({ ...pL, y: v })} />
                <div className="help">Or drag yourself on the preview.</div>
              </div>
              <div className="card">
                <div className="card-h"><div className="title grow">Background removal</div><span className="help" style={{ margin: 0 }}>rebuilds</span></div>
                <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <button className={data.episode.cutout !== false ? 'on' : ''} disabled={busy} onClick={() => setConfig({ cutout: null })}>Cut out · new set</button>
                  <button className={data.episode.cutout === false ? 'on' : ''} disabled={busy} onClick={() => setConfig({ cutout: false })}>Keep original place</button>
                </div>
                {data.episode.cutout !== false && <>
                  <Slider label="Keep desk" v={keepPct} min={0} max={45} step={1} fmt={(v) => (v ? `bottom ${v}%` : 'off')}
                    onChange={(v) => { setKeepPct(v); const kp = { ...(data.episode.keep || {}) }; if (v) kp['*'] = { below_frac: +(1 - v / 100).toFixed(3), objects: true }; else delete kp['*'];
                      setConfig({ keep: Object.keys(kp).length ? kp : null }, true, 1200); }} />
                  <div className="help">The bottom of your real footage (desk, keyboard, props) stays in front of the new set.</div>
                </>}
              </div>
              <div className="card">
                <div className="card-h"><div className="title grow">Look</div><span className="help" style={{ margin: 0 }}>live · Export uses the same</span></div>
                {!look && <button className="btn" style={{ width: '100%' }} onClick={() => changeLook({ smooth: 0.5, warm: 0.06, brightness: 0.03, saturation: 1.06 })}>Turn on the live look</button>}
                {look && <>
                  <Slider label="Smooth" v={look.smooth ?? 0} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => changeLook({ smooth: v })} />
                  <Slider label="Warmth" v={look.warm ?? 0} min={-0.15} max={0.25} step={0.01} fmt={(v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}`} onChange={(v) => changeLook({ warm: v })} />
                  <Slider label="Brightness" v={look.brightness ?? 0} min={-0.2} max={0.3} step={0.01} fmt={(v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}`} onChange={(v) => changeLook({ brightness: v })} />
                  <Slider label="Saturation" v={look.saturation ?? 1} min={0.6} max={1.5} step={0.02} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => changeLook({ saturation: v })} />
                </>}
              </div>
              {!L.person_raw && <div className="card">
                <div className="card-h"><div className="title grow">Eye contact</div><span className="help" style={{ margin: 0 }}>off</span></div>
                <button className="btn" style={{ width: '100%' }} disabled={busy} onClick={() => setConfig({ eye_contact: { on: true } })}>Make eye contact (NVIDIA)</button>
                <div className="help" style={{ marginTop: 6 }}>Turns your eyes to the lens; takes about 2 minutes per minute of video. Not for scenes where you look at a screen or someone else.</div>
              </div>}
              {L.person_raw && <div className="card">
                <div className="sec">Eye contact</div>
                <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <button className={eyeOn ? 'on' : ''} onClick={() => { setEyeOn(true); saveOpt({ eye_on: true }); }}>On</button>
                  <button className={!eyeOn ? 'on' : ''} onClick={() => { setEyeOn(false); saveOpt({ eye_on: false }); }}>Off</button>
                </div>
                <div className="help" style={{ marginTop: 6 }}>{(() => {
                  const ec = data.episode.eye_contact || {};
                  return ec.file ? `From ${ec.file} (your CapCut export)`
                    : ec.mode && ec.mode !== 'nvidia' ? `Our own (${ec.mode})`
                    : 'NVIDIA eye contact - our v6 if NVIDIA is unavailable';
                })()}</div>
              </div>}
              {L.voice && <div className="card">
                <div className="card-h"><div className="title grow">Voice</div><span className="help" style={{ margin: 0 }}>live</span></div>
                <div className="seg" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  {Object.keys(VOICE_PRESETS).map((k) => <button key={k} className={voice.preset === k ? 'on' : ''}
                    onClick={() => changeVoice({ preset: k, ...VOICE_PRESETS[k] })}>{k[0].toUpperCase() + k.slice(1)}</button>)}
                </div>
                <div className="row2"><label>Noise</label>
                  <div className="seg" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                    <button className={noise === 'off' ? 'on' : ''} onClick={() => setNoise('off')}>Off</button>
                    <button className={noise === 'standard' ? 'on' : ''} disabled={busy} onClick={() => setNoise('standard')}>Standard</button>
                    <button className={noise === 'strong' ? 'on' : ''} disabled={busy} title="RNNoise - takes out air conditioner / fan hum" onClick={() => setNoise('strong')}>Strong</button>
                  </div></div>
                <Slider label="Boost" v={voice.boost ?? 0} min={-6} max={12} step={0.5} fmt={(v) => `${v > 0 ? '+' : ''}${v} dB`} onChange={(v) => changeVoice({ boost: v })} />
                <Slider label="Low cut" v={voice.lowcut ?? 60} min={30} max={200} step={5} fmt={(v) => `${v} Hz`} onChange={(v) => changeVoice({ lowcut: v })} />
                <Slider label="Warmth" v={voice.warmth ?? 0} min={-6} max={6} step={0.5} fmt={(v) => `${v > 0 ? '+' : ''}${v} dB`} onChange={(v) => changeVoice({ warmth: v })} />
                <Slider label="Boxiness" v={voice.box ?? 0} min={-6} max={3} step={0.5} fmt={(v) => `${v > 0 ? '+' : ''}${v} dB`} onChange={(v) => changeVoice({ box: v })} />
                <Slider label="Presence" v={voice.presence ?? 0} min={-3} max={8} step={0.5} fmt={(v) => `${v > 0 ? '+' : ''}${v} dB`} onChange={(v) => changeVoice({ presence: v })} />
                <Slider label="Soft s's" v={voice.deess ?? 0} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => changeVoice({ deess: v })} />
                <Slider label="Compression" v={voice.comp ?? 0} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => changeVoice({ comp: v })} />
              </div>}
            </>}

            {sel?.kind === 'layer' && sel.id === 'background' && <>
              <div className="card">
                <div className="sec">Picture</div>
                <Slider label="Zoom" v={bgL.zoom} min={1} max={1.8} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setBg({ ...bgL, zoom: v })} />
                <Slider label="Left / right" v={bgL.x} min={-500} max={500} step={2} fmt={(v) => `${v}`} onChange={(v) => setBg({ ...bgL, x: v })} />
                <Slider label="Up / down" v={bgL.y} min={-700} max={700} step={2} fmt={(v) => `${v}`} onChange={(v) => setBg({ ...bgL, y: v })} />
                <div className="help">{(data.episode.background || '').split('/').pop()} — or drag it on the preview.</div>
              </div>
              <div className="card">
                <div className="card-h"><div className="title grow">Set</div><span className="help" style={{ margin: 0 }}>click = rebuilds</span></div>
                <div className="set-grid">
                  {lib.sets.map((s) => { const on = (data.episode.background || '').endsWith(s.rel);
                    return <button key={s.rel} className={`set ${on ? 'on' : ''}`} title={`${s.folder} / ${s.name}`} disabled={busy}
                      onClick={() => !on && setConfig({ background: `../_assets/${s.rel}` })}>
                      <img src={`/api/asset?p=${encodeURIComponent(s.rel)}`} loading="lazy" /><span>{s.folder}</span></button>; })}
                </div>
              </div>
              {data.episode.plaque_quad && <div className="card">
                <div className="sec">Plaque (one line each)</div>
                <textarea className="field he" dir="rtl" rows={3} style={{ width: '100%', height: 'auto', userSelect: 'text' }} value={plaque} onChange={(e) => setPlaque(e.target.value)} />
                <button className="btn primary" style={{ width: '100%', marginTop: 8 }} disabled={busy || !dirty} onClick={() => save()}>Save & rebuild</button>
              </div>}
            </>}

            {sel?.kind === 'layer' && sel.id === 'music' && <>
              {data.episode.music ? <>
                <div className="card">
                  <div className="card-h"><div className="title grow">Track</div><span className="help" style={{ margin: 0 }}>click = switches now</span></div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {tracks.map((tr) => (
                      <div key={tr.sound} className="trk">
                        <button className={`fx-play ${hearing === tr.url ? 'on' : ''}`} title={hearing === tr.url ? 'Stop' : 'Listen'} onClick={() => hear(tr.url)}>{hearing === tr.url ? '■' : '▶'}</button>
                        <button className={`btn ${tr.on ? 'primary' : ''}`} style={{ justifyContent: 'flex-start', height: 32, flex: 1 }} onClick={() => pickTrack(tr)}>
                          {tr.on ? '♪ ' : ''}{tr.name}
                        </button>
                      </div>))}
                  </div>
                </div>
                <div className="card">
                  <div className="sec">Volume</div>
                  <Slider label="Music" v={musicGain} min={0} max={0.8} step={0.02} fmt={(v) => (v ? `${Math.round(v * 100)}%` : 'off')}
                    onChange={(v) => { setMusicGain(v); saveOpt({ music_gain: v }); }} />
                </div>
              </> : <div className="empty" style={{ padding: 16 }}>No background music in this episode.</div>}
              <div className="card">
                <div className="card-h"><div className="title grow">Sound effects & voices</div><span className="help" style={{ margin: 0 }}>{fx.length}</span></div>
                {fx.map((s: any, n: number) => { const pl = (edit?.sounds || [])[n];
                  return <div key={n} className="fx-row">
                    <div className="fx-top"><button className="fx-play" title="Go there" onClick={() => pl && seek(pl.from / k)}>▶</button>
                      <span className="fx-name">{String(s.sound).split('/').pop()?.replace(/\.[^.]+$/, '')}</span>
                      <span className="fx-time">{pl ? mmss(pl.from / k) : ''}</span>
                      <button className="fx-x" title="Remove" onClick={() => changeFx(fx.filter((_: any, j: number) => j !== n))}>✕</button></div>
                    <div className="fx-ctl">
                      <select className="field" value={s.filter || ''} onChange={(e) => changeFx(fx.map((x: any, j: number) => (j === n ? { ...x, filter: e.target.value || undefined } : x)))}>
                        <option value="">As recorded</option><option value="speaker">Laptop speaker</option><option value="phone">Phone</option><option value="thought">Thought (inner voice)</option>
                      </select>
                      <input type="range" min={0} max={1.5} step={0.05} value={s.gain ?? 0.8} title="Volume" style={{ flex: 1, accentColor: 'var(--accent)' }}
                        onChange={(e) => changeFx(fx.map((x: any, j: number) => (j === n ? { ...x, gain: +e.target.value } : x)))} />
                      <span className="fx-time" style={{ width: 38, textAlign: 'right' }}>{Math.round((s.gain ?? 0.8) * 100)}%</span>
                    </div>
                  </div>; })}
                {!addingFx && <button className="btn" style={{ width: '100%', marginTop: 6 }} disabled={busy} onClick={() => setAddingFx(true)}>+ Add effect at {mmss(t)}</button>}
                {addingFx && <div className="fx-lib">
                  <div className="help" style={{ marginBottom: 6 }}>Pick one - it plays from {mmss(t)} (the playhead).</div>
                  {lib.effects.map((e) => <div key={e.rel} className="fx-lib-row">
                    <button className={`fx-play ${hearing === `/api/asset?p=${encodeURIComponent(e.rel)}` ? 'on' : ''}`} title="Listen" onClick={() => hear(`/api/asset?p=${encodeURIComponent(e.rel)}`)}>{hearing === `/api/asset?p=${encodeURIComponent(e.rel)}` ? '■' : '▶'}</button>
                    <button className="fx-pick" onClick={() => { const at = takeAt(t); if (at) changeFx([...fx, { sound: `../_assets/${e.rel}`, take: at.take, at: at.t, gain: 0.6 }]); setAddingFx(false); }}>
                      {e.name}<span>{e.folder}</span></button></div>)}
                  <button className="btn ghost" style={{ width: '100%', marginTop: 4 }} onClick={() => setAddingFx(false)}>Cancel</button>
                </div>}
              </div>
            </>}

            {!sel && <>
              <div className="card">
                <div className="card-h"><div className="title grow">Layers</div><span className="help" style={{ margin: 0 }}>click one to edit it</span></div>
                <div className="ly-list">
                  {ov.map((o: any, i) => (
                    <button key={i} className="ly" onClick={() => setSel({ kind: 'text', i })}>
                      <span className="ly-ic">{I.text}</span>
                      <span className="ly-main"><span className="ly-name he">{o.image ? String(o.image).split('/').pop() : (o.text || '').split('\n')[0] || 'Text'}</span>
                        <span className="ly-sub">{STYLE_NAMES[o.style || 'pov'] || 'Text'} · {o.start == null && (o.from_words || o.sound != null) ? 'placed by the build' : `${mmss(o.start || 0)}${o.end != null ? `–${mmss(o.end)}` : ' → end'}`}</span></span>
                      <span className="ly-go">›</span>
                    </button>))}
                  {([
                    ['captions', I.cc, 'Captions', `${capStyle?.color === '#ffffff' ? 'White' : capStyle?.color ? 'Colour' : 'Yellow'} · ${(capStyle?.font || 'stam-ashkenaz').replace('-', ' ')} · ${capStyle?.size || 84}px`],
                    ['speaker', I.phone, 'Speaker', `${voice.preset || 'natural'} voice · ${data.episode.cutout === false ? 'original place' : 'cut out'}${eyeOn && L.person_raw ? ' · eye contact' : ''}${look ? ' · look' : ''}`],
                    ['background', I.layout, 'Background', data.episode.cutout === false ? 'not used (original place)' : (data.episode.background || '').split('/').pop()],
                    ['music', null, 'Music & sounds', `${data.episode.music ? `${String(data.episode.music.sound).split('/').pop()?.replace(/\.[^.]+$/, '')} · ${Math.round(musicGain * 100)}%` : 'no music'} · ${(data.episode.sounds || []).length} effects`],
                  ] as const).map(([id, ic, name, sub]) => (
                    <button key={id} className="ly" onClick={() => setSel({ kind: 'layer', id: id as Layer })}>
                      <span className="ly-ic">{ic || '♪'}</span>
                      <span className="ly-main"><span className="ly-name">{name}</span><span className="ly-sub">{sub}</span></span>
                      <span className="ly-go">›</span>
                    </button>))}
                </div>
                <div className="add-row"><span className="add-k">Add</span>
                  {([['hook', 'Hook text'], ['question', 'Question card'], ['thought', 'Thought'], ['band', 'Lower third'], ['ticker', 'Ticker']] as const).map(([kd, nm]) =>
                    <button key={kd} className="add-chip" onClick={() => addOverlay(kd)}>+ {nm}</button>)}
                </div>
              </div>
              <div className="card">
                <div className="card-h"><div className="title grow">Video</div>{edit?.total ? <span className="kv-v">{mmss(edit.total / fps / speed)}</span> : null}</div>
                <div className="sec">Cut</div>
                <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  {([['tight', 'Tight'], ['light', 'Light'], ['keep', 'Keep pauses'], ['whole', 'Whole take']] as const).map(([kc, nm]) =>
                    <button key={kc} className={cutPreset === kc ? 'on' : ''} disabled={busy} onClick={() => setCut(kc)}>{nm}</button>)}
                </div>
                <div className="help" style={{ margin: '6px 0 12px' }}>Tight cuts every pause · Light keeps a breath for faces and gestures · drag any piece's edge on the timeline to pull footage back.</div>
                <div className="sec">Speed</div>
                <div className="seg" style={{ gridTemplateColumns: `repeat(${SPEEDS.length}, 1fr)` }}>
                  {SPEEDS.map((v) => <button key={v} className={speed === v ? 'on' : ''} onClick={() => { setSpeed(v); api(`/api/ep/${ep}/speed`, { speed: v }); }}>{v === 1 ? '1×' : `${v}×`}</button>)}
                </div>
                <div className="help" style={{ marginTop: 6 }}>{speed !== 1 && edit?.total ? `${mmss(edit.total / fps)} at 1× → ${mmss(edit.total / fps / speed)}. ` : ''}Plays live at this speed; Export makes the file at it.</div>
              </div>
            </>}
          </div>
        </div>
      </div>

      <div className="split" />
      <LessonTimeline edit={edit} fps={fps} k={k} t={t} total={total} onSeek={seek} overlays={ov} sel={sel?.kind === 'text' ? sel.i : null}
        onSelText={(i) => setSel({ kind: 'text', i })} layer={sel?.kind === 'layer' ? sel.id : sel?.kind === 'take' ? 'captions' : null}
        onLayer={(id) => setSel({ kind: 'layer', id: id as any })}
        bgName={`Background · ${(data.episode.background || '').split('/').pop()}${data.episode.music ? ' · music' : ''}`}
        busy={busy} onTrim={async (take, from, to) => setJob(await api(`/api/ep/${ep}/trim`, { take, from, to }))} />
    </div>
  );
}

// the ticker strip, positioned from the video's time exactly as the export's ffmpeg formula does - moved on every
// screen frame straight from the video clock (the 4-a-second time updates made it jump)
// an animated thought, live: the same motion as the export (render/ui/thought_anim.js)
function ThoughtText({ o, clock }: { o: any; clock: () => number }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const step = () => { setT(clock()); raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [clock]);
  const words = useMemo(() => thoughtWords(o.text, o.size || 70), [o.text, o.size]);
  if (o.start == null || o.end == null || t < o.start || t > o.end) return null;
  return (
    <div className="he" style={{ position: 'absolute', top: o.y ?? 1150, left: 60, right: 60, display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
      alignItems: 'baseline', gap: '4px 20px', direction: 'rtl', fontFamily: fontCss('assistant'), ...THOUGHT_STYLE, transform: lineDrift(t, o.start, o.text), pointerEvents: 'none' }}>
      {words.map((w, i) => { const s = wordState(i, words.length, t, o.start, o.end);
        return <span key={i} style={{ display: 'inline-block', whiteSpace: 'nowrap', fontSize: w.size, marginTop: w.dy, opacity: s.opacity, filter: s.filter,
          transform: `rotate(${w.rot.toFixed(2)}deg) ${s.transform}` }}>{w.w}</span>; })}
    </div>
  );
}

function TickerStrip({ o, clock }: { o: Overlay; clock: () => number }) {
  const ref = useRef<HTMLDivElement>(null);
  const v = (o as any).speed || 120;
  useEffect(() => {
    let raf = 0;
    const step = () => {
      const el = ref.current;
      if (el) {
        const tw = el.offsetWidth;
        el.style.transform = `translateX(${((v * clock()) % (1080 + tw)) - tw}px)`;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [v, clock]);
  const size = o.size || 46;
  return (
    <div ref={ref} className="he" style={{ position: 'relative', display: 'inline-block', whiteSpace: 'nowrap', padding: '10px 40px', willChange: 'transform',
      font: `800 ${size}px/1.25 ${fontCss(o.font || 'assistant')}, "Segoe UI Emoji"`, color: o.theme === 'gold' ? '#FFD60A' : '#fff', direction: 'rtl' }}>{o.text}</div>
  );
}

// "New video": a template, the footage folder, optionally an earlier project's settings - then it opens
function NewVideo() {
  const [folders, setFolders] = useState<any[]>([]);
  const [eps, setEps] = useState<any[]>([]);
  const [tpl, setTpl] = useState<'solo' | 'zoom'>('solo');
  const [folder, setFolder] = useState('');
  const [from, setFrom] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api('/api/downloads').then((l) => l && setFolders(l)); api('/api/episodes').then((l) => l && setEps(l.filter((e: any) => !e.test))); }, []);
  const create = async () => {
    setBusy(true); setErr('');
    const r = await fetch('/api/new', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, template: tpl, folder, from: tpl === 'solo' ? from : '' }) }).then((x) => x.json()).catch(() => ({ error: 'Could not create it' }));
    setBusy(false);
    if (r.error) return setErr(r.error);
    store.set('zc-ep', r.id);
    location.reload();
  };
  return (
    <div className="nv">
      <div className="nv-sec">1 · Template</div>
      <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <button className={tpl === 'solo' ? 'on' : ''} onClick={() => setTpl('solo')}>Solo · one person</button>
        <button className={tpl === 'zoom' ? 'on' : ''} onClick={() => setTpl('zoom')}>Zoom call</button>
      </div>
      <div className="help" style={{ marginTop: 6 }}>{tpl === 'solo' ? 'One person to camera: monologue, Q&A, a desk sketch with an off-screen voice.' : 'Several people in a video meeting, one file per person.'}</div>
      <div className="nv-sec">2 · Footage folder <span>in Downloads</span></div>
      <div className="nv-list">
        {folders.map((f) => <button key={f.path} className={`nv-f ${folder === f.path ? 'on' : ''}`} onClick={() => { setFolder(f.path); if (!name) setName(f.name); }}>
          <span className="nv-fn he">{f.name}</span><span className="nv-fc">{f.videos} video{f.videos > 1 ? 's' : ''}</span></button>)}
        {!folders.length && <div className="help">No folder with videos in Downloads.</div>}
      </div>
      {tpl === 'solo' && <>
        <div className="nv-sec">3 · Settings from <span>optional</span></div>
        <select className="field" value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">Fresh (default look)</option>
          {eps.filter((e) => e.template !== 'Zoom').map((e) => <option key={e.id} value={e.id}>{e.id} · {e.title}</option>)}
        </select>
        <div className="help" style={{ marginTop: 6 }}>Same series? Its set, music, voice and subtitle style come along; its texts, effects and cuts do not.</div>
      </>}
      <div className="nv-sec">{tpl === 'solo' ? '4' : '3'} · Name</div>
      <input className="field" value={name} placeholder="e.g. gym-2" onChange={(e) => setName(e.target.value)} />
      {err && <div className="nv-err">{err}</div>}
      <button className="btn primary" style={{ width: '100%', marginTop: 14 }} disabled={busy || !folder || !name.trim()} onClick={create}>{busy ? 'Creating…' : 'Create and open'}</button>
      <div className="help" style={{ marginTop: 8 }}>Then press Re-analyze: it transcribes, cuts and builds the layers.</div>
    </div>
  );
}

const hexA = (c: string, a: number) => { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

type Proj = { id: string; title: string; done?: boolean; created?: number; template?: string; test?: boolean };

function LessonTimeline({ edit, fps, k, t, total, onSeek, overlays, sel, onSelText, bgName, layer, onLayer, onTrim, busy }: {
  edit: any; fps: number; k: number; t: number; total: number; onSeek: (s: number) => void; overlays: Overlay[]; sel: number | null; onSelText: (i: number) => void; bgName: string;
  layer: string | null; onLayer: (id: string) => void; onTrim: (take: string, from: number, to: number) => void; busy: boolean;
}) {
  const lanesRef = useRef<HTMLDivElement>(null);
  // dragging a piece's edge: the block follows the mouse, the cut is redone from the original take on release
  const [drag, setDrag] = useState<{ i: number; side: 'in' | 'out'; dx: number } | null>(null);
  const grabEdge = (e: React.MouseEvent, i: number, side: 'in' | 'out') => {
    e.stopPropagation(); e.preventDefault();
    if (busy) return;
    const it = edit.items[i], x0 = e.clientX;
    let dx = 0;
    setDrag({ i, side, dx: 0 });
    const mv = (m: MouseEvent) => { dx = m.clientX - x0; setDrag({ i, side, dx }); };
    const up = () => {
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up);
      setDrag(null);
      if (Math.abs(dx) < 3) return;
      const ds = (dx / pps) * k;  // timeline seconds -> seconds of his take
      const from = side === 'in' ? it.a : it.a + (it.an ?? it.n) / fps;
      onTrim(it.take, +from.toFixed(3), +Math.max(0, from + ds).toFixed(3));
    };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  };
  const [width, setWidth] = useState(1000);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = lanesRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth)); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pps = total ? ((width - 24) / total) * zoom : 10;
  const x = (s: number) => 12 + s * pps;
  const sec = (f: number) => f / fps / k;  // edit frames → preview seconds
  const W = Math.max(width, x(total) + 24);
  const scrub = (e: React.MouseEvent) => {
    const el = lanesRef.current!;
    const at = (cx: number) => onSeek(Math.max(0, (cx - el.getBoundingClientRect().left + el.scrollLeft - 12) / pps));
    at(e.clientX);
    const mv = (m: MouseEvent) => at(m.clientX);
    const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  };
  const step = pps > 60 ? 1 : pps > 25 ? 2 : pps > 10 ? 5 : 10;
  const ticks: React.ReactNode[] = [];
  for (let s = 0; s <= total + 0.001; s += step) ticks.push(<div key={s} className="tick" style={{ left: x(s) }}><span>{mmss(s)}</span></div>);
  const TH = 40;
  return (
    <div className="tl" style={{ ['--th' as any]: `${TH}px` }}>
      <div className="tl-bar">
        <div className="grow" />
        <button className="btn ghost icon" title="Zoom out" onClick={() => setZoom(Math.max(1, zoom / 1.5))}>{I.zoomOut}</button>
        <input type="range" min={1} max={40} step={0.1} value={zoom} onChange={(e) => setZoom(+e.target.value)} />
        <button className="btn ghost icon" title="Zoom in" onClick={() => setZoom(Math.min(40, zoom * 1.5))}>{I.zoomIn}</button>
        <button className="btn" style={{ marginLeft: 6 }} onClick={() => setZoom(1)}>Fit</button>
      </div>
      <div className="tl-body">
        <div className="heads">
          <div className="h ruler" />
          <div className="h">{I.text}Text</div>
          {([['captions', <>{I.cc}Captions</>], ['speaker', <><div className="av sm" style={{ background: 'var(--daniel)' }}>{I.phone}</div><span>Speaker</span></>],
            ['background', <>{I.layout}Background</>], ['music', <>♪&nbsp;Music &amp; sounds</>]] as const).map(([id, label]) => (
            <div key={id} className={`h pick ${layer === id ? 'on' : ''}`} onClick={() => onLayer(id)} title="Click to edit this layer">{label}</div>))}
        </div>
        <div className="lanes" ref={lanesRef}>
          <div className="lanes-in" style={{ width: W }}>
            <div className="ruler" onMouseDown={scrub}>{ticks}</div>
            <div className="lane" onMouseDown={(e) => e.target === e.currentTarget && scrub(e)}>
              {overlays.map((o, i) => (
                <div key={i} className={`txt he ${sel === i ? 'sel' : ''}`} style={{ left: x(o.start || 0), width: Math.max(10, ((o.end ?? total) - (o.start || 0)) * pps - 2) }}
                  onMouseDown={(e) => e.stopPropagation()} onClick={() => onSelText(i)}>
                  {(o as any).image ? `🖼 ${String((o as any).image).split('/').pop()}` : (o as any).asker ? `${(o as any).asker} שואלת · ${o.text}` : o.text}</div>))}
            </div>
            <div className={`lane ${layer === 'captions' ? 'sel' : ''}`} onMouseDown={scrub}>
              {(edit?.captions || []).map((c: any, i: number) => (
                <div key={i} className="cap he" style={{ left: x(sec(c.from)), width: Math.max(2, sec(c.to - c.from) * pps - 2), cursor: 'pointer' }}
                  onMouseDown={(e) => e.stopPropagation()} onClick={() => onLayer('captions')}>{c.text}</div>))}
            </div>
            <div className={`lane ${layer === 'speaker' ? 'sel' : ''}`} onMouseDown={scrub}>
              {(edit?.items || []).map((it: any, i: number) => {
                if (it.kind !== 'clip') return <div key={i} className="idle" style={{ left: x(sec(it.out)), width: Math.max(2, sec(it.n) * pps - 1) }} />;
                const d = drag?.i === i ? drag : null, w0 = sec(it.n) * pps;
                const left = x(sec(it.out)) + (d?.side === 'in' ? d.dx : 0), width = Math.max(4, w0 - 2 + (d ? (d.side === 'in' ? -d.dx : d.dx) : 0));
                const hd = (side: 'in' | 'out') => <div onMouseDown={(e) => grabEdge(e, i, side)} title={side === 'in' ? 'Drag left: more before it (from the original take)' : 'Drag right: more after it (from the original take)'}
                  style={{ position: 'absolute', top: 0, bottom: 0, [side === 'in' ? 'left' : 'right']: 0, width: 7, cursor: 'ew-resize', background: d?.side === side ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.18)', borderRadius: 3 }} />;
                return <div key={i} className="blk" style={{ left, width, background: 'var(--daniel)', cursor: 'pointer', position: 'absolute', outline: d ? '2px solid var(--accent)' : 'none', zIndex: d ? 2 : undefined }}
                  title={`${it.take} · ${it.a.toFixed(2)}s - ${(it.a + (it.an ?? it.n) / fps).toFixed(2)}s of the take · drag an edge to take more / less`}
                  onMouseDown={(e) => e.stopPropagation()} onClick={() => onLayer('speaker')}>
                  {hd('in')}{width > 70 ? <span style={{ padding: '0 10px' }}>{d ? `${d.dx > 0 === (d.side === 'out') ? '+' : '−'}${Math.abs((d.dx / pps) * k).toFixed(2)}s` : it.take.replace('IMG_', '')}</span> : null}{hd('out')}
                </div>;
              })}
            </div>
            <div className={`lane ${layer === 'background' ? 'sel' : ''}`} onMouseDown={scrub}>
              <div className="shot" style={{ left: x(0), width: Math.max(10, total * pps - 2), cursor: 'pointer' }}
                onMouseDown={(e) => e.stopPropagation()} onClick={() => onLayer('background')}>{bgName}</div>
            </div>
            <div className={`lane ${layer === 'music' ? 'sel' : ''}`} onMouseDown={scrub}>
              <div className="cap" style={{ left: x(0), width: Math.max(10, total * pps - 2), background: 'transparent', border: '1px dashed var(--edge-2)', color: 'var(--dim)', cursor: 'pointer' }}
                onMouseDown={(e) => e.stopPropagation()} onClick={() => onLayer('music')}>♪ {bgName.includes('music') ? 'music' : 'no music'}</div>
              {(edit?.sounds || []).map((s: any, i: number) => (
                <div key={i} className="cap" style={{ left: x(s.from / k), width: Math.max(4, ((s.to - s.from) / k) * pps - 2), background: 'var(--gold)', color: '#2a2000' }}
                  title={s.name}>{s.name.includes('ring') ? '☎ ring' : s.name.includes('wife') ? 'the wife (phone)' : s.name}</div>))}
            </div>
            <div className="playhead" style={{ left: x(t), height: 30 + 5 * TH }} />
          </div>
        </div>
      </div>
    </div>
  );
}
