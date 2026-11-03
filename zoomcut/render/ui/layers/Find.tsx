// Search the video's words (his ask, 2026-11-03: "enable search - it will find the word and place me on it"): the
// captions and the on-screen texts. Type a word - every place it is said / shown, in time order; Enter = the next one
// (Shift+Enter back), a click = that one. Going to one picks its caption and puts the playhead on the word itself
// (its place inside the caption, by its letters). Ctrl+F from anywhere in the editor.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fmtT } from './api';

type Hit = { layer: string; item: string; at: number; text: string; i: number; kind: string };
const norm = (s: string) => s.replace(/[֑-ׇ]/g, '').toLowerCase();  // (Hebrew vowel marks don't count)

export function Find({ project, fps, onGo }: { project: any; fps: number; onGo: (h: Hit) => void }) {
  const [q, setQ] = useState('');
  const [cur, setCur] = useState(-1);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLInputElement>(null);
  const hits = useMemo(() => {
    const w = norm(q.trim());
    if (!w) return [] as Hit[];
    const out: Hit[] = [];
    for (const l of project.layers) {
      if (l.kind !== 'subtitles' && l.kind !== 'text') continue;
      for (const it of l.items || []) {
        const t = String(it.text ?? ''), n = norm(t);
        for (let i = n.indexOf(w); i >= 0; i = n.indexOf(w, i + w.length))
          out.push({ layer: l.id, item: it.id, at: Math.round(it.from + (it.dur * i) / Math.max(1, n.length)), text: t, i, kind: l.kind === 'subtitles' ? 'Caption' : 'Text' });
      }
    }
    return out.sort((a, b) => a.at - b.at);
  }, [q, project.layers]);
  useEffect(() => { setCur(-1); }, [q]);
  useEffect(() => {  // Ctrl+F = the search box
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); box.current?.focus(); box.current?.select(); } };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);
  const go = (n: number) => { if (!hits.length) return; const j = (n + hits.length) % hits.length; setCur(j); onGo(hits[j]); };
  const w = q.trim().length;
  return (
    <div className="find" onMouseDown={(e) => e.stopPropagation()}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
      <input ref={box} value={q} dir="auto" spellCheck={false} placeholder="Find a word  (Ctrl+F)" onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') { e.preventDefault(); go(e.shiftKey ? cur - 1 : cur + 1); setOpen(false); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); go(cur + 1); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); go(cur - 1); }
          else if (e.key === 'Escape') { e.preventDefault(); if (q) setQ(''); else box.current?.blur(); }
        }} />
      {w > 0 && <span className="find-n">{hits.length ? `${cur >= 0 ? cur + 1 : '–'}/${hits.length}` : 'none'}</span>}
      {w > 0 && hits.length > 0 && <>
        <button className="find-b" title="Previous (Shift+Enter)" onClick={() => go(cur - 1)}><svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 6.5 5 3.5l3 3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg></button>
        <button className="find-b" title="Next (Enter)" onClick={() => go(cur + 1)}><svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 3.5 5 6.5l3-3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg></button>
      </>}
      {open && w > 0 && hits.length > 0 && <div className="find-list">
        {hits.slice(0, 60).map((h, j) => (
          <button key={`${h.item}.${h.i}`} className={j === cur ? 'on' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => { go(j); setOpen(false); }}>
            <span className="find-t">{fmtT(h.at / fps)}</span>
            <span className="find-x" dir="auto">{h.text.slice(0, h.i)}<mark>{h.text.slice(h.i, h.i + w)}</mark>{h.text.slice(h.i + w)}</span>
            <span className="find-k">{h.kind}</span>
          </button>))}
      </div>}
    </div>
  );
}
