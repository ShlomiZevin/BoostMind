// A quick check of one character's answer (the chain, techietech-api/wiki-deep.js) to a few messages - local, the design key.
//   node scripts/wiki/knows_test.mjs <character-id> "message 1" ["message 2" ...] [--speech "replace the sheet's speech for this run"]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const req = createRequire(path.join(ROOT, 'techietech-api', 'index.js'));
req('firebase-admin').initializeApp({ projectId: 'boostmind-b052c' });
const wiki = req('./wiki.js'), deep = req('./wiki-deep.js');
const args = process.argv.slice(2), si = args.indexOf('--speech');
const speech = si >= 0 ? args.splice(si, 2)[1] : null;
const [id, ...msgs] = args;
const key = (fs.readFileSync(path.join(ROOT, 'scripts', 'design.env'), 'utf8').match(/^OPENAI_API_KEY=(.+)$/m) || [])[1].trim().replace(/^["']|["']$/g, '');
const cur = await wiki._canon();
if (speech) cur.byId[id].sheet = { ...cur.byId[id].sheet, speech };
let turns = [], convo = {}, total = 0;
for (const m of msgs) {
  turns.push({ role: 'user', content: m });
  const r = await deep.reply({ key, cur, mode: id, turns, convo });
  convo = r.convo; total += r.cost; turns.push({ role: 'assistant', content: r.text });
  const knows = r.steps.find((s) => s.step === 'understand')?.out?.knows;
  console.log(`> ${m}\n[knows: ${JSON.stringify(knows)}]\n${r.text}\n(${(r.first / 1000).toFixed(1)} s, ${(r.cost * 100).toFixed(2)}c)\n`);
}
console.log(`total ${(total * 100).toFixed(2)}c`);
process.exit(0);
