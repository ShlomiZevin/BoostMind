// How we write scripts in the Shlomiverse - the writing guide every GPT reads through the MCP before it writes (his ask,
// 2026-11-17: "a skill that whoever works with our MCP will read and work accordingly ... and after a session I tell him
// 'we learned stuff, update the skill'"). One record, Firestore scriptCraft/guide: {text (the guide, markdown), lessons:
// [{d, text, characters, why}] (what a session learned, added at his word), v, updated, by}. Every change keeps the record
// as it was in scriptCraft/guide/versions - nothing he wrote is ever lost. Read / written by mcp.js; the seed below is the
// first version, from his words (2026-11-17) - once the record exists the database is the truth, not this file.
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

const SEED = `# איך כותבים תסריט בשלומיוורס

השלומיוורס אמיתי: הדמויות הן אנשים אמיתיים, וכל סרטון הוא רגע מהחיים שלהן. כותבים בעברית, לסרטון קצר (טיקטוק / אינסטגרם).

## 1. קודם הדמות
לפני השורה הראשונה - get_character לכל דמות שבסצנה. דף הדמות (Backstage → דמויות, ששלומי מעצב) הוא האמת היחידה עליה:
מי זה, איך מדבר, מה מצחיק, הפרודיה, הדיסוננס, הניואנסים, הקאצ'פרייז. לא ממציאים לדמות משהו שסותר את הדף.
"החיים שלה" בדף = אירוע לכל סרטון, לפי הסדר - זו ההמשכיות: מה כבר קרה לה, ומה היא יודעת.

## 2. הצחוק בא מהאמת
זה לא צריך להיות "סופר מצחיק". זה צריך להיות "אלוהים, זה כל כך אמיתי, זה כל כך נכון".
- תופסים ניואנס פשוט מהיומיום: משפט שכולם שמעו, תנועה קטנה, הרגל, מבוכה מוכרת, הדרך שבה מישהו עונה לטלפון.
  הצחוק בא מההכרה. ניואנס קטן ומדויק שווה יותר מבדיחה גדולה.
- כל שורה נשמעת בדיוק כמו שהדמות הזאת הייתה אומרת אותה - אוצר המילים שלה, המנגינה שלה, מה שהיא לא הייתה אומרת אף פעם.
- בלי פאנצ'ים מאולצים, בלי קריצות לקהל, בלי להסביר את הבדיחה.

## 3. מה מצחיק בדמות - הפרודיה והדיסוננס
לכל דמות יש פרודיה (מה היא משקפת מהחיים) ודיסוננס (הסתירה שבלב שלה). בונים מצב שמפעיל את הסתירה הזאת מול העיניים -
לא מספרים עליה. שתי דמויות בסצנה = שני דיסוננסים שנפגשים.

## 4. קאצ'פרייז - רק מהדף, ובמשורה
רק המשפטים שבדף הדמות, אחד או שניים בסרטון, במקום שבו הם נוחתים טבעי. דמות בלי קאצ'פרייז - כל הדיבור שלה הוא החתימה.

## 5. תסריטים שכבר עבדו - מעתיקים את המכניקה
לדמות שכבר יש לה סרטונים: list_videos ואז get_video לתמלולים. בונים על המכניקה שעבדה - המבנה, הקצב, איך המצב מסלים,
איפה ההפתעה, מי מגיב למי, איך זה נגמר. מעתיקים את המכניקה, לא את הבדיחות ולא את המשפטים. כששלומי אומר איזה סרטון
עבד במיוחד - מתחילים ממנו.

## 6. איך התסריט כתוב
- כל שורה: \`שם הדמות: הטקסט\` (השם כמו בדף הדמות). הוראה קטנה בסוגריים מרובעים, למשל \`[שתיקה 0.8]\`.
- שורה שנקטעת באמצע נגמרת ב-\`—\` (מישהו נכנס לו לדברים).
- קצר. כל שורה מקדמת משהו; שורה שאפשר להוריד - מורידים.

## 7. סוף שרק בשלומיוורס
סרטון שהסוף שלו (השיא, הפאנץ', מה שקרה באמת) רק בשלומיוורס: מסמנים בתסריט את המקום שבו הגרסה לרשתות נעצרת, בשורה
נפרדת: \`[עד כאן ברשתות]\`. העצירה היא צוק - רגע לפני התשובה / הגילוי / השיא, כשהצופה הכי רוצה לדעת מה קורה. מה שאחרי
הסימון חייב להיות שווה את הקליק.

## 8. בסוף הסשן - שומרים מה שלמדנו
רק כששלומי מבקש ("למדנו משהו", "תעדכן"):
- משהו על דמות מסוימת (ניואנס, מה מצחיק אותה, איך היא מדברת, משפט שלה) → update_character_sheet. קודם מראים לו בדיוק מה
  ישתנה בדף, ורק אחרי שהוא מאשר - שולחים.
- משהו על איך כותבים בכלל → update_writing_guide (add_lesson) - לקח אחד, ברור, במילים שלו.
`;

const ref = () => admin.firestore().collection('scriptCraft').doc('guide');
async function get() {
  const d = await ref().get();
  return d.exists ? d.data() : { text: SEED, lessons: [], v: 0 };
}
const day = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
function text(g) {
  const ls = (g.lessons || []).map((l) => `- ${l.d}${l.characters ? ` (${l.characters})` : ''}: ${l.text}`).join('\n');
  return `${g.text}${ls ? `\n## לקחים מסשנים (מה שלמדנו - חלק מהמדריך)\n${ls}\n` : ''}`;
}
// action: add_lesson {text, characters?, why?} | rewrite {text, why, clear_lessons?} - the old record goes to versions first
async function change(a, by) {
  const g = await get(), next = { text: g.text, lessons: [...(g.lessons || [])] };
  const t = String(a.text || '').trim();
  if (!t) return { error: 'text is empty' };
  if (a.action === 'add_lesson') next.lessons.push({ d: day(), text: t.slice(0, 2000), characters: String(a.characters || '').slice(0, 200), why: String(a.why || '').slice(0, 500) });
  else if (a.action === 'rewrite') {
    if (!String(a.why || '').trim()) return { error: 'a rewrite needs why - what changed and why' };
    if (t.length < 200) return { error: 'a rewrite is the WHOLE guide - this text is too short (to add one thing use add_lesson)' };
    next.text = t.slice(0, 40000);
    if (a.clear_lessons) next.lessons = [];
  } else return { error: 'action is add_lesson or rewrite' };
  const v = (g.v || 0) + 1;
  if (g.v) await ref().collection('versions').doc(String(g.v)).set({ text: g.text, lessons: g.lessons || [], replacedBy: by, why: String(a.why || a.action), t: FieldValue.serverTimestamp() });
  await ref().set({ ...next, v, updated: FieldValue.serverTimestamp(), by });
  return { ok: true, v, lessons: next.lessons.length };
}

module.exports = { get, text, change, SEED };
