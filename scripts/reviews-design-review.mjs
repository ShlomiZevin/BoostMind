/**
 * reviews-design-review.mjs
 *
 * Ratings and reviews on trips — where they belong on the public library
 * page and on the investor page, and how to show them honestly when no
 * real traveller has reviewed anything yet.
 *
 * Usage:
 *   node scripts/reviews-design-review.mjs
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
const OUT = arg('out', 'scripts/reviews-design.out.json');

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
# ההקשר
״מסלול״ — אפליקציית טיולים בעברית (RTL, mobile-first, PWA). עבדנו יחד על
דף הבית הציבורי ועל דף המשקיע. עכשיו בעל המוצר מבקש שינוי מהותי.

# מה הוא ביקש, במילים שלו
1. ״תוסיף בדף הבית וגם בדף למשקיע ביקורות על טיולים.״
2. ״לא צריך מספרים של טיולים שיש באתר. זה מיותר ומטופש. לא מחפש להציג
   שימוש עדיין, רק רעיון.״
3. ״ותראה שבעצם יוכלו לראות טיול מתוכנן מסוים עם ציונים וביקורות.״

כלומר: הוא לא מנסה להעמיד פנים שיש קהילה. הוא רוצה **להראות את הרעיון** —
שמסלול שלם נושא ציון וביקורות, ושאפשר לבחור מסלול על סמך זה.

# האילוץ שאסור לשבור
**אין עדיין אף ביקורת אמיתית ואף משתמש אמיתי.** בעבר היה בדף הבית דירוג
מומצא (״★ 4.8 · 12 דירוגים״) עם תווית קטנה ״נתוני הדגמה״ לידו, ואתה עצמך
המלצת להסיר אותו. הסרנו.

עכשיו צריך להחזיר ביקורות — אבל **כהדגמה של הרעיון, לא כנתון**. אסור
שמשקיע או מטייל יחשוב לרגע שאלה ביקורות אמיתיות. מצד שני, תווית קטנה ואפורה
שנבלעת ליד המספר היא בדיוק מה שנכשל קודם.

השאלה המרכזית: **איך מציגים פיצ׳ר של דירוגים וביקורות בצורה שהיא כנה
לחלוטין ועדיין משכנעת ומעוררת חשק?**

# המצב הנוכחי

## דף הבית (ספריית הטיולים)
כרטיס לכל טיול, בגריד. בכל כרטיס:
- תמונת שער (16:9)
- תג: ״בוצע בפועל״ (לטיולים אמיתיים) או ״טיול הדגמה״ (מסגרת מקווקוות)
- שם הטיול
- שלושה צ׳יפים של עובדות (למשל ״5 ימים״ · ״חול המועד״ · ״משפחתי · עם רכב״)
- פסקת סיכום קצרה
- שני כפתורים: ״להעתיק את הטיול״ · ״לפרטי הטיול״
שלושה טיולים בספרייה: סיציליה וג׳ורג׳יה (אמיתיים, של המפתח ומשפחתו),
וסלובניה (הדגמה, לא נסעו בו).

## דף המשקיע
סקשנים לפי הסדר: פתיח עם תצלום · מה זה · מה זה נותן היום למטייל בודד ·
הכלים באמצע היום · הספרייה כרגע · מה ייפתח כשיש ספרייה גדולה · CTA.
בסקשן ״הספרייה כרגע״ כתוב כרגע שיש שלושה טיולים ומה מצבם. בפתיח יש שלוש
סטטיסטיקות, אחת מהן ״3 — טיולים בספרייה כרגע״.

# מה קיים במוצר שרלוונטי לדירוגים
כשמטייל משתמש באפליקציה הוא מסמן כל פריט בלו״ז: **בוצע** / **ויתרנו** /
נשאר פתוח. כלומר המערכת יודעת, לכל מסלול שבוצע, אילו פעילויות נעשו ואילו
נזנחו. זה הבסיס שעליו ביקורות ודירוגים יוכלו להיבנות — ביקורת על מסלול
שלם, על יום מסוים, או על פעילות מסוימת בתוך היום.

# עוד תיקון קטן שצריך
בכרטיס מקום באפליקציה יש כרגע תג של כוכב בודד — עיגול עם ״⭐״ ותו לא,
בשורה נפרדת. זה נראה רע ולא אומר כלום. יש כבר מחרוזת ״⭐ חובה״ במערכת
שמשמשת במקום אחר. מה הפתרון הנכון?

# כללי סגנון — מחייבים
- עברית פשוטה וישירה. בלי סופרלטיבים ובלי לק שיווקי.
- אף פעם gradients. צבעים מלאים. flat. גבולות 1px עדינים.
- מבטא: כחול #3B82F6 (כהה) / #1D4ED8 (בהיר).
- הכול נקרא במובייל.
`.trim();

const SYSTEM = `
אתה מעצב מוצר בכיר וקופירייטר עברי. אתה מכריע ומספק גם את הטקסטים המדויקים.

החזר JSON תקין בלבד:
{
  "approach": "<ארבע-שש שורות: איך להציג דירוגים וביקורות בכנות מלאה ועדיין בצורה משכנעת. זו ההכרעה המרכזית.>",
  "honestyDevice": {
    "label": "<הטקסט המדויק של התווית שמסמנת שזו הדגמה>",
    "placement": "<איפה בדיוק היא יושבת ביחס לביקורות>",
    "why": "<למה הפתרון הזה עובד היכן שהתווית הקטנה נכשלה>"
  },
  "landing": {
    "onCard": "<מה מוצג על כרטיס טיול בספרייה: ציון, כמות, ומה עוד. טקסטים מדויקים.>",
    "tripPage": "<מה מוצג כשנכנסים לטיול מסוים: מבנה בלוק הביקורות. טקסטים מדויקים.>",
    "sampleReviews": [{ "author": "<שם או תיאור גנרי>", "score": "<ציון>", "text": "<ביקורת לדוגמה, 1-2 שורות, בעברית טבעית>", "on": "<על מה הביקורת — המסלול כולו / יום / פעילות>" }],
    "removeTripCount": "<מה בדיוק להסיר בנוגע למספר הטיולים>"
  },
  "investor": {
    "where": "<לאיזה סקשן שייכות הביקורות בדף המשקיע, ולמה>",
    "h2": "<כותרת הסקשן>",
    "body": ["<פסקה>"],
    "removeStats": "<אילו סטטיסטיקות בפתיח להסיר או להחליף, ובמה>"
  },
  "ratingAnatomy": ["<מה בדיוק אפשר לדרג במסלול — רשימה קצרה של רמות>"],
  "mustBadge": { "fix": "<הפתרון לתג הכוכב>", "text": "<הטקסט המדויק>" },
  "actions": ["<שינויים קונקרטיים לביצוע, לפי סדר>"]
}

כללים:
- ״sampleReviews״ — שלוש עד ארבע. עברית טבעית של מטייל אמיתי, לא שיווקית.
  הן חייבות להיראות כמו ביקורות אמיתיות **ולהיות מסומנות בבירור כדוגמה**.
- אל תמציא מספרי משתמשים. אל תציע להציג כמות ביקורות שנראית כמו נתון אמיתי.
`.trim();

console.log(`\n▸ model: ${MODEL}\n▸ ratings and reviews\n`);

const res = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST', headers: headers(),
  body: JSON.stringify({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: BRIEF }],
  }),
});

const j = await res.json();
if (!res.ok) die(`OpenAI ${res.status}: ${j?.error?.message || JSON.stringify(j).slice(0, 400)}`);
let out;
try { out = JSON.parse(j.choices[0].message.content); }
catch { die('bad JSON:\n' + (j.choices?.[0]?.message?.content || '').slice(0, 600)); }

writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');

console.log('═'.repeat(72));
console.log('\n── approach ──\n' + out.approach);
console.log('\n── honesty device ──');
console.log(`תווית: ${out.honestyDevice?.label}`);
console.log(`מיקום: ${out.honestyDevice?.placement}`);
console.log(`למה:   ${out.honestyDevice?.why}`);
console.log('\n── landing ──');
console.log('בכרטיס: ' + out.landing?.onCard);
console.log('בדף הטיול: ' + out.landing?.tripPage);
console.log('להסיר: ' + out.landing?.removeTripCount);
console.log('\nדוגמאות:');
for (const r of out.landing?.sampleReviews || []) {
  console.log(`  ${r.score} · ${r.author} (${r.on})\n    ${r.text}`);
}
console.log('\n── investor ──');
console.log(`מיקום: ${out.investor?.where}`);
console.log(`כותרת: ${out.investor?.h2}`);
(out.investor?.body || []).forEach((b) => console.log('  ' + b));
console.log('סטטיסטיקות: ' + out.investor?.removeStats);
console.log('\n── מה אפשר לדרג ──');
(out.ratingAnatomy || []).forEach((a) => console.log('  · ' + a));
console.log('\n── תג הכוכב ──\n' + out.mustBadge?.fix + '  → "' + out.mustBadge?.text + '"');
console.log('\n── actions ──');
(out.actions || []).forEach((a, i) => console.log(`  ${i + 1}. ${a}`));
console.log(`\n✓ נשמר ל-${OUT}\n`);
