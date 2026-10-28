// Every video on the layers is marked "Use" in Media (his rule, 2026-10-28: he marked them by hand, a video in the
// video should say so by itself). Keeps his notes; never flips his "Don't use" - a used video he marked ✕ is listed
// for him instead. Through the studio's ops API with the rev (the studio must be running) - he presses F5 after.
//   node tools/mark_used.mjs <episode>            mark them
//   node tools/mark_used.mjs <episode> --dry      only say what it would mark
const base = 'http://127.0.0.1:4747';
const [ep] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dry = process.argv.includes('--dry');
if (!ep) { console.log('node tools/mark_used.mjs <episode> [--dry]'); process.exit(1); }

const view = await (await fetch(`${base}/api/p/${encodeURIComponent(ep)}`)).json();
const p = view.project;
if (!p) { console.log(`no layered project "${ep}"`); process.exit(1); }
const used = new Set();
for (const l of p.layers || []) {
  if (l.kind !== 'video') continue;
  for (const it of l.items || []) { const a = it.asset ?? l.props?.asset; if (a) used.add(a); }
}
const name = (id) => { const a = p.assets[id]; return a?.label || String(a?.src || id).split('/').pop(); };
const mark = [...used].filter((id) => p.assets[id]?.kind === 'video' && !p.assets[id].mark);
const skipped = [...used].filter((id) => p.assets[id]?.mark === 'skip');
console.log(`${ep}: ${used.size} videos on the layers - ${mark.length} to mark Use${skipped.length ? `, ${skipped.length} he marked Don't use but are in the video:` : ''}`);
for (const id of skipped) console.log(`   ✕ ${name(id)}${p.assets[id].note ? ` - his note: ${p.assets[id].note}` : ''}  (tell him)`);
if (!mark.length || dry) { for (const id of mark) console.log(`   would mark: ${name(id)}`); process.exit(0); }
const ops = mark.map((id) => ({ op: 'asset.add', id, asset: { ...p.assets[id], mark: 'use' } }));
const r = await fetch(`${base}/api/p/${encodeURIComponent(ep)}/ops`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rev: p.rev, ops }) });
const j = await r.json().catch(() => ({}));
console.log(r.ok ? `✓ marked ${mark.length}: ${mark.map(name).join(', ')} - tell him F5` : `✗ ${j.error || r.status}`);
process.exit(r.ok ? 0 : 1);
