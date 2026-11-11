// The characters' chain (techietech-api/wiki-deep.js) against today's chat, on the same conversations: each answer's text,
// the time to its first word, the time of every step and what it cost. Writes a report (Hebrew - read it with the Read tool).
//   node scripts/wiki/deep_test.mjs --out report.md [--only deep|today] [--budget=0.6]
// The design key (scripts/design.env) - a session's test counts as the verse's in Backstage → הוצאות.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const req = createRequire(path.join(ROOT, 'techietech-api', 'index.js'));
const admin = req('firebase-admin');
admin.initializeApp({ projectId: 'boostmind-b052c' });
const wiki = req('./wiki.js'), deep = req('./wiki-deep.js');
const args = process.argv.slice(2), opt = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
const cap = Number((args.find((a) => a.startsWith('--budget=')) || '').slice(9)) || 0.6;
const key = (fs.readFileSync(path.join(ROOT, 'scripts', 'design.env'), 'utf8').match(/^OPENAI_API_KEY=(.+)$/m) || [])[1].trim().replace(/^["']|["']$/g, '');

const TALKS = {
  hani: ['היי חני, מה נשמע?', 'שמעתי שאברהם משה עשה תאונה, מה קרה?', 'רגע, והילדים היו איתו באוטו?', 'יצא לך פעם לעלות על רכבת לכיוון ההפוך?', 'מה דעתך על AI שכותב קוד במקומך?'],
  vova: ['וובה, מה קורה?', 'אוסנת מארגנת האקתון, אתה בא?', 'מה קרה עם שירלי בסוף?', 'תמליץ לי על סדרה טובה', 'למה אתה תמיד כזה עצבני?'],
  rosenblum: ['שלום המורה', 'המורה, אפשר לצאת להפסקה?', 'מה אתה חושב על הדור של היום?', 'היה לך פעם תלמיד שבאמת הוציא אותך מדעתך?', 'למה אתה תמיד כותב שמות על הלוח?'],
};
const TERRA = deep.PRICE;
const costOf = (u) => ((u.input_tokens - (u.input_tokens_details?.cached_tokens || 0)) * TERRA.in + (u.input_tokens_details?.cached_tokens || 0) * TERRA.cached + u.output_tokens * TERRA.out) / 1e6;

const cur = await wiki._canon();
// sheets drafted but not yet in the records (scripts/characters/work) - the test reads them as if they were
for (const id of Object.keys(TALKS)) {
  const f = path.join(ROOT, 'scripts', 'characters', 'work', id + '.json');
  if (fs.existsSync(f) && cur.byId[id] && !cur.byId[id].sheet) { const d = JSON.parse(fs.readFileSync(f, 'utf8')); Object.assign(cur.byId[id], { sheet: d.sheet, life: d.life, love: d.love }); }
}
const out = ['# המוח המצחיק - מבחן', ''];
let spent = 0;
const only = opt('only');
for (const [mode, msgs] of Object.entries(TALKS)) {
  const c = cur.byId[mode];
  if (!c?.sheet?.person) { out.push(`(${mode}: no sheet in the brain yet - skipped)`); continue; }
  out.push(`## ${c.name}`, '');
  const runs = { today: [], deep: [] };
  let convo = {};
  for (const [i, m] of msgs.entries()) {
    if (spent >= cap) { out.push(`(stopped: the test reached $${cap})`); break; }
    out.push(`### ${i + 1}. "${m}"`, '');
    if (only !== 'deep') {   // today's chat - one call (two when it looks something up)
      const turns = [...runs.today, { role: 'user', content: m }];
      const t0 = Date.now(); let first = null, text = '';
      const u = await wiki._stream(key, mode, turns, (d) => { if (first == null) first = Date.now() - t0; text += d; }, {});   // returns the usage
      const usd = costOf({ input_tokens: 0, output_tokens: 0, ...(u || {}) }); spent += usd;
      runs.today.push({ role: 'user', content: m }, { role: 'assistant', content: text });
      out.push(`**היום** · מילה ראשונה ${((first || 0) / 1000).toFixed(1)} שנ' · סה"כ ${((Date.now() - t0) / 1000).toFixed(1)} שנ' · ${(usd * 100).toFixed(2)}¢`, '', text.trim(), '');
    }
    if (only !== 'today') {   // the chain
      const turns = [...runs.deep, { role: 'user', content: m }];
      const r = await deep.reply({ key, cur, mode, turns, convo });
      convo = r.convo; spent += r.cost;
      runs.deep.push({ role: 'user', content: m }, { role: 'assistant', content: r.text });
      out.push(`**השרשרת** · מילה ראשונה ${(r.first / 1000).toFixed(1)} שנ' · סה"כ ${(r.ms / 1000).toFixed(1)} שנ' · ${(r.cost * 100).toFixed(2)}¢ · ${r.steps.map((s) => `${s.step} ${(s.ms / 1000).toFixed(1)}s ${((s.cost || 0) * 100).toFixed(2)}¢`).join(' → ')}`, '', r.text.trim(), '');
      out.push('<details><summary>מה כל שלב חשב</summary>', '', ...r.steps.filter((s) => s.step !== 'talk').map((s) => `- ${s.step}: ${JSON.stringify(s.out)}`), '', '</details>', '');
    }
    console.log(mode, i + 1, `spent $${spent.toFixed(3)}`);
  }
}
out.push('', `סה"כ המבחן: $${spent.toFixed(2)}`);
fs.writeFileSync(opt('out') || 'deep-report.md', out.join('\n'), 'utf8');
console.log('done, $' + spent.toFixed(3));
process.exit(0);
