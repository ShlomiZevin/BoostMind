// Put a sound setup (render/src/layers/setups.js + his saved ones) on a row or one clip of a project, through the
// running studio (an op - undoable, live in his editor, marked "set by a session" in the panel).
//   node tools/setup_apply.mjs <project> <layer> <setup>            the whole row
//   node tools/setup_apply.mjs <project> <layer> <item> <setup>     one clip (it wins over its row)
//   node tools/setup_apply.mjs --list                               every setup (id - label - what it's for)
// <setup> = an id (podcast) or a label ("Synagogue hall"). ZC_PORT = the studio's port (4747).
import { allSetups, setupOps } from '../render/src/layers/setups.js';

const base = `http://localhost:${process.env.ZC_PORT || 4747}`;
const saved = await fetch(`${base}/api/setups`).then((r) => r.json()).then((j) => j.setups || []).catch(() => []);
const list = allSetups(saved);
const a = process.argv.slice(2);
if (a[0] === '--list' || !a.length) {
  for (const s of list) console.log(`${s.id.padEnd(14)} ${s.label.padEnd(28)} ${s.about || ''}`);
  process.exit(0);
}
if (a.length < 3) { console.error('usage: node tools/setup_apply.mjs <project> <layer> [item] <setup>'); process.exit(1); }
const [id, layerId] = a, itemId = a.length > 3 ? a[2] : null, want = a[a.length - 1].toLowerCase();
const s = list.find((x) => x.id.toLowerCase() === want || x.label.toLowerCase() === want);
if (!s) { console.error(`no setup "${want}" - node tools/setup_apply.mjs --list`); process.exit(1); }
const pj = await fetch(`${base}/api/p/${encodeURIComponent(id)}`).then((r) => r.json());
const layer = pj.project?.layers?.find((l) => l.id === layerId);
if (!layer) { console.error(`no layer "${layerId}" in ${id}`); process.exit(1); }
if (itemId && !layer.items?.some((i) => i.id === itemId)) { console.error(`no clip "${itemId}" on ${layerId}`); process.exit(1); }
const r = await fetch(`${base}/api/p/${encodeURIComponent(id)}/ops`, { method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ ops: setupOps(layer, itemId, s, 'session'), by: 'session' }) }).then((x) => x.json());
if (!r.ok) { console.error('failed:', r.error, r.problems || ''); process.exit(1); }
console.log(`${s.label} on ${layerId}${itemId ? ` / ${itemId}` : ' (whole row)'} - rev ${r.rev}`);
