// Terra writes the copy of the "app + notifications" flow (his ask 2026-11-05: make it super clear for every viewer, on
// iPhone and Android, that they can put the Shlomiverse on the home screen AND get notifications).
// node scripts/v2-design/app-push-copy.mjs  -> prints JSON for T.app in v2/site/verse/copy.js
import { readFileSync } from 'node:fs';

const env = readFileSync('C:/workspace/BoostMind/scripts/design.env', 'utf8');
const KEY = (env.match(/^OPENAI_API_KEY=(.+)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, '');
if (!KEY) throw new Error('no OPENAI_API_KEY');

const draft = {
  welcomeTitle: 'ברוכים הבאים לאפליקציה',
  welcomeLine: 'נשאר צעד אחד: התראות. ככה תדעו ראשונים כשיש סרטון חדש, כשעונים לכם וכשקורה משהו בשלומיוורס.',
  welcomeYes: 'להפעיל התראות',
  welcomeLater: 'לא עכשיו',
  pageTitle: 'השלומיוורס כאפליקציה, עם התראות',
  pageSub: 'שני צעדים קצרים: שמים את השלומיוורס במסך הבית, ומפעילים התראות.',
  part1: 'שמים את השלומיוורס במסך הבית',
  part1Done: 'השלומיוורס כבר במסך הבית שלכם',
  part2: 'מפעילים התראות',
  part2Done: 'ההתראות פועלות. תדעו ראשונים.',
  part2Denied: 'ההתראות חסומות. פותחים אותן בהגדרות הטלפון: התראות ← שלומיוורס ← לאפשר.',
  iosOnlyFromIcon: 'באייפון התראות עובדות רק כשפותחים מהסמל במסך הבית',
  pushStepsIos: [['פותחים מהסמל במסך הבית', 'לא מהדפדפן - רק משם האייפון מאפשר התראות.'], ['לוחצים ״להפעיל התראות״', 'בחלון שקופץ כשנכנסים, או כאן. נתחבר עם גוגל כדי שההתראות יגיעו רק אליכם.'], ['מאשרים ״אפשר״', 'וזהו. אפשר לכבות מתי שרוצים.']],
  pushStepsAndroid: [['לוחצים ״להפעיל התראות״', 'אפשר כבר עכשיו, גם לפני שמוסיפים למסך. נתחבר עם גוגל כדי שההתראות יגיעו רק אליכם.'], ['מאשרים ״אפשר״', 'וזהו. אפשר לכבות מתי שרוצים.']],
  permAsk: 'השלומיוורס רוצה לשלוח לכם התראות',
  permNo: 'לא לאפשר',
  permYes: 'אפשר',
  step3: ['פותחים מהסמל ומפעילים התראות', 'כדי לדעת ראשונים כשיש סרטון חדש.'],
  whatYouGet: 'סרטון חדש מדמות שאתם עוקבים אחריה, תשובה לתגובה שלכם, דמות שעונה לכם',
};

const r = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST', headers: { authorization: 'Bearer ' + KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ model: 'gpt-5.6-terra', reasoning: { effort: 'low' }, store: false,
    text: { format: { type: 'json_object' } },
    instructions: `You write the Hebrew UI copy of "השלומיוורס" (shlomiverse.com) - comedian Shlomi Zevin's world of characters: their videos, games, stories and a community. Viewers mostly come from TikTok / Instagram, on phones.
This flow must make it SUPER clear, for iPhone and Android, that they can (1) put the Shlomiverse on their home screen like an app and (2) get notifications. Facts you must keep: on iPhone, notifications work only when the site is opened from its home-screen icon; on Android they can be turned on right away in the browser; turning them on asks them to sign in with Google (free) so the notifications reach only them; the phone then asks "allow".
Rewrite the draft: short, warm, plain, clear Hebrew, plural address (אתם), no exclamation marks overload, no emoji, no "מעריצים". Never the word "פוש". Keep every key and the array shapes ([title, line] pairs; line may be ""). Return the same JSON object.`,
    input: [{ role: 'user', content: 'The draft JSON: ' + JSON.stringify(draft) }] }) });
const j = await r.json();
if (!r.ok) throw new Error(j.error?.message || r.status);
const out = (j.output || []).flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('');
console.log(JSON.stringify(JSON.parse(out), null, 2));
