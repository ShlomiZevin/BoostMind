// His ideas for videos - a notebook he writes in (his ask, 2026-11-02: "an ideas panel, I'll just write ideas"),
// shown on the studio's Ideas page (ui/ideas.tsx), in the left rail. One file: zoomcut/ideas/ideas.json - git-ignored,
// the repo is public and these are jokes he hasn't filmed yet.
//   GET  /api/ideas              every idea, newest first
//   POST /api/ideas              {id?, title, text} - a new one (no id) or an edit; answers with the list
//   POST /api/ideas/:id/done     {done} - "I did it already" (a time in `done`), or taken off; answers with the list
//   POST /api/ideas/:id/delete   removes one; answers with the list
import fs from 'node:fs';
import path from 'node:path';

export default function ideas(app, { ROOT }) {
  const FILE = path.join(ROOT, 'ideas', 'ideas.json');
  // (deleted: a note of each idea he deleted - so the studio online's merge with another computer doesn't bring it back)
  const file = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } };
  const read = () => file().ideas || [];
  const write = (list, deleted = file().deleted || []) => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify({ ideas: list, deleted }, null, 2)); };
  const sorted = (list) => [...list].sort((a, b) => b.created - a.created);

  app.get('/api/ideas', (_q, res) => res.json(sorted(read())));
  app.post('/api/ideas', (q, res) => {
    const list = read(), b = q.body || {}, now = Date.now();
    const title = String(b.title ?? '').slice(0, 300), text = String(b.text ?? '').slice(0, 20000);
    const cur = b.id && list.find((x) => x.id === b.id);
    if (cur) Object.assign(cur, { title, text, updated: now });
    else list.push({ id: `i${now.toString(36)}`, title, text, created: now, updated: now });
    write(list);
    res.json(sorted(list));
  });
  // {done: true} - he already made this video (the idea stays, marked, at the bottom); false takes the mark off
  app.post('/api/ideas/:id/done', (q, res) => {
    const list = read(), cur = list.find((x) => x.id === q.params.id);
    if (!cur) return res.status(404).json({ error: 'No such idea' });
    if (q.body?.done) cur.done = Date.now(); else delete cur.done;
    cur.updated = Date.now();
    write(list);
    res.json(sorted(list));
  });
  app.post('/api/ideas/:id/delete', (q, res) => {
    const list = read().filter((x) => x.id !== q.params.id);
    write(list, [...(file().deleted || []).filter((d) => d.id !== q.params.id), { id: q.params.id, at: Date.now() }]);
    res.json(sorted(list));
  });
}
