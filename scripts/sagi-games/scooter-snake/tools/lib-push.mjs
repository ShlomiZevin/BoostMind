// push this game's library items (or all ids given) to the studio's cloud library: node lib-push.mjs [project]
import fs from 'node:fs'; import path from 'node:path';
const Z = path.resolve(path.dirname(new URL(import.meta.url).pathname.slice(1)), '../../../../zoomcut');
import { pathToFileURL, fileURLToPath } from 'node:url'; const store = await import(pathToFileURL(path.join(Z, 'render/cloud/store.mjs')).href);
const ix = JSON.parse(fs.readFileSync(path.join(Z, 'library/index.json'), 'utf8'));
const proj = process.argv[2] || 'game-scooter-snake';
const mine = ix.items.filter((x) => (x.from || []).includes(proj));
const order = mine.sort((a, b) => (a.kind === 'music' ? -1 : 0) - (b.kind === 'music' ? -1 : 0));
for (const it of order) { await store.upload(path.join(Z, 'library', it.file), 'library/' + it.file); console.log('up', it.file); }
for (let k = 0; k < 3; k++) {
  const c = await store.getJson('library/index.json');
  const by = new Map((c?.v.items || []).map((x) => [x.id, x]));
  for (const it of order) by.set(it.id, { ...(by.get(it.id) || {}), ...it });
  if (await store.putJson('library/index.json', { items: [...by.values()], at: Date.now() }, c ? c.gen : '0')) { console.log('index ok', order.length, 'items, cloud has', by.size); break; }
}
