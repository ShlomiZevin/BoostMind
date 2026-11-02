// The Assets page (his ask, 2026-11-02: "a folder with all the backgrounds, music, sound effects, so we don't make them
// again, and find what suits a kind of video"): every background, music, sound and picture his videos in the layered
// editor use - the library (render/library.mjs, zoomcut/library/, in the cloud too). Search by name, words, the kind of
// video (series) and how it's made; play a sound right on its card; a click opens it big, with "Add to <project>".
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { tabProject } from './common';

type Item = { id: string; kind: string; file: string; name: string; size: number; dur?: number; w?: number; h?: number;
  from: string[]; series: string[]; types: string[]; labels: string[]; prompt?: string; tags?: string[]; about?: string; made?: string; added: number };
const api = async (u: string, body?: any) => (await fetch(u, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined)).json();
const KINDS: [string, string][] = [['', 'All'], ['background', 'Backgrounds'], ['music', 'Music'], ['sound', 'Sounds'], ['picture', 'Pictures'], ['icon', 'Icons'], ['video', 'Videos']];
const src = (it: Item) => '/lib/' + it.file.split('/').map(encodeURIComponent).join('/');
const secs = (s?: number) => (s == null ? '' : s < 60 ? `${s.toFixed(s < 10 ? 1 : 0)} s` : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);
const isSound = (it: Item) => it.kind === 'music' || it.kind === 'sound';
const words = (it: Item) => [it.name, it.about || '', ...it.labels, ...it.series, ...it.types, ...it.from, ...(it.tags || []), it.prompt || ''].join(' ').toLowerCase();

const PlayIc = ({ on }: { on: boolean }) => <svg width="12" height="12" viewBox="0 0 12 12">{on ? <><rect x="2" y="2" width="3" height="8" rx="1" fill="currentColor" /><rect x="7" y="2" width="3" height="8" rx="1" fill="currentColor" /></> : <path d="M3 1.5l7.5 4.5L3 10.5z" fill="currentColor" />}</svg>;

// one player for the page: a card's play button, the window's player - starting one stops the other
const player = new Audio();
function usePlaying() {
  const [on, setOn] = useState<string | null>(null);
  useEffect(() => { const end = () => setOn(null); player.addEventListener('ended', end); player.addEventListener('pause', end); return () => { player.removeEventListener('ended', end); player.removeEventListener('pause', end); }; }, []);
  const toggle = (it: Item) => { if (on === it.id) { player.pause(); return; } player.src = src(it); player.play().then(() => setOn(it.id)).catch(() => {}); };
  return { on, toggle };
}

function Big({ it, onClose, onTags }: { it: Item; onClose: () => void; onTags: (t: string[]) => void }) {
  const ep = tabProject.get();
  const [added, setAdded] = useState<'' | 'adding' | 'added' | string>('');
  const [tags, setTags] = useState((it.tags || []).join(', '));
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  const add = async () => {
    setAdded('adding');
    const r = await api(`/api/lib/${it.id}/add`, { ep }).catch((e) => ({ error: String(e) }));
    setAdded(r.error ? r.error : 'added');
  };
  return (
    <div className="ax-modal" onClick={onClose}>
      <div className="ax-big" onClick={(e) => e.stopPropagation()}>
        <div className="ax-big-view">
          {isSound(it) ? <audio src={src(it)} controls autoPlay style={{ width: '100%' }} />
            : it.kind === 'video' ? <video src={src(it)} controls autoPlay style={{ maxWidth: '100%', maxHeight: '60vh' }} />
            : <img src={src(it)} alt="" />}
        </div>
        <div className="ax-big-info">
          <div className="ax-big-name" dir="auto">{it.labels[0] || it.name}</div>
          {it.about && <div className="ax-row"><i dir="auto">{it.about}</i></div>}
          <div className="ax-meta">{KINDS.find((k) => k[0] === it.kind)?.[1].replace(/s$/, '')}{it.dur ? ` · ${secs(it.dur)}` : ''}{it.w ? ` · ${it.w}×${it.h}` : ''} · {(it.size / 1e6).toFixed(1)} MB</div>
          <div className="ax-row"><span>Used in</span><b dir="auto">{it.from.join(', ') || '-'}</b></div>
          <div className="ax-row"><span>Kind of video</span><b>{[...it.series, ...it.types].join(' · ') || '-'}</b></div>
          {it.prompt && <div className="ax-row"><span>Made from</span><i dir="auto">{it.prompt}</i></div>}
          <label className="ax-row"><span>Words to find it by</span>
            <input className="field" dir="auto" value={tags} placeholder="e.g. office, tense, rabbi" onChange={(e) => setTags(e.target.value)}
              onBlur={() => { const t = tags.split(',').map((x) => x.trim()).filter(Boolean); if (t.join(',') !== (it.tags || []).join(',')) onTags(t); }} />
          </label>
          <div className="ax-actions">
            <button className="btn primary" disabled={!ep || added === 'adding' || added === 'added'} onClick={add}>
              {added === 'added' ? `Added to ${ep}'s Media ✓` : added === 'adding' ? 'Adding…' : ep ? `Add to ${ep}` : 'Open a project first'}</button>
            <button className="btn ghost" onClick={onClose}>Close</button>
          </div>
          {added && !['adding', 'added'].includes(added) && <div className="ax-err">{added}</div>}
          {added === 'added' && <div className="ax-meta">It's in the project's Media - "+ timeline" puts it on the timeline.</div>}
        </div>
      </div>
    </div>
  );
}

function Assets() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState(() => localStorage.getItem('zc-ax-kind') || '');
  const [series, setSeries] = useState('');
  const [open, setOpen] = useState<Item | null>(null);
  const play = usePlaying();
  useEffect(() => { api('/api/lib').then((ix) => setItems(ix.items || [])); }, []);
  useEffect(() => { try { localStorage.setItem('zc-ax-kind', kind); } catch {} }, [kind]);
  const allSeries = useMemo(() => {
    const n = new Map<string, number>();
    for (const it of items || []) for (const s of it.series) n.set(s, (n.get(s) || 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  }, [items]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (items || []).filter((it) => (!kind || it.kind === kind) && (!series || it.series.includes(series)) && t.every((w) => words(it).includes(w)))
      .sort((a, b) => b.added - a.added || a.name.localeCompare(b.name));
  }, [items, q, kind, series]);
  const count = (k: string) => (items || []).filter((it) => !k || it.kind === k).length;
  const setTags = async (it: Item, tags: string[]) => { const n = await api(`/api/lib/${it.id}`, { tags }); setItems((l) => l!.map((x) => (x.id === it.id ? n : x))); };
  const sounds = shown.filter(isSound), pics = shown.filter((it) => !isSound(it));
  return (
    <div className="ax">
      <div className="ax-top">
        <div><h1>Assets</h1><div className="sub">{items ? `${items.length} backgrounds, music, sounds and pictures your videos use - find one before making a new one` : 'Loading…'}</div></div>
      </div>
      <div className="ax-bar">
        <input className="field ax-search" dir="auto" value={q} autoFocus placeholder="Search - a name, a word, a video (office, rabbi, coins, gym…)" onChange={(e) => setQ(e.target.value)} />
        <div className="ax-chips">{KINDS.map(([k, l]) => <button key={k} className={`chip-btn ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{l} <span>{count(k)}</span></button>)}</div>
        <div className="ax-chips">
          <button className={`chip-btn ${!series ? 'on' : ''}`} onClick={() => setSeries('')}>Every kind of video</button>
          {allSeries.map((s) => <button key={s} className={`chip-btn ${series === s ? 'on' : ''}`} onClick={() => setSeries(series === s ? '' : s)}>{s}</button>)}
        </div>
      </div>
      {items && !shown.length && <div className="ax-empty">Nothing like that yet.</div>}
      {sounds.length > 0 && <div className="ax-sounds">
        {sounds.map((it) => (
          <div key={it.id} className={`ax-snd ${play.on === it.id ? 'on' : ''}`} onClick={() => setOpen(it)} title="Open it big">
            <button className="ax-play" title={play.on === it.id ? 'Stop' : 'Play'} onClick={(e) => { e.stopPropagation(); play.toggle(it); }}><PlayIc on={play.on === it.id} /></button>
            <div className="ax-snd-name" dir="auto">{it.labels[0] || it.name}</div>
            <div className="ax-snd-meta">{it.kind === 'music' ? 'music' : 'sound'} · {secs(it.dur)}</div>
            <div className="ax-snd-from" dir="auto">{it.about || it.series.join(' · ')}</div>
          </div>))}
      </div>}
      {pics.length > 0 && <div className="ax-grid">
        {pics.map((it) => (
          <div key={it.id} className={`ax-card ${it.kind}`} onClick={() => setOpen(it)} title="Open it big">
            <div className="ax-thumb">{it.kind === 'video' ? <video src={src(it)} muted preload="metadata" /> : <img src={src(it)} loading="lazy" alt="" />}</div>
            <div className="ax-card-name" dir="auto">{it.labels[0] || it.name}</div>
            <div className="ax-card-meta" dir="auto">{it.about || `${it.kind} · ${it.series.join(' · ')}`}</div>
          </div>))}
      </div>}
      {open && <Big it={open} onClose={() => setOpen(null)} onTags={(t) => setTags(open, t)} />}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Assets />);
