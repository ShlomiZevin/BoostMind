// The Ideas page - his notebook of video ideas (his ask, 2026-11-02): write a title and the idea, it saves as he
// types; newest first. Data: render/ideas.mjs (zoomcut/ideas/ideas.json, git-ignored). Opens in the studio's left rail.
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

type Idea = { id: string; title: string; text: string; created: number; updated: number };
const api = async (u: string, body?: any) => (await fetch(u, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined)).json();
const dt = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function Card({ idea, autoFocus, onDelete }: { idea: Idea; autoFocus: boolean; onDelete: () => void }) {
  const [title, setTitle] = useState(idea.title);
  const [text, setText] = useState(idea.text);
  const [saved, setSaved] = useState<'' | 'saving' | 'saved'>('');
  const [sure, setSure] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const first = useRef(true);
  // the text box grows with the idea (no inner scroll)
  useEffect(() => { const a = area.current; if (a) { a.style.height = 'auto'; a.style.height = a.scrollHeight + 'px'; } }, [text]);
  // saved as he types (a short pause after the last key)
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSaved('saving');
    const t = setTimeout(async () => { await api('/api/ideas', { id: idea.id, title, text }); setSaved('saved'); }, 600);
    return () => clearTimeout(t);
  }, [title, text]);
  useEffect(() => { if (!sure) return; const t = setTimeout(() => setSure(false), 3000); return () => clearTimeout(t); }, [sure]);
  return (
    <div className="ix-card">
      <input className="ix-title" dir="auto" value={title} placeholder="Title" autoFocus={autoFocus} onChange={(e) => setTitle(e.target.value)} />
      <textarea ref={area} className="ix-text" dir="auto" rows={1} value={text} placeholder="The idea…" onChange={(e) => setText(e.target.value)} />
      <div className="ix-foot">
        <span>{dt(idea.created)}</span>
        {saved && <span className={saved === 'saved' ? 'ix-saved' : ''}>{saved === 'saved' ? '✓ saved' : 'saving…'}</span>}
        <span className="grow" />
        <button className={`ix-del ${sure ? 'sure' : ''}`} onClick={() => (sure ? onDelete() : setSure(true))}>{sure ? 'Delete it?' : 'Delete'}</button>
      </div>
    </div>
  );
}

function Ideas() {
  const [list, setList] = useState<Idea[] | null>(null);
  const [fresh, setFresh] = useState('');  // the idea just added (its title gets the cursor)
  useEffect(() => { api('/api/ideas').then(setList); }, []);
  const add = async () => { const l: Idea[] = await api('/api/ideas', { title: '', text: '' }); setFresh(l[0]?.id || ''); setList(l); };
  const del = async (id: string) => setList(await api(`/api/ideas/${id}/delete`, {}));
  return (
    <div className="ix">
      <div className="ix-top">
        <div><h1>Ideas</h1><div className="sub">{list ? `${list.length} idea${list.length === 1 ? '' : 's'} for videos` : ''}</div></div>
        <button className="btn primary" onClick={add}>+ New idea</button>
      </div>
      <div className="ix-list">
        {list?.map((i) => <Card key={i.id} idea={i} autoFocus={i.id === fresh} onDelete={() => del(i.id)} />)}
        {list && !list.length && <div className="ix-empty">No ideas yet - "+ New idea" and write.</div>}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Ideas />);
