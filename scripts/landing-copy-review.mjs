/**
 * landing-copy-review.mjs
 *
 * Runs the Hebrew copy of the Trip Planner public landing page
 * (trip-planner/src/i18n/landing.ts) through OpenAI, per MARKETING.md §4.
 * Also puts one open design question to the model: whether the investor page
 * should carry scenery photography alongside the product panels.
 *
 * Usage:
 *   node scripts/landing-copy-review.mjs
 *   node scripts/landing-copy-review.mjs --model gpt-5.6-terra
 *   node scripts/landing-copy-review.mjs --apply scripts/landing-review.out.json   # judge the text as it shipped
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
const OUT = arg('out', 'scripts/landing-review.out.json');

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

/* ── the brief ──────────────────────────────────────────────────────────── */
const BRIEF = `
# מה הדף הזה
דף הבית הציבורי של אפליקציית טיולים בשם "מסלול" (https://boostart-trips.web.app).
זה **לא** דף למשקיע — זה הדף שמטייל רגיל נוחת עליו.

# מי הקהל
אדם ישראלי שמתכנן טיול, או שקיבל לינק לטיול של מישהו. לא איש טכנולוגיה.
הוא מגיע במובייל, נותן לדף ארבע שניות, ורוצה להבין מיד: מה זה, ומה אני עושה כאן.

# המוצר
אפליקציה (PWA) שמנהלת טיול **בזמן שהוא קורה**, לא רק מתכננת אותו:
- נפתחת על היום הנוכחי. מסמנים מה בוצע, על מה ויתרנו, מה נשאר.
- לו״ז, סימונים, רשימת ציוד וסימון חניה — משותפים בין כל המטיילים, בכל המכשירים.
- עובדת אופליין.
- צ׳אט AI שמכיר את התוכנית האמיתית, את התאריך והשעה ואת המיקום אם שיתפו אותו.
  מודד מרחקים דרך שירותי ניווט אמיתיים, מחפש בשפה המקומית, ומציע שינויים ללו״ז
  שנכנסים רק אחרי אישור.
- מסך "תגיד למקומי": משפט בשפה המקומית על כל המסך, להראות למוכר או לנהג.
- סימון חניה, חזרה אליה ברגל, ניווט למלון של הלילה מבין כמה.
- ניווט לכל מקום ב-Waze / Google Maps / Apple Maps, לפי בחירת המשתמש.
- רשימת ציוד לפי היעד ומזג האוויר.

# מה הדף הזה מוכר
את **ההעתקה**. בספרייה יש טיולים מלאים; רואים טיול שאוהבים, לוחצים "העתק",
בוחרים תאריכים — והמערכת בונה את כל התוכנית מחדש על התאריכים שלך, כאפליקציה
משלך שאפשר לשנות ולשתף.

# מצב אמיתי כרגע — אסור להתעלם ממנו
בספרייה יש **שלושה** טיולים: סיציליה וג׳ורג׳יה, שהם טיולים אמיתיים של המפתח
ומשפחתו שרצו על המוצר בפועל; וסלובניה, שהוא טיול הדגמה לחול המועד סוכות שנבנה
כדוגמה ולא נסעו בו.
הדירוגים בכרטיסים (״★ 4.8 · 12 דירוגים״) הם **נתוני הדגמה** ומסומנים ככאלה בדף.
אין עדיין משתמשים בקנה מידה. הדף לא צריך להעמיד פנים שיש קהילה גדולה.

# כללי סגנון — מחייבים
- עברית טבעית, פשוטה, בגובה העיניים. **בלי להתחכם.**
- בלי סופרלטיבים, בלי "מהפכה", בלי "הפלטפורמה המובילה", בלי "חוויה בלתי נשכחת".
- בלי buzzwords וקלישאות שיווקיות. משפטים קצרים.
- אסור להבטיח מה שאין. אסור לרמוז על קהילה גדולה או על כמות משתמשים.
- זה נקרא במובייל. כל מחרוזת צריכה להיות קצרה ככל האפשר בלי לאבד משמעות.
- מותר לך להציע ניסוח **אחר לגמרי** אם הנוכחי לא טוב. אל תתקן בשוליים אם צריך לכתוב מחדש.
`.trim();

const STRINGS = [
  { key: 'eyebrow', label: 'אייברו מעל הכותרת', text: 'ספריית טיולים אמיתיים' },
  { key: 'title', label: 'כותרת ראשית (H1) — הדבר הראשון שרואים', text: 'כבר עשו את הטיול הזה. עכשיו אפשר להעתיק אותו.' },
  { key: 'lead', label: 'פסקת הפתיחה מתחת לכותרת', text: 'בוחרים מסלול שכבר היה בשימוש, מתאימים את התאריכים ומשנים רק מה שצריך. מקבלים עותק משלכם עם הלו״ז, המקומות, הניווט והצ׳אט של הטיול.' },
  { key: 'cta', label: 'כפתור ראשי', text: 'לראות את הטיולים' },
  { key: 'stock', label: 'שורת מלאי מתחת לכפתור (n = מספר הטיולים)', text: 'כרגע בספרייה: 3 טיולים מלאים.' },
  { key: 'flow', label: 'שורת התהליך בשלושה שלבים', text: 'בוחרים טיול · קובעים תאריכים · מקבלים עותק משלכם' },

  { key: 'libraryTitle', label: 'כותרת סקשן הספרייה', text: 'בחרו טיול להתחיל ממנו' },
  { key: 'libraryLead', label: 'תת־כותרת הספרייה', text: 'אלה לא רשימות המלצות. כל טיול כולל את הימים, המקומות, ההערות והפעולות ששימשו בדרך.' },
  { key: 'doneBadge', label: 'תג על כרטיס טיול', text: 'בוצע בפועל' },
  { key: 'demoBadge', label: 'תג ליד הדירוג, שמסמן שהדירוג הוא דמה', text: 'נתוני הדגמה' },
  { key: 'copy', label: 'כפתור ההעתקה על הכרטיס', text: 'להעתיק את הטיול' },
  { key: 'details', label: 'כפתור משני על הכרטיס', text: 'לפרטי הטיול' },

  { key: 'whatTitle', label: 'כותרת הסקשן השלישי', text: 'מה מועתק? הטיול עצמו.' },
  { key: 'whatLead', label: 'תת־כותרת הסקשן השלישי', text: 'לא קובץ PDF ולא אוסף לינקים. העותק הוא אפליקציה של הטיול, מוכנה לתאריכים שבחרתם.' },
  { key: 'point1_t', label: 'נקודה 1 · כותרת', text: 'היום הנכון, מיד' },
  { key: 'point1_b', label: 'נקודה 1 · גוף', text: 'נפתח על הלו״ז של היום, עם השעות, הפעילויות והאזהרות הרלוונטיות.' },
  { key: 'point2_t', label: 'נקודה 2 · כותרת', text: 'ניווט לפי הבחירה שלכם' },
  { key: 'point2_b', label: 'נקודה 2 · גוף', text: 'Waze, Google Maps או Apple Maps — כולל החניה והמלון של הלילה.' },
  { key: 'point3_t', label: 'נקודה 3 · כותרת', text: 'צ׳אט שמכיר את ההקשר' },
  { key: 'point3_b', label: 'נקודה 3 · גוף', text: 'מכיר את התוכנית ואת המיקום, מחפש ברשת, ומציע שינוי שנכנס רק אחרי אישור.' },
  { key: 'point4_t', label: 'נקודה 4 · כותרת', text: 'אותו טיול לכולם' },
  { key: 'point4_b', label: 'נקודה 4 · גוף', text: 'משתפים בקישור. סימון «ביצענו» מופיע אצל כולם, והתוכן זמין גם בלי קליטה.' },

  { key: 'copyTitle', label: 'כותרת חלון ההעתקה', text: 'להעתיק את הטיול לסלובניה' },
  { key: 'copyLead', label: 'הסבר בחלון ההעתקה', text: 'בחרו את היום הראשון בטיול. נעדכן את התאריכים וניצור עותק משלכם; אחר כך אפשר לשנות כל פרט.' },
  { key: 'copyDate', label: 'תווית שדה תאריך', text: 'היום הראשון בטיול' },
  { key: 'copyName', label: 'תווית שדה שם', text: 'שם הטיול' },
  { key: 'copyGo', label: 'כפתור אישור בחלון', text: 'ליצור את העותק' },
  { key: 'copyNote', label: 'הערה קטנה בתחתית החלון', text: 'העותק לא ישנה את הטיול המקורי. תוכלו לשתף אותו בקישור.' },
];

/* The header warns that stale strings make the review judge a draft that is
   no longer on the page. --apply folds a previous run's accepted revisions
   into STRINGS, so a second pass reads what actually shipped. */
const APPLY = arg('apply');
if (APPLY) {
  if (!existsSync(APPLY)) die('--apply file not found: ' + APPLY);
  const prev = JSON.parse(readFileSync(APPLY, 'utf8'));
  const byKey = Object.fromEntries(STRINGS.map((s) => [s.key, s]));
  let n = 0;
  for (const r of prev.reviews || []) {
    if (r.verdict === 'revise' && r.revised && byKey[r.key]) { byKey[r.key].text = r.revised; n++; }
  }
  console.log(`
▸ applied ${n} revisions from ${APPLY}`);
}

/* ── the open design question ───────────────────────────────────────────── */
const IMAGE_Q = `
# שאלה נפרדת — ויזואליה
בביקורת קודמת המלצת על **דף המשקיע** להשתמש רק בצילומי מוצר אמיתיים, ולהימנע
מתמונות נוף דקורטיביות ומתמונות סטוק. יישמתי: יש שם שלושה פאנלים שמציגים את
ה-UI האמיתי (מסך היום עם סימוני בוצע/ויתרנו, הצ׳אט עם מדידת מרחק והצעה לאישור,
ומסך "תגיד למקומי").

בעל המוצר מבקש לשקול מחדש: הוא רוצה שהדף ירגיש **אימרסיבי**, ומציע לשלב גם
תמונות נוף.

תכריע, ותנמק. שים לב לשני הקשרים שונים:
1. **דף המשקיע** — נשלח למשקיע שכבר מכיר את הכותב אישית.
2. **דף הבית הציבורי** — מטייל רגיל, במובייל. שם ממילא יש תמונות שער לכל טיול.

אם התשובה היא "כן לנוף" — תגיד בדיוק איפה, כמה, באיזה תפקיד, ומה הסכנה. אם
התשובה היא "לא" — תגיד מה כן ייתן את תחושת האימרסיביות בלי נוף.
`.trim();

const SYSTEM = `
אתה עורך לשוני ואסטרטג מיצוב לעברית שיווקית, וגם יועץ עיצוב מוצר.

תפקידך: לעבור על כל מחרוזת בנפרד ולהחליט אם היא עומדת בכללי הסגנון שבבריף.
- "keep" הוא פסק דין לגיטימי. אל תשנה כדי לשנות.
- "revise" כשיש שיפור אמיתי — כולל ניסוח אחר לגמרי, אם צריך.
- אל תוסיף מידע שלא קיים בבריף. אל תמציא מספרים או משתמשים.

החזר JSON תקין בלבד, במבנה:
{
  "reviews": [
    { "key": "<המפתח>", "verdict": "keep" | "revise", "revised": "<הטקסט החדש, רק אם revise>", "why": "<משפט אחד בעברית>" }
  ],
  "overall": "<ארבע-שש שורות בעברית: מה החולשה המרכזית של דף הבית כרגע, ומה הייתי משנה במבנה, בסדר או בהיררכיה.>",
  "images": "<ההכרעה בשאלת הוויזואליה, בעברית, מפורטת וקונקרטית: מה לעשות בדף המשקיע ומה בדף הבית.>"
}
`.trim();

const USER = BRIEF + '\n\n# המחרוזות לבדיקה\n' +
  STRINGS.map((s) => `\n---\nkey: ${s.key}\nמיקום: ${s.label}\nטקסט נוכחי:\n${s.text}`).join('\n') +
  '\n\n' + IMAGE_Q;

console.log(`\n▸ model: ${MODEL}`);
console.log(`▸ strings under review: ${STRINGS.length}\n`);

const res = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: headers(),
  body: JSON.stringify({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: USER },
    ],
  }),
});

const j = await res.json();
if (!res.ok) die(`OpenAI ${res.status}: ${j?.error?.message || JSON.stringify(j).slice(0, 400)}`);

let out;
try {
  out = JSON.parse(j.choices[0].message.content);
} catch {
  die('model did not return valid JSON:\n' + (j.choices?.[0]?.message?.content || '').slice(0, 600));
}

const byKey = Object.fromEntries(STRINGS.map((s) => [s.key, s]));
const reviews = out.reviews || [];
const revised = reviews.filter((r) => r.verdict === 'revise');

console.log('═'.repeat(72));
for (const r of reviews) {
  const src = byKey[r.key];
  if (!src || r.verdict !== 'revise') continue;
  console.log(`\n▸ ${r.key} — ${src.label}`);
  console.log(`  לפני: ${src.text}`);
  console.log(`  אחרי: ${r.revised}`);
  console.log(`  למה:  ${r.why}`);
}
console.log('\n' + '═'.repeat(72));
console.log(`\nשונו ${revised.length} מתוך ${reviews.length}.\n`);
console.log('── overall ──\n' + (out.overall || '(אין)'));
console.log('\n── images ──\n' + (out.images || '(אין)'));

writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
console.log(`\n✓ נשמר ל-${OUT}\n`);
