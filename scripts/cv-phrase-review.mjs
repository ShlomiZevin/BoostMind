/**
 * cv-phrase-review.mjs
 *
 * Runs the Hebrew strings of public/tzach-cv/index.html through OpenAI for
 * phrasing + review, following the briefing protocol in MARKETING.md §4:
 *   1. send the full brief   2. send the EXACT current text of every string
 *   3. ask for JSON, one field per string, plus a `why`
 *   4. state explicitly that "change nothing" is a valid answer
 *   5. then judge it  <-- that step is human, not automated. Nothing is written
 *                        to the CV by this script. It only reports.
 *
 * Usage:
 *   node scripts/cv-phrase-review.mjs                 # default model gpt-5.6-sol
 *   node scripts/cv-phrase-review.mjs --model gpt-5.6-terra
 *   node scripts/cv-phrase-review.mjs --list-models   # print ALL matches, never a head
 *
 * Env: OPENAI_API_KEY (+ optional OPENAI_ORG_ID / OPENAI_PROJECT_ID) in ./.env
 */

import 'dotenv/config';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : dflt;
};
const MODEL = arg('model', 'gpt-5.6-sol');
const OUT = arg('out', 'scripts/cv-review.out.json');

/* Key source. MARKETING.md §4 names aspect-agent-server/.env as the OpenAI
   source of truth; BoostMind's own .env holds a revoked key, so that one is
   only a last resort. Override with --env-file <path>. */
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

function headers() {
  const h = { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
  if (ORG) h['OpenAI-Organization'] = ORG;
  if (PROJ) h['OpenAI-Project'] = PROJ;
  return h;
}

function die(msg) {
  console.error('\n✖ ' + msg + '\n');
  process.exit(1);
}

if (!KEY) die('OPENAI_API_KEY missing. Put a valid key in ./.env');

/* ── --list-models ────────────────────────────────────────────────────────
   MARKETING.md warns: print ALL matches, never a truncated head — a truncated
   list once made gpt-5.1 look like the newest available.                     */
if (argv.includes('--list-models')) {
  const r = await fetch('https://api.openai.com/v1/models', { headers: headers() });
  const j = await r.json();
  if (!j.data) die('models call failed: ' + (j?.error?.message || JSON.stringify(j).slice(0, 300)));
  const ids = j.data.map((m) => m.id).sort();
  console.log(`\nall ${ids.length} models:`);
  ids.forEach((id) => console.log('  ' + id));
  process.exit(0);
}

/* ── the brief ──────────────────────────────────────────────────────────── */
const BRIEF = `
# מי המועמד
צח דוידוב, יליד 08/08/1992. לוחם לשעבר בחטיבת כפיר (גדוד דוכיפת, 2010–2013).
ניסיון תעסוקתי בפועל, לפי סדר כרונולוגי הפוך:
  • 2024–היום — נציג מוקד אישורים בכאל (שירות לקוחות טלפוני).
  • 2018–2020 — מאבטח ביחידה הרכובה, אלקטרה סקיוריטי. אחריות על גזרה של כ־30 סניפי בנק.
  • 2016–2017 — גנן בחברת "ארזים": הקמה ואחזקת גינות, מערכות השקיה.
השכלה: 12 שנות לימוד.

# הטקסט המקורי של המועמד — מקורות החיים שהוא שלח (verbatim)
כל מה שמופיע כאן הוא מידע מאושר שהמועמד עצמו כתב. אין להתייחס אליו כ"המצאה".
מותר לנסח אותו מחדש, אסור לפסול אותו כלא־מבוסס.

תקציר מקורי:
"בעל יכולת גבוהה לעבודה בתנאים משתנים, עמידה בנהלים ומתן שירות איכותי ומקצועי,
לצד עבודה עצמאית וכחלק מצוות. בעל זיקה עמוקה לטבע, לסביבה ולעשייה ערכית, לצד
מוסר עבודה גבוה, משמעת עצמית ורצון להתפתח מקצועית. שואף להשתלב בתפקיד שטח
משמעותי, לתרום מניסיוני התפעולי והמקצועי ולהיות חלק מעשייה בעלת משמעות."

כאל — נציג מוקד אישורים (2024–היום):
"מתן מענה מקצועי, סבלני ואדיב לקהל רחב של לקוחות תוך שמירה על קור רוח והתמודדות עם מצבי לחץ."
"עבודה מדויקת ואחראית בהתאם לנהלים, כולל טיפול במקרים מורכבים ושיקול דעת מקצועי בזמן אמת."
"יכולת הסתגלות לשינויים, ניהול ריבוי משימות ונכונות לעבודה בשעות לא שגרתיות."
"יכולת גבוהה לביצוע משימות באופן עצמאי לצד שיתוף פעולה פורה עם צוותים וגורמים מקצועיים אחרים."

אלקטרה סקיוריטי — מאבטח ביחידה הרכובה (2018–2020):
"אחריות כוללת על אבטחת גזרה של כ־30 סניפי בנק בהתאם להנחיות ולנהלי הביטחון של בנק ישראל."
"התנהלות מקצועית ושירותית מול גורמים שונים, תוך שמירה על רמה גבוהה של ייצוגיות בעבודה עצמאית ובצוותים."
"קבלת החלטות ברגע האמת והפעלת שיקול דעת בסביבה דינמית, הדורשת משמעת עצמית ואחריות."

ארזים — הקמה ואחזקת גינות (2016–2017):
"ניסיון מעשי בטיפול בצמחייה ובקרקע, שימוש בכלי עבודה וביצוע משימות תחזוקה שוטפת בשטח."
"התמחות מעשית בתכנון, הקמה וביצוע של מערכות השקיה מגוונות."
"יכולת עבודה מאומצת בשטח הפתוח תוך הסתגלות לתנאי סביבה ומזג אוויר דינמיים."

שירות צבאי — לוחם, חטיבת כפיר, גדוד דוכיפת (2010–2013):
"שירות קרבי במסגרת הדורשת משמעת, אחריות אישית, עבודת צוות, עמידה בנהלים,
חוסן תפקודי ויכולת פעולה בתנאים מאתגרים ומשתנים."

# המטרה
קורות חיים למשרת שטח ברשות הטבע והגנים — פקח / סייר / עובד שטח.
הקהל הקורא: מגייס בגוף ציבורי ישראלי. קורא מהר, מחפש התאמה לתפקיד שטח.

# האתגר הריטורי
לצח אין ניסיון קודם בפיקוח סביבתי או ברשות הטבע והגנים. כל הכוח של המסמך הוא
בתרגום הניסיון הקיים לשפה של התפקיד: גינון = עבודה בשטח פתוח עם צמחייה וקרקע;
אבטחת 30 סניפים = פיקוח, סיור ואחריות על גזרה; מוקד כאל = מענה לקהל מבקרים
מגוון; כפיר = חוסן פיזי, משמעת ותפקוד בתנאים משתנים.

# כללי סגנון — מחייבים
- עברית טבעית, קונקרטית, בגובה העיניים. לא פומפוזית, לא "שיווקית".
- בלי buzzwords וקלישאות גיוס ("שחקן קבוצתי", "חושב מחוץ לקופסה", "תשוקה בוערת").
- פעלים חזקים ועובדות. מספרים כשיש מספרים.
- אסור להמציא ניסיון, תארים, הסמכות או נתונים שלא מופיעים בבריף הזה.
- אורך דומה למקור — זה מסמך שצריך להיכנס לעמוד אחד.
`.trim();

/* ── the exact current strings ────────────────────────────────────────────
   Copied verbatim from public/tzach-cv/index.html. If you edit the HTML,
   re-sync these before re-running, or the review will judge stale text.     */
const STRINGS = [
  {
    key: 'role',
    label: 'תת־כותרת בראש העמוד (התפקיד)',
    text: 'פקח שטח · סייר · עובד שטח',
  },
  {
    key: 'summary',
    label: 'תקציר מקצועי (הפסקה הפותחת)',
    text:
      'בעל זיקה עמוקה לטבע, לסביבה ולעשייה ערכית — ומבקש להפוך אותה לעיסוק. ' +
      'ניסיון באבטחת גזרה של כ־30 סניפי בנק, בעבודה פיזית עם קרקע, צמחייה ומערכות השקיה, ' +
      'ובמתן שירות לקהל רחב. לוחם לשעבר בחטיבת כפיר, מורגל בעבודה לפי נהלים, בקבלת ' +
      'החלטות בתנאים משתנים ובעבודה עצמאית ובצוות. מבקש להשתלב בתפקיד שטח ברשות ' +
      'הטבע והגנים ולתרום לשמירה על השטחים הפתוחים.',
  },
  {
    key: 'fit_field',
    label: 'בלוק התאמה — "שטח, לא משרד"',
    text:
      'ניסיון בעבודה פיזית בשטח פתוח — טיפול בקרקע ובצמחייה, הקמה ואחזקה של גינות, ' +
      'ועבודה עם מערכות השקיה וכלי עבודה.',
  },
  {
    key: 'fit_enforcement',
    label: 'בלוק התאמה — "אחריות על גזרה"',
    text:
      'אחריות על אבטחת גזרה של כ־30 סניפי בנק, עבודה לפי נהלי ביטחון והפעלת שיקול דעת בסביבה משתנה.',
  },
  {
    key: 'fit_public',
    label: 'בלוק התאמה — "מול קהל מגוון"',
    text:
      'מתן מענה מקצועי, סבלני ואדיב לקהל רחב, כולל טיפול במקרים מורכבים ושמירה על קור רוח במצבי לחץ.',
  },
  {
    key: 'fit_combat',
    label: 'בלוק התאמה — "רקע קרבי"',
    text:
      'שלוש שנות שירות כלוחם בחטיבת כפיר — עבודה לפי נהלים, אחריות אישית, עבודת צוות ותפקוד בתנאים מאתגרים ומשתנים.',
  },
  {
    key: 'cal_1',
    label: 'כאל — בולט 1',
    text:
      'מתן מענה מקצועי, סבלני ואדיב לקהל רחב ומגוון של לקוחות, תוך שמירה על קור רוח והתנהלות רגועה במצבי לחץ.',
  },
  {
    key: 'cal_2',
    label: 'כאל — בולט 2',
    text:
      'טיפול מדויק ואחראי במקרים מורכבים בהתאם לנהלים, תוך הפעלת שיקול דעת מקצועי בזמן אמת.',
  },
  {
    key: 'electra_1',
    label: 'אלקטרה — בולט 1',
    text: 'אחריות כוללת על אבטחת גזרה של כ־30 סניפי בנק, בהתאם לנהלים ולהנחיות של בנק ישראל.',
  },
  {
    key: 'electra_2',
    label: 'אלקטרה — בולט 2',
    text: 'עבודה עצמאית ובצוות, התנהלות מול גורמים שונים וקבלת החלטות בסביבה דינמית.',
  },
  {
    key: 'arazim_1',
    label: 'ארזים — בולט 1',
    text:
      'טיפול בצמחייה ובקרקע, שימוש בכלי עבודה וביצוע משימות תחזוקה שוטפת בשטח.',
  },
  {
    key: 'arazim_2',
    label: 'ארזים — בולט 2',
    text: 'תכנון והקמה של מערכות השקיה מגוונות במסגרת עבודות גינון בשטח.',
  },
];

/* ── the request ──────────────────────────────────────────────────────── */
const SYSTEM =
  'אתה כותב קורות חיים בכיר בעברית, שמתמחה בהשמה לגופים ציבוריים בישראל. ' +
  'אתה כותב עברית טבעית, קצרה וקונקרטית, ושונא קלישאות גיוס ו-buzzwords. ' +
  'אתה לא ממציא עובדות שלא נמסרו לך. אתה עונה JSON תקין בלבד.';

const USER = `${BRIEF}

# הטקסטים הנוכחיים — בדיוק כפי שהם במסמך
${STRINGS.map((s) => `[${s.key}] ${s.label}\n"${s.text}"`).join('\n\n')}

# מה אני מבקש
עבור כל מחרוזת: החלט אם היא טובה כמו שהיא או שאפשר לשפר אותה.

**"לא לשנות" היא תשובה לגיטימית ואפילו רצויה.** אם מחרוזת עובדת — החזר
verdict:"keep" והסבר בשורה אחת למה היא עובדת. אל תשנה טקסט רק כדי להראות
שעבדת. עדיף שתשנה שלוש מחרוזות באמת חלשות מאשר את כולן.

החזר JSON בדיוק במבנה הזה:
{
  "reviews": [
    {
      "key": "<המפתח מהרשימה למעלה>",
      "verdict": "keep" | "revise",
      "proposed": "<הנוסח המוצע — או מחרוזת ריקה אם verdict=keep>",
      "why": "<משפט אחד: למה משנים, או למה משאירים>"
    }
  ],
  "overall": {
    "strengths": ["<מה עובד במסמך כמסמך>"],
    "risks": ["<מה מגייס ברשות הטבע והגנים עלול לתקוע עליו>"],
    "missing": ["<מידע שחסר וכדאי לבקש מהמועמד>"]
  }
}

חובה: פריט אחד ב-reviews לכל מפתח ברשימה, באותם שמות מפתח בדיוק.`;

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

/* ── report ──────────────────────────────────────────────────────────── */
const byKey = Object.fromEntries(STRINGS.map((s) => [s.key, s]));
const reviews = out.reviews || [];
const revised = reviews.filter((r) => r.verdict === 'revise');

console.log('═'.repeat(72));
for (const r of reviews) {
  const src = byKey[r.key];
  if (!src) {
    console.log(`\n⚠ unknown key returned by model: ${r.key}`);
    continue;
  }
  const tag = r.verdict === 'keep' ? '✓ KEEP  ' : '✎ REVISE';
  console.log(`\n${tag} [${r.key}] ${src.label}`);
  if (r.verdict === 'revise') {
    console.log(`  לפני: ${src.text}`);
    console.log(`  אחרי: ${r.proposed}`);
  }
  console.log(`  למה:  ${r.why}`);
}

const missingKeys = STRINGS.map((s) => s.key).filter((k) => !reviews.some((r) => r.key === k));
if (missingKeys.length) console.log(`\n⚠ model skipped ${missingKeys.length} key(s): ${missingKeys.join(', ')}`);

const sec = (title, arr) => {
  if (!arr?.length) return;
  console.log(`\n${title}`);
  arr.forEach((x) => console.log('  • ' + x));
};
console.log('\n' + '═'.repeat(72));
sec('חוזקות:', out.overall?.strengths);
sec('סיכונים:', out.overall?.risks);
sec('מידע חסר:', out.overall?.missing);

writeFileSync(OUT, JSON.stringify({ model: j.model, strings: STRINGS, ...out }, null, 2), 'utf8');
console.log(`\n▸ ${revised.length}/${reviews.length} proposed for revision`);
console.log(`▸ full JSON → ${OUT}`);
console.log('▸ nothing was written to the CV. Review, then apply what earns it.\n');
