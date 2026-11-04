// Face swap - a BETA (his ask, 2026-11-03), in a video clip's own window (his rule: extra options open from the item, the
// panels stay as they are). Any picture's face on his take, the Snapchat way (tools/faceswap/quick.py): a job makes the
// swapped copy (pipeline/face_layers.py, action "faceswap"), then Your face / Swapped is a live switch on the layer
// (props.face - VideoTrack plays the copy, export_layers reads it), like eye contact.
// The face: a picture of this project, a character's portrait, one from the asset library, or a file from this computer -
// whatever is picked from outside comes into the project's Media first (the job reads project pictures only).
import React from 'react';
import { Note, Seg } from './inspect/controls';
import { upload } from './api';

type Src = 'project' | 'characters' | 'library';
type Pic = { key: string; url: string; name: string; add?: () => Promise<string> };  // add: bring it into the project -> its asset id

export function FaceSwap({ ep, project, layer, asset, urls, send, build, reload, onMade }: {
  ep: string; project: any; layer: any; asset: string; urls: Record<string, string>;
  send: (ops: any[], o?: any) => void; build: (action: string, args?: any) => Promise<void>; reload: () => Promise<any> | void; onMade: () => void;
}) {
  const a = project.assets?.[asset] || {};
  const made = !!a.face_src;
  const on = made && layer.props?.face !== false;
  const [image, setImage] = React.useState<string>(a.face_image || '');
  const [blend, setBlend] = React.useState<'a' | 'c'>(a.face_blend || 'a');
  const [src, setSrc] = React.useState<Src>('project');
  const [q, setQ] = React.useState('');
  const [busy, setBusy] = React.useState('');
  const [chars, setChars] = React.useState<Pic[] | null>(null);
  const [lib, setLib] = React.useState<Pic[] | null>(null);
  const file = React.useRef<HTMLInputElement>(null);
  const asFile = async (url: string, name: string) => {
    const b = await (await fetch(url)).blob();
    return new File([b], name, { type: b.type || 'image/jpeg' });
  };
  const bring = async (f: File) => { const r = await upload(ep, f); if (r.error) throw new Error(r.error); await reload(); return r.id as string; };
  React.useEffect(() => {
    if (src === 'characters' && !chars) fetch('/api/characters').then((r) => r.json()).then((j) => setChars((j.characters || [])
      .filter((c: any) => c.portrait_url).map((c: any) => ({ key: 'c:' + c.id, url: c.portrait_url, name: c.name || c.id,
        add: async () => bring(await asFile(c.portrait_url, `face-${c.id}.jpg`)) })))).catch(() => setChars([]));
    if (src === 'library' && !lib) fetch('/api/lib').then((r) => r.json()).then((j) => setLib((j.items || [])
      .filter((x: any) => x.kind === 'picture' || x.kind === 'background').map((x: any) => ({ key: 'l:' + x.id, url: `/lib/${x.file}`,
        name: [x.name, ...(x.tags || []), ...(x.labels || [])].join(' '),
        add: async () => { const r = await fetch(`/api/lib/${x.id}/add`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ep }) }).then((r) => r.json());
          if (r.error) throw new Error(r.error); await reload(); return r.id as string; } })))).catch(() => setLib([]));
  }, [src]);
  const mine: Pic[] = Object.entries(project.assets || {}).filter(([, x]: any) => x.kind === 'image')
    .map(([id, x]: any) => ({ key: id, url: urls[id], name: x.label || id }));
  const shown = (src === 'project' ? mine : src === 'characters' ? chars : lib) || [];
  const found = q.trim() ? shown.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())) : shown;
  const pick = async (p: Pic) => {
    if (!p.add) return setImage(p.key);
    setBusy('Adding the picture…');
    try { setImage(await p.add()); setSrc('project'); } catch (e: any) { alert(e.message); } finally { setBusy(''); }
  };
  const fromComputer = async (f?: File) => {
    if (!f) return;
    setBusy('Adding the picture…');
    try { setImage(await bring(f)); setSrc('project'); } catch (e: any) { alert(e.message); } finally { setBusy(''); }
  };
  const go = async () => {
    setBusy('Starting…');
    try { await build('faceswap', { image, assets: [asset], blend }); onMade(); } finally { setBusy(''); }
  };
  const secs = a.duration || 0;
  return <div className="vp-fs">
    <div className="vp-fs-h">Face swap <span className="vp-fs-beta">beta</span></div>
    {made && !urls[`${asset}:face`] && <Note warn>Made - restart the studio once (with nothing in Jobs) to see it here: the server learns the swapped copies on start.</Note>}
    {made && <>
      <Seg options={[[false, 'Your face'], [true, 'Swapped']]} value={on} onPick={(v) => send([{ op: 'layer.update', id: layer.id, props: { face: v ? null : false } }])} />
      <Note>Live, for the whole layer - the export uses the same choice. While the swapped face plays, eye contact is off.</Note>
    </>}
    <div className="vp-fs-l">{made ? 'Make it again with' : 'The face'} - one clear face, looking at the camera</div>
    <Seg<Src> options={[['project', 'This project'], ['characters', 'Characters'], ['library', 'Library']]} value={src} onPick={(v) => { setSrc(v); setQ(''); }} />
    {src === 'library' && <input className="field vp-fs-q" placeholder="Search the library…" value={q} onChange={(e) => setQ(e.target.value)} />}
    <div className="vp-fs-pics">
      {found.map((p) => <button key={p.key} className={`vp-fs-pic ${image === p.key ? 'on' : ''}`} title={p.name} disabled={!!busy} onClick={() => pick(p)}>
        <img src={p.url} alt="" loading="lazy" /></button>)}
      <button className="vp-fs-pic vp-fs-add" title="A picture from this computer" disabled={!!busy} onClick={() => file.current?.click()}>+</button>
      <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => fromComputer(e.target.files?.[0])} />
    </div>
    {src !== 'project' && !(src === 'characters' ? chars : lib) && <Note>Loading…</Note>}
    {src === 'project' && !mine.length && <Note>No picture in this project yet - take one from Characters or the Library, or + for a file from this computer.</Note>}
    <div className="vp-fs-l">Look</div>
    <Seg<'a' | 'c'> options={[['a', 'Takes your light'], ['c', 'Most blended']]} value={blend} onPick={setBlend} />
    <button className="btn primary vp-fs-go" disabled={!image || !!busy} onClick={go}>{busy || (made ? 'Make it again' : 'Make face swap')}</button>
    <Note>About {Math.max(1, Math.round((secs * 2.5) / 60))} min for {Math.round(secs)} s - it runs in Jobs, you can keep editing. Only the face
      changes: hair and head shape stay yours; your eyes and mouth stay yours, so every blink and word is real.</Note>
  </div>;
}
