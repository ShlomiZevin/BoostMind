// What the editor's shell and the panels it still shares (footage, a script line, speed) have in common: the data's
// types, the server call, the speakers' colours, this tab's project, the few icons.
import React from 'react';

export type Fix = { clip?: string; in?: number; out?: number; cut?: number; layout?: string; pause_before?: number; skip?: boolean; shift?: number; gain?: number; soften?: boolean };
export type Take = { clip: string; in: number; out: number; cut?: number; score?: number; heard?: string };
export type Line = {
  n: number; speaker: string; name: string; text: string; interrupted: boolean;
  status: 'ok' | 'check' | 'missing' | 'skipped'; score: number | null; heard: string;
  auto: Take | null; alternatives: Take[]; clip: string | null; in: number | null; out: number | null;
  cut: number | null; start: number | null; fix: Fix;
};
export type Job = { running: boolean; kind: string; log: string[]; code: number | null; send?: string[] };
export type Data = {
  episode: any; state: { lines: Line[]; total: number; takes: string[] } | null; edit: any;
  footage: { clips: { rel: string; char: string; kind: string }[]; unassigned: string[] } | null;
  audioVersion: number | null; output: string | null; job: Job | null;
};
export type Proj = { id: string; title: string; done?: boolean; created?: number; template?: string; test?: boolean };

export const api = async (url: string, body?: any) =>
  (await fetch(url, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined)).json();
const COLOR: Record<string, string> = { amir: 'var(--amir)', ofer: 'var(--ofer)', daniel: 'var(--daniel)' };
const PALETTE = ['var(--amir)', 'var(--ofer)', 'var(--daniel)', '#d9822b', '#c2507a'];
export const colorOf = (id: string, chars: any[]) => COLOR[id] || PALETTE[Math.max(0, chars.findIndex((c) => c.id === id)) % PALETTE.length];
export const LAYOUTS: [string, string, string][] = [
  ['', 'Auto', 'The editor picks: interruptions, reactions and back-and-forth decide the view.'],
  ['gallery', 'Gallery', 'Everyone in the meeting, stacked vertically.'],
  ['speaker', 'Speaker', 'The speaker big, the others in a strip underneath.'],
  ['duo', 'Duo', 'Two people big, the third floating in the corner.'],
];
export const STATUS: Record<string, string> = { ok: 'Matched', check: 'Check', missing: 'Missing', skipped: 'Dropped' };
export const f2 = (t?: number | null) => (t == null ? '' : t.toFixed(2));
// the project of this browser tab: shared by its tools (editor, Reader, Karaoke), not by other tabs
export const tabProject = {
  get: () => { try { return sessionStorage.getItem('zc-ep') || localStorage.getItem('zc-ep') || ''; } catch { return ''; } },
  set: (id: string) => { try { sessionStorage.setItem('zc-ep', id); localStorage.setItem('zc-ep', id); } catch {} },
};

export const I = {
  export: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" /><path d="M5 14v4.5A1.5 1.5 0 006.5 20h11a1.5 1.5 0 001.5-1.5V14" /></svg>,
  stop: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>,
  drop: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 7h14M10 11v6M14 11v6M6.5 7l1 12.5h9L17.5 7M9.5 7V4.5h5V7" /></svg>,
  reset: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12a8 8 0 108-8 8.5 8.5 0 00-6 2.5L4 8.5" /><path d="M4 4v4.5h4.5" /></svg>,
  up: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 15l6-6 6 6" /></svg>,
  down: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>,
};
