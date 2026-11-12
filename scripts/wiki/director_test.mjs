// The chain with the director (techietech-api/wiki-deep.js) on the conversations he commented on (Backstage → שיחות, 2026-11-12):
// each answer, the director's plan, the steps, the time and the cost - next to the answer that got his comment. Nothing live.
//   node scripts/wiki/director_test.mjs --brain brain.json --out report.md [--only demokratovich] [--budget=0.4] [--sonnet]
// --brain: the live brain (gcloud storage cp gs://shlomiverse-private/wiki-brain.json brain.json) - no Google login needed.
// Keys from scripts/design.env (OPENAI_API_KEY; ANTHROPIC_API_KEY for --sonnet) - a session's test counts as the verse's.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const req = createRequire(path.join(ROOT, 'techietech-api', 'index.js'));
const wiki = req('./wiki.js'), deep = req('./wiki-deep.js');
const args = process.argv.slice(2), opt = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
const cap = Number((args.find((a) => a.startsWith('--budget=')) || '').slice(9)) || 0.4;
const envf = fs.readFileSync(path.join(ROOT, 'scripts', 'design.env'), 'utf8');
const env = (k) => (envf.match(new RegExp(`^${k}=(.+)$`, 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const key = env('OPENAI_API_KEY'), akey = args.includes('--sonnet') ? env('ANTHROPIC_API_KEY') : null;
if (args.includes('--sonnet') && !akey) { console.error('--sonnet needs ANTHROPIC_API_KEY in scripts/design.env'); process.exit(1); }
const cur = wiki._fromBrain(JSON.parse(fs.readFileSync(opt('brain'), 'utf8')), 'test');

// his comments, word for word, with the conversation as the visitor wrote it
const TALKS = [
  { mode: 'demokratovich', turns: [
    ['אני הולך לשבוע בסאבלט בתל אביב. האם לבשל אוכל בעצמי או לקחת קופסאות מההורים?', 'זה לא קשור לדמוקרטיה. זה מאולץ ממש'],
    ['אם אני מעוניין לחזור בשבת בבוקר לבקר, לעשות מצוות כיבוד הורים, האם מותר בשביל זה לחלל שבת ולנסוע אליהם באוטו?', 'הוא לא דתי ולא מאמין בדת הוא אמין רק בדמוקרטיה'],
    ['ואם משפחתי הצביעה בבחירות לימין - מהליכוד ועד לסמוטריץ לא עלינו - האם עדיין עליי לקיים מצוות כיבוד הורים?', 'הוא קיצוני פנאט ממש לא יתמוך במשפחה שמצביעה אחרת'],
    ['תן לי שיעור יומי', 'המצחיקות שלו שהוא קיצוני באמתלא של פילפול וזה לא בא לידי ביטוי כאן']] },
  { mode: 'demokratovich', turns: [['מה דין פתק שנפל?', ''], ['הצבעתי עוצמה יהודית', 'גרוע מאוד. הוא קיצוני לא מקבל דעות של אחר']] },
  { mode: 'dor-eckstein', turns: [['איך עושים כסף', 'לא אמור להתחיל כל שיחה בהדרכה קצרה; מבין בכסף, עניין תפיסתי, אלפא'], ['מה יש במערכת הלמבית שלנו', '']] },
  { mode: 'yotam', turns: [['@יותם אפשר לדבר?', 'למה קפץ ישר לג׳אז. מאולץ ומוזר'], ['מה דעתך על הארי פוטר?', '']] },
  { mode: 'daniel', turns: [['מה ניסית להגיד?', 'איך עבר מתשובה לסרטון להודעה לשלומי']] },
  { mode: 'gilad', turns: [['איפה ה-IP?', 'למה הביא סרטון ולמה שלח לארכיון']] },
];
const only = opt('only');
const contact = [wiki._contact.CONTACT_TOURIST, wiki._contact.CONTACT_CHAR].join('\n\n');   // as a guest sees it live
const out = [`# The director test · ${akey ? 'Sonnet directs' : 'Terra directs'} · ${new Date().toISOString().slice(0, 16)}`, ''];
let spent = 0;
for (const T of TALKS) {
  if (only && T.mode !== only) continue;
  const c = cur.byId[T.mode];
  if (!c?.sheet?.person) { out.push(`(${T.mode}: no page in the brain - skipped)`, ''); continue; }
  out.push(`## ${c.name}`, '');
  const turns = []; let convo = {};
  for (const [q, his] of T.turns) {
    if (spent > cap) { out.push(`(stopped - spent $${spent.toFixed(3)} > $${cap})`); break; }
    turns.push({ role: 'user', content: q });
    const r = await deep.reply({ key, akey, cur, mode: T.mode, turns, convo, contact });
    spent += r.cost; convo = r.convo;
    turns.push({ role: 'assistant', content: r.text });
    out.push(`**VISITOR:** ${q}`, '', `**${c.name}:** ${r.text}`, '');
    if (his) out.push(`> his comment on the old answer: ${his}`, '');
    out.push(`plan: kind=${r.plan.kind} · stance: ${r.plan.stance} · joke: ${r.plan.joke || "-"} · move: ${r.plan.move || "-"} · avoid: ${r.plan.avoid || '-'} · knows: ${r.plan.knows?.level || '-'}`,
      `steps: ${r.steps.map((s) => `${s.step} ${s.model} ${(s.ms / 1000).toFixed(1)}s`).join(' · ')} · first word ${(r.first / 1000).toFixed(1)}s · $${r.cost.toFixed(4)}`, '');
    console.log(T.mode, (r.first / 1000).toFixed(1) + 's', '$' + r.cost.toFixed(4));
  }
}
out.push(`Total: $${spent.toFixed(3)}`);
fs.writeFileSync(opt('out'), out.join('\n'), 'utf8');
console.log('written', opt('out'), '$' + spent.toFixed(3));
