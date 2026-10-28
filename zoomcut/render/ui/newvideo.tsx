import React, { useEffect, useState } from 'react';
import { api, tabProject } from './common';

// "New video": a template, the footage folder, optionally an earlier project's settings - then it opens
// the iPhone's way in: scan the QR once, drop videos on the phone page - they come down to Downloads\drop\<folder>
// by themselves and show in the footage list; a project marked Done empties its folder in the cloud
export function DropCard() {
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

export function NewVideo() {
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
