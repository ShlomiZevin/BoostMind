// Hebrew needs the character's gender for "מקליד / מקלידה" and "הצטרף / הצטרפה" (Shlomi: "more realistic"). The canon
// has no gender field yet, so Terra reads each character (name, role, bio) once: m / f / p (p = plural, e.g. a company).
//   node scripts/v2-design/genders.mjs   ->  v2/site/verse/genders.json   (re-run after new characters; keeps known ones)
import fs from 'node:fs';
const envKey = (file, name) => { try { return fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, ''); } catch { return undefined; } };
const KEY = envKey('C:/workspace/BoostMind/zoomcut/.env', 'OPENAI_API_KEY') || envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
const OUT = 'C:/workspace/BoostMind/v2/site/verse/genders.json';
const W = JSON.parse(fs.readFileSync('C:/workspace/BoostMind/public/wiki/data/wiki.json', 'utf8'));
const known = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const todo = W.characters.filter((c) => !known[c.id]);
if (!todo.length) { console.log('nothing new'); process.exit(0); }
const list = todo.map((c) => `${c.id} | ${c.name} | ${c.role || ''} | ${(c.bio || '').slice(0, 220)}`).join('\n');
const res = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
  body: JSON.stringify({ model: 'gpt-5.6-terra', reasoning: { effort: 'low' }, store: false, max_output_tokens: 4000, text: { format: { type: 'json_object' } },
    instructions: 'For each Hebrew comedy character below (id | name | role | bio), decide the grammatical gender Hebrew uses for them: "m" (masculine), "f" (feminine), or "p" (plural - a company, a group, or a role like "מגיש/ת" that is written for both). Read the Hebrew verb and noun forms in the role and bio. Return JSON {"<id>": "m"|"f"|"p", ...} for every id.',
    input: `Characters:\n${list}\n\nReturn the JSON.` }),
});
const j = await res.json();
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1); }
const text = (j.output || []).flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('');
const got = JSON.parse(text);
const merged = { ...known };
for (const c of todo) if (['m', 'f', 'p'].includes(got[c.id])) merged[c.id] = got[c.id];
fs.writeFileSync(OUT, JSON.stringify(merged, null, 1));
console.log('ok', Object.keys(merged).length, 'of', W.characters.length);
