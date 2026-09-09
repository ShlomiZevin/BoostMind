/**
 * design-system-review.mjs
 *
 * Colour and type only — not layout, not copy. Three surfaces of the same
 * product currently carry three unrelated accents, and the question is
 * whether that is a system or an accident.
 *
 * Usage:
 *   node scripts/design-system-review.mjs
 *   node scripts/design-system-review.mjs --model gpt-5.6-terra
 *
 * Key source: aspect/aspect-agent-server/.env (MARKETING.md §4).
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : dflt;
};
const MODEL = arg('model', 'gpt-5.6-sol');
const OUT = arg('out', 'scripts/design-system.out.json');

const KEY_FILE = arg('env-file', 'C:/workspace/aspect/aspect-agent-server/.env');
const readEnvFile = (path) => {
  if (!path || !existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
};
const fileEnv = readEnvFile(KEY_FILE);
const KEY = fileEnv.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const ORG = fileEnv.OPENAI_ORG_ID || process.env.OPENAI_ORG_ID;
const PROJ = fileEnv.OPENAI_PROJECT_ID || process.env.OPENAI_PROJECT_ID;

const die = (m) => { console.error('✖ ' + m); process.exit(1); };
if (!KEY) die('OPENAI_API_KEY missing. Checked ' + KEY_FILE);

const headers = () => {
  const h = { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
  if (ORG) h['OpenAI-Organization'] = ORG;
  if (PROJ) h['OpenAI-Project'] = PROJ;
  return h;
};

const BRIEF = `
# מה אני מבקש
ביקורת על **פלטת הצבעים והטיפוגרפיה בלבד**. לא פריסה, לא ניסוחים, לא מבנה.
שלושה משטחים של אותו מוצר, וכל אחד מהם נושא היום צבע מבטא אחר.

# המוצר
״מסלול״ — אפליקציית טיולים בעברית (RTL), mobile-first, PWA. שלושה משטחים:

## 1. דף הבית הציבורי — boostart-trips.web.app
ספריית טיולים. הקהל: מטייל ישראלי במובייל.
פונט: **Heebo** (Google Fonts), משקלים 400–800.
כהה בלבד, אין מצב בהיר.
  --l-bg: #0A0C0F        רקע
  --l-card: #101318      כרטיס
  --l-raised: #141820    שכבה מוגבהת
  --l-line: #242A33      גבול
  --l-line-strong: #343C48
  --l-text: #F5F7FA
  --l-dim: #A7AFBA       טקסט משני
  --l-faint: #707A87     טקסט שלישוני
  --l-accent: #B8F34A    **ליים־ירוק זרחני**
  --l-accent-hi: #C8FF64
  --l-ink: #11150A       טקסט על גבי המבטא

## 2. דף המשקיע — boostart-trips.web.app/invest
עמוד יחיד, נשלח למשקיע אחד. פונט: **Heebo**, משקלים 400–900.
יש מצב כהה (ברירת מחדל) ומצב בהיר, עם כפתור החלפה.
כהה: bg #0d0f12 · surface #14171b · surface2 #1a1e23 · border #262b31 ·
     text #eef1f4 · muted #98a2ad · **accent #f0692e (כתום)** · accent-ink #150703
בהיר: bg #fbfaf8 · surface #ffffff · surface2 #f4f2ef · border #e4e0da ·
     text #16191c · muted #6b7480 · **accent #d9541c** · accent-ink #ffffff
בדף יש גם תצלומים במסך מלא עם כיסוי כהה אחיד (rgba(8,10,13,.68)) וטקסט לבן מעליהם.

## 3. האפליקציה עצמה
פונט: **Heebo**, אותם משקלים. כהה ובהיר.
**ברירות מחדל** (טיול שלא מגדיר צבעים משלו):
כהה: bg #0e0f11 · surface #17191c · surface2 #1f2226 · border rgba(255,255,255,.09) ·
     text #eceef1 · muted #8f97a3 · **accent #3b82f6 (כחול)** · accentInk #08131f ·
     sunset #fb7185 · good #34d399 · warn #f87171
בהיר: bg #f7f8fa · surface #ffffff · surface2 #eef1f5 · border rgba(20,30,45,.12) ·
     text #14181d · muted #5d6673 · **accent #1d4ed8** · accentInk #ffffff ·
     sunset #be123c · good #059669 · warn #dc2626

**חשוב:** לכל טיול מותר להגדיר פלטה משלו, וזה פיצ׳ר מכוון — הטיול מרגיש כמו
היעד שלו. שלושת הטיולים הקיימים:
  סיציליה   — כהה bg #120f0d, accent #f59e0b (ענבר) | בהיר accent #c2410c
  ג׳ורג׳יה  — כהה bg #0c1413, accent #2dd4bf (טורקיז) | בהיר accent #0f766e
  סלובניה   — כהה bg #0c1211, accent #2fb37f (ירוק) | בהיר accent #0f7a55
הפלטה של הטיול נטענת דינמית ל-CSS variables.

# כללי העיצוב שהמוצר מחויב להם
- **אף פעם gradients.** לא בטקסט, לא ברקע, לא בכפתורים. צבעים מלאים בלבד.
- Flat. בלי צללים מוגזמים, בלי glow, בלי neumorphism.
- טיפוגרפיה עושה את העבודה: היררכיה בגדלים ובמשקלים, לא בצבעים.
- צבע מבטא אחד, אולי שניים. משתמשים בו בנקודות, לא שופכים אותו.
- גבולות עדינים, 1px.
- Dark mode הוא ברירת המחדל וצריך להיראות מעולה.
- הכול בעברית RTL. הפונט חייב לתמוך בעברית היטב.

# השאלות
1. **המבטאים.** ליים #B8F34A בדף הבית, כתום #f0692e בדף המשקיע, כחול #3b82f6
   באפליקציה. שלושה משטחים, שלושה צבעים לא קשורים. האם זו בעיה, ומה הפתרון?
   שים לב שפלטה־לכל־טיול היא פיצ׳ר שאסור לבטל — אז מה כן צריך להישאר קבוע
   בכל המוצר, ומה מותר שישתנה?
2. **הליים #B8F34A.** האם הוא נכון למוצר תיירות בעברית, או שהוא קורא כמו
   מוצר פיננסי/קריפטו? אם להחליף — במה בדיוק (hex)?
3. **הרקעים.** #0A0C0F מול #0d0f12 מול #0e0f11 — שלושה שחורים כמעט זהים אבל
   לא זהים. לאחד? לאיזה ערך?
4. **הפונט.** Heebo בכל שלושת המשטחים. האם הוא הבחירה הנכונה לעברית במוצר
   כזה? אם יש חלופה טובה יותר בעברית (Google Fonts או פונט חופשי אחר) — לנקוב
   בשם, ולומר למה. אם Heebo נכון — לומר את זה ולא להחליף סתם.
5. **סקאלת גדלים ומשקלים.** כרגע כותרות במשקל 800–900, גוף 400–600.
   האם ההיררכיה נכונה? מה הייתי משנה בסקאלה?
6. **הטקסט על גבי התצלומים** בדף המשקיע: לבן על כיסוי כהה אחיד. עובד?
`.trim();

const SYSTEM = `
אתה מעצב מוצר בכיר, מתמחה במערכות עיצוב, בטיפוגרפיה עברית ובנגישות צבע.

תענה קונקרטית. כל המלצת צבע חייבת לכלול ערך hex מדויק. כל המלצת פונט חייבת
לכלול שם מדויק ומקור. אל תיתן עצות כלליות בסגנון ״לשמור על עקביות״ — תגיד
בדיוק מה לשנות ולמה.
"לא לשנות" הוא פסק דין לגיטימי ואף רצוי כשהמצב הקיים תקין.

החזר JSON תקין בלבד:
{
  "verdict": "<שלוש-חמש שורות: מה המצב הכללי, ומה הבעיה החמורה ביותר אם יש>",
  "accents": {
    "diagnosis": "<האם שלושה מבטאים שונים הם בעיה, ולמה>",
    "constant": "<מה חייב להישאר זהה בכל המוצר>",
    "variable": "<מה מותר שישתנה בין טיולים>",
    "recommendation": [{ "surface": "<איזה משטח>", "from": "<hex נוכחי>", "to": "<hex מוצע או 'ללא שינוי'>", "why": "<משפט>" }]
  },
  "backgrounds": { "unify": true, "value": "<hex>", "why": "<משפט>" },
  "typography": {
    "keepHeebo": true,
    "alternative": "<שם פונט אם ממליץ להחליף, אחרת null>",
    "why": "<נימוק>",
    "scale": [{ "role": "<H1 / H2 / גוף / משני>", "size": "<px>", "weight": "<מספר>", "note": "<אם יש>" }]
  },
  "overImages": "<האם הטקסט על התצלומים עובד, ומה לתקן>",
  "actions": ["<רשימת שינויים קונקרטיים לביצוע, לפי סדר חשיבות>"]
}
`.trim();

console.log(`\n▸ model: ${MODEL}\n▸ colour and type only\n`);

const res = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: headers(),
  body: JSON.stringify({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: BRIEF },
    ],
  }),
});

const j = await res.json();
if (!res.ok) die(`OpenAI ${res.status}: ${j?.error?.message || JSON.stringify(j).slice(0, 400)}`);

let out;
try { out = JSON.parse(j.choices[0].message.content); }
catch { die('model did not return valid JSON:\n' + (j.choices?.[0]?.message?.content || '').slice(0, 600)); }

writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');

console.log('═'.repeat(72));
console.log('\n── verdict ──\n' + out.verdict);
console.log('\n── accents ──');
console.log('אבחנה: ' + out.accents?.diagnosis);
console.log('קבוע:  ' + out.accents?.constant);
console.log('משתנה: ' + out.accents?.variable);
for (const r of out.accents?.recommendation || []) {
  console.log(`  ${r.surface}: ${r.from} → ${r.to}  (${r.why})`);
}
console.log('\n── backgrounds ──');
console.log(`${out.backgrounds?.unify ? 'לאחד ל־' + out.backgrounds?.value : 'להשאיר'} — ${out.backgrounds?.why}`);
console.log('\n── typography ──');
console.log(`Heebo: ${out.typography?.keepHeebo ? 'להשאיר' : 'להחליף ל־' + out.typography?.alternative}`);
console.log(out.typography?.why);
for (const r of out.typography?.scale || []) {
  console.log(`  ${r.role}: ${r.size} / ${r.weight}${r.note ? '  — ' + r.note : ''}`);
}
console.log('\n── over images ──\n' + out.overImages);
console.log('\n── actions ──');
(out.actions || []).forEach((a, i) => console.log(`  ${i + 1}. ${a}`));
console.log(`\n✓ נשמר ל-${OUT}\n`);
