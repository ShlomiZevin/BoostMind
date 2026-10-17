import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Player, PlayerRef } from '@remotion/player';
import { ZoomCall, ovBoxStyle } from '../src/ZoomCall';

// ---------- types ----------------------------------------------------------------------
type Fix = { clip?: string; in?: number; out?: number; cut?: number; layout?: string; pause_before?: number; skip?: boolean; shift?: number };
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
  const [eps, setEps] = useState<{ id: string; title: string }[]>([]);
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
    : job?.code ? 'Last run failed' : (data?.state || (data as any)?.preview || (data as any)?.output) ? 'Preview ready' : 'Not analyzed yet';

  const startDrag = (e: React.MouseEvent) => {
    const y0 = e.clientY, h0 = tlH;
    const mv = (m: MouseEvent) => setTlH(Math.max(180, Math.min(window.innerHeight - 300, h0 - (m.clientY - y0))));
    const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  };
  useEffect(() => store.set('zc-tlh2', String(tlH)), [tlH]);
  const shown = query ? lines.filter((l) => (l.text + ' ' + l.name + ' ' + l.n).includes(query)) : lines;

  const lessonData = (data as any)?.episode?.type === 'lesson' ? (data as any) : null;
  const ready = !!data?.state || !!lessonData?.preview || !!lessonData?.output;
  const top = (
      <div className="top studio-top">
        {/* @ts-ignore - the shared studio bar (render/studio/bar.js) */}
        <studio-nav app="video"></studio-nav>
        <div className="proj">
          <select value={ep} onChange={(e) => setEp(e.target.value)}>{eps.map((e) => <option key={e.id} value={e.id}>{e.id}</option>)}</select>
        </div>
        <div className="chip">Template: {lessonData ? 'Rabbi Lesson' : 'Zoom Call'}</div>
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
                {t === 'script' ? 'Script' : t === 'media' ? `Media${data?.footage?.unassigned?.length ? ' •' : ''}` : 'Templates'}
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
            {tab === 'templates' && (
              <>
                <div className="tpl"><h4>Zoom Call</h4><p>A corporate video call in vertical format: gallery, speaker and duo layouts, interruptions, reaction shots, live captions, host events.</p></div>
                <div className="tpl soon"><h4>Your next format</h4><p>New sketch formats plug in here as templates — same script → takes → edit pipeline, a different look and set of editing rules.</p></div>
              </>)}
          </div>
        </div>

        <div className="pane viewer">
          <div className="monitor">
            <div className="frame" ref={frameRef} style={{ position: 'relative' }}>
              {sel?.kind === 'text' && ovDraft[sel.i] && <TextHandle o={ovDraft[sel.i]} i={sel.i} scale={(frameRef.current?.clientHeight || 1920) / 1920}
                onMove={(y, done) => changeOverlays(ovDraft.map((x, k) => (k === sel.i ? { ...x, y } : x)), done)} />}
              {props && <Player ref={player} component={ZoomCall as any} inputProps={props} durationInFrames={props.durationInFrames}
                fps={props.fps} compositionWidth={1080} compositionHeight={1920} controls={false} clickToPlay
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
              participants={liveParticipants} onChar={changeChar}
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
function Inspector({ data, sel, busy, job, chars, onFix, onSettings, overlays, onOverlays, onSelText, participants, onChar }: {
  participants: any[]; onChar: (id: string, patch: { look?: any; frame?: any }) => void;
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
        <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <button className={o.style === 'pov' ? 'on' : ''} onClick={() => set({ style: 'pov', y: null })}>Top (POV)</button>
          <button className={o.style === 'label' ? 'on' : ''} onClick={() => set({ style: 'label', y: null })}>Middle</button>
        </div>
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
  const y = o.y ?? (o.style === 'label' ? 1180 : 158 + i * 150);
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

function Slider({ label, v, min, max, step, fmt, onChange }: { label: string; v: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div className="row2"><label>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input type="range" min={min} max={max} step={step} value={v} style={{ flex: 1, accentColor: 'var(--accent)' }} onChange={(e) => onChange(+e.target.value)}
          onDoubleClick={() => onChange(min <= 0 && max >= 0 && min < 0 ? 0 : 1)} />
        <span style={{ width: 44, textAlign: 'right', color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{fmt(v)}</span>
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
                    onMouseDown={(e) => e.stopPropagation()} onClick={() => onSelText(i)}>{o.text}</div>))}
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
  const frameRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<'script' | 'media' | 'templates'>('script');
  const [sel, setSel] = useState<{ kind: 'take'; k: number } | { kind: 'text'; i: number } | null>(null);
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
  const layered = !!(data.layers?.person && data.layers?.scene && edit?.photo);
  const [bgL, setBgL] = useState<{ zoom: number; x: number; y: number }>({ zoom: 1, x: 0, y: 0, ...(data.episode.bg || {}) });
  const [pL, setPL] = useState<{ scale: number; x: number; y: number }>({ scale: 1, x: 0, y: 0, ...(data.episode.person || {}) });
  const [capY, setCapY] = useState<number>(data.episode.captions_y ?? 1330);
  const bgBox = (() => {
    const [bw, bh] = edit?.photo || [1080, 1920];
    const c = Math.max(1080 / bw, 1920 / bh) * (bgL.zoom || 1), sw = bw * c, sh = bh * c;
    const clamp = (v: number, hi: number) => Math.min(Math.max(0, v), hi);
    return { sw, sh, cx: clamp((sw - 1080) / 2 - (bgL.x || 0), sw - 1080), cy: clamp((sh - 1920) / 2 - (bgL.y || 0), sh - 1920) };
  })();
  const pBox = (() => { const w = 1080 * pL.scale, h = 1920 * pL.scale; return { w, h, x: (1080 - w) / 2 + (pL.x || 0), y: 1920 - h + (pL.y || 0) }; })();
  const capNow = (edit?.captions || []).find((c: any) => t * fps >= c.from && t * fps < c.to);
  const layoutTimer = useRef<any>(null);
  const saveLayout = (patch: any) => { clearTimeout(layoutTimer.current); layoutTimer.current = setTimeout(() => api(`/api/ep/${ep}/layout`, patch), 300); };
  const setBg = (v: any) => { setBgL(v); saveLayout({ bg: v }); };
  const setP = (v: any) => { setPL(v); saveLayout({ person: v }); };
  // drag him / the set directly on the preview; a click without moving plays / pauses
  const dragLayer = (e: React.MouseEvent, which: 'bg' | 'person') => {
    e.preventDefault(); e.stopPropagation();
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
      if (moved) (which === 'bg' ? setBg : setP)(cur); else if (sel?.kind === 'text') setSel(null); else toggle();
    };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  };
  const dragText = (e: React.MouseEvent, i: number) => {
    e.preventDefault(); e.stopPropagation();
    setSel({ kind: 'text', i });
    const y0 = e.clientY, start = ov[i].y ?? 158;
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
  const liveOv = ov.filter((o) => (o.text || '').trim() && t >= (o.start || 0) && (o.end == null || t < o.end));

  return (
    <div className="ed" style={{ ['--tl-h' as any]: '290px' }}>
      {top}
      <div className="work">
        <div className="pane left">
          <div className="tabs">
            {(['script', 'media', 'templates'] as const).map((x) => (
              <div key={x} className={`tab ${tab === x ? 'on' : ''}`} onClick={() => setTab(x)}>{x === 'script' ? 'Script' : x === 'media' ? 'Media' : 'Templates'}</div>))}
            <div className="grow" />
          </div>
          <div className="scroll">
            {tab === 'script' && (
              <div className="lines">
                {blocks.map((b, n) => (
                  <div key={b.take} className={`ln ${sel?.kind === 'take' && sel.k === n ? 'on' : ''} ${nowTake === b.take ? 'now' : ''}`} onClick={() => { setSel({ kind: 'take', k: n }); seek(takeStart(b.take)); }}>
                    <div className="n">{n + 1}</div>
                    <div className="av" style={{ background: 'var(--daniel)' }}>ד</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="who he" style={{ textAlign: 'left' }}>{b.take}</div>
                      <div className="t he">{b.text}</div>
                    </div>
                    <div className="sdot" style={{ background: 'var(--ok)' }} />
                  </div>))}
                {!blocks.length && <div className="empty" style={{ padding: 16 }}>No captions.txt yet.</div>}
              </div>)}
            {tab === 'media' && (
              <div className="lines">
                {blocks.map((b, n) => (
                  <div key={b.take} className="ln" onClick={() => { setTab('script'); setSel({ kind: 'take', k: n }); seek(takeStart(b.take)); }}>
                    <div className="n">{n + 1}</div><div style={{ minWidth: 0 }}><div className="t">{b.take}</div></div>
                  </div>))}
              </div>)}
            {tab === 'templates' && (
              <>
                <div className="tpl"><h4>Rabbi Lesson</h4><p>One speaker, takes in order: tight cut with overlapping joins, his background removed and a set behind him, holy-style subtitles, sounds under his speech (phone, off-screen voices).</p></div>
                <div className="tpl"><h4>Zoom Call</h4><p>A corporate video call in vertical format: gallery, speaker and duo layouts, interruptions, reaction shots, live captions, host events.</p></div>
              </>)}
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
                  <video ref={video} key={data.layers.person.v} src={`${data.layers.person.url}?v=${data.layers.person.v}`} onMouseDown={(e) => dragLayer(e, 'person')}
                    style={{ position: 'absolute', left: pBox.x, top: pBox.y, width: pBox.w, height: pBox.h, cursor: 'grab' }}
                    onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
                  {capNow && <div className="he" style={{ position: 'absolute', top: capY, left: 50, right: 50, textAlign: 'center', direction: 'rtl', pointerEvents: 'none',
                    font: `84px/1.18 ${fontCss('stam-ashkenaz')}`, color: '#FFD60A', WebkitTextStroke: '14px #000', paintOrder: 'stroke fill',
                    textShadow: '0 6px 14px rgba(0,0,0,0.55)', letterSpacing: '0.045em' } as any}>{capNow.text}</div>}
                </div>
              ) : (data.preview || data.output)
                ? <video ref={video} key={data.previewVersion || data.outputVersion} src={data.preview ? `${data.preview}?v=${data.previewVersion}` : `${data.output}?v=${data.outputVersion}`}
                    style={{ width: '100%', height: '100%' }}
                    onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
                    onClick={() => (sel?.kind === 'text' ? setSel(null) : toggle())} />
                : <div className="empty" style={{ padding: 24 }}>{busy ? 'Building the video…' : 'Press Re-analyze to build it.'}</div>}
              {/* text on video, drawn live at the export's size and place */}
              <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: `scale(${scale})`, transformOrigin: '0 0', pointerEvents: 'none' }}>
                {ov.map((o, i) => liveOv.includes(o) && (
                  <div key={i} style={{ position: 'absolute', top: o.y ?? 158, left: 60, right: 60, display: 'flex', justifyContent: 'center' }}>
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
          <div className="pane-h">Inspector</div>
          <div className="scroll">
            {sel?.kind === 'text' && ov[sel.i]
              ? <>
                <div style={{ padding: '10px 12px 0' }}><button className="btn" onClick={() => setSel(null)}>← Done</button>
                  <span className="help" style={{ marginLeft: 8 }}>or Esc / click the video</span></div>
                <TextProps all={ov} i={sel.i} onChange={(next, commit) => { changeOv(next, commit); if (next.length < ov.length) setSel(null); }} />
              </>
              : <>
                <div className="card">
                  <div className="card-h"><div className="title grow">Layout</div><span className="help" style={{ margin: 0 }}>live · drag on the preview too</span></div>
                  <div className="sec">Background</div>
                  <Slider label="Zoom" v={bgL.zoom} min={1} max={1.8} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setBg({ ...bgL, zoom: v })} />
                  <Slider label="Left / right" v={bgL.x} min={-500} max={500} step={2} fmt={(v) => `${v}`} onChange={(v) => setBg({ ...bgL, x: v })} />
                  <Slider label="Up / down" v={bgL.y} min={-700} max={700} step={2} fmt={(v) => `${v}`} onChange={(v) => setBg({ ...bgL, y: v })} />
                  <div className="sec" style={{ marginTop: 10 }}>Rabbi</div>
                  <Slider label="Size" v={pL.scale} min={0.5} max={1.4} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setP({ ...pL, scale: v })} />
                  <Slider label="Left / right" v={pL.x} min={-600} max={600} step={2} fmt={(v) => `${v}`} onChange={(v) => setP({ ...pL, x: v })} />
                  <Slider label="Up / down" v={pL.y} min={-600} max={1000} step={2} fmt={(v) => `${v}`} onChange={(v) => setP({ ...pL, y: v })} />
                  <div className="sec" style={{ marginTop: 10 }}>Subtitles</div>
                  <Slider label="Height" v={capY} min={900} max={1700} step={5} fmt={(v) => `${v}`} onChange={(v) => { setCapY(v); saveLayout({ captions_y: v }); }} />
                </div>
                <div className="card">
                  <div className="card-h"><div className="title grow">Project</div></div>
                  <div className="sec">Speed</div>
                  <div className="seg" style={{ gridTemplateColumns: `repeat(${SPEEDS.length}, 1fr)` }}>
                    {SPEEDS.map((v) => <button key={v} className={speed === v ? 'on' : ''} onClick={() => { setSpeed(v); api(`/api/ep/${ep}/speed`, { speed: v }); }}>{v === 1 ? '1×' : `${v}×`}</button>)}
                  </div>
                  <div className="help">Plays live at this speed (the voice keeps its pitch); Export makes the file at this speed.</div>
                  <div className="sec" style={{ marginTop: 12 }}>Text on video</div>
                  {ov.map((o, i) => (
                    <div key={i} className="ln" style={{ margin: '4px 0' }} onClick={() => setSel({ kind: 'text', i })}>
                      <div className="t he" style={{ fontFamily: fontCss(o.font) }}>{o.text || '—'}</div>
                    </div>))}
                  <button className="btn" onClick={addText}>+ Add text</button>
                </div>
                {sel?.kind === 'take' && blocks[sel.k] && (
                  <div className="card">
                    <div className="sec">Take {sel.k + 1} · {blocks[sel.k].take} — subtitles</div>
                    <textarea className="field he" dir="rtl" rows={9} style={{ width: '100%', resize: 'vertical', height: 'auto', userSelect: 'text' }}
                      value={blocks[sel.k].text} onChange={(e) => setBlock(sel.k, e.target.value)} />
                  </div>)}
                <div className="card">
                  <div className="sec">Plaque above the ark (one line each)</div>
                  <textarea className="field he" dir="rtl" rows={3} style={{ width: '100%', height: 'auto', userSelect: 'text' }} value={plaque} onChange={(e) => setPlaque(e.target.value)} />
                </div>
                <div style={{ padding: '0 12px 12px' }}>
                  <button className="btn primary" style={{ width: '100%' }} disabled={busy || !dirty} onClick={() => save()}>Save & rebuild preview</button>
                  <div className="help" style={{ marginTop: 8 }}>Pick a take in the script to edit its subtitles; click a text to style or drag it.</div>
                </div>
              </>}
          </div>
        </div>
      </div>

      <div className="split" />
      <LessonTimeline edit={edit} fps={fps} k={k} t={t} total={total} onSeek={seek} overlays={ov} sel={sel?.kind === 'text' ? sel.i : null}
        onSelText={(i) => setSel({ kind: 'text', i })} />
    </div>
  );
}

function LessonTimeline({ edit, fps, k, t, total, onSeek, overlays, sel, onSelText }: {
  edit: any; fps: number; k: number; t: number; total: number; onSeek: (s: number) => void; overlays: Overlay[]; sel: number | null; onSelText: (i: number) => void;
}) {
  const lanesRef = useRef<HTMLDivElement>(null);
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
          <div className="h">{I.cc}Captions</div>
          <div className="h"><div className="av sm" style={{ background: 'var(--daniel)' }}>ד</div><span className="he">דמוקרטוביץ</span></div>
          <div className="h">{I.layout}Background</div>
          <div className="h">♪&nbsp;Sounds</div>
        </div>
        <div className="lanes" ref={lanesRef}>
          <div className="lanes-in" style={{ width: W }}>
            <div className="ruler" onMouseDown={scrub}>{ticks}</div>
            <div className="lane" onMouseDown={(e) => e.target === e.currentTarget && scrub(e)}>
              {overlays.map((o, i) => (
                <div key={i} className={`txt he ${sel === i ? 'sel' : ''}`} style={{ left: x(o.start || 0), width: Math.max(10, ((o.end ?? total) - (o.start || 0)) * pps - 2) }}
                  onMouseDown={(e) => e.stopPropagation()} onClick={() => onSelText(i)}>{o.text}</div>))}
            </div>
            <div className="lane" onMouseDown={scrub}>
              {(edit?.captions || []).map((c: any, i: number) => (
                <div key={i} className="cap he" style={{ left: x(sec(c.from)), width: Math.max(2, sec(c.to - c.from) * pps - 2) }}>{c.text}</div>))}
            </div>
            <div className="lane" onMouseDown={scrub}>
              {(edit?.items || []).map((it: any, i: number) => it.kind === 'clip'
                ? <div key={i} className="blk" style={{ left: x(sec(it.out)), width: Math.max(2, sec(it.n) * pps - 2), background: 'var(--daniel)' }} title={it.take}>{sec(it.n) * pps > 70 ? it.take.replace('IMG_', '') : ''}</div>
                : <div key={i} className="idle" style={{ left: x(sec(it.out)), width: Math.max(2, sec(it.n) * pps - 1) }} />)}
            </div>
            <div className="lane" onMouseDown={scrub}>
              <div className="shot" style={{ left: x(0), width: Math.max(10, total * pps - 2) }}>Synagogue · ark & plaque</div>
            </div>
            <div className="lane" onMouseDown={scrub}>
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
