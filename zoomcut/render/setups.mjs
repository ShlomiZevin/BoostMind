// His saved sound setups (src/layers/setups.js - the built-ins are in code): one file, episodes/_setups.json, the same
// on every computer (cloud/shared.mjs merges it with studio/setups.json - by id, the newer edit wins, a deleted one
// stays deleted).
//   GET  /api/setups              {setups: [...his saved ones]}
//   POST /api/setups              {setup: {id?, label, clean, voice, fx}} - a new one (no id) or an update (a built-in's
//                                 id = his version of it); answers with the list
//   POST /api/setups/:id/delete   removes his saved one (a built-in comes back as it was)
import fs from 'node:fs';
import path from 'node:path';

export const SETUPS_FILE = (EPS) => path.join(EPS, '_setups.json');

export default function setups(app, { EPS }) {
  const FILE = SETUPS_FILE(EPS);
  const file = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } };
  const write = (list, deleted) => fs.writeFileSync(FILE, JSON.stringify({ setups: list, deleted }, null, 2));
  app.get('/api/setups', (_q, res) => res.json({ setups: file().setups || [] }));
  app.post('/api/setups', (q, res) => {
    const f = file(), list = f.setups || [], b = q.body?.setup || {}, now = Date.now();
    const label = String(b.label || '').trim().slice(0, 60);
    if (!label) return res.status(400).json({ error: 'a setup needs a name' });
    const id = String(b.id || `my-${now.toString(36)}`).replace(/[^\w-]/g, '').slice(0, 40);
    const s = { id, label, about: String(b.about || 'Saved by you.').slice(0, 300), clean: b.clean, voice: b.voice || null, fx: b.fx || null, updated: now };
    write([...list.filter((x) => x.id !== id), s], (f.deleted || []).filter((d) => d.id !== id));
    res.json({ setups: file().setups, id });
  });
  app.post('/api/setups/:id/delete', (q, res) => {
    const f = file();
    write((f.setups || []).filter((x) => x.id !== q.params.id), [...(f.deleted || []).filter((d) => d.id !== q.params.id), { id: q.params.id, at: Date.now() }]);
    res.json({ setups: file().setups });
  });
}
