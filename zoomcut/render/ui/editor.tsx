import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Player, PlayerRef } from '@remotion/player';
import { ZoomCall, ovBoxStyle } from '../src/ZoomCall';
import { thoughtWords, wordState, lineDrift, wordDust, dustState, THOUGHT_STYLE } from './thought_anim.js';
import { drawMarket, marketBox } from './market_anim.js';
import { stickerPop, rainBills } from './sticker_anim.js';
import { fxCss, fxAt } from './fx.js';
import { LiveClock } from './liveplayer';
import { usePreloaded, usePrefetched, Preload } from './preload';
// every clip of the project coming down into memory (once) - a thin bar over the video until it is all there
const PreloadBar = ({ p }: { p: Preload }) => (p.loading ? <div className="pre-bar">
  <div className="pre-fill" style={{ width: `${Math.round((p.done / Math.max(1, p.total)) * 100)}%` }} />
  <span>Loading the clips into memory · {p.done}/{p.total} · {Math.round(p.bytes / 1e6)} MB</span></div> : null);
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
type Sel = { kind: 'line'; n: number } | { kind: 'text'; i: number } | { kind: 'char'; id: string } | null;
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
// the project of this browser tab: shared by its tools (editor, Reader, Karaoke), not by other tabs
const tabProject = {
  get: () => { try { return sessionStorage.getItem('zc-ep') || localStorage.getItem('zc-ep') || ''; } catch { return ''; } },
  set: (id: string) => { try { sessionStorage.setItem('zc-ep', id); localStorage.setItem('zc-ep', id); } catch {} },
};
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
  const [expOpen, setExpOpen] = useState(false);
  const [expQuick, setExpQuick] = useState(false);  // Quick check: a half-size draft (Zoom projects)
  const [stalePick, setStalePick] = useState<'email' | 'telegram' | null>(null);
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
  const [ep, setEp] = useState(tabProject.get());  // this tab's project (another tab can hold another video)
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

  useEffect(() => { api('/api/episodes').then((l) => { setEps(l); if (!l.find((e: any) => e.id === ep) && !ep.startsWith('_')) setEp(l.find((e: any) => !e.id.endsWith('-test'))?.id || l[0]?.id); }); }, []);
  const load = useCallback(async () => { if (!ep) return; const d: Data = await api(`/api/ep/${ep}`); setData(d); setJob(d.job); }, [ep]);
  useEffect(() => { if (ep) { tabProject.set(ep); setData(null); setSel(null); setUndo([]); setRedo([]); load(); } }, [ep]);
  useEffect(() => { const on = () => load(); window.addEventListener('studio-reload', on); return () => window.removeEventListener('studio-reload', on); }, [load]);
  useEffect(() => {  // one project for every tool: picked in the Reader or Karaoke -> opened here too
    const on = (e: StorageEvent) => { if (e.key === 'zc-ep' && e.newValue && e.storageArea === sessionStorage) setEp(e.newValue); };  // this tab's tools only
    addEventListener('storage', on);
    return () => removeEventListener('storage', on);
  }, []);
  useEffect(() => {  // a job already running (another tab, before a refresh): follow it
    if (!ep) return;
    api(`/api/ep/${ep}/job`).then((j: any) => { if (j?.running) setJob(j); }).catch(() => {});  // (no job yet: an empty answer)
  }, [ep]);
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
    // (mirrors plan.py _overlay: an image layer too, and a negative start counts from the end)
    return ovDraft.filter((o: any) => (o.text || '').trim() || (o.style === 'image' && o.image)).map((o: any) => {
      const s = o.start || 0, from = s < 0 ? Math.max(0, total + Math.round(s * fps)) : Math.round(s * fps);
      const end = o.end ? Math.min(total, Math.round(o.end * fps)) : total;
      const base = { text: o.text || '', style: o.style || 'pov', from, dur: Math.max(1, end - from), font: o.font || 'system', theme: o.theme || 'light', opacity: o.opacity ?? 1, y: o.y ?? null, size: o.size };
      return o.style === 'image' ? { ...base, image: 'overlays/' + String(o.image).split(/[\\/]/).pop(), x: o.x ?? null, w: o.w ?? 960, fade_in: o.fade_in ?? 0.3 } : base;
    });
  }, [ovDraft, data?.edit, fps]);
  const [charDraft, setCharDraft] = useState<Record<string, { look?: any; frame?: any; bg?: any }>>({});
  useEffect(() => setCharDraft({}), [data?.episode]);
  const charTimer = useRef<any>(null);
  const changeChar = (id: string, patch: { look?: any; frame?: any; bg?: any }) => {
    const curC = chars.find((c) => c.id === id) || {};
    const curP = (data?.edit?.participants || []).find((p: any) => p.id === id) || {};
    const bgNow = charDraft[id] && 'bg' in charDraft[id] ? charDraft[id].bg : curP.bg;
    const next: any = { look: { ...(curC.look || {}), ...(charDraft[id]?.look || {}), ...(patch.look || {}) },
                   frame: { ...(curC.frame || {}), ...(charDraft[id]?.frame || {}), ...(patch.frame || {}) },
                   bg: 'bg' in patch ? (patch.bg === null ? null : { ...(bgNow || {}), ...patch.bg }) : bgNow };
    setCharDraft({ ...charDraft, [id]: next });
    clearTimeout(charTimer.current);
    // the server keeps the file name; the editor's copy lives under bg/
    const send = { ...next, bg: next.bg ? { ...next.bg, image: String(next.bg.image).split('/').pop() } : next.bg };
    charTimer.current = setTimeout(() => api(`/api/ep/${ep}/character`, { id, ...send }), 350);
  };
  const [voiceDraft, setVoiceDraft] = useState<Record<string, any>>({});
  const [voiceBusy, setVoiceBusy] = useState<string | null>(null);
  useEffect(() => setVoiceDraft({}), [data?.edit]);
  const voiceTimer = useRef<any>(null);
  const changeVoice = (id: string, patch: any) => {
    const cur = { ...((data?.edit?.participants || []).find((p: any) => p.id === id)?.voice || {}), ...(voiceDraft[id] || {}) };
    const next = { ...cur, ...patch };
    setVoiceDraft({ ...voiceDraft, [id]: next });
    clearTimeout(voiceTimer.current);
    const remix = 'clean' in patch || 'presence' in patch;
    voiceTimer.current = setTimeout(async () => {
      if (remix) setVoiceBusy(id);
      const r = await api(`/api/ep/${ep}/voice`, { id, voice: next });
      setVoiceBusy(null);
      if (r?.remixed) load();  // the new tracks
    }, remix ? 500 : 350);
  };
  const liveParticipants = useMemo(() => (data?.edit?.participants || []).map((pp: any) => {
    const q = charDraft[pp.id] ? { ...pp, ...charDraft[pp.id] } : pp;
    return voiceDraft[pp.id] ? { ...q, voice: { ...(q.voice || {}), ...voiceDraft[pp.id] } } : q;
  }), [data?.edit, charDraft, voiceDraft]);
  const props = useMemo(() => data?.edit && ({ ...data.edit, participants: liveParticipants, overlays: liveOverlays, mediaBase: `/media/${ep}/`,
    audioSrc: data.audioVersion ? `/media/${ep}/dialogue.wav?v=${data.audioVersion}` : undefined,
    voices: data.edit.voices?.map((v: any) => ({ ...v, src: `${v.src}?v=${data.audioVersion}` })) }), [data?.edit, data?.audioVersion, ep, liveOverlays, liveParticipants]);
  const preUrls = useMemo(() => {
    if (!props) return [] as string[];
    const b = props.mediaBase;
    const vids = Object.values(props.clips || {}).flatMap((c: any) => [c.fg && b + c.fg, b + (c.preview || c.src)]);
    return [...new Set([...vids, ...(props.voices || []).map((v: any) => b + v.src), props.audioSrc].filter(Boolean))] as string[];
  }, [props?.clips, props?.voices, props?.audioSrc, ep]);
  const pre = usePrefetched(preUrls);

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
  const sendOrAsk = (channel: 'email' | 'telegram') => ((data as any)?.outputStale ? setStalePick(channel) : send(channel));  // an old export: ask first
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
  // sends run by the server (after an export, after a restart, from another tab) show here too
  useEffect(() => {
    if (!ep) return;
    let stop = false;
    const look = async () => {
      const all = (await Promise.all(['telegram', 'email'].map((c) => api(`/api/ep/${ep}/share/${c}`).catch(() => null)))).filter(Boolean) as any[];
      const now = all.find((x) => x.running) || all.sort((x, y) => (y.ended || 0) - (x.ended || 0))[0];
      if (!stop && now && (now.running || !share?.running)) setShare(now);
      if (!stop) setTimeout(look, all.some((x) => x.running) ? 1500 : 6000);
    };
    look();
    return () => { stop = true; };
  }, [ep]);
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
        {job?.kind === 'export' && (busy || share?.running) ? (() => {
          // the export, step by step: preparing -> rendering n% -> sending -> done
          const rendered = /Rendered (\d+)\/(\d+)/.exec((job?.log || []).filter((l: string) => l.startsWith('Rendered')).at(-1) || '');
          const p = rendered ? +rendered[1] / +rendered[2] : 0;
          const stage = !busy ? (share?.log?.at(-1) || 'Sending…') : rendered ? `Rendering ${Math.round(p * 100)}%` : 'Preparing the layers and the sound…';
          const dest = (job?.send || []).map((c: string) => (c === 'email' ? 'Email' : 'Telegram')).join(' + ');
          return <div className="xp">
            <span className="xp-k">Exporting {ep}</span>
            <div className="xp-bar"><div style={{ width: `${Math.round((busy ? (rendered ? 0.08 + 0.92 * p : 0.04) : 1) * 100)}%` }} /></div>
            <span className="xp-s">{stage}</span>
            <span className="xp-d">{busy ? (dest ? `then → ${dest}` : 'then → the file only') : ''}</span>
          </div>;
        })() : <div className="state"><span className={`ring ${busy ? 'busy' : job?.code ? 'err' : ''}`} />{statusText}</div>}
        <div className="grow" />
        {busy && <button className="btn" onClick={async () => setJob(await api(`/api/ep/${ep}/cancel`, {}))}>{I.stop} Stop</button>}
        <button className="btn" disabled={busy} onClick={async () => setJob(await api(`/api/ep/${ep}/analyze`, {}))}>Re-analyze</button>
        {shareText && <div className="state" style={{ color: share!.ok === false ? 'var(--bad)' : share!.ok ? 'var(--ok)' : 'var(--dim)' }}>{shareText}</div>}
        {data?.output && !busy && <a href={`${data.output}?v=${Date.now()}`} target="_blank"><button className="btn">Open MP4</button></a>}
        {data?.output && !busy && <button className="btn" disabled={!!share?.running} title="Email the video to shlomi@boostart.io" onClick={() => sendOrAsk('email')}>{I.mail} Email</button>}
        {data?.output && !busy && <button className="btn" disabled={!!share?.running} title="Send the video to your Telegram" onClick={() => sendOrAsk('telegram')}>{I.tg} Telegram</button>}
        {stalePick && <div className="pm-modal" onClick={() => setStalePick(null)}>
          <div className="pm-box" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>The video changed after the last export</div>
            <div className="help" style={{ margin: '0 0 14px' }}>The file you'd send doesn't have your latest changes.</div>
            <div style={{ display: 'grid', gap: 6 }}>
              <button className="btn primary" onClick={async () => { const ch = stalePick; setStalePick(null); setShare(null); setJob(await api(`/api/ep/${ep}/export`, { send: [ch] })); }}>Export again, then send it</button>
              <button className="btn" onClick={() => { const ch = stalePick; setStalePick(null); send(ch); }}>Send the old file anyway</button>
              <button className="btn ghost" onClick={() => setStalePick(null)}>Cancel</button>
            </div>
          </div>
        </div>}
        <div className="exp">
          <button className="btn primary" disabled={busy || !ready} onClick={() => setExpOpen(!expOpen)} title="Export the video - pick where it goes first">{I.export} Export ▾</button>
          {expOpen && <div className="exp-pop" onMouseLeave={() => setExpOpen(false)}>
            {!lessonData && <div className="seg exp-mode" style={{ gridTemplateColumns: '1fr 1fr', margin: '4px 10px 8px' }}>
              <button className={!expQuick ? 'on' : ''} onClick={() => setExpQuick(false)} title="1080x1920, the file for TikTok">Full quality</button>
              <button className={expQuick ? 'on' : ''} onClick={() => setExpQuick(true)} title="Half size, fastest - a draft to check the edit on the phone (sent marked DRAFT; the real file is not replaced)">Quick check</button>
            </div>}
            <div className="exp-h">When it's done, send it to…</div>
            {([[['telegram'], 'Telegram', I.tg], [['email'], 'Email', I.mail], [['telegram', 'email'], 'Telegram + Email', null], [[], 'Nowhere - just make the file', null]] as const).map(([send, nm, ic]) => (
              <button key={nm} className="exp-it" onClick={async () => { setExpOpen(false); setShare(null); setJob(await api(`/api/ep/${ep}/export`, { send, quick: expQuick && !lessonData })); }}>
                {ic || <span style={{ width: 16 }} />}{nm}</button>))}
            <div className="exp-f">{expQuick && !lessonData ? 'Quick check: a draft at half size, a few times faster - check the edit, then export Full quality.' : 'Export takes a few minutes - it sends by itself when it finishes.'}</div>
          </div>}
        </div>
      </div>
  );
  if (lessonData) return <LessonView ep={ep} data={lessonData} top={top} busy={busy} setJob={setJob} jobLine={busy ? statusText : ''} reload={load} />;

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
              <PreloadBar p={pre} />
              {sel?.kind === 'text' && ovDraft[sel.i] && <TextHandle o={ovDraft[sel.i]} i={sel.i} scale={(frameRef.current?.clientHeight || 1920) / 1920}
                onMove={(y, done) => changeOverlays(ovDraft.map((x, k) => (k === sel.i ? { ...x, y } : x)), done)} />}
              {props && <Player ref={player} component={ZoomCall as any} inputProps={props} numberOfSharedAudioTags={16} durationInFrames={props.durationInFrames}
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
          <div className="pane-h" style={{ display: 'flex', alignItems: 'center' }}>
            <span className="grow">{sel ? (sel.kind === 'char' ? `${chars.find((c) => c.id === sel.id)?.name || ''} · all settings` : sel.kind === 'line' ? `Line #${sel.n}` : 'Text') : 'Project'}</span>
            {sel && <button className="btn ghost icon" title="Back to the project settings (speed, subtitles, texts)" onClick={() => setSel(null)}>✕</button>}
          </div>
          <div className="scroll">
            <Inspector ep={ep} data={data} sel={sel} busy={busy} job={job} chars={chars} onFix={changeLine} onSettings={changeSettings}
              participants={liveParticipants} onChar={changeChar} onVoice={changeVoice} voiceBusy={voiceBusy} speed={speed} onSpeed={changeSpeed}
              overlays={ovDraft} onOverlays={changeOverlays} onSelText={(i) => setSel({ kind: 'text', i })} />
          </div>
        </div>
      </div>

      <div className="split" onMouseDown={startDrag} />
      <Timeline data={data && data.edit ? { ...data, edit: { ...data.edit, overlays: liveOverlays } } : data} frame={frame} fps={fps} total={total} sel={sel} playing={playing} chars={chars}
        canUndo={!!undo.length && !busy} canRedo={!!redo.length && !busy} onUndo={doUndo} onRedo={doRedo} busy={busy} onTrim={trim}
        onSeek={seek} onSelLine={(n) => selectLine(n, false)} onSelText={(i) => setSel({ kind: 'text', i })}
        onSelChar={(id) => setSel({ kind: 'char', id })} participants={liveParticipants} ep={ep} />
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
function Inspector({ ep, data, sel, busy, job, chars, onFix, onSettings, overlays, onOverlays, onSelText, participants, onChar, onVoice, voiceBusy, speed, onSpeed }: {
  ep: string; onVoice: (id: string, patch: any) => void; voiceBusy: string | null; participants: any[]; onChar: (id: string, patch: { look?: any; frame?: any; bg?: any }) => void; speed: number; onSpeed: (v: number) => void;
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
      <SubtitleEdit key={'s' + l.n} ep={ep} n={l.n} script={l.text} saved={(data as any)?.corrections?.lines?.[String(l.n)]?.caption} />
      <CharacterCard ep={ep} who={participants.find((x) => x.id === l.speaker)} onChar={onChar} onVoice={onVoice} voiceBusy={voiceBusy} />{runLog}</div>;
  }
  if (sel?.kind === 'char') {
    return <div className="insp"><CharacterCard ep={ep} who={participants.find((x) => x.id === sel.id)} onChar={onChar} onVoice={onVoice} voiceBusy={voiceBusy} />{runLog}</div>;
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
          <SpeedPick speed={speed} onSpeed={onSpeed} />
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

// a layer that pops in (springs past its size and settles in 0.35 s) and shrinks away in its last 0.2 s -
// the export draws the same curve (lesson.py pop_expr)
const popScale = (o: any, t: number) => {
  if (!o?.pop) return 1;
  const p = Math.min(1, Math.max(0, (t - (o.start || 0)) / 0.35));
  const q = o.end == null ? 1 : Math.min(1, Math.max(0, (o.end - t) / 0.2));
  return (0.3 + 0.7 * (1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2)) * (0.3 + 0.7 * q);
};
// a layer that fades in / out ("fade_in" / "fade_out" seconds) - lesson.py draws the same alpha ramps
const fadeOp = (o: any, t: number, total: number) => {
  const fi = +(o?.fade_in || 0), fo = +(o?.fade_out || 0), end = o?.end ?? total;
  let op = 1;
  if (fi > 0) op = Math.min(op, (t - (o.start || 0)) / fi);
  if (fo > 0) op = Math.min(op, (end - t) / fo);
  return Math.max(0, Math.min(1, op));
};
// a call to action that blinks: on 72% of each second (lesson.py draws the same)
const blinkOn = (o: any, t: number) => !o?.blink || ((t - (o.start || 0)) % 1 + 1) % 1 < 0.72;
const Entrance = ({ o, set }: { o: any; set: (patch: any) => void }) => <>
  <div className="sec" style={{ marginTop: 4 }}>Entrance</div>
  <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
    <button className={!o.pop ? 'on' : ''} onClick={() => set({ pop: undefined })}>Appears</button>
    <button className={o.pop ? 'on' : ''} onClick={() => set({ pop: true })}>Pops in</button>
  </div>
  <div className="seg" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 6 }}>
    <button className={!o.blink ? 'on' : ''} onClick={() => set({ blink: undefined })}>Steady</button>
    <button className={o.blink ? 'on' : ''} onClick={() => set({ blink: true })}>Blinks</button>
  </div>
</>;

function TextProps({ all, i, onChange }: { all: Overlay[]; i: number; onChange: (o: Overlay[], commit?: boolean) => void }) {
  const o = all[i];
  const set = (patch: Partial<Overlay>, commit = true) => onChange(all.map((x, k) => (k === i ? { ...x, ...patch } : x)), commit);
  const theme = o.theme || 'light', op = o.opacity ?? 1;
  const chipBg = (t: string) => (t === 'light' ? `rgba(255,255,255,${op})` : `rgba(0,0,0,${op})`);
  if (o.style === 'market') return <MarketProps o={o as any} set={set} remove={() => onChange(all.filter((_, k) => k !== i))} />;
  if (o.style === 'sticker') return <StickerProps o={o as any} set={set} remove={() => onChange(all.filter((_, k) => k !== i))} />;
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
        {o.style !== 'ticker' && <Entrance o={o} set={set as any} />}
        <div className="pair">
          <label>From</label><Num value={o.start} step={0.5} onCommit={(v) => set({ start: v ?? 0 })} />
          <label>Until</label><Num value={o.end} step={0.5} placeholder="end" onCommit={(v) => set({ end: v ?? null })} />
        </div>
        <button className="btn" onClick={() => onChange(all.filter((_, k) => k !== i))}>{I.drop}Delete text</button>
      </div>
    </>
  );
}

// a sticker's settings: how it moves, its size, place, tilt and timing
function StickerProps({ o, set, remove }: { o: any; set: (p: any, commit?: boolean) => void; remove: () => void }) {
  const slider = (k: string, label: string, min: number, max: number, step: number, def: number) =>
    <div className="row2" key={k}><label>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input type="range" min={min} max={max} step={step} value={o[k] ?? def} style={{ flex: 1, accentColor: 'var(--accent)' }}
          onChange={(e) => set({ [k]: +e.target.value }, false)} onMouseUp={() => set({}, true)} />
        <span style={{ width: 44, textAlign: 'right', color: 'var(--dim)' }}>{o[k] ?? def}</span>
      </div></div>;
  const rain = o.motion === 'rain';
  return (
    <>
      <div className="card">
        <div className="card-h"><div className="av" style={{ background: 'var(--gold)', color: '#2a2000' }}>★</div><div className="title grow">Sticker</div>
          <span className="help" style={{ margin: 0 }}>changes show live</span></div>
        <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <button className={!rain ? 'on' : ''} onClick={() => set({ motion: 'pop' })}>Pop in</button>
          <button className={rain ? 'on' : ''} onClick={() => set({ motion: 'rain' })}>Rain down</button>
        </div>
        {slider('w', rain ? 'Bill size' : 'Size', 120, 1000, 10, rain ? 260 : 520)}
        {rain ? slider('count', 'How many', 4, 60, 1, 22) : <>{slider('x', 'Left / right', 0, 1080, 10, 540)}{slider('y', 'Up / down', 0, 1920, 10, 700)}{slider('rot', 'Tilt', -30, 30, 1, -6)}</>}
      </div>
      <div className="card">
        <div className="sec">Timing</div>
        <div className="pair">
          <label>From</label><Num value={o.start} step={0.1} onCommit={(v) => set({ start: v ?? 0 })} />
          <label>Until</label><Num value={o.end} step={0.1} placeholder="end" onCommit={(v) => set({ end: v ?? null })} />
        </div>
        <button className="btn" onClick={remove}>{I.drop}Delete sticker</button>
      </div>
    </>
  );
}

// a finance-news panel's settings: the coin, its numbers, the words on it, its size and timing
function MarketProps({ o, set, remove }: { o: any; set: (p: any, commit?: boolean) => void; remove: () => void }) {
  const field = (k: string, label: string, ph = '', num = false) => <div className="row2" key={k}><label>{label}</label>
    <input className={`field ${num ? '' : 'he'}`} value={o[k] ?? ''} placeholder={ph}
      onChange={(e) => set({ [k]: e.target.value === '' ? undefined : e.target.value }, false)}
      onBlur={() => set(num && o[k] != null && o[k] !== '' && !isNaN(+o[k]) ? { [k]: +o[k] } : {}, true)} /></div>;
  const slider = (k: string, label: string, min: number, max: number, step: number, def: number, show: (v: number) => string) =>
    <div className="row2" key={k}><label>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input type="range" min={min} max={max} step={step} value={o[k] ?? def} style={{ flex: 1, accentColor: 'var(--accent)' }}
          onChange={(e) => set({ [k]: +e.target.value }, false)} onMouseUp={() => set({}, true)} />
        <span style={{ width: 44, textAlign: 'right', color: 'var(--dim)' }}>{show(o[k] ?? def)}</span>
      </div></div>;
  return (
    <>
      <div className="card">
        <div className="card-h"><div className="av" style={{ background: 'var(--gold)', color: '#2a2000' }}>$</div><div className="title grow">Market panel</div>
          <span className="help" style={{ margin: 0 }}>changes show live</span></div>
        {field('symbol', 'Coin', 'LMTS')}
        {field('name', 'Name', 'מטבע קריפטו')}
        {field('price', 'Price $', '0.0847', true)}
        {field('change', 'Change %', '95.4', true)}
        {field('text', 'Section', 'שוק הקריפטו')}
        {field('tag', 'Tag', 'מבזק')}
        {field('updated', 'Updated', 'עודכן: אתמול')}
        {field('call', 'The call', 'ההמלצה יצאה')}
        {field('fine', 'Fine print', 'אין לראות באמור ייעוץ השקעות')}
        <div className="help">The chart draws in: the day before yesterday flat, yesterday the rise, today the call - after the rise. Drag the panel on the preview to move it.</div>
      </div>
      <div className="card">
        <div className="sec">Size & timing</div>
        {slider('w', 'Width', 560, 1040, 10, 960, (v) => String(v))}
        {slider('draw', 'Chart starts', 0, 8, 0.1, 0.3, (v) => `${(+v).toFixed(1)}s`)}
        {slider('dump', 'After the call', 0, 0.3, 0.01, 0.07, (v) => `-${Math.round(v * 100)}%`)}
        <div className="pair">
          <label>From</label><Num value={o.start} step={0.5} onCommit={(v) => set({ start: v ?? 0 })} />
          <label>Until</label><Num value={o.end} step={0.5} placeholder="end" onCommit={(v) => set({ end: v ?? null })} />
        </div>
        <button className="btn" onClick={remove}>{I.drop}Delete panel</button>
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
function CharacterCard({ ep, who, onChar, onVoice, voiceBusy }: { ep: string; who: any; onChar: (id: string, patch: { look?: any; frame?: any; bg?: any }) => void;
  onVoice?: (id: string, patch: any) => void; voiceBusy?: string | null }) {
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
      <BgLayer ep={ep} who={who} onChar={onChar} />
      {onVoice && <VoiceLayer who={who} onVoice={onVoice} busy={voiceBusy === who.id} />}
    </div>
  );
}

// a line's subtitle - a layer: its text, edited live (empty = the script's words). Saved instantly; the next build keeps it
function SubtitleEdit({ ep, n, script, saved }: { ep: string; n: number; script: string; saved?: string }) {
  const [txt, setTxt] = useState(saved ?? script);
  const timer = useRef<any>(null);
  const save = (v: string) => {
    setTxt(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await api(`/api/ep/${ep}/caption`, { n, text: v.trim() === script.trim() ? '' : v });
      window.dispatchEvent(new Event('studio-reload'));
    }, 450);
  };
  return (
    <div className="card">
      <div className="card-h"><div className="title grow">Subtitle · layer</div>
        {saved ? <button className="btn ghost" onClick={() => save(script)} title="Back to the script's words">Back to script</button> : null}</div>
      <textarea className="field he" dir="rtl" rows={3} value={txt} onChange={(e) => save(e.target.value)} />
      <div className="help">What the subtitle says for this line (write what he actually SAID). Changes show at once.</div>
    </div>
  );
}

// a character's voice - a layer: volume (live), cleaning and clarity (the audio is mixed again in seconds)
function VoiceLayer({ who, onVoice, busy }: { who: any; onVoice: (id: string, patch: any) => void; busy: boolean }) {
  const v = who.voice || {};
  const clean = v.clean || 'off';
  return (
    <div style={{ marginTop: 14 }}>
      <div className="sec" style={{ marginBottom: 8 }}>Voice · layer {busy && <span className="help" style={{ margin: 0 }}>· mixing…</span>}</div>
      <Slider label="Volume" v={v.volume ?? 1} min={0} max={1} step={0.02} fmt={(x) => `${Math.round(x * 100)}%`} onChange={(x) => onVoice(who.id, { volume: x })} />
      <div className="row2" style={{ margin: '6px 0' }}><label>Cleaning</label>
        <div className="seg" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {(['off', 'mild', 'strong', 'nn'] as const).map((k) => <button key={k} className={clean === k ? 'on' : ''} title={k === 'nn' ? 'RNNoise - the neural noise filter (as on the news voice)' : undefined}
            onClick={() => onVoice(who.id, { clean: k })}>{k === 'nn' ? 'NN' : k}</button>)}
        </div></div>
      <Slider label="Clarity" v={v.presence ?? 0} min={-6} max={8} step={0.5} fmt={(x) => `${x > 0 ? '+' : ''}${x} dB`} onChange={(x) => onVoice(who.id, { presence: x })} />
      <div className="help">Mild: hiss and rumble out, level evened. Strong: also mud out, clarity up, the room's ringing gated. NN: RNNoise, the neural noise filter (as on the news voice) - can swallow a very soft sound.</div>
    </div>
  );
}

// a character's background - a layer: pick a photo (or add one), move and zoom it; live, the export follows
function BgLayer({ ep, who, onChar }: { ep: string; who: any; onChar: (id: string, patch: { bg?: any }) => void }) {
  const [list, setList] = useState<{ name: string; url: string }[]>([]);
  const load = () => api(`/api/ep/${ep}/backgrounds`).then((l) => Array.isArray(l) && setList(l));
  useEffect(() => { load(); }, [ep]);
  const bg = who.bg;
  const cur = bg?.image ? String(bg.image).split('/').pop() : null;
  const pick = (f: { name: string; url: string }) => {
    const img = new Image();
    img.onload = () => onChar(who.id, { bg: { image: 'bg/' + f.name, w: img.naturalWidth, h: img.naturalHeight, x: 0, y: 0, zoom: 1 } });
    img.src = f.url;
  };
  const add = async (file?: File) => {
    if (!file) return;
    const r = await fetch(`/api/ep/${ep}/backgrounds?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file }).then((x) => x.json());
    const l = await api(`/api/ep/${ep}/backgrounds`);
    if (Array.isArray(l)) { setList(l); const f = l.find((x: any) => x.name === r.name); if (f) pick(f); }
  };
  const sgn = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}`, pct = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <div style={{ marginTop: 14 }}>
      <div className="sec" style={{ marginBottom: 8 }}>Background · layer</div>
      <div className="bg-grid">
        {list.map((f) => <img key={f.name} src={f.url} className={cur === f.name ? 'on' : ''} title={f.name} onClick={() => pick(f)} />)}
        <label className="bg-add" title="Add a background picture">+<input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { add(e.target.files?.[0]); e.target.value = ''; }} /></label>
        <button className={`bg-none ${!bg ? 'on' : ''}`} title="No background (the take as filmed)" onClick={() => onChar(who.id, { bg: null })}>None</button>
      </div>
      {bg && <>
        <Slider label="Pan left / right" v={bg.x ?? 0} min={-0.5} max={0.5} step={0.01} fmt={sgn} onChange={(v) => onChar(who.id, { bg: { x: v } })} />
        <Slider label="Pan up / down" v={bg.y ?? 0} min={-0.5} max={0.5} step={0.01} fmt={sgn} onChange={(v) => onChar(who.id, { bg: { y: v } })} />
        <Slider label="Zoom" v={bg.zoom ?? 1} min={0.4} max={2.5} step={0.02} fmt={pct} onChange={(v) => onChar(who.id, { bg: { zoom: v } })} />
      </>}
    </div>
  );
}

// ---------- timeline ---------------------------------------------------------------------
function Timeline({ data, frame, fps, total, sel, playing, chars, canUndo, canRedo, onUndo, onRedo, busy, onTrim, onSeek, onSelLine, onSelText, onSelChar, participants, ep }: {
  onSelChar: (id: string) => void; participants: any[]; ep: string;
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
        setZoom((z) => Math.max(0.25, Math.min(40, z * (e.deltaY < 0 ? 1.25 : 0.8))));
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
  const tracks = ['layout', ...chars.flatMap((c) => [c.id, 'bg:' + c.id]), 'captions', 'text'];
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
        <button className="btn ghost icon" title="Zoom out" onClick={() => setZoom(Math.max(0.25, zoom / 1.5))}>{I.zoomOut}</button>
        <input type="range" min={0.25} max={40} step={0.05} value={zoom} onChange={(e) => setZoom(+e.target.value)} title="Ctrl + mouse wheel on the timeline zooms too" />
        <button className="btn ghost icon" title="Zoom in" onClick={() => setZoom(Math.min(40, zoom * 1.5))}>{I.zoomIn}</button>
        <button className="btn" style={{ marginLeft: 6 }} onClick={() => setZoom(1)}>Fit</button>
      </div>
      <div className="tl-body">
        <div className="heads">
          <div className="h ruler" />
          {tracks.map((t) => {
            const c = chars.find((x) => x.id === t);
            if (t.startsWith('bg:')) {
              const who = chars.find((x) => x.id === t.slice(3));
              return <div key={t} className="h sub bgh" onClick={() => onSelChar(t.slice(3))} title="This character's background - a layer">
                <span className="he">רקע · {who?.name}</span></div>;
            }
            return <div key={t} className={`h ${c ? 'pick' : ''} ${c && sel?.kind === 'char' && sel.id === t ? 'on' : ''}`} onClick={() => c && onSelChar(t)}
              title={c ? "All of this character's settings - voice, background, look" : undefined}>
              {c ? <><div className="av sm" style={{ background: colorOf(t, chars) }}>{c.name[0]}</div><span className="he">{c.name}</span></>
                : t === 'layout' ? <>{I.layout}Layout</> : t === 'captions' ? <>{I.cc}Subtitles</> : <>{I.text}Text</>}
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
              {chars.map((c) => [(
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
                </div>), (() => {
                  // the background layer of this character: one bar for the whole video
                  const bg = participants.find((p: any) => p.id === c.id)?.bg;
                  const on = sel?.kind === 'char' && sel.id === c.id;
                  return <div key={'bg' + c.id} className="lane" onMouseDown={onlyBg}>
                    <div className={`bgbar he ${on ? 'sel' : ''} ${bg ? '' : 'none'}`} style={{ left: x(0), width: Math.max(20, total * pps - 2),
                      backgroundImage: bg ? `url(/media/${ep}/${bg.image})` : undefined }}
                      onMouseDown={(e) => e.stopPropagation()} onClick={() => onSelChar(c.id)}>
                      {bg ? String(bg.image).split('/').pop() : 'no background'}</div>
                  </div>;
                })()])}
              <div className="lane" onMouseDown={scrub}>
                {edit.subtitles && edit.captions.map((c: any, i: number) => (
                  <div key={i} className={`cap he ${c.n != null ? 'pick' : ''} ${sel?.kind === 'line' && sel.n === c.n ? 'sel' : ''}`}
                    style={{ left: x(c.from / fps), width: Math.max(2, c.dur / fps * pps - 2) }}
                    onMouseDown={(e) => c.n != null && e.stopPropagation()} onClick={() => c.n != null && onSelLine(c.n)}
                    title={c.n != null ? 'A subtitle - click to edit its text' : undefined}>{c.text}</div>))}
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
// the presets, and his own exact number beside them (0.5-2x; typed, applied on Enter or leaving the box)
function SpeedPick({ speed, onSpeed }: { speed: number; onSpeed: (v: number) => void }) {
  // the presets and a sixth button: "Custom" - his own number, lit like a preset when it is the speed; click to type it
  const own = !SPEEDS.includes(speed);
  const [edit, setEdit] = useState(false);
  const [txt, setTxt] = useState('');
  const open = () => { setTxt(own ? String(speed) : ''); setEdit(true); };
  const commit = () => {
    setEdit(false);
    const v = +txt;
    if (txt.trim() && Number.isFinite(v)) { const c = Math.min(2, Math.max(0.5, +v.toFixed(3))); if (c !== speed) onSpeed(c); }
  };
  return <div className="seg spd" style={{ gridTemplateColumns: `repeat(${SPEEDS.length}, 1fr) 1.25fr` }}>
    {SPEEDS.map((v) => <button key={v} className={speed === v ? 'on' : ''} onClick={() => onSpeed(v)}>{v === 1 ? '1×' : `${v}×`}</button>)}
    {edit
      ? <span className="spd-edit"><input autoFocus type="number" min={0.5} max={2} step={0.01} value={txt} placeholder="1.15"
          onChange={(e) => setTxt(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setTxt(''); setEdit(false); } }} />×</span>
      : <button className={own ? 'on spd-own' : 'spd-own'} onClick={open} title="Your own speed (0.5-2×): click, type it, Enter">
          {own ? <>{+speed.toFixed(3)}×<small>custom</small></> : <>Custom…</>}</button>}
  </div>;
}

function LessonView({ ep, data, top, busy, setJob, jobLine, reload }: { ep: string; data: any; top: React.ReactNode; busy: boolean; setJob: (j: Job) => void; jobLine?: string; reload?: () => void }) {
  const fps = 30;
  const [editLive, setEditLive] = useState<any>(null);  // the cut as just changed here, until the server's re-plan answers
  useEffect(() => setEditLive(null), [data.lesson?.edit]);
  const edit = editLive || data.lesson?.edit;
  const [tlH, setTlH] = useState(+(store.get('zc-tl-h') || 330));
  const dragTl = (e: React.MouseEvent) => {  // the line above the timeline: drag it to make the timeline taller / shorter
    e.preventDefault();
    const y0 = e.clientY, h0 = tlH;
    const mv = (m: MouseEvent) => setTlH(Math.max(180, Math.min(innerHeight - 260, h0 + (y0 - m.clientY))));
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); setTlH((h) => { store.set('zc-tl-h', String(h)); return h; }); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };
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
  type Layer = 'captions' | 'speaker' | 'background' | 'music' | 'sounds' | 'filters';
  const [sel, setSel] = useState<{ kind: 'take'; k: number } | { kind: 'text'; i: number } | { kind: 'layer'; id: Layer } | { kind: 'sound'; i: number } | null>(null);
  const [caps, setCaps] = useState<string>(data.lesson?.captions || '');
  const [plaque, setPlaque] = useState<string>((data.episode.plaque || []).join('\n'));
  const [ov, setOv] = useState<Overlay[]>(data.episode.overlays || []);
  const [fh, setFh] = useState(800);
  useEffect(() => { setCaps(data.lesson?.captions || ''); setPlaque((data.episode.plaque || []).join('\n')); setOv(data.episode.overlays || []); },
    [ep, data.outputVersion, data.previewVersion, JSON.stringify(data.episode.overlays || [])]);
  useEffect(() => {
    const el = frameRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setFh(el.clientHeight)); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const dirty = caps !== (data.lesson?.captions || '') || plaque !== (data.episode.plaque || []).join('\n');
  const save = async (extra: any = {}) => { const r = await api(`/api/ep/${ep}/lesson`, { captions: caps, plaque: plaque.split('\n').filter((x) => x.trim()), ...extra }); if (r?.live) reload?.(); else setJob(r); };
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
  const inspTitle = !sel ? 'Project' : sel.kind === 'text' ? 'Text' : sel.kind === 'take' ? 'Subtitles' : sel.kind === 'sound' ? 'Sound' : LAYER_NAMES[sel.id];
  const inspIcon = !sel ? I.layout : sel.kind === 'text' ? I.text : sel.kind === 'take' ? I.cc : sel.kind === 'sound' ? <span>♪</span>
    : sel.id === 'captions' ? I.cc : sel.id === 'speaker' ? I.phone : sel.id === 'background' ? I.layout : <span>♪</span>;
  const clock = useCallback(() => video.current?.currentTime ?? 0, []);
  const camRef = useRef<HTMLDivElement>(null);
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
    // the raw track plays at once; its prepared bed (placed, ducked under his voice) follows in a second
    setFxBusy(true); api(`/api/ep/${ep}/music-time`, { sound: tr.sound }).then(() => { setFxBusy(false); reload?.(); });
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
  const [film, setFilm] = useState<any>(data.episode.fx || null);  // the film look: live, saved without a rebuild
  const filmKey = JSON.stringify(data.episode.fx || null);
  useEffect(() => setFilm(data.episode.fx || null), [ep, filmKey]);
  const changeFilm = (fx: any) => { setFilm(fx); setConfig({ fx }, false, 300); };
  const [lib, setLib] = useState<{ sets: any[]; effects: any[] }>({ sets: [], effects: [] });
  useEffect(() => { api('/api/library').then((l) => l && setLib(l)); }, []);
  const [fx, setFx] = useState<any[]>(data.episode.sounds || []);
  const fxSig = JSON.stringify(data.episode.sounds || []);  // the list follows the project file (a rebuild, another tool)
  useEffect(() => setFx(data.episode.sounds || []), [ep, fxSig]);
  const fxTimer = useRef<any>(null);
  const [fxBusy, setFxBusy] = useState(false);
  const allLevel = (db: number) => {  // the Sounds group: every sound and the music, each by the same dB
    const f = Math.pow(10, db / 20);
    changeFx(fx.map((x: any) => ({ ...x, gain: +Math.min(3, (x.gain ?? 0.8) * f).toFixed(3) })));
    if (data.episode.music && !data.episode.music.off) { const g = +Math.min(2, musicGain * f).toFixed(3); setMusicGain(g); saveOpt({ music_gain: g }); }
  };
  // sound layers are lanes of their own: each sound sits on one ("lane"); taking a sound off leaves its layer (empty),
  // Delete layer takes a layer away (with what is on it). Older projects: a lane per sound, in order.
  const laneOf = (s: any, i: number) => (Number.isInteger(s?.lane) ? s.lane : i);
  const [lanesN, setLanesN] = useState<number>(data.episode.sound_lanes ?? 0);
  useEffect(() => setLanesN(data.episode.sound_lanes ?? 0), [ep]);
  const laneCount = Math.max(lanesN, 0, ...fx.map((s: any, i: number) => laneOf(s, i) + 1));
  const changeFx = (next: any[], overlays?: any[], lanes?: number) => {  // sounds: saved, then only the sound layers are remade (seconds)
    const n = lanes ?? Math.max(laneCount, 0, ...next.map((s: any, i: number) => laneOf(s, i) + 1));
    setFx(next); setLanesN(n);
    clearTimeout(fxTimer.current);
    fxTimer.current = setTimeout(async () => { setFxBusy(true); await api(`/api/ep/${ep}/sounds`, { sounds: next, overlays, sound_lanes: n }); setFxBusy(false); reload?.(); }, 350);
  };
  const withLanes = (list: any[]) => list.map((s: any, i: number) => ({ ...s, lane: laneOf(s, i) }));  // (before indices shift)
  // sounds taken off: whatever points at a sound by its number (a thought bubble, a film hit) follows the new numbers
  const dropSounds = (gone: Set<number>, next: any[], lanes: number) => {
    const to = (k: number) => k - [...gone].filter((j) => j < k).length;
    const ovs = ov.filter((o: any) => !(o.sound != null && gone.has(o.sound))).map((o: any) => (o.sound != null ? { ...o, sound: to(o.sound) } : o));
    if (ovs.length !== ov.length || ovs.some((o: any, j: number) => o.sound !== (ov[j] as any)?.sound)) setOv(ovs);
    if (film && (film.hits || film.blackouts)) {
      const fix = (list?: any[]) => list?.filter((h: any) => !(h.sound != null && gone.has(h.sound))).map((h: any) => (h.sound != null ? { ...h, sound: to(h.sound) } : h));
      const f2 = { ...film, ...(film.hits ? { hits: fix(film.hits) } : {}), ...(film.blackouts ? { blackouts: fix(film.blackouts) } : {}) };
      if (JSON.stringify(f2) !== JSON.stringify(film)) changeFilm(f2);
    }
    changeFx(next, ovs, lanes);
  };
  const removeLane = (l: number) => {  // the layer goes, with the sounds on it; the layers under it move up
    const m = withLanes(fx), gone = new Set(m.flatMap((s: any, j: number) => (s.lane === l ? [j] : [])));
    dropSounds(gone, m.filter((_: any, j: number) => !gone.has(j)).map((s: any) => (s.lane > l ? { ...s, lane: s.lane - 1 } : s)), Math.max(0, laneCount - 1));
  };
  const addLane = () => changeFx(withLanes(fx), undefined, laneCount + 1);
  const freeLane = () => { const used = new Set(fx.map(laneOf)); for (let l = 0; l < laneCount; l++) if (!used.has(l)) return l; return laneCount; };
  const moveSound = (i: number, startOut: number | null, lane?: number) => {  // dragged: to that moment of the take, and / or to another layer
    const m = withLanes(fx);
    let s = m[i];
    if (!s) return;
    if (startOut != null) {
      const at = takeAt(Math.max(0, startOut));
      if (!at) return;
      const { end_word, end_after, end_offset, start_word, start_after, start_offset, after_prev, at: _a, ...rest } = s;
      s = { ...rest, take: at.take, at: at.t };
    }
    if (lane != null) s = { ...s, lane: Math.max(0, Math.min(laneCount - 1, lane)) };
    changeFx(m.map((x: any, j: number) => (j === i ? s : x)));
  };
  const removeSound = (i: number) => {  // the sound comes off its layer - the layer stays (empty)
    const m = withLanes(fx);
    dropSounds(new Set([i]), m.filter((_: any, j: number) => j !== i), laneCount);
  };
  // an end of a sound dragged on its lane: it plays less (or more) of its file - left end = its start, right end = its end
  const trimSound = (i: number, side: 'l' | 'r', ds: number) => {
    const pl = edit?.sounds?.[i], s = fx[i];
    if (!pl || !s) return;
    const cur = pl.to - pl.from;
    let start = pl.from, trim = +(s.trim_in || 0), len = cur;
    if (side === 'l') { const d = Math.max(-trim, Math.min(cur - 0.1, ds)); start += d; trim += d; len -= d; }
    else len = Math.max(0.1, cur + ds);
    const at = takeAt(Math.max(0, start));
    if (!at) return;
    const { end_word, end_after, end_offset, start_word, start_after, start_offset, after_prev, at: _a, ...rest } = s;
    changeFx(fx.map((x: any, j: number) => (j === i ? { ...rest, take: at.take, at: at.t, trim_in: +trim.toFixed(3), len: +len.toFixed(3) } : x)));
  };
  const [musT, setMusT] = useState<any>(data.episode.music || null);
  useEffect(() => setMusT(data.episode.music || null), [ep, JSON.stringify(data.episode.music || null)]);
  const changeMusic = async (patch: any) => {  // the music moved / its ends dragged / taken off: only the sound layers are remade
    setMusT({ ...(musT || {}), ...patch });
    setFxBusy(true); await api(`/api/ep/${ep}/music-time`, patch); setFxBusy(false); reload?.();
  };
  // each sound's name on the timeline and in its panel (a thought: its words)
  const soundNames: string[] = fx.map((s: any, i: number) => { const th = ov.find((o: any) => o.style === 'thought' && o.sound === i);
    return th ? `💭 ${th.text}` : String(s.sound).split('/').pop()!.replace(/\.[^.]+$/, ''); });
  const [addingFx, setAddingFx] = useState(false);
  const [swapFx, setSwapFx] = useState(false);
  useEffect(() => setSwapFx(false), [sel]);
  const takeAt = (sec: number) => {  // a moment of the video -> the take and its own time (effects are pinned to the take)
    const f = sec * fps * k;
    const it = (edit?.items || []).find((x: any) => x.kind === 'clip' && f >= x.out && f < x.out + x.n) || (edit?.items || []).find((x: any) => x.kind === 'clip');
    return it ? { take: it.take, t: +(it.a + Math.max(0, f - it.out) / fps * (it.sp ?? 1)).toFixed(2) } : null;
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
  const [cutout, setCutout] = useState<boolean>(data.episode.cutout !== false);  // live: the plain footage is drawn instead
  const plainVideo = useRef<HTMLVideoElement>(null);
  const needPlain = !cutout || keepPct > 0;
  useEffect(() => {  // a project built before the plain copy existed: make it once (seconds), then show it
    if (needPlain && !(data.layers as any)?.plain) api(`/api/ep/${ep}/plain`, {}).then((r: any) => r?.ok && reload?.());
  }, [needPlain]);
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
      market: { text: 'שוק הקריפטו', style: 'market', symbol: 'LMTS', name: 'מטבע קריפטו', price: 0.0847, change: 95.4, y: 300, w: 960, start: now, end: +(now + 6).toFixed(2) },
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
    // shown at once (that line, its new words); the server places the subtitles again in about a second - no rebuild
    setEditLive({ ...edit, captions: edit.captions.map((x: any, j: number) => (j === ci ? { ...x, text: text.trim() } : x)) });
    const r = await api(`/api/ep/${ep}/lesson`, { captions: next, plaque: plaque.split('\n').filter((x) => x.trim()) });
    if (r?.live) reload?.(); else if (r?.error) setEditLive(null); else setJob(r);
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
    const r = await api(`/api/ep/${ep}/lesson`, { captions: next, plaque: plaque.split('\n').filter((x) => x.trim()) });  // subtitles are text: no rebuild
    if (r?.live) reload?.(); else setJob(r);
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
  const STYLE_NAMES: Record<string, string> = { pov: 'Hook text', question: 'Question card', thought: 'Thought', band: 'Lower third', ticker: 'Ticker', image: 'Picture', market: 'Market panel', sticker: 'Sticker' };
  const changeVoice = (patch: any) => { const v = { ...voice, ...patch }; setVoice(v); saveOpt({ voice: v }); };
  // pitch is the one voice setting that remakes the voice track (higher / lower, same timing): about a second, after you let go
  const [duckDb, setDuckDb] = useState<number>(data.episode.music?.duck ?? 0);
  useEffect(() => setDuckDb(data.episode.music?.duck ?? 0), [ep]);
  const duckTimer = useRef<any>(null);
  const [lift, setLift] = useState<{ db: number; fade: number }>({ db: data.episode.music?.lift?.db ?? 0, fade: data.episode.music?.lift?.fade ?? 1.2 });
  const [musFadeOut, setMusFadeOut] = useState<number>(data.episode.music?.fade_out ?? 2.5);
  useEffect(() => { setLift({ db: data.episode.music?.lift?.db ?? 0, fade: data.episode.music?.lift?.fade ?? 1.2 }); setMusFadeOut(data.episode.music?.fade_out ?? 2.5); }, [ep]);
  const musTimer = useRef<any>(null);
  const changeMusicEnd = (body: any) => {  // the music's end: lift / fade out - saved, then only the sound layers (about a second)
    clearTimeout(musTimer.current);
    musTimer.current = setTimeout(async () => { setFxBusy(true); await api(`/api/ep/${ep}/music-time`, body); setFxBusy(false); reload?.(); }, 450);
  };
  const changeDuck = (db: number) => {
    setDuckDb(db);
    clearTimeout(duckTimer.current);
    duckTimer.current = setTimeout(async () => { setFxBusy(true); await api(`/api/ep/${ep}/music-time`, { duck: db }); setFxBusy(false); reload?.(); }, 450);
  };
  const pitchTimer = useRef<any>(null);
  const changePitch = (st: number) => {
    setVoice((v: any) => ({ ...v, pitch: st }));
    clearTimeout(pitchTimer.current);
    pitchTimer.current = setTimeout(async () => { setFxBusy(true); await api(`/api/ep/${ep}/voice-pitch`, { pitch: st }); setFxBusy(false); reload?.(); }, 450);
  };

  // the live sound: the video is the clock; voice (raw + noise-reduced), effects and music play beside it
  const audioRef = useRef<any>(null);
  const L = data.layers || {};
  // the cut, played live over the takes' whole videos: an edge dragged, a split, a piece deleted change it at once
  // (a project made before them: its takes are made once, quietly, and the built preview plays meanwhile)
  const takesL = (L as any).takes as Record<string, any> | null;
  const clockRef = useRef<LiveClock | null>(null);
  const liveCut = !!(takesL && layered && edit?.items);
  const preUrls = useMemo(() => (liveCut ? Object.values(takesL!).flatMap((l: any) => [l.cut, l.raw, l.plain].filter(Boolean).map((x: any) => `${x.url}?v=${x.v}`)) : []),
    [JSON.stringify(takesL), liveCut]);
  const [preBlobs, pre] = usePreloaded(preUrls);
  const takeSrc = (x: any) => preBlobs[`${x.url}?v=${x.v}`] || `${x.url}?v=${x.v}`;
  if (liveCut && !clockRef.current) clockRef.current = new LiveClock();
  if (liveCut) { (video as any).current = clockRef.current; (window as any).__zcClock = clockRef.current; }  // (window: for tests)
  useEffect(() => { if (liveCut) (video as any).current = clockRef.current; });  // (after an old video element let go of the ref)
  useEffect(() => () => clockRef.current?.dispose(), []);
  useEffect(() => { if (liveCut) clockRef.current!.setItems(edit.items, fps, total); }, [liveCut, edit]);
  useEffect(() => { if (layered && !takesL) api(`/api/ep/${ep}/takes`, {}).then((r: any) => r?.ok && reload?.()); }, [ep, layered, !!takesL]);
  const refFns = useRef<Record<string, (el: HTMLVideoElement | null) => void>>({});
  const liveRef = (tk: string, slot: number, kind: 'cut' | 'plain' | 'raw') =>
    (refFns.current[`${tk}|${slot}|${kind}`] ??= (el) => clockRef.current?.register(tk, slot, kind, el));
  const lastTick = useRef(0);
  const boxFns = useRef<Record<string, (el: HTMLDivElement | null) => void>>({});
  const boxRef = (tk: string, slot: number) => (boxFns.current[`${tk}|${slot}`] ??= (el) => clockRef.current?.box(tk, slot, el));
  useEffect(() => {
    if (!L.voice) return;
    const mk = (l: any) => { if (!l) return null; const a = new Audio(`${l.url}?v=${l.v}`); a.preload = 'auto'; a.crossOrigin = 'anonymous'; return a; };
    const els = { voice: mk(L.voice), voice_dn: mk(L.voice_dn), fx: mk(L.fx), music: mk(L.music) };
    audioRef.current = { els, ctx: null, nodes: null };
    (window as any).__zcAudio = audioRef;  // (for tests)
    const v = video.current;  // remade while it plays (a sound changed): they join in now, not at the next Play
    if (v && !v.paused) setTimeout(() => { graph(); applyAudio(); audioRef.current?.ctx?.resume(); syncAudio(true); }, 0);
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
  if (clockRef.current) clockRef.current.on = {  // the live cut's clock: the same as the single video's events
    time: (s) => { const now = performance.now(); if (clockRef.current?.paused || now - lastTick.current > 50) { lastTick.current = now; setT(s); } },
    play: () => { setPlaying(true); graph(); applyAudio(); audioRef.current?.ctx?.resume(); syncAudio(true); },
    pause: () => { setPlaying(false); syncAudio(false); },
    seeked: () => syncAudio(),
  };
  // a piece's edge dragged: the cut changes here at once (the picture is in the take's whole video), the server
  // re-plans the subtitles and the sound beside it (about a second) and the editor takes its answer
  const trimPiece = async (take: string, from: number, to: number, i?: number, side?: 'in' | 'out') => {
    to = +Math.min(to, (clockRef.current?.takeLength(take) ?? Infinity) - 0.05).toFixed(3);  // the take ends there
    if (Math.abs(to - from) < 0.02) return;
    if (liveCut && edit && i != null && side) {
      const it = edit.items[i], sp = it.sp ?? 1;
      const dn = Math.round(((to - from) / sp) * fps), grow = side === 'out' ? dn : -dn;
      const n = Math.max(1, it.n + grow), d = n - it.n, endF = it.out + it.n;
      const after = (f: number) => f >= endF - 0.5;
      const items = edit.items.map((x: any, j: number) => (j === i
        ? { ...x, n, ...(x.an != null ? { an: Math.max(1, x.an + d) } : {}), ...(side === 'in' ? { a: +Math.max(0, x.a + (to - from)).toFixed(3) } : {}) }
        : j > i ? { ...x, out: x.out + d } : x));
      const next = { ...edit, items, total: edit.total + d,
        captions: (edit.captions || []).map((c: any) => (after(c.from) ? { ...c, from: c.from + d, to: c.to + d } : c)),
        sounds: (edit.sounds || []).map((x: any) => (after(x.from * fps) ? { ...x, from: x.from + d / fps, to: x.to + d / fps } : x)) };
      setEditLive(next);
      clockRef.current!.setItems(items, fps, next.total / fps);
      seek(side === 'in' ? it.out / fps : (it.out + n - 1) / fps);  // on the edge: what was added is right there
    }
    const r = await api(`/api/ep/${ep}/trim`, { take, from, to });
    if (r?.live) reload?.(); else if (r?.error) setEditLive(null); else setJob(r);
  };

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
    <div className="ed" style={{ ['--tl-h' as any]: `${tlH}px` }}>
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
              <PreloadBar p={pre} />
              {busy && <div className="upd"><div className="upd-bar" /></div>}
              {layered ? (
                // layers, put together live: the set photo, him (transparent video, carries the sound), subtitles
                <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: `scale(${scale})`, transformOrigin: '0 0', overflow: 'hidden' }}
                  onMouseDown={(e) => { if (e.target === e.currentTarget) { if (sel?.kind === 'text') setSel(null); else toggle(); } }}>
                  <div ref={camRef} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }}>
                  <img src={`${data.layers.scene.url}?v=${data.layers.scene.v}`} draggable={false} onMouseDown={(e) => dragLayer(e, 'bg')}
                    style={{ position: 'absolute', left: -bgBox.cx, top: -bgBox.cy, width: bgBox.sw, height: bgBox.sh, cursor: 'grab',
                      filter: `blur(${data.episode.bg_blur ?? 2.2}px)${data.episode.bg_dim === false ? '' : ' brightness(0.96) saturate(0.95)'}` }} />
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
                  {liveCut ? Object.entries(takesL!).flatMap(([tk, l]: [string, any]) => [0, 1].map((slot) => (
                    <div key={tk + slot} ref={boxRef(tk, slot)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, pointerEvents: 'none', opacity: 0 }}>
                      {l.cut && <video ref={liveRef(tk, slot, 'cut')} src={takeSrc(l.cut)} muted playsInline preload="auto" onMouseDown={(e) => dragLayer(e, 'person')}
                        style={{ position: 'absolute', pointerEvents: 'auto', left: pBox.x, top: pBox.y, width: pBox.w, height: pBox.h, cursor: 'grab', opacity: !l.raw || eyeOn ? 1 : 0,
                          filter: look ? 'url(#zc-look)' : undefined }} />}
                      {l.plain && needPlain && <video ref={liveRef(tk, slot, 'plain')} src={takeSrc(l.plain)} muted playsInline preload="auto"
                        style={{ position: 'absolute', left: pBox.x, top: pBox.y, width: pBox.w, height: pBox.h, pointerEvents: 'none', zIndex: 1,
                          clipPath: cutout ? `inset(${100 - keepPct}% 0 0 0)` : undefined, filter: look ? 'url(#zc-look)' : undefined }} />}
                      {l.raw && <video ref={liveRef(tk, slot, 'raw')} src={takeSrc(l.raw)} muted playsInline preload="auto"
                        style={{ position: 'absolute', left: pBox.x, top: pBox.y, width: pBox.w, height: pBox.h, pointerEvents: 'none', opacity: eyeOn ? 0 : 1,
                          filter: look ? 'url(#zc-look)' : undefined }} />}
                    </div>))) : <>
                  <video ref={video} key={data.layers.person.v} src={`${data.layers.person.url}?v=${data.layers.person.v}`} onMouseDown={(e) => dragLayer(e, 'person')} muted={!!L.voice}
                    style={{ position: 'absolute', left: pBox.x, top: pBox.y, width: pBox.w, height: pBox.h, cursor: 'grab', opacity: !L.person_raw || eyeOn ? 1 : 0,
                      filter: look ? 'url(#zc-look)' : undefined }}
                    onTimeUpdate={(e) => { const v = e.currentTarget;
                      if (total && v.currentTime >= total) { v.pause(); v.currentTime = total; }  // the video's end (End here) - nothing plays past it
                      setT(v.currentTime); for (const r of [rawVideo.current, plainVideo.current]) if (r && Math.abs(r.currentTime - v.currentTime) > 0.1) r.currentTime = v.currentTime; }}
                    onPlay={() => { setPlaying(true); graph(); applyAudio(); audioRef.current?.ctx?.resume(); syncAudio(true); rawVideo.current?.play().catch(() => {}); plainVideo.current?.play().catch(() => {}); }}
                    onPause={() => { setPlaying(false); syncAudio(false); rawVideo.current?.pause(); plainVideo.current?.pause(); }}
                    onSeeked={() => { syncAudio(); for (const r of [rawVideo.current, plainVideo.current]) if (r && video.current) r.currentTime = video.current.currentTime; }} />
                  {(L as any).plain && needPlain && <video ref={plainVideo} key={'plain' + (L as any).plain.v} src={`${(L as any).plain.url}?v=${(L as any).plain.v}`} muted playsInline
                    style={{ position: 'absolute', left: pBox.x, top: pBox.y, width: pBox.w, height: pBox.h, pointerEvents: 'none', zIndex: 1,
                      clipPath: cutout ? `inset(${100 - keepPct}% 0 0 0)` : undefined, filter: look ? 'url(#zc-look)' : undefined }} />}
                  {L.person_raw && <video ref={rawVideo} key={'raw' + L.person_raw.v} src={`${L.person_raw.url}?v=${L.person_raw.v}`} muted
                    style={{ position: 'absolute', left: pBox.x, top: pBox.y, width: pBox.w, height: pBox.h, pointerEvents: 'none', opacity: eyeOn ? 0 : 1,
                      filter: look ? 'url(#zc-look)' : undefined }} />}
                  </>}
                  {film?.ghost > 0 && <GhostVideo fx={film} clock={clock} camRef={camRef} box={pBox} />}
                  </div>
                  {film && <FilmFx fx={film} clock={clock} camRef={camRef} />}
                  {L.intro && t < introSecs && <video ref={introRef} key={'intro' + L.intro.v} src={`${L.intro.url}?v=${L.intro.v}`} muted playsInline
                    style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, objectFit: 'cover', pointerEvents: 'none',
                      opacity: introFade > 0 && t > introSecs - introFade ? Math.max(0, (introSecs - t) / introFade) : 1 }} />}
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
                      transform: o.pop ? `scale(${popScale(o, t)})` : undefined, transformOrigin: 'center',
                      ...(o.plain ? { opacity: (o.opacity ?? 1) * fadeOp(o, t, (data.edit?.durationInFrames || 0) / 30) } : { opacity: fadeOp(o, t, (data.edit?.durationInFrames || 0) / 30), border: '6px solid #fff', borderRadius: 14, boxShadow: '0 12px 34px rgba(0,0,0,0.55)' }), boxSizing: 'border-box',
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
                {ov.map((o, i) => liveOv.includes(o) && o.style !== 'ticker' && o.style !== 'image' && o.style !== 'band' && o.style !== 'question' && o.style !== 'thought' && o.style !== 'market' && o.style !== 'sticker' && (
                  <div key={i} style={{ position: 'absolute', top: o.y ?? 270, left: 60, right: 60, display: 'flex', justifyContent: 'center' }}>
                    {/* click to select, drag to move; the outline hugs the text whatever its size */}
                    <div className="he" onMouseDown={(e) => dragText(e, i)}
                      style={{ ...ovBoxStyle(o, { fontFamily: fontCss(o.font), fontWeight: ['system', 'arimo', 'assistant'].includes(o.font || 'system') ? 800 : 400 }),
                        pointerEvents: 'auto', cursor: 'move', transform: (o as any).pop ? `scale(${popScale(o, t)})` : undefined, transformOrigin: 'center',
                        visibility: blinkOn(o, t) ? 'visible' : 'hidden',
                        outline: sel?.kind === 'text' && sel.i === i ? `${Math.round(3 / scale)}px dashed var(--accent)` : 'none', outlineOffset: Math.round(6 / scale) }}>{o.text}</div>
                  </div>))}
                {/* the market panels last: over the text, as in the export (the panel is laid after the hook) */}
                {ov.map((o: any, i) => o.style === 'sticker' && (o.motion === 'video' ? <KeyedClip key={'st' + i} o={o} ep={ep} clock={clock} />
                  : <StickerLayer key={'st' + i} o={o} ep={ep} clock={clock} />))}
                {ov.some((o: any) => o.style === 'market') && <MarketCanvas ov={ov} clock={clock} />}
                {ov.map((o: any, i) => liveOv.includes(o) && o.style === 'market' && (() => {
                  // the panel itself is on the canvas (MarketCanvas); this box is what you click and drag
                  const b = marketBox(o);
                  return <div key={'mk' + i} onMouseDown={(e) => dragText(e, i)} style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h,
                    pointerEvents: 'auto', cursor: 'move', outline: sel?.kind === 'text' && sel.i === i ? `${Math.round(3 / scale)}px dashed var(--accent)` : 'none' }} />;
                })())}
                {/* the subtitles over everything (stickers, panels, text) - as in the export */}
                  {capOver && (() => {
                    const st = { ...(capStyle || {}), ...(data.episode.captions_other || {}) };
                    return <div className="he" style={{ position: 'absolute', top: data.episode.captions_other?.y ?? capY - 150, left: 50, right: 50, textAlign: 'center', direction: 'rtl', pointerEvents: 'none',
                      font: `${st.weight || 400} ${st.size || 84}px/1.18 ${fontCss(st.font || 'stam-ashkenaz')}`, color: st.color || '#FFD60A',
                      WebkitTextStroke: `${st.stroke ?? 14}px #000`, paintOrder: 'stroke fill',
                      textShadow: '0 6px 14px rgba(0,0,0,0.55)', letterSpacing: st.font ? 0 : '0.045em', unicodeBidi: 'plaintext' } as any}>{capOver.text}</div>;
                  })()}
                  {capNow && (() => {
                    const st = { ...(capStyle || {}), ...(capNow.who === 'other' ? data.episode.captions_other || {} : {}) };  // the series' look; the other side's in its colour
                    return <div className="he" onMouseDown={dragCap} style={{ position: 'absolute', top: capY, left: 50, right: 50, textAlign: 'center', direction: 'rtl', cursor: 'ns-resize', pointerEvents: 'auto',
                      outline: sel?.kind === 'layer' && sel.id === 'captions' ? `${Math.round(3 / scale)}px dashed var(--accent)` : 'none',
                      font: `${st.weight || 400} ${st.size || 84}px/1.18 ${fontCss(st.font || 'stam-ashkenaz')}`, color: st.color || '#FFD60A',
                      WebkitTextStroke: `${st.stroke ?? 14}px #000`, paintOrder: 'stroke fill',
                      textShadow: '0 6px 14px rgba(0,0,0,0.55)', letterSpacing: st.font ? 0 : '0.045em', unicodeBidi: 'plaintext' } as any}>{capNow.text}</div>;
                  })()}
              </div>
            </div>
          </div>
          <div className="transport">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}><span className="chip">{I.phone}&nbsp;9:16</span>
              {busy && <span className="upd-note"><b>Updating</b>{(jobLine || 'the preview').replace(/^Updating preview…$/, 'the preview')} · your change is saved</span>}</div>
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
                  <div className="card-h"><div className="title grow">Picture</div><span className="help" style={{ margin: 0 }}>click one to swap</span></div>
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
                  <Entrance o={o} set={set} />
                  <button className="btn ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => { changeOv(ov.filter((_: any, j) => j !== sel.i)); setSel(null); }}>Remove the picture from the video</button>
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
                <div className="card-h"><div className="sec grow" style={{ margin: 0 }}>Picture</div>
                  <button className="btn ghost" style={{ height: 26, padding: '0 10px', fontSize: 12 }} title="Back to the original size and place"
                    disabled={pL.scale === 1 && !pL.x && !pL.y} onClick={() => setP({ scale: 1, x: 0, y: 0 })}>Reset</button></div>
                <Slider label="Size" v={pL.scale} min={0.5} max={3} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setP({ ...pL, scale: v })} />
                <Slider label="Left / right" v={pL.x} min={-1500} max={1500} step={2} fmt={(v) => `${v}`} onChange={(v) => setP({ ...pL, x: v })} />
                <Slider label="Up / down" v={pL.y} min={-1500} max={2000} step={2} fmt={(v) => `${v}`} onChange={(v) => setP({ ...pL, y: v })} />
                <div className="help">Or drag yourself on the preview.</div>
              </div>
              <div className="card">
                <div className="card-h"><div className="title grow">Background removal</div><span className="help" style={{ margin: 0 }}>live · Export uses the same</span></div>
                <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <button className={cutout ? 'on' : ''} onClick={() => { setCutout(true); setConfig({ cutout: null }, false); }}>Cut out · new set</button>
                  <button className={!cutout ? 'on' : ''} onClick={() => { setCutout(false); setConfig({ cutout: false }, false); }}>Keep original place</button>
                </div>
                {cutout && <>
                  <Slider label="Keep desk" v={keepPct} min={0} max={45} step={1} fmt={(v) => (v ? `bottom ${v}%` : 'off')}
                    onChange={(v) => { setKeepPct(v); const kp = { ...(data.episode.keep || {}) }; if (v) kp['*'] = { below_frac: +(1 - v / 100).toFixed(3), objects: true }; else delete kp['*'];
                      setConfig({ keep: Object.keys(kp).length ? kp : null }, false, 400); }} />
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
                <Slider label="Pitch" v={voice.pitch ?? 0} min={-4} max={6} step={0.25} fmt={(v) => v ? `${v > 0 ? '+' : ''}${v} st` : 'as recorded'} onChange={changePitch} />
                <Slider label="Boost" v={voice.boost ?? 0} min={-30} max={12} step={0.5} fmt={(v) => `${v > 0 ? '+' : ''}${v} dB`} onChange={(v) => changeVoice({ boost: v })} />
                <Slider label="Low cut" v={voice.lowcut ?? 60} min={30} max={200} step={5} fmt={(v) => `${v} Hz`} onChange={(v) => changeVoice({ lowcut: v })} />
                <Slider label="Warmth" v={voice.warmth ?? 0} min={-6} max={6} step={0.5} fmt={(v) => `${v > 0 ? '+' : ''}${v} dB`} onChange={(v) => changeVoice({ warmth: v })} />
                <Slider label="Boxiness" v={voice.box ?? 0} min={-6} max={3} step={0.5} fmt={(v) => `${v > 0 ? '+' : ''}${v} dB`} onChange={(v) => changeVoice({ box: v })} />
                <Slider label="Presence" v={voice.presence ?? 0} min={-3} max={8} step={0.5} fmt={(v) => `${v > 0 ? '+' : ''}${v} dB`} onChange={(v) => changeVoice({ presence: v })} />
                <Slider label="Soft s's" v={voice.deess ?? 0} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => changeVoice({ deess: v })} />
                <Slider label="Compression" v={voice.comp ?? 0} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => changeVoice({ comp: v })} />
                <Slider label="Room" v={voice.room ?? 0} min={0} max={1} step={0.05} fmt={(v) => v ? `${Math.round(v * 100)}%` : 'off'} onChange={(v) => changeVoice({ room: v })} />
                {(voice.room ?? 0) > 0 && <Slider label="Room size" v={voice.roomSize ?? 1.6} min={0.4} max={3} step={0.1} fmt={(v) => `${v.toFixed(1)} s`} onChange={(v) => changeVoice({ roomSize: v })} />}
                <Slider label="PA echo" v={voice.pa ?? 0} min={0} max={1} step={0.05} fmt={(v) => v ? `${Math.round(v * 100)}%` : 'off'} onChange={(v) => changeVoice({ pa: v })} />
              </div>}
            </>}

            {sel?.kind === 'layer' && sel.id === 'background' && <>
              <div className="card">
                <div className="card-h"><div className="sec grow" style={{ margin: 0 }}>Picture</div>
                  <button className="btn ghost" style={{ height: 26, padding: '0 10px', fontSize: 12 }} title="Back to the original zoom and place"
                    disabled={bgL.zoom === 1 && !bgL.x && !bgL.y} onClick={() => setBg({ zoom: 1, x: 0, y: 0 })}>Reset</button></div>
                <Slider label="Zoom" v={bgL.zoom} min={1} max={3} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setBg({ ...bgL, zoom: v })} />
                <Slider label="Left / right" v={bgL.x} min={-1500} max={1500} step={2} fmt={(v) => `${v}`} onChange={(v) => setBg({ ...bgL, x: v })} />
                <Slider label="Up / down" v={bgL.y} min={-2500} max={2500} step={2} fmt={(v) => `${v}`} onChange={(v) => setBg({ ...bgL, y: v })} />
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

            {sel?.kind === 'layer' && sel.id === 'filters' && <FilterLayers fx={film} t={t * k} onChange={changeFilm} />}
            {sel?.kind === 'sound' && fx[sel.i] && (() => {
              // one sound or voice on the video: its voice, level, fades, speed - each change remakes only the sound layers
              const n = sel.i, s = fx[n], pl = (edit?.sounds || [])[n];
              const set = (patch: any) => changeFx(fx.map((x: any, j: number) => (j === n ? { ...x, ...patch } : x)));
              const name = soundNames?.[n] || String(s.sound).split('/').pop()!.replace(/\.[^.]+$/, '');
              const url = `/api/ep/${ep}/file?p=${encodeURIComponent(s.sound)}`;
              const VOICES: [string, string][] = [['', 'As recorded'], ['speaker', 'Laptop speaker'], ['phone', 'Phone'], ['speakerphone', 'Phone on speaker'], ['thought', 'Thought'], ['echo', 'Thought + echo'], ['muffled', 'Muffled']];
              const secs = (v: number) => `${v.toFixed(2)}s`;
              return <>
                <div className="card">
                  <div className="scope">Affects: this sound only</div>
                  <div className="card-h"><div className="title grow">{name}</div>
                    <span className="help" style={{ margin: 0 }}>{pl ? `${mmss(pl.from / k)} · ${(pl.to - pl.from).toFixed(1)}s` : ''}</span></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <button className={`btn ${hearing === url ? 'primary' : ''}`} onClick={() => hear(url)}>{hearing === url ? '■ Stop' : '▶ Listen'}</button>
                    <button className="btn" disabled={!pl} onClick={() => pl && seek(pl.from / k)}>Go there</button>
                  </div>
                  <div className="help" style={{ marginTop: 8 }}>On its lane: drag it to move it, drag an end to make it shorter or longer.</div>
                </div>
                <div className="card">
                  <div className="card-h"><div className="title grow">Voice</div>{fxBusy && <span className="help" style={{ margin: 0 }}>updating the sound…</span>}</div>
                  <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    {VOICES.map(([v, label]) => <button key={v} className={(s.filter || '') === v ? 'on' : ''} onClick={() => set({ filter: v || undefined })}>{label}</button>)}
                  </div>
                  <div className="row2"><label>Noise</label>
                    <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
                      <button className={!s.denoise ? 'on' : ''} onClick={() => set({ denoise: undefined })}>As recorded</button>
                      <button className={s.denoise ? 'on' : ''} onClick={() => set({ denoise: true })}>Clean</button>
                    </div></div>
                  <div className="row2"><label title="In the same room as the speaker's voice (his Room setting)">Room</label>
                    <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
                      <button className={!s.room ? 'on' : ''} onClick={() => set({ room: undefined })}>Dry</button>
                      <button className={s.room ? 'on' : ''} onClick={() => set({ room: true })}>His room</button>
                    </div></div>
                </div>
                <div className="card">
                  <div className="sec">Level</div>
                  <Slider label="Volume" v={s.gain ?? 0.8} min={0} max={3} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ gain: v })} />
                  <Slider label="Fade in" v={s.fade_in ?? 0.02} min={0} max={3} step={0.05} fmt={secs} onChange={(v) => set({ fade_in: v })} />
                  <Slider label="Fade out" v={s.fade_out ?? 0.06} min={0} max={3} step={0.05} fmt={secs} onChange={(v) => set({ fade_out: v })} />
                  <Slider label="Speed" v={s.tempo ?? 1} min={0.7} max={1.5} step={0.02} fmt={(v) => `${v.toFixed(2)}×`} onChange={(v) => set({ tempo: v })} />
                  {(s.filter === 'echo' || s.echo != null) && <Slider label="Echo" v={s.echo ?? 1} min={0} max={2} step={0.1} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ echo: v })} />}
                </div>
                <div className="card">
                  <button className="btn" style={{ width: '100%' }} onClick={() => setSwapFx(true)}>Swap for another sound…</button>
                  {swapFx && <SoundPicker ep={ep} title="Swap for another sound" hint="It takes this one's place and settings." hear={hear} hearing={hearing}
                    onClose={() => setSwapFx(false)}
                    onPick={(e) => { set({ sound: e.sound, trim_in: undefined, len: undefined, from: undefined, to: undefined, skip: undefined }); setSwapFx(false); }} />}
                  <button className="btn ghost" style={{ width: '100%', marginTop: 6 }} onClick={() => { removeSound(n); setSel(null); }}>Remove this sound</button>
                </div>
              </>;
            })()}
            {sel?.kind === 'layer' && sel.id === 'music' && <>
              <div className="card" style={{ paddingBottom: 0 }}><div className="scope">Affects: the music only</div></div>
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
                  <Slider label="Music" v={musicGain} min={0} max={2} step={0.02} fmt={(v) => (v ? `${Math.round(v * 100)}%` : 'off')}
                    onChange={(v) => { setMusicGain(v); saveOpt({ music_gain: v }); }} />
                  <Slider label="Duck under voice" v={duckDb} min={-18} max={0} step={0.5} fmt={(v) => (v ? `${v} dB` : 'off')} onChange={changeDuck} />
                  <div className="help">Ducking: the music goes down while he talks and comes back up in his pauses.</div>
                  <div className="sec" style={{ marginTop: 10 }}>The end</div>
                  <Slider label="Lift at the end" v={lift.db} min={0} max={18} step={0.5} fmt={(v) => (v ? `+${v} dB` : 'off')}
                    onChange={(v) => { const l = { ...lift, db: v }; setLift(l); changeMusicEnd({ lift: l }); }} />
                  {lift.db > 0 && <Slider label="Lift over" v={lift.fade} min={0.1} max={4} step={0.1} fmt={(v) => `${v.toFixed(1)}s`}
                    onChange={(v) => { const l = { ...lift, fade: v }; setLift(l); changeMusicEnd({ lift: l }); }} />}
                  <Slider label="Fade out" v={musFadeOut} min={0} max={6} step={0.1} fmt={(v) => `${v.toFixed(1)}s`}
                    onChange={(v) => { setMusFadeOut(v); changeMusicEnd({ fade_out: v }); }} />
                  <div className="help">Lift: the music rises once he stops talking for good (the end card). Fade out: how it ends.</div>
                </div>
              </> : <div className="empty" style={{ padding: 16 }}>No background music in this episode.</div>}
            </>}
            {sel?.kind === 'layer' && sel.id === 'sounds' && <>
              <div className="card">
                <div className="scope">Affects: every sound and the music together</div>
                <div className="card-h"><div className="title grow">All sounds</div><span className="help" style={{ margin: 0 }}>{fx.length + (data.episode.music && !data.episode.music.off ? 1 : 0)} layers</span></div>
                <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <button disabled={busy} onClick={() => allLevel(-2)}>Quieter (−2 dB)</button>
                  <button disabled={busy} onClick={() => allLevel(2)}>Louder (+2 dB)</button>
                </div>
                <div className="help" style={{ marginTop: 6 }}>Moves every layer below by the same amount - each keeps its own balance. Click one to change only it.</div>
              </div>
              <div className="card">
                <div className="card-h"><div className="title grow">Music</div></div>
                <button className="fx-open" onClick={() => setSel({ kind: 'layer', id: 'music' })} title="Open the music's settings">
                  <span className="fx-name">♪ {data.episode.music && !data.episode.music.off ? String(data.episode.music.sound).split('/').pop()?.replace(/\.[^.]+$/, '') : 'no music'}</span>
                  <span className="fx-time">{data.episode.music && !data.episode.music.off ? `${Math.round(musicGain * 100)}%` : ''}</span><span className="fx-go">›</span>
                </button>
              </div>
              <div className="card">
                <div className="card-h"><div className="title grow">Sound effects & voices</div><span className="help" style={{ margin: 0 }}>{fx.length}</span></div>
                {fx.map((s: any, n: number) => { const pl = (edit?.sounds || [])[n];
                  return <button key={n} className="fx-open" onClick={() => setSel({ kind: 'sound', i: n })} title="Open its settings: voice, volume, fades, speed">
                    <span className="fx-name">{soundNames?.[n] || String(s.sound).split('/').pop()?.replace(/\.[^.]+$/, '')}</span>
                    <span className="fx-time">{pl ? mmss(pl.from / k) : ''}</span><span className="fx-go">›</span>
                  </button>; })}
                <button className="btn" style={{ width: '100%', marginTop: 6 }} disabled={busy} onClick={() => setAddingFx(true)}>+ Add effect at {mmss(t)}</button>
                {addingFx && <SoundPicker ep={ep} title={`Add a sound at ${mmss(t)}`} hint="It plays from the playhead; drag it on its lane afterwards." hear={hear} hearing={hearing}
                  onClose={() => setAddingFx(false)}
                  onPick={(e) => { const at = takeAt(t); if (at) changeFx([...withLanes(fx), { sound: e.sound, take: at.take, at: at.t, gain: 0.6, lane: freeLane() }]); setAddingFx(false); }} />}
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
                    ['filters', null, 'Filters', filtersOn(film).length ? filtersOn(film).map((F) => `${F.name} ${Math.round(F.get(film) * 100)}%`).join(' · ') : 'raw picture'],
                    ['music', null, 'Music', data.episode.music && !data.episode.music.off ? `${String(data.episode.music.sound).split('/').pop()?.replace(/\.[^.]+$/, '')} · ${Math.round(musicGain * 100)}%` : 'no music'],
                    ['sounds', null, 'All sounds', `${(data.episode.sounds || []).length} effects & voices${data.episode.music && !data.episode.music.off ? ' + the music' : ''}`],
                  ] as const).map(([id, ic, name, sub]) => (
                    <button key={id} className="ly" onClick={() => setSel({ kind: 'layer', id: id as Layer })}>
                      <span className="ly-ic">{ic || (id === 'filters' ? '◐' : id === 'sounds' ? '♫' : '♪')}</span>
                      <span className="ly-main"><span className="ly-name">{name}</span><span className="ly-sub">{sub}</span></span>
                      <span className="ly-go">›</span>
                    </button>))}
                </div>
                <div className="add-row"><span className="add-k">Add</span>
                  {([['hook', 'Hook text'], ['question', 'Question card'], ['thought', 'Thought'], ['band', 'Lower third'], ['ticker', 'Ticker'], ['market', 'Market panel']] as const).map(([kd, nm]) =>
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
                <SpeedPick speed={speed} onSpeed={(v) => { setSpeed(v); api(`/api/ep/${ep}/speed`, { speed: v }); }} />
                <div className="help" style={{ marginTop: 6 }}>{speed !== 1 && edit?.total ? `${mmss(edit.total / fps)} at 1× → ${mmss(edit.total / fps / speed)}. ` : ''}Plays live at this speed; Export makes the file at it.</div>
                <div className="sec" style={{ marginTop: 12 }}>Slow motion</div>
                <div className="seg" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                  {[0.5, 0.35].map((v) => <button key={v} disabled={busy} onClick={() => { const at = takeAt(t); if (!at) return;
                    const c = { ...(data.episode.cut || {}) }; c.slow = { ...(c.slow || {}), [at.take]: [...((c.slow || {})[at.take] || []).filter((r: any) => r[1] <= at.t), [at.t, 9999, v]] };
                    setConfig({ cut: c }); }}>{v}× from here</button>)}
                  <button disabled={busy || !data.episode.cut?.slow} onClick={() => { const c = { ...(data.episode.cut || {}) }; delete c.slow; setConfig({ cut: c }); }}>Normal</button>
                </div>
                <div className="help" style={{ marginTop: 6 }}>{Object.entries(data.episode.cut?.slow || {}).map(([tk, r]: any) => r.map((x: any) => `${tk} ${x[0].toFixed(1)}s→${x[1] > 999 ? 'end' : x[1].toFixed(1) + 's'} at ${x[2]}×`).join(' · ')).join(' · ') || 'The take plays at its own speed.'} Eases in, frames made up between the real ones.</div>
              </div>
            </>}
          </div>
        </div>
      </div>

      <div className="split" onMouseDown={dragTl} title="Drag to make the timeline taller or shorter" />
      <LessonTimeline edit={edit} fps={fps} k={k} t={t} total={total} onSeek={seek} overlays={ov} sel={sel?.kind === 'text' ? sel.i : null}
        onSelText={(i) => setSel({ kind: 'text', i })} layer={sel?.kind === 'layer' ? sel.id : sel?.kind === 'take' ? 'captions' : null}
        onSoundPick={(i) => setSel({ kind: 'sound', i })}
        onLayer={(id) => setSel({ kind: 'layer', id: id as any })}
        bgName={`Background · ${(data.episode.background || '').split('/').pop()}${data.episode.music ? ' · music' : ''}`}
        busy={busy} onTrim={trimPiece} onPeek={liveCut ? (tk, at) => clockRef.current?.peek(tk, at) : undefined}
        onOvTime={(i, start, end) => changeOv(ov.map((o: any, j) => { if (j !== i) return o; const { from_words, sound, until, ...rest } = o; return { ...rest, start, end }; }))}
        onCut={async (op) => { const r = await api(`/api/ep/${ep}/cutop`, op); if (r?.live) reload?.(); else setJob(r); }} hasEnds={!!(data.episode.cut?.video_start || data.episode.cut?.video_end)}
        onSoundMove={moveSound} onSoundRemove={removeSound} fxBusy={fxBusy} film={film} onFilm={changeFilm}
        soundLane={fx.map(laneOf)} laneCount={laneCount} onLaneAdd={addLane} onLaneRemove={removeLane}
        onSoundTrim={trimSound} soundTrim={fx.map((s: any) => !s?.from_word)} music={musT} onMusic={changeMusic}
        soundNames={soundNames} />
    </div>
  );
}

// the filters, each a layer with a strength bar: the picture stays raw until a filter is turned up. One table for the
// panel, the Layers list and the timeline lanes; the values land in episode.json "fx" (render/ui/fx.js applies them)
const FILTERS: { id: string; name: string; def: number; max?: number; get: (fx: any) => number; set: (fx: any, v: number) => any }[] = [
  { id: 'grade', name: 'Movie colour', def: 0.4, get: (fx) => fx?.grade_amount ?? 0,
    set: (fx, v) => ({ ...fx, grade_amount: v, grade: { saturation: +(1 - 0.35 * v).toFixed(3), contrast: +(1 + 0.15 * v).toFixed(3), brightness: +(-0.06 * v).toFixed(3) } }) },
  { id: 'dark', name: 'Darken', def: 0.35, get: (fx) => fx?.dark || 0, set: (fx, v) => ({ ...fx, dark: v }) },
  { id: 'vignette', name: 'Vignette', def: 0.3, get: (fx) => fx?.vignette || 0, set: (fx, v) => ({ ...fx, vignette: v }) },
  { id: 'grain', name: 'Film grain', def: 0.12, get: (fx) => fx?.grain || 0, set: (fx, v) => ({ ...fx, grain: v }) },
  { id: 'zoom', name: 'Slow zoom in', def: 0.35, get: (fx) => fx?.zoom || 0, set: (fx, v) => { const { push, ...rest } = fx || {}; return { ...rest, zoom: v }; } },
  { id: 'drift', name: 'Handheld', def: 0.2, get: (fx) => fx?.drift || 0, set: (fx, v) => ({ ...fx, drift: v }) },
  { id: 'ghost', name: 'Ghost trail', def: 0.35, get: (fx) => fx?.ghost || 0, set: (fx, v) => ({ ...fx, ghost: v }) },
  { id: 'flicker', name: 'Light flicker', def: 0.3, get: (fx) => fx?.flicker || 0, set: (fx, v) => ({ ...fx, flicker: v }) },
];
const filtersOn = (fx: any) => FILTERS.filter((f) => f.get(fx) > 0.001);
const FL_ON = (F: any, fx: any, t: number) => { const n = F.set(fx || {}, F.def); if (!n.times?.[F.id]) n.times = { ...(n.times || {}), [F.id]: [+t.toFixed(2), null] }; return n; };

function FilterLayers({ fx, t, onChange }: { fx: any; t: number; onChange: (fx: any) => void }) {
  const f = fx || {};
  const set = (patch: any) => onChange({ ...f, ...patch });
  const mm = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
  const setTime = (id: string, r: [number, number | null]) => onChange({ ...f, times: { ...(f.times || {}), [id]: r } });
  return (
    <>
      <div className="card">
        <div className="card-h"><div className="title grow">Filters</div><span className="help" style={{ margin: 0 }}>{filtersOn(fx).length} on · raw picture underneath</span></div>
        {FILTERS.map((F) => { const v = F.get(f), on = v > 0.001;
          return <div key={F.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <button className={`btn ${on ? 'primary' : ''}`} style={{ height: 26, width: 44, padding: 0, flex: 'none' }} title={on ? 'Turn it off' : 'Turn it on'}
              onClick={() => onChange(on ? F.set(f, 0) : FL_ON(F, f, t))}>{on ? 'On' : 'Off'}</button>
            <span style={{ width: 96, flex: 'none', color: on ? 'var(--fg)' : 'var(--dim)' }}>{F.name}</span>
            <input type="range" min={0} max={F.max ?? 1} step={0.01} value={v} style={{ flex: 1, accentColor: 'var(--accent)' }} onChange={(e) => onChange(F.set(f, +e.target.value))} />
            <span className="fx-time" style={{ width: 38, textAlign: 'right' }}>{on ? `${Math.round(v * 100)}%` : 'off'}</span>
            {on && <span className="fx-time" style={{ width: 92, textAlign: 'right', cursor: 'pointer' }} title="Click: it starts at the playhead"
              onClick={() => setTime(F.id, [+t.toFixed(2), f.times?.[F.id]?.[1] ?? null])}>{f.times?.[F.id] ? `${mm(f.times[F.id][0])}→${f.times[F.id][1] == null ? 'end' : mm(f.times[F.id][1])}` : 'always'}</span>}
          </div>; })}
        <Slider label="Fade in" v={f.fade ?? 1.5} min={0} max={4} step={0.1} fmt={(v) => `${v.toFixed(1)}s`} onChange={(v) => set({ fade: v })} />
        <div className="seg" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 6 }}>
          <button onClick={() => onChange({ ...f, times: Object.fromEntries(FILTERS.filter((F) => F.get(f) > 0.001).map((F) => [F.id, [+t.toFixed(2), f.times?.[F.id]?.[1] ?? null]])) })}>All start here</button>
          <button onClick={() => onChange({ ...f, times: Object.fromEntries(FILTERS.filter((F) => F.get(f) > 0.001).map((F) => [F.id, [f.times?.[F.id]?.[0] ?? 0, +t.toFixed(2)]])) })}>All end here</button>
        </div>
        <div className="help" style={{ marginTop: 6 }}>Each filter is a layer: On / Off, the bar is its strength, and on the timeline its block is when it plays (drag it, drag its ends). They fade in over "Fade in". Everything plays live; Export uses the same numbers.</div>
      </div>
      <div className="card">
        <div className="card-h"><div className="title grow">Hits & ending</div><span className="help" style={{ margin: 0 }}>{(f.hits || []).length} hits</span></div>
        {(f.hits || []).map((h: any, i: number) => <div key={i} className="fx-top" style={{ gap: 6 }}>
          <span className="fx-time">{h.at != null ? `${Math.floor(h.at / 60)}:${(h.at % 60).toFixed(1).padStart(4, '0')}` : '-'}</span>
          <span className="fx-name">kick {Math.round((h.kick || 0) * 100)}% · shake {Math.round((h.shake || 0) * 100)}% · flash {Math.round((h.flash || 0) * 100)}%</span>
          <button className="fx-x" title="Remove" onClick={() => set({ hits: f.hits.filter((_: any, j: number) => j !== i) })}>✕</button></div>)}
        <div className="seg" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 6 }}>
          <button onClick={() => set({ hits: [...(f.hits || []), { at: +t.toFixed(2), kick: 0.04, shake: 0.3, flash: 0 }].sort((a: any, b: any) => (a.at ?? 0) - (b.at ?? 0)) })}>+ Hit here</button>
          <button onClick={() => set({ blackouts: [{ at: +t.toFixed(2) }] })}>Black from here</button>
        </div>
        {(f.blackouts || []).length > 0 && <div className="help" style={{ marginTop: 6 }}>Cuts to black at {(f.blackouts[0].at ?? 0).toFixed(1)}s · <a onClick={() => set({ blackouts: [] })} style={{ cursor: 'pointer' }}>remove</a></div>}
      </div>
    </>
  );
}

// the Ghost trail filter, live: a copy of whichever person video is showing, ghost_lag behind it, laid over it at the
// filter's strength - the export blends the picture with itself that many frames back (lesson.py FxFrame), the same look
function GhostVideo({ fx, clock, camRef, box }: { fx: any; clock: () => number; camRef: React.RefObject<HTMLDivElement>; box: any }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let raf = 0;
    const visible = (el: HTMLElement) => { for (let e: HTMLElement | null = el; e && e !== camRef.current; e = e.parentElement) if (e.style.opacity === '0') return false; return true; };
    const step = () => {
      const g = ref.current, cam = camRef.current;
      raf = requestAnimationFrame(step);
      if (!g || !cam) return;
      const a = fxAt(fx, clock()).ghost;
      g.style.opacity = String(a);
      const main = [...cam.querySelectorAll('video')].find((v) => v !== g && v.currentSrc && visible(v as HTMLElement)) as HTMLVideoElement | undefined;
      if (a < 0.002 || !main) { if (!g.paused) g.pause(); return; }
      if (g.getAttribute('src') !== main.currentSrc) { g.src = main.currentSrc; return; }
      const target = Math.max(0, main.currentTime - (fx.ghost_lag ?? 0.2) * main.playbackRate);
      if (g.playbackRate !== main.playbackRate) g.playbackRate = main.playbackRate;
      if (main.paused) { if (!g.paused) g.pause(); if (Math.abs(g.currentTime - target) > 0.03) g.currentTime = target; }
      else { if (g.paused) g.play().catch(() => {}); if (Math.abs(g.currentTime - target) > 0.15) g.currentTime = target; }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [fx, clock]);
  return <video ref={ref} muted playsInline preload="auto" style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, pointerEvents: 'none', opacity: 0 }} />;
}

// camera & film (episode.json "fx"), live: the same curve as the export (render/ui/fx.js) - the camera moves the set and
// him, the light and grade filter them, the vignette / grain / flash lie on top of the picture and under the text
function FilmFx({ fx, clock, camRef }: { fx: any; clock: () => number; camRef: React.RefObject<HTMLDivElement> }) {
  const flash = useRef<HTMLDivElement>(null), black = useRef<HTMLDivElement>(null), grain = useRef<HTMLCanvasElement>(null), vig = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0, f = 0;
    const black_ = [...(fx.black || []), ...(fx.blackouts || []).filter((b: any) => b.at != null).map((b: any) => [b.at, 1e6])];
    const step = () => {
      const s = fxCss({ ...fx, black: black_ }, clock());
      const cam = camRef.current;
      if (cam) { cam.style.transformOrigin = s.transformOrigin; cam.style.transform = s.transform; cam.style.filter = s.filter; }
      if (flash.current) flash.current.style.opacity = String(Math.min(1, s.flash));
      if (vig.current) vig.current.style.opacity = String(s.vig);
      if (grain.current) grain.current.style.opacity = String(Math.min(1, s.grain * 0.55));
      if (black.current) black.current.style.opacity = String(s.black);
      const c = grain.current;
      if (c && fx.grain && (f++ % 2 === 0)) {  // fresh grain every other screen frame
        const g = c.getContext('2d')!, img = g.createImageData(c.width, c.height);
        for (let i = 0; i < img.data.length; i += 4) { const v = 128 + (Math.random() + Math.random() + Math.random() - 1.5) * 120; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
        g.putImageData(img, 0, 0);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); const cam = camRef.current; if (cam) { cam.style.transform = ''; cam.style.filter = ''; } };
  }, [fx, clock]);
  return <>
    {fx.vignette > 0 && <div ref={vig} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0, background: 'radial-gradient(ellipse farthest-corner at center, rgba(0,0,0,0) 45%, rgba(0,0,0,1) 100%)' }} />}
    {fx.grain > 0 && <canvas ref={grain} width={270} height={480} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, pointerEvents: 'none',
      mixBlendMode: 'overlay', opacity: 0 }} />}
    <div ref={flash} style={{ position: 'absolute', inset: 0, background: '#fff', opacity: 0, pointerEvents: 'none' }} />
    <div ref={black} style={{ position: 'absolute', inset: 0, background: '#000', opacity: 0, pointerEvents: 'none' }} />
  </>;
}

// the ticker strip, positioned from the video's time exactly as the export's ffmpeg formula does - moved on every
// screen frame straight from the video clock (the 4-a-second time updates made it jump)
// a green-screen clip (money rain), live: the source video in step with the clock, its green keyed out on a half-size
// canvas each frame (the export keys it the same way with ffmpeg: chromakey + despill, cover-cropped, a fade at the end)
function KeyedClip({ o, ep, clock }: { o: any; ep: string; clock: () => number }) {
  const vid = useRef<HTMLVideoElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const live = useRef(o); live.current = o;
  useEffect(() => {
    let raf = 0, lastT = -1;
    const step = () => {
      const v = vid.current, c = cv.current, cur = live.current, t = clock();
      const on = cur.start != null && t >= cur.start && (cur.end == null || t <= cur.end);
      if (v && c) {
        c.style.opacity = on ? '1' : '0';
        if (on) {
          const want = (cur.from || 0) + (t - cur.start), moving = Math.abs(t - lastT) > 0.0005 && Math.abs(t - lastT) < 0.2;
          if (Math.abs(v.currentTime - want) > (moving ? 0.2 : 0.03)) v.currentTime = want;
          if (moving && v.paused) v.play().catch(() => {});
          if (!moving && !v.paused) v.pause();
          const ctx = c.getContext('2d', { willReadFrequently: true });
          if (ctx && v.videoWidth) {
            const W = c.width, H = c.height, sc = H / v.videoHeight, sw = W / sc;  // cover: full height, the middle of the width
            ctx.clearRect(0, 0, W, H);
            ctx.drawImage(v, (v.videoWidth - sw) / 2, 0, sw, v.videoHeight, 0, 0, W, H);
            const img = ctx.getImageData(0, 0, W, H), d = img.data;
            for (let k = 0; k < d.length; k += 4) {
              const g = d[k + 1] - Math.max(d[k], d[k + 2]);  // how green
              if (g > 40) d[k + 3] = Math.max(0, 255 - (g - 40) * 6);
              if (g > 0) d[k + 1] = Math.max(d[k], d[k + 2]) + g * 0.4;  // despill
            }
            const left = cur.end != null ? cur.end - t : 99, f = Math.min(1, left / 0.4);
            ctx.putImageData(img, 0, 0);
            c.style.opacity = String(Math.max(0, f));
          }
        } else if (!v.paused) v.pause();
      }
      lastT = t;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [clock]);
  return <>
    <video ref={vid} src={`/api/ep/${ep}/file?p=${encodeURIComponent(o.video)}`} muted playsInline preload="auto" style={{ display: 'none' }} />
    <canvas ref={cv} width={540} height={960} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, pointerEvents: 'none', opacity: 0 }} />
  </>;
}

// a picture sticker, live: pops in on its moment / rains down - the export's own motion (render/ui/sticker_anim.js),
// moved on every screen frame straight from the clock
function StickerLayer({ o, ep, clock }: { o: any; ep: string; clock: () => number }) {
  const root = useRef<HTMLDivElement>(null);
  const live = useRef(o); live.current = o;
  const n = o.motion === 'rain' ? (o.count || 22) : 1;
  useEffect(() => {
    let raf = 0;
    const step = () => {
      const el = root.current, cur = live.current, t = clock();
      if (el) {
        const ims = Array.from(el.children) as HTMLElement[];
        if (cur.motion === 'rain') {
          const r = rainBills(cur, t);
          ims.forEach((im, i) => { const q = r[i]; if (!q) { im.style.opacity = '0'; return; }
            Object.assign(im.style, { left: q.x + 'px', top: q.y + 'px', width: q.w + 'px', opacity: String(q.opacity), transform: q.transform }); });
        } else if (ims[0]) {
          const q = stickerPop(cur, t);
          Object.assign(ims[0].style, { left: (cur.x ?? 540) + 'px', top: (cur.y ?? 700) + 'px', width: (cur.w || 520) + 'px', opacity: String(q.opacity), transform: q.transform });
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [clock]);
  const src = `/api/ep/${ep}/file?p=${encodeURIComponent(o.image)}`;
  return <div ref={root} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    {Array.from({ length: n }, (_, i) => <img key={i} src={src} draggable={false} style={{ position: 'absolute', left: 0, top: 0, opacity: 0, transformOrigin: '50% 50%' }} />)}
  </div>;
}

// the finance-news panels, live: the export's own drawing (render/ui/market_anim.js) on one frame-sized canvas
function MarketCanvas({ ov, clock }: { ov: any[]; clock: () => number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef(ov); live.current = ov;
  useEffect(() => {
    let raf = 0;
    const step = () => {
      const ctx = ref.current?.getContext('2d');
      if (ctx) { ctx.clearRect(0, 0, 1080, 1920); const t = clock(); for (const o of live.current) if (o.style === 'market') drawMarket(ctx, o, t, fontCss('assistant')); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [clock]);
  return <canvas ref={ref} width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, pointerEvents: 'none' }} />;
}

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
  const dust = useMemo(() => words.map((w, i) => wordDust(i, w.w)), [words]);
  if (o.start == null || o.end == null || t < o.start || t > o.end) return null;
  return (
    <div className="he" style={{ position: 'absolute', top: o.y ?? 1150, ...(o.w ? { left: (o.x ?? 540) - o.w / 2, width: o.w } : { left: 60, right: 60 }), display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
      alignItems: 'baseline', gap: '4px 20px', direction: 'rtl', fontFamily: fontCss('assistant'), ...(THOUGHT_STYLE as any), transform: lineDrift(t, o.start, o.text, o.motion, !!o.w, o.end, o.hold, o.grow), pointerEvents: 'none' }}>
      {words.map((w, i) => { const s = wordState(i, words.length, t, o.start, o.end, o.motion, o.hold);
        // the word, and its atoms beside it (not inside: they must not fade with it)
        return <span key={i} style={{ display: 'inline-block', position: 'relative', whiteSpace: 'nowrap', fontSize: w.size, marginTop: w.dy, transform: `rotate(${w.rot.toFixed(2)}deg)` }}>
          <span style={{ display: 'inline-block', opacity: s.opacity, filter: s.filter, transform: s.transform }}>{w.w}</span>
          {o.motion === 'horror' && dust[i].map((p, k) => { const d = dustState(p, i, words.length, t, o.start, o.end, o.motion);
            return d.opacity > 0 ? <span key={k} style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, borderRadius: '50%',
              background: '#fff', boxShadow: '0 0 4px rgba(0,0,0,0.9)', opacity: d.opacity, transform: d.transform, WebkitTextStroke: 0 } as any} /> : null; })}
        </span>; })}
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
// the iPhone's way in: scan the QR once, drop videos on the phone page - they come down to Downloads\drop\<folder>
// by themselves and show in the footage list; a project marked Done empties its folder in the cloud
function DropCard() {
  const [d, setD] = useState<any>(null);
  const [qr, setQr] = useState(false);
  useEffect(() => {
    const load = () => api('/api/drop').then((x) => x && setD(x)).catch(() => {});
    load(); const t = setInterval(load, 4000); return () => clearInterval(t);
  }, []);
  if (!d) return null;
  const gb = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : `${Math.round(n / 1e6)} MB`);
  return <div className="drop-card">
    <div className="nv-sec">From the iPhone <span>full quality, any size</span></div>
    <div style={{ display: 'flex', gap: 6 }}>
      <button className="btn" style={{ flex: 1 }} onClick={() => setQr(!qr)}>{qr ? 'Hide the QR' : 'QR for the phone'}</button>
      <button className="btn ghost" onClick={() => api('/api/drop/sync', {})} title="Look for new files now (it also looks every minute)">Check now</button>
    </div>
    {qr && <div className="drop-qr">
      <img src="/api/drop/qr.svg" alt="The drop page" />
      <div className="help">Scan it once with the iPhone camera - the page keeps its key. Then Share → Add to Home Screen, and it is an app.</div>
    </div>}
    {d.running && <div className="drop-f on"><span className="he">{d.running.folder}</span>
      <span>coming down {d.running.i}/{d.running.n}</span><span>{Math.floor((d.running.bytes / Math.max(1, d.running.total)) * 100)}%</span></div>}
    {(d.folders || []).map((f: any) => <div key={f.name} className="drop-f"><span className="he">{f.name}</span>
      <span>{f.files} file{f.files === 1 ? '' : 's'} · {gb(f.bytes)}</span><span className={f.here === f.files ? 'ok' : ''}>{f.here === f.files ? 'here ✓' : `${f.here}/${f.files} here`}</span></div>)}
    {!(d.folders || []).length && !d.running && <div className="help">Nothing waiting in the cloud. What you drop comes down to Downloads\drop by itself and is listed under Footage folder.</div>}
    {d.error && <div className="nv-err">{d.error}</div>}
  </div>;
}

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
    tabProject.set(r.id);
    location.reload();
  };
  return (
    <div className="nv">
      <DropCard />
      <div className="nv-sec">1 · Template</div>
      <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <button className={tpl === 'solo' ? 'on' : ''} onClick={() => setTpl('solo')}>Solo · one person</button>
        <button className={tpl === 'zoom' ? 'on' : ''} onClick={() => setTpl('zoom')}>Zoom call</button>
      </div>
      <div className="help" style={{ marginTop: 6 }}>{tpl === 'solo' ? 'One person to camera: monologue, Q&A, a desk sketch with an off-screen voice.' : 'Several people in a video meeting, one file per person.'}</div>
      <div className="nv-sec">2 · Footage folder <span>in Downloads (drop/ = from the iPhone)</span></div>
      <div className="nv-list">
        {folders.map((f) => <button key={f.path} className={`nv-f ${folder === f.path ? 'on' : ''}`} onClick={() => { setFolder(f.path); if (!name) setName(f.name.split('/').pop()); }}>
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

/** Pick a sound in a window over the editor (never inside the panel): this project's sounds first, the whole library
 *  one tab away, a search, a play button to listen. Esc / a click outside closes it. */
function SoundPicker({ ep, title, hint, onPick, onClose, hear, hearing }: { ep: string; title: string; hint?: string;
  onPick: (e: any) => void; onClose: () => void; hear: (url: string) => void; hearing: string | null }) {
  const [lib, setLib] = useState<{ project: any[]; all: any[] } | null>(null);
  const [tab, setTab] = useState<'project' | 'all'>('project');
  const [q, setQ] = useState('');
  useEffect(() => { api(`/api/ep/${ep}/sound-lib`).then((l) => { if (l?.all) { setLib(l); if (!l.project.length) setTab('all'); } }); }, [ep]);
  const close = () => { if (hearing) hear(hearing); onClose(); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  });
  const list = (lib?.[tab] || []).filter((e) => !q || `${e.name} ${e.folder}`.toLowerCase().includes(q.toLowerCase()));
  return <div className="pm-modal" onMouseDown={close}>
    <div className="pm-box sp-box" onMouseDown={(e) => e.stopPropagation()}>
      <div className="sp-title">{title}</div>
      {hint && <div className="help" style={{ margin: '2px 0 12px' }}>{hint}</div>}
      <div className="sp-bar">
        <div className="seg" style={{ gridTemplateColumns: '1fr 1fr', flex: 1 }}>
          <button className={tab === 'project' ? 'on' : ''} onClick={() => setTab('project')}>This project{lib ? ` · ${lib.project.length}` : ''}</button>
          <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>All sounds{lib ? ` · ${lib.all.length}` : ''}</button>
        </div>
        <input className="field" autoFocus placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 170 }} />
      </div>
      <div className="sp-list">
        {!lib && <div className="empty">Loading…</div>}
        {lib && !list.length && <div className="empty">{q ? 'Nothing matches.' : 'No sounds in this project yet - see All sounds.'}</div>}
        {list.map((e) => <div key={e.sound} className="fx-lib-row">
          <button className={`fx-play ${hearing === e.url ? 'on' : ''}`} title={hearing === e.url ? 'Stop' : 'Listen'} onClick={() => hear(e.url)}>{hearing === e.url ? '■' : '▶'}</button>
          <button className="fx-pick" onClick={() => { if (hearing) hear(hearing); onPick(e); }}>{e.name}<span>{e.folder}</span></button>
        </div>)}
      </div>
      <div className="pm-bar" style={{ marginTop: 12 }}><span className="pm-bn" /><button className="btn ghost" onClick={close}>Cancel</button></div>
    </div>
  </div>;
}

function LessonTimeline({ edit, fps, k, t, total, onSeek, overlays, sel, onSelText, bgName, layer, onLayer, onTrim, onPeek, onSoundTrim, soundTrim, music, onMusic, onSoundPick, soundLane, laneCount = 0, onLaneAdd, onLaneRemove, busy, onOvTime, onCut, hasEnds, onSoundMove, onSoundRemove, fxBusy, film, soundNames, onFilm }: {
  edit: any; fps: number; k: number; t: number; total: number; onSeek: (s: number) => void; overlays: Overlay[]; sel: number | null; onSelText: (i: number) => void; bgName: string;
  layer: string | null; onLayer: (id: string) => void; onTrim: (take: string, from: number, to: number, i?: number, side?: 'in' | 'out') => void; busy: boolean;
  onPeek?: (take: string, at: number) => void;
  onSoundTrim?: (i: number, side: 'l' | 'r', ds: number) => void; soundTrim?: boolean[]; music?: any; onMusic?: (patch: any) => void;
  onSoundPick?: (i: number) => void;
  soundLane?: number[]; laneCount?: number; onLaneAdd?: () => void; onLaneRemove?: (l: number) => void;
  onOvTime: (i: number, start: number, end: number | null) => void; onCut: (op: any) => void; hasEnds?: boolean;
  onSoundMove?: (i: number, startOut: number | null, lane?: number) => void; onSoundRemove?: (i: number) => void; fxBusy?: boolean; film?: any; soundNames?: string[]; onFilm?: (fx: any) => void;
}) {
  // a filter layer moved / its ends dragged on its lane (its time: fx.times[id] = [start, end | null])
  const [fDrag, setFDrag] = useState<{ id: string; mode: 'm' | 'l' | 'r'; dx: number } | null>(null);
  const fRange = (id: string): [number, number] => { const r = film?.times?.[id]; return r ? [r[0], r[1] ?? total] : [0, total]; };
  const grabF = (e: React.MouseEvent, id: string, mode: 'm' | 'l' | 'r') => {
    e.stopPropagation(); e.preventDefault();
    onLayer('filters');
    const x0 = e.clientX; let dx = 0;
    setFDrag({ id, mode, dx: 0 });
    const mv = (m: MouseEvent) => { dx = m.clientX - x0; setFDrag({ id, mode, dx }); };
    const up = () => {
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up); setFDrag(null);
      if (Math.abs(dx) < 3 || !onFilm) return;
      const ds = dx / pps, [s0, e0] = fRange(id), open = film?.times?.[id]?.[1] == null;
      const s1 = mode === 'r' ? s0 : Math.max(0, Math.min(e0 - 0.3, s0 + ds));
      const e1 = mode === 'l' ? e0 : Math.max(s1 + 0.3, Math.min(total, e0 + ds));
      const end = open && mode !== 'r' ? null : +e1.toFixed(2);  // (an open end stays open unless its end is dragged)
      onFilm({ ...film, times: { ...(film?.times || {}), [id]: [+s1.toFixed(2), end] } });
    };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };
  // the filter and sound groups: collapsed = one lane, open = a lane each (like the text layers)
  const [fltOpen, setFltOpen] = useState(store.get('zc-flt-open') === '1');
  const [sndOpen, setSndOpen] = useState(store.get('zc-snd-open') !== '0');
  const toggleFlt = () => { store.set('zc-flt-open', fltOpen ? '0' : '1'); setFltOpen(!fltOpen); };
  const toggleSnd = () => { store.set('zc-snd-open', sndOpen ? '0' : '1'); setSndOpen(!sndOpen); };
  const fOn = filtersOn(film);
  // sounds: pick one (click), drag it to move it, drag an end to make it shorter / longer; Delete removes the pick
  const [snd, setSnd] = useState<number | null>(null);
  const [sndDrag, setSndDrag] = useState<{ i: number; dx: number; dy: number; mode: 'm' | 'l' | 'r' } | null>(null);
  const [laneSel, setLaneSel] = useState<number | null>(null);  // a sound layer picked (its name on the left): Delete layer
  const laneAt = (i: number) => soundLane?.[i] ?? i;
  const [sndMoved, setSndMoved] = useState<Record<number, { from: number; to: number }>>({});  // shown so until its layer is remade
  useEffect(() => setSndMoved({}), [edit?.sounds]);
  const sndBox = (i: number) => { const s = edit.sounds[i]; return sndMoved[i] ?? { from: s.from / k, to: s.to / k }; };
  const grabSound = (e: React.MouseEvent, i: number, mode: 'm' | 'l' | 'r' = 'm') => {
    e.stopPropagation(); e.preventDefault();
    pick({ snd: i }); onSoundPick?.(i);
    const x0 = e.clientX, y0 = e.clientY; let dx = 0, dy = 0;
    setSndDrag({ i, dx: 0, dy: 0, mode });
    const mv = (m: MouseEvent) => { dx = m.clientX - x0; dy = sndOpen && mode === 'm' ? m.clientY - y0 : 0; setSndDrag({ i, dx, dy, mode }); };
    const up = () => {
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up); setSndDrag(null);
      const dl = Math.round(dy / TH), lane = Math.max(0, Math.min(laneCount - 1, laneAt(i) + dl));
      if (Math.abs(dx) < 3) { if (dl && lane !== laneAt(i)) onSoundMove?.(i, null, lane); return; }
      const b = sndBox(i), ds = dx / pps;
      if (mode === 'm') { setSndMoved({ ...sndMoved, [i]: { from: b.from + ds, to: b.to + ds } }); onSoundMove?.(i, b.from + ds, dl ? lane : undefined); }
      else if (mode === 'l') { setSndMoved({ ...sndMoved, [i]: { from: Math.min(b.to - 0.1, b.from + ds), to: b.to } }); onSoundTrim?.(i, 'l', ds); }
      else { setSndMoved({ ...sndMoved, [i]: { from: b.from, to: Math.max(b.from + 0.1, b.to + ds) } }); onSoundTrim?.(i, 'r', ds); }
    };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };
  // the music bed: moved, its ends dragged (start / end on the video), taken off with Delete
  const [musSel, setMusSel] = useState(false);
  const [musDrag, setMusDrag] = useState<{ dx: number; mode: 'm' | 'l' | 'r' } | null>(null);
  const musOn = !!music && !music.off;
  const mS = +(music?.start || 0), mE = music?.end == null ? total : Math.min(total, +music.end);
  const grabMusic = (e: React.MouseEvent, mode: 'm' | 'l' | 'r') => {
    e.stopPropagation(); e.preventDefault();
    pick({ music: true }); onLayer('music');
    const x0 = e.clientX; let dx = 0;
    setMusDrag({ dx: 0, mode });
    const mv = (m: MouseEvent) => { dx = m.clientX - x0; setMusDrag({ dx, mode }); };
    const up = () => {
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up); setMusDrag(null);
      if (Math.abs(dx) < 3) return;
      const ds = dx / pps, open = music?.end == null;
      const s1 = mode === 'r' ? mS : Math.max(0, Math.min(mE - 1, mS + ds));
      const e1 = mode === 'l' ? mE : Math.max(s1 + 1, Math.min(total, mE + ds));
      onMusic?.({ start: +s1.toFixed(2), end: open && mode === 'l' ? null : e1 >= total - 0.05 ? null : +e1.toFixed(2) });
    };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };
  // the cut tool: a piece picked on the Speaker lane; Split at the playhead (S), Delete the piece (Delete)
  const [piece, setPiece] = useState<number | null>(null);
  const atPlayhead = () => {
    const f = t * fps * k;
    const it = (edit?.items || []).find((x: any) => x.kind === 'clip' && f > x.out && f < x.out + x.n);
    return it ? { take: it.take, t: +(it.a + (f - it.out) / fps * (it.sp ?? 1)).toFixed(3) } : null;
  };
  const split = () => { const at = atPlayhead(); if (at && !busy) onCut({ op: 'split', ...at }); };
  const pick = (p: { piece?: number; snd?: number; music?: boolean; lane?: number }) => { setPiece(p.piece ?? null); setSnd(p.snd ?? null); setMusSel(!!p.music); setLaneSel(p.lane ?? null); };
  const picked = piece != null ? 'piece' : snd != null ? 'sound' : musSel ? 'music' : laneSel != null ? 'lane' : null;
  const del = () => {  // the pick goes: a piece (the rest closes up), a sound (its layer stays), the music, a sound layer
    if (snd != null) { onSoundRemove?.(snd); pick({}); return; }
    if (laneSel != null) { onLaneRemove?.(laneSel); pick({}); return; }
    if (musSel) { onMusic?.({ off: true }); pick({}); return; }
    const it = piece != null ? edit?.items?.[piece] : null;
    if (!it || busy) return;
    onCut({ op: 'remove', take: it.take, a: +it.a.toFixed(3), b: +(it.a + (it.an ?? it.n) / fps * (it.sp ?? 1)).toFixed(3) });
    setPiece(null);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) || tg.isContentEditable) return;
      if (e.key === 's' || e.key === 'S' || e.key === 'ד') { e.preventDefault(); split(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && picked) { e.preventDefault(); del(); }
      if (e.key === 'Escape' && picked) pick({});
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  });
  // a text layer moved / its ends dragged on its own lane
  const [ovDrag, setOvDrag] = useState<{ i: number; mode: 'm' | 'l' | 'r'; dx: number } | null>(null);
  const grabOv = (e: React.MouseEvent, i: number, mode: 'm' | 'l' | 'r') => {
    e.stopPropagation(); e.preventDefault();
    onSelText(i);
    const x0 = e.clientX; let dx = 0;
    setOvDrag({ i, mode, dx: 0 });
    const mv = (m: MouseEvent) => { dx = m.clientX - x0; setOvDrag({ i, mode, dx }); };
    const up = () => {
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up); setOvDrag(null);
      if (Math.abs(dx) < 3) return;
      const o: any = overlays[i], ds = dx / pps, s0 = o.start || 0, e0 = o.end ?? total;
      const s1 = mode === 'r' ? s0 : Math.max(0, Math.min(e0 - 0.2, s0 + ds));
      const e1 = mode === 'l' ? e0 : Math.max(s1 + 0.2, Math.min(total, e0 + ds));
      onOvTime(i, +s1.toFixed(2), mode === 'm' && o.end == null ? null : +e1.toFixed(2));
    };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };
  const [textOpen, setTextOpen] = useState(store.get('zc-text-open') !== '0');
  const toggleText = () => { store.set('zc-text-open', textOpen ? '0' : '1'); setTextOpen(!textOpen); };
  const headsRef = useRef<HTMLDivElement>(null);
  const zoomAnchor = useRef<{ t: number; px: number } | null>(null);
  useEffect(() => {  // Ctrl + wheel = zoom, the moment under the mouse stays where it is; the wheel alone scrolls
    const el = lanesRef.current; if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect(), px = e.clientX - r.left;
      zoomAnchor.current = { t: (px + el.scrollLeft - 12) / pps, px };
      setZoom((z) => Math.max(0.25, Math.min(40, z * (e.deltaY < 0 ? 1.18 : 1 / 1.18))));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });
  useEffect(() => {
    const el = lanesRef.current, a = zoomAnchor.current;
    if (el && a) { el.scrollLeft = Math.max(0, 12 + a.t * pps - a.px); zoomAnchor.current = null; }
  });  // (after every render: the anchor is set only by a Ctrl+wheel zoom)
  const syncHeads = () => { if (headsRef.current && lanesRef.current) headsRef.current.scrollTop = lanesRef.current.scrollTop; };
  const ovName = (o: any) => o.image ? 'Logo' : o.asker ? `${o.asker}` : ({ pov: 'Hook', question: 'Question', thought: 'Thought', band: 'Lower third', ticker: 'Ticker', market: 'Market', sticker: 'Sticker' } as any)[o.style || 'pov'] || 'Text';
  const lanesRef = useRef<HTMLDivElement>(null);
  // the lanes have a horizontal scrollbar, the names column does not: without the same room at its bottom the names
  // stop scrolling short of the lanes and every name sits a scrollbar's height off its lane
  const [sbH, setSbH] = useState(0);
  useEffect(() => {
    const el = lanesRef.current;
    if (!el) return;
    const f = () => { const h = el.offsetHeight - el.clientHeight; setSbH((p) => (p === h ? p : h)); syncHeads(); };
    f();
    const ro = new ResizeObserver(f);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { syncHeads(); }, [sbH]);
  // dragging a piece's edge: the block follows the mouse, the cut is redone from the original take on release
  const [drag, setDrag] = useState<{ i: number; side: 'in' | 'out'; dx: number } | null>(null);
  const grabEdge = (e: React.MouseEvent, i: number, side: 'in' | 'out') => {
    e.stopPropagation(); e.preventDefault();
    if (busy) return;
    const it = edit.items[i], x0 = e.clientX;
    const from = side === 'in' ? it.a : it.a + (it.an ?? it.n) / fps * (it.sp ?? 1);
    let dx = 0;
    setDrag({ i, side, dx: 0 });
    const ds = () => (dx / pps) * k * (it.sp ?? 1);  // timeline seconds -> seconds of his take (a slow-motion piece shows less of it)
    const mv = (m: MouseEvent) => {
      dx = m.clientX - x0; setDrag({ i, side, dx });
      onPeek?.(it.take, Math.max(0, from + ds() - (side === 'out' ? 1 / fps : 0)));  // the frame under the edge, from the whole take
    };
    const up = () => {
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up);
      setDrag(null);
      if (Math.abs(dx) < 3) return;
      onTrim(it.take, +from.toFixed(3), +Math.max(0, from + ds()).toFixed(3), i, side);
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
        <button className="btn" disabled={busy || !atPlayhead()} title="The video starts here - everything before it goes, in every layer" onClick={() => { const at = atPlayhead(); if (at) onCut({ op: 'start', ...at }); }}>⇤ Start here</button>
        <button className="btn" disabled={busy || !atPlayhead()} title="The video ends here - everything after it goes, in every layer" onClick={() => { const at = atPlayhead(); if (at) onCut({ op: 'end', ...at }); }}>End here ⇥</button>
        {hasEnds && <button className="btn ghost" disabled={busy} title="Back to the full length" onClick={() => onCut({ op: 'clear-ends' })}>Reset start/end</button>}
        <span className="vsep" />
        <button className="btn" disabled={busy || !atPlayhead()} title="Split the video at the playhead (S)" onClick={split}>✂ Split</button>
        <button className="btn" disabled={!picked || (picked === 'piece' && busy)} title="Remove what is picked on the timeline - a piece (the rest closes up), a sound (its layer stays), the music, a sound layer (Delete)" onClick={del}>{picked === 'lane' ? 'Delete layer' : 'Delete'}</button>
        <span className="help" style={{ margin: '0 10px 0 4px' }}>{picked === 'piece' ? 'a piece of the video picked' : picked === 'sound' ? `sound picked: ${soundNames?.[snd!] || edit?.sounds?.[snd!]?.name || ''}` : picked === 'music' ? 'the music picked' : picked === 'lane' ? `sound layer ${laneSel! + 1} picked${(soundLane || []).includes(laneSel!) ? '' : ' (empty)'}` : 'click a piece, a sound or the music to pick it'}</span>
        <button className="btn ghost icon" title="Zoom out" onClick={() => setZoom(Math.max(0.25, zoom / 1.5))}>{I.zoomOut}</button>
        <input type="range" min={0.25} max={40} step={0.05} value={zoom} onChange={(e) => setZoom(+e.target.value)} />
        <button className="btn ghost icon" title="Zoom in" onClick={() => setZoom(Math.min(40, zoom * 1.5))}>{I.zoomIn}</button>
        <button className="btn" style={{ marginLeft: 6 }} onClick={() => setZoom(1)}>Fit</button>
      </div>
      <div className="tl-body">
        <div className="heads" ref={headsRef}>
          <div className="h ruler" />
          <div className="h pick grp" onClick={toggleText} title={textOpen ? 'Collapse the text layers into one lane' : 'Show each text layer on its own lane'}>
            <span className="caret">{textOpen ? '▾' : '▸'}</span>{I.text}<span className="h-name">Text · {overlays.length}</span></div>
          {textOpen && overlays.map((o: any, i) => <div key={'oh' + i} className={`h pick sub ${sel === i ? 'on' : ''}`} onClick={() => onSelText(i)} title={o.text || o.image}>
            {o.image ? '🖼' : I.text}<span className="h-name">{ovName(o)}</span></div>)}
          {([['captions', <>{I.cc}Captions</>], ['speaker', <><div className="av sm" style={{ background: 'var(--daniel)' }}>{I.phone}</div><span>Speaker</span></>],
            ['background', <>{I.layout}Background</>]] as const).map(([id, label]) => (
            <div key={id} className={`h pick ${layer === id ? 'on' : ''}`} onClick={() => onLayer(id)} title="Click to edit this layer">{label}</div>))}
          <div className={`h pick grp ${layer === 'filters' ? 'on' : ''}`} onClick={() => { toggleFlt(); onLayer('filters'); }} title={fltOpen ? 'Collapse the filters into one lane' : 'Show each filter on its own lane'}>
            <span className="caret">{fltOpen ? '▾' : '▸'}</span>◐<span className="h-name">Filters · {fOn.length}</span></div>
          {fltOpen && FILTERS.map((F) => <div key={'fh' + F.id} className={`h pick sub ${layer === 'filters' ? 'on' : ''}`} onClick={() => onLayer('filters')}>
            <span className="h-name">{F.name}</span></div>)}
          <div className={`h pick grp ${layer === 'sounds' ? 'on' : ''}`} onClick={() => { toggleSnd(); onLayer('sounds'); }} title={`All sounds: their panel - and ${sndOpen ? 'collapse them into one lane' : 'a lane each'}`}>
            <span className="caret">{sndOpen ? '▾' : '▸'}</span>♪<span className="h-name">Sounds · {(edit?.sounds || []).length}</span></div>
          {sndOpen && <div className={`h pick sub ${musSel ? 'on' : ''}`} onClick={() => { if (musOn) pick({ music: true }); onLayer('music'); }}
            title="The background music"><span className="h-name">♪ {musOn ? String(music.sound || 'music').split('/').pop()!.replace(/\.[^.]+$/, '') : 'Music'}</span></div>}
          {sndOpen && Array.from({ length: laneCount }, (_, l) => { const on = (edit?.sounds || []).map((s: any, i: number) => (laneAt(i) === l ? soundNames?.[i] || s.name : null)).filter(Boolean);
            return <div key={'sh' + l} className={`h pick sub ${laneSel === l ? 'on' : ''}`} onClick={() => { pick({ lane: l }); onLayer('music'); }}
              title={on.length ? `${on.join(' · ')} - click to pick this layer (Delete layer removes it)` : 'An empty sound layer - click to pick it (Delete layer removes it)'}>
              <span className="h-name he" style={on.length ? undefined : { color: 'var(--faint)', fontStyle: 'italic' }}>{on.length ? on.join(' · ') : 'Empty layer'}</span></div>; })}
          {sndOpen && <div className="h pick sub" onClick={() => onLaneAdd?.()} title="Add an empty sound layer"><span className="h-name" style={{ color: 'var(--dim)' }}>+ Sound layer</span></div>}
          <div style={{ height: sbH }} />
        </div>
        <div className="lanes" ref={lanesRef} onScroll={syncHeads}>
          <div className="lanes-in" style={{ width: W }}>
            <div className="ruler" onMouseDown={scrub}>{ticks}</div>
            {/* the text group: collapsed = all of them on one lane, open = a lane each (below) */}
            <div className="lane grp-lane" onMouseDown={(e) => e.target === e.currentTarget && scrub(e)}>
              {overlays.map((o: any, i) => (o.start != null || !(o.from_words || o.sound != null)) && <div key={'g' + i} className={`txt he ${sel === i ? 'sel' : ''}`}
                style={{ left: x(o.start || 0), width: Math.max(10, ((o.end ?? total) - (o.start || 0)) * pps - 2), position: 'absolute', opacity: textOpen ? 0.45 : 0.85, cursor: 'pointer' }}
                onMouseDown={(e) => e.stopPropagation()} onClick={() => onSelText(i)}>{o.image ? '🖼' : o.asker || o.text}</div>)}
            </div>
            {textOpen && overlays.map((o: any, i) => { const d = ovDrag?.i === i ? ovDrag : null, ds = d ? d.dx / pps : 0;
              const s0 = (o.start || 0) + (d && d.mode !== 'r' ? ds : 0), e0 = (o.end ?? total) + (d && d.mode !== 'l' ? ds : 0);
              return <div key={'ol' + i} className="lane" onMouseDown={(e) => e.target === e.currentTarget && scrub(e)}>
                {(o.start != null || !(o.from_words || o.sound != null)) && <div className={`txt he ${sel === i ? 'sel' : ''}`} style={{ left: x(s0), width: Math.max(10, (e0 - s0) * pps - 2), cursor: 'grab', position: 'absolute' }}
                  onMouseDown={(e) => grabOv(e, i, 'm')} title="Drag to move it · drag an end to change when it shows">
                  <span className="ov-h l" onMouseDown={(e) => grabOv(e, i, 'l')} />
                  {o.image ? `🖼 ${String(o.image).split('/').pop()}` : o.asker ? `${o.asker} שואלת · ${o.text}` : o.text}
                  <span className="ov-h r" onMouseDown={(e) => grabOv(e, i, 'r')} />
                </div>}
              </div>; })}
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
                return <div key={i} className="blk" style={{ left, width, background: 'var(--daniel)', cursor: 'pointer', position: 'absolute', outline: d || piece === i ? '2px solid var(--accent)' : 'none', zIndex: d || piece === i ? 2 : undefined, filter: piece === i ? 'brightness(1.15)' : undefined }}
                  title={`${it.take} · ${it.a.toFixed(2)}s - ${(it.a + (it.an ?? it.n) / fps * (it.sp ?? 1)).toFixed(2)}s of the take${it.sp ? ` · slow motion ${it.sp}x` : ''} · drag an edge to take more / less`}
                  onMouseDown={(e) => e.stopPropagation()} onClick={() => { onLayer('speaker'); pick(piece === i ? {} : { piece: i }); }}>
                  {hd('in')}{width > 70 ? <span style={{ padding: '0 10px' }}>{d ? `${d.dx > 0 === (d.side === 'out') ? '+' : '−'}${Math.abs((d.dx / pps) * k).toFixed(2)}s` : it.take.replace('IMG_', '')}</span> : null}{hd('out')}
                </div>;
              })}
            </div>
            <div className={`lane ${layer === 'background' ? 'sel' : ''}`} onMouseDown={scrub}>
              <div className="shot" style={{ left: x(0), width: Math.max(10, total * pps - 2), cursor: 'pointer' }}
                onMouseDown={(e) => e.stopPropagation()} onClick={() => onLayer('background')}>{bgName}</div>
            </div>
            <div className={`lane grp-lane ${layer === 'filters' ? 'sel' : ''}`} onMouseDown={scrub}>
              {fOn.length > 0 && <div className="shot" style={{ left: x(0), width: Math.max(10, total * pps - 2), cursor: 'pointer', opacity: fltOpen ? 0.45 : 0.85 }}
                onMouseDown={(e) => e.stopPropagation()} onClick={() => onLayer('filters')}>{fOn.map((F) => `${F.name} ${Math.round(F.get(film) * 100)}%`).join(' · ')}</div>}
            </div>
            {fltOpen && FILTERS.map((F) => { const v = F.get(film), d = fDrag?.id === F.id ? fDrag : null, ds = d ? d.dx / pps : 0;
              const [r0, r1] = fRange(F.id), s0 = r0 + (d && d.mode !== 'r' ? ds : 0), e0 = r1 + (d && d.mode !== 'l' ? ds : 0);
              return <div key={'fl' + F.id} className={`lane ${layer === 'filters' ? 'sel' : ''}`} onMouseDown={scrub}>
                {v > 0.001 && <div className="txt" style={{ left: x(s0), width: Math.max(10, (e0 - s0) * pps - 2), cursor: 'grab', position: 'absolute' }}
                  onMouseDown={(e) => grabF(e, F.id, 'm')} title="Drag to move it · drag an end to change when it plays">
                  <span className="ov-h l" onMouseDown={(e) => grabF(e, F.id, 'l')} />
                  {F.name} · {Math.round(v * 100)}%
                  <span className="ov-h r" onMouseDown={(e) => grabF(e, F.id, 'r')} />
                </div>}
              </div>; })}
            {(() => {
              const block = (s: any, i: number) => {
                const b = sndBox(i), d = sndDrag?.i === i ? sndDrag : null, ds = d ? d.dx / pps : 0;
                const st = b.from + (d && d.mode !== 'r' ? ds : 0), en = b.to + (d && d.mode !== 'l' ? ds : 0);
                const w = Math.max(14, (en - st) * pps - 2);  // a short sound: zoom in to drag its ends (the middle stays to move it)
                const nm = soundNames?.[i] || s.name, thought = nm.startsWith('💭'), ends = soundTrim?.[i] !== false && w >= 34;
                return <div key={i} className={`cap snd he ${snd === i ? 'on' : ''}`} style={{ left: x(st), width: w,
                  background: thought ? 'var(--daniel)' : 'var(--gold)', color: thought ? '#fff' : '#2a2000', cursor: 'grab', opacity: fxBusy && sndMoved[i] != null ? 0.7 : 1,
                  transform: d?.dy ? `translateY(${d.dy}px)` : undefined, zIndex: d ? 5 : undefined }}
                  title={`${nm} - drag to move it${ends ? ', drag an end to make it shorter / longer' : ''}; click it and press Delete to remove it`} onMouseDown={(e) => grabSound(e, i)}>
                  {ends && <span className="ov-h l" onMouseDown={(e) => grabSound(e, i, 'l')} />}
                  {w >= 40 && <span className="snd-n">{nm}</span>}
                  {ends && <span className="ov-h r" onMouseDown={(e) => grabSound(e, i, 'r')} />}
                </div>; };
              const musLane = <>
                  {musOn ? (() => {
                    const d = musDrag, ds = d ? d.dx / pps : 0;
                    const s0 = Math.max(0, mS + (d && d.mode !== 'r' ? ds : 0)), e0 = Math.min(total, mE + (d && d.mode !== 'l' ? ds : 0));
                    return <div className={`cap snd mus ${musSel ? 'on' : ''}`} style={{ left: x(s0), width: Math.max(14, (e0 - s0) * pps - 2), cursor: 'grab', opacity: fxBusy && d ? 0.7 : 1 }}
                      title="Music - drag to move it, drag an end to start / stop it elsewhere; click it and press Delete to take it off" onMouseDown={(e) => grabMusic(e, 'm')}>
                      <span className="ov-h l" onMouseDown={(e) => grabMusic(e, 'l')} />
                      <span className="snd-n">♪ {String(music.sound || 'music').split('/').pop()!.replace(/\.[^.]+$/, '')}</span>
                      <span className="ov-h r" onMouseDown={(e) => grabMusic(e, 'r')} />
                    </div>;
                  })() : <div className="cap" style={{ left: x(0), width: Math.max(10, total * pps - 2), background: 'transparent', border: '1px dashed var(--edge-2)', color: 'var(--dim)', cursor: 'pointer' }}
                    onMouseDown={(e) => e.stopPropagation()} onClick={() => onLayer('music')} title="No music - pick a track in Music & sounds">♪ no music</div>}
                </>;
              return <>
                <div className={`lane grp-lane ${layer === 'sounds' ? 'sel' : ''}`} onMouseDown={scrub}>
                  {!sndOpen && musLane}
                  {!sndOpen && (edit?.sounds || []).map(block)}
                </div>
                {sndOpen && <div className={`lane ${musSel ? 'sel' : ''}`} onMouseDown={scrub}>{musLane}</div>}
                {sndOpen && Array.from({ length: laneCount }, (_, l) => <div key={'sl' + l} className={`lane ${laneSel === l || (snd != null && laneAt(snd) === l) ? 'sel' : ''}`} onMouseDown={scrub}>
                  {(edit?.sounds || []).map((s: any, i: number) => (laneAt(i) === l ? block(s, i) : null))}</div>)}
                {sndOpen && <div className="lane" onMouseDown={scrub} />}
              </>;
            })()}
            <div className="playhead" style={{ left: x(t), height: 30 + (6 + (textOpen ? overlays.length : 0) + (fltOpen ? FILTERS.length : 0) + (sndOpen ? laneCount + 2 : 0)) * TH }} />
          </div>
        </div>
      </div>
    </div>
  );
}
