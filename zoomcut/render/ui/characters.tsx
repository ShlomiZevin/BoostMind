// The Characters page - his multiverse: every recurring character, who they are, how they look and sound, how fast
// they talk (the Reader's measured pace, kept up to date by it), their website, their videos and their assets.
// "Copy brief for a session" puts the whole profile on the clipboard - to brief a session working on a character.
// Data: render/characters.mjs (zoomcut/characters/<id>/character.json). Opens in the studio's left rail.
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

type Ch = any;
const api = async (u: string, body?: any) => (await fetch(u, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined)).json();
const hashId = () => decodeURIComponent((location.hash.match(/^#c=(.+)$/) || [])[1] || '');
const isHe = (s: string) => /[֐-׿]/.test(s || '');
const dt = (ms?: number) => (ms ? new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

function Gallery({ data, open }: { data: { characters: Ch[]; worlds: any }; open: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [world, setWorld] = useState('');
  const worlds = useMemo(() => [...new Set(data.characters.map((c) => c.world).filter(Boolean))], [data]);
  const list = data.characters.filter((c) => (!world || c.world === world) && (!q || JSON.stringify([c.name, c.name_en, c.role, c.world, c.aka]).toLowerCase().includes(q.toLowerCase())));
  const add = async () => {
    const name = prompt('The new character\'s name (as in the scripts):');
    if (!name) return;
    const en = prompt('A short id in English letters (e.g. "yotam"):', '') || '';
    const id = en.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    if (!id) return;
    await api(`/api/characters/${id}`, { patch: { name, world: world || '', brief: '' } });
    open(id);
  };
  return <div className="cx">
    <div className="cx-top">
      <div><h1>Characters</h1><div className="sub">The multiverse · {data.characters.length} characters</div></div>
      <input className="field cx-search" placeholder="Search characters…" value={q} onChange={(e) => setQ(e.target.value)} />
    </div>
    <div className="cx-chips">
      <button className={`cx-chip ${!world ? 'on' : ''}`} onClick={() => setWorld('')}>All</button>
      {worlds.map((w) => <button key={w} className={`cx-chip ${world === w ? 'on' : ''} ${isHe(w) ? 'he' : ''}`} onClick={() => setWorld(w)}>{w}</button>)}
    </div>
    <div className="cx-grid">
      {list.map((c) => (
        <button key={c.id} className="cx-card" onClick={() => open(c.id)}>
          <div className="cx-ph" style={c.portrait_url ? { backgroundImage: `url("${c.portrait_url}")` } : undefined}>
            {!c.portrait_url && <div className="initial">{(c.name || c.id)[0]}</div>}
          </div>
          <div className="body">
            <div className={`nm ${isHe(c.name) ? 'he' : ''}`}>{c.name || c.id}</div>
            <div className={`rl ${isHe(c.role) ? 'he' : ''}`}>{c.role || ' '}</div>
            <div className="meta">
              <span className={`cx-world ${isHe(c.world) ? 'he' : ''}`}><i style={{ background: c.color || 'var(--faint)' }} />{c.world || '—'}</span>
              <span className="cx-count">{c.pace?.wpm ? `${c.pace.wpm} wpm · ` : ''}{c.video_count} video{c.video_count === 1 ? '' : 's'}</span>
            </div>
          </div>
        </button>))}
      <button className="cx-card cx-new" onClick={add}><span className="plus">+</span>New character</button>
    </div>
  </div>;
}

/** The profile as text, for a session that writes or edits for this character. */
function briefText(c: Ch) {
  const L = (t: string, v: any) => (v && (!Array.isArray(v) || v.length) ? `## ${t}\n${Array.isArray(v) ? v.map((x) => `- ${typeof x === 'string' ? x : JSON.stringify(x)}`).join('\n') : v}\n` : '');
  return [`# ${c.name}${c.name_en ? ` (${c.name_en})` : ''} - ${c.role || ''}`, c.world ? `World: ${c.world}` : '', '',
    L('Who', c.brief), L('Personality', c.personality), L('Catchphrases', c.catchphrases), L('Look', c.look),
    L('Voice', [c.voice?.preset && `preset: ${c.voice.preset}`, c.voice?.notes].filter(Boolean).join(' - ')),
    L('Pace', c.pace?.wpm ? `${c.pace.wpm} words per minute (measured in the Reader${c.pace.script ? `, ${c.pace.script}` : ''})` : ''),
    L('Writing rules', c.writing_rules), L('Relations', (c.relations || []).map((r: any) => `${r.id}: ${r.relation}`)),
    L('Website', c.site?.url ? `${c.site.url}${c.site.notes ? ` - ${c.site.notes}` : ''}` : ''), L('Videos', (c.videos || []).map((v: any) => `${v.title} (${v.id})`)),
  ].filter(Boolean).join('\n');
}

function Profile({ id, all, back, open, reload }: { id: string; all: Ch[]; back: () => void; open: (id: string) => void; reload: () => void }) {
  const [c, setC] = useState<Ch | null>(null);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<any>({});
  const [toast, setToast] = useState('');
  const load = () => api(`/api/characters/${id}`).then(setC);
  // the pace follows the Reader: read again when this page comes back into view, and every 10 s while it is shown
  useEffect(() => { load(); const t = setInterval(() => { if (!document.hidden) load(); }, 10000); const f = () => load(); addEventListener('focus', f);
    return () => { clearInterval(t); removeEventListener('focus', f); }; }, [id]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 2200); return () => clearTimeout(t); } }, [toast]);
  if (!c) return <div className="cx"><div className="cp-note">Loading…</div></div>;
  const save = async (patch: any) => { const r = await api(`/api/characters/${id}`, { patch }); if (r.ok) { await load(); reload(); setToast('Saved'); } };
  const startEdit = () => { setDraft({ name: c.name || '', role: c.role || '', world: c.world || '', brief: c.brief || '', look: c.look || '',
    personality: (c.personality || []).join(', '), catchphrases: (c.catchphrases || []).join('\n'), writing_rules: (c.writing_rules || []).join('\n'),
    voice_preset: c.voice?.preset || '', voice_notes: c.voice?.notes || '', site: c.site?.url || '', color: c.color || '#ff6b57' }); setEdit(true); };
  const commit = async () => {
    const d = draft, lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
    await save({ name: d.name, role: d.role, world: d.world, brief: d.brief, look: d.look, color: d.color,
      personality: d.personality.split(',').map((x: string) => x.trim()).filter(Boolean), catchphrases: lines(d.catchphrases), writing_rules: lines(d.writing_rules),
      voice: { ...(c.voice || {}), preset: d.voice_preset, notes: d.voice_notes }, site: { ...(c.site || {}), url: d.site } });
    setEdit(false);
  };
  const F = (k: string, ta = false) => (ta ? <textarea className={isHe(draft[k]) ? 'he' : ''} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
    : <input className={isHe(draft[k]) ? 'he' : ''} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />);
  const copy = async () => { try { await navigator.clipboard.writeText(briefText(c)); setToast('The brief is on the clipboard'); } catch { setToast('Could not copy'); } };
  const openVideo = (ep: string) => { try { sessionStorage.setItem('zc-ep', ep); localStorage.setItem('zc-ep', ep); } catch {} if (parent !== window) parent.location.hash = 'video'; else location.href = '/'; };
  const groups: [string, string][] = [['portraits', 'Portraits'], ['backgrounds', 'Backgrounds'], ['logos', 'Logos'], ['other', 'Other']];
  const he = isHe(c.name);
  return <div className="cx">
    <div className="cp-crumb"><a onClick={back}>Characters</a><span>›</span><span>{c.name}</span></div>
    <div className="cp">
      <div className="cp-left">
        <div className="cp-portrait" style={c.portrait_url ? { backgroundImage: `url("${c.portrait_url}")` } : undefined} />
        {edit ? <div className="cp-edit" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{F('name')}{F('role')}{F('world')}
          <label className="cp-note">Colour <input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} style={{ width: 40, height: 26, padding: 0 }} /></label></div>
          : <>
            <div className={`cp-name ${he ? 'he' : ''}`}>{c.name}</div>
            {c.name_en && <div className="cp-note">{c.name_en}{c.aka?.length ? ` · ${c.aka.join(' · ')}` : ''}</div>}
            <div className={`cp-role ${isHe(c.role) ? 'he' : ''}`}>{c.role}</div>
            <div className="cp-row"><span className={`cx-world ${isHe(c.world) ? 'he' : ''}`}><i style={{ background: c.color || 'var(--faint)' }} />{c.world || '—'}</span></div>
          </>}
        <button className="cp-btn primary" onClick={copy}>Copy brief for a session</button>
        {c.site?.url && <a className="cp-btn" href={c.site.url} target="_blank" rel="noreferrer">Open {he ? 'the' : 'their'} website ↗</a>}
        {edit ? <div className="cp-row"><button className="cp-btn primary" style={{ flex: 1 }} onClick={commit}>Save</button><button className="cp-btn" style={{ flex: 1 }} onClick={() => setEdit(false)}>Cancel</button></div>
          : <button className="cp-btn" onClick={startEdit}>Edit profile</button>}
      </div>
      <div className="cp-right">
        <div className="cp-sec w2"><h3>Who {he ? '' : 'they are'}</h3>{edit ? <div className="cp-edit">{F('brief', true)}</div> : <div className={`cp-text ${isHe(c.brief) ? 'he' : ''}`}>{c.brief || '—'}</div>}</div>
        <div className="cp-sec"><h3>Pace <span className="end">from the Reader</span></h3>
          {c.pace?.wpm ? <><div className="cp-pace">{c.pace.wpm}<small>words / min</small></div>
            <div className="cp-note">Measured {dt(c.pace.at)}{c.pace.script ? ` · ${c.pace.script}` : ''}. Measure again in the Reader (⏱ next to the name) - it updates here by itself.</div></>
            : <div className="cp-note">Not measured yet. In the Reader, press ⏱ next to {he ? 'the' : 'their'} name on a script - it shows here by itself.</div>}
        </div>
        <div className="cp-sec"><h3>Personality</h3>{edit ? <div className="cp-edit">{F('personality', true)}<div className="cp-note">comma separated</div></div>
          : <div className="cp-pills">{(c.personality || []).map((p: string, i: number) => <span key={i} className={`cp-pill ${isHe(p) ? 'he' : ''}`}>{p}</span>)}{!(c.personality || []).length && <span className="cp-note">—</span>}</div>}</div>
        <div className="cp-sec"><h3>Catchphrases</h3>{edit ? <div className="cp-edit">{F('catchphrases', true)}<div className="cp-note">one per line</div></div>
          : (c.catchphrases || []).length ? (c.catchphrases || []).map((q: string, i: number) => <div key={i} className={`cp-quote ${isHe(q) ? 'he' : ''}`}>“{q}”</div>) : <div className="cp-note">—</div>}</div>
        <div className="cp-sec"><h3>Look and voice</h3>{edit ? <div className="cp-edit" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{F('look', true)}{F('voice_preset')}{F('voice_notes')}</div>
          : <div className="cp-kv"><b>Look</b><span className={isHe(c.look) ? 'he' : ''}>{c.look || '—'}</span><b>Voice preset</b><span>{c.voice?.preset || '—'}</span>
            {c.voice?.notes && <><b>Voice</b><span className={isHe(c.voice.notes) ? 'he' : ''}>{c.voice.notes}</span></>}</div>}</div>
        <div className="cp-sec w2"><h3>Writing rules</h3>{edit ? <div className="cp-edit">{F('writing_rules', true)}<div className="cp-note">one per line</div></div>
          : (c.writing_rules || []).length ? <ul style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.6 }}>{c.writing_rules.map((r: string, i: number) => <li key={i} className={isHe(r) ? 'he' : ''}>{r}</li>)}</ul> : <div className="cp-note">—</div>}</div>
        <div className="cp-sec"><h3>Website</h3>{edit ? <div className="cp-edit">{F('site')}</div>
          : c.site?.url ? <><a className="cp-site" href={c.site.url} target="_blank" rel="noreferrer"><iframe src={c.site.url} loading="lazy" tabIndex={-1} title="site" /></a>
            <div className="cp-url"><a href={c.site.url} target="_blank" rel="noreferrer">{c.site.url}</a><span>↗</span></div>
            {c.site.notes && <div className={`cp-note ${isHe(c.site.notes) ? 'he' : ''}`} style={{ marginTop: 6 }}>{c.site.notes}</div>}</>
            : <div className="cp-note">No website yet - every character is a real person with a site of their own.</div>}
          {(c.links || []).map((l: any, i: number) => <div key={i} className="cp-url"><a href={l.url} target="_blank" rel="noreferrer">{l.label || l.url}</a></div>)}</div>
        <div className="cp-sec w3"><h3>Videos <span className="end">{(c.videos || []).length}</span></h3>
          {(c.videos || []).length ? <div className="cp-vids">{c.videos.map((v: any) => (
            <div key={v.id} className="cp-vid" onClick={() => openVideo(v.id)} title="Open in the editor">
              <div className="th">{v.video ? <video src={`${v.video}#t=1`} preload="metadata" muted /> : 'no export yet'}</div>
              <div className={`tt ${isHe(v.title) ? 'he' : ''}`}>{v.title}</div><div className="st">{v.done ? 'done' : 'in progress'} · {v.id}</div>
            </div>))}</div> : <div className="cp-note">No video yet. A video's characters are listed in its project (`characters`) - the builders fill it.</div>}</div>
        <div className="cp-sec w3"><h3>Assets <span className="end">click a picture to make it the portrait</span></h3>
          {groups.map(([k, label]) => (c.asset_urls?.[k] || []).length ? <div key={k} style={{ marginBottom: 12 }}>
            <div className="cp-note" style={{ marginBottom: 6 }}>{label}</div>
            <div className="cp-assets">{c.asset_urls[k].map((a: any) => (
              <div key={a.path} className={`cp-asset ${c.portrait_url === a.url ? 'sel' : ''}`} onClick={() => k !== 'sounds' && save({ portrait: a.path })} title={a.path}>
                <div className="im" style={{ backgroundImage: `url("${a.url}")` }} /><div className="an">{a.name}</div></div>))}</div></div> : null)}
          {(c.asset_urls?.sounds || []).map((a: any) => <div key={a.path} className="cp-url"><span>{a.name}</span><audio src={a.url} controls preload="none" style={{ height: 28 }} /></div>)}
          {!Object.values(c.asset_urls || {}).some((l: any) => l.length) && <div className="cp-note">No assets yet.</div>}</div>
        {(c.relations || []).length > 0 && <div className="cp-sec w3"><h3>Relations</h3><div className="cp-rel">
          {c.relations.map((r: any, i: number) => { const o = all.find((x) => x.id === r.id);
            return <div key={i} className="cp-relp" onClick={() => o && open(o.id)}><div className="av" style={o?.portrait_url ? { backgroundImage: `url("${o.portrait_url}")` } : undefined} />
              <div><div className={`rn ${isHe(o?.name) ? 'he' : ''}`}>{o?.name || r.id}</div><div className={`rr ${isHe(r.relation) ? 'he' : ''}`}>{r.relation}</div></div></div>; })}</div></div>}
      </div>
    </div>
    {toast && <div className="cp-toast">{toast}</div>}
  </div>;
}

function App() {
  const [data, setData] = useState<{ characters: Ch[]; worlds: any } | null>(null);
  const [id, setId] = useState(hashId());
  const reload = () => api('/api/characters').then(setData).catch(() => setData({ characters: [], worlds: {} }));
  useEffect(() => { reload(); const f = () => setId(hashId()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  const open = (x: string) => { location.hash = `c=${encodeURIComponent(x)}`; scrollTo(0, 0); };
  if (!data) return <div className="cx"><div className="cp-note">Loading the multiverse…</div></div>;
  return id ? <Profile id={id} all={data.characters} back={() => { location.hash = ''; }} open={open} reload={reload} /> : <Gallery data={data} open={open} />;
}
createRoot(document.getElementById('root')!).render(<App />);
