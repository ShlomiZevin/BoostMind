// דדלוק - Yotam's parking game (Rush Hour in the Techy-Tech parking, level B2).
// Every car belongs to someone on the team; Yotam's green car has to reach the gate. A move = one car slid any
// distance. 5 lots a day from lots.json (same for everyone, seeded by the Israeli date), score = total moves.
'use strict';
const $ = (id) => document.getElementById(id);
const SLUG = 'deadlock';
const KEY = { best: 'shlomiverse:deadlock:best', day: 'shlomiverse:deadlock:day', tut: 'shlomiverse:deadlock:tut', snd: 'shlomiverse:deadlock:snd' };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} },
};
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const lastPick = {};
const pickNo = (a, id) => { let x = pick(a); if (a.length > 1 && x === lastPick[id]) x = a[(a.indexOf(x) + 1) % a.length]; lastPick[id] = x; return x; };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function seeded(s) { let a = hash(s) || 1; return () => { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; }; }

// ───────────────────────── the team ─────────────────────────
// name, role, the car picture, the face sticker, and what Yotam says when you touch their car
const TEAM = {
  yotam: { name: 'יותם', role: 'AI & Context', car: 'yotam', face: 'yotam' },
  erez: { name: 'ארז', role: 'ראש צוות Data & AI', car: 'erez', face: 'erez', lines: ['ארז חנה באמצע ושלח לי וואטסאפ ״תזיז אם צריך״. בסלאק, ארז. בסלאק.', 'ראש הצוות שלי. ה-dependency הכי ותיק בגרף.'] },
  osnat: { name: 'אסנת', role: 'Head of People', car: 'osnat', face: 'osnat', lines: ['אסנת בטח שוב בשיחת גיוס. Victim Process. סליחה, אסנת.', 'האוטו של אסנת. עם סרט ורוד. אפילו ה-UI שלה נעים.'] },
  yaniv: { name: 'יניב', role: 'אבטחת מידע', car: 'yaniv', face: 'yaniv', lines: ['יניב שם נעילת הגה. על אוטו שאף אחד לא ירצה לגנוב. Security by obscurity.', 'סלוטייפ על הגג. זה ה-firewall של יניב.'] },
  ido: { name: 'עידו', role: 'Backend', car: 'ido', face: 'ido', lines: ['עידו. ה-temperature שלו על אפס, גם בחניה הוא תמיד באותו מקום.', 'המיקרופון של הפודקאסט על הכיסא האחורי. בין שני גיקים, בין שני עמודים.'] },
  tzvika: { name: 'צביקה', role: 'Core Platform', car: 'tzvika', face: 'tzvika', lines: ['צביקה חונה באותו מקום מ-1998. legacy על ארבעה גלגלים.', 'בקוד של צביקה אסור לגעת. באוטו של צביקה אין ברירה.'] },
  amir: { name: 'אמיר', role: 'סמנכ״ל אסטרטגיה', car: 'amir', face: 'amir', lines: ['אמיר השאיר את הגג פתוח. חשיפה מלאה, אפס הגנה.', 'סמנכ״ל אסטרטגיה. האסטרטגיה: לחנות על הקו.'] },
  ronit: { name: 'רונית', role: 'COO', car: 'ronit', face: 'ronit', lines: ['רונית מניהול סיכונים חנתה בדיוק על ה-critical path.', 'האוטו של רונית מבריק. ה-risk היחיד פה זה אני.'] },
  daniel: { name: 'דניאל', role: 'AI Enablement', car: 'daniel', face: 'daniel', lines: ['דניאל מטעין. blocking resource עד שהסוללה מלאה.', 'כבל טעינה על הגג. זה לא אוטו, זה device.'] },
  sagi: { name: 'שגיא', role: 'Customer Success', car: 'sagi', face: 'sagi', lines: ['שגיא. יש לו קורקינט על הגג. למה הוא צריך בכלל אוטו?', 'אם שגיא יראה שהזזתי, אני שומע על הקורקינט עד 2027.'] },
  gilad: { name: 'גלעד', role: 'מנכ״ל', car: 'gilad', face: 'gilad', lines: ['גלעד. ה-root process. אם הוא לא זז, אף אחד לא זז.', 'לימוזינה של מנכ״ל. שלוש משבצות של over-provisioning.'] },
  ofer: { name: 'עופר', role: 'סמנכ״ל פיתוח עסקי', car: 'ofer-suv', face: 'ofer', lines: ['עופר. SUV עם ארגז גג. capacity planning של אופטימיסט.', 'פיתוח עסקי: תופס הכי הרבה מקום ומבטיח שזה זמני.'] },
  shuttle: { name: 'ההסעה של אסנת', role: 'מועמדים לראיונות', car: 'shuttle', face: 'osnat', lines: ['ההסעה של המועמדים של אסנת. עשרים מועמדים, משרה אחת. Starvation.', 'מיניבוס בחניון. מישהו פה לא עשה capacity planning.'] },
};
const SHORT = ['erez', 'osnat', 'yaniv', 'ido', 'tzvika', 'amir', 'ronit', 'daniel', 'sagi'];
const LONG = ['gilad', 'ofer', 'shuttle'];

const LINES = {
  start: ['Circular Wait קלאסי. כולם מחכים לכולם.', 'זה לא חניון. זה גרף תלויות עם עמודים.', 'שבע בערב, חניון B2. Deadlock. כרגיל.', 'אף אחד לא פתח לי ticket. אני פותר את זה בכל זאת.', 'בוא נמצא את ה-Victim Process.'],
  optimal: ['Shortest path. בלי אף תנועה מיותרת.', 'אופטימלי. אני אוהב כשהגרף מסכים איתי.', 'מינימום תנועות. ככה נראה pipeline נקי.'],
  extra: ['יצאתי. עם קצת overhead. זה בסדר, זה בסדר.', 'כמה תנועות מעל האופטימום. זה לא כישלון, זה edge case.', 'יצאתי. ה-latency קצת גבוה, אבל יצאתי.'],
  livelock: ['כולם זזים ואף אחד לא מתקדם. זה כבר Livelock.', 'הרבה תנועות, אפס התקדמות. אני מכיר את זה מישיבות.'],
  restart: ['Rollback. לפעמים זה הכי נכון.', 'חוזרים ל-commit האחרון שעבד.'],
  blocked: ['אני לא עובר דרך {n}. זה לא Kubernetes.', '{n} חוסם לי את הנתיב. Circular Wait.'],
  hint: ['תזיז את {n}. בוחרים Victim Process אחד ומשחררים את כולם.', '{n}. משם מתחיל ה-bottleneck.', 'האוטו של {n}. אתה לא יודע מה זה Hold and Wait? זה בדיוק זה.'],
};

// what each teammate says out of the car window (Terra, 10 Nov): colleagues - polite, never shouting
const WIN = {
  erez: {"moved":["יותם, שלח לי מיקום בוואטסאפ.","סבבה, רק בלי שרשור בסלאק.","אני בשיחה, תזיז חופשי."],"bumped":["הכול טוב, זה לא פרודקשן.","ראיתי, נטפל בזה אחרי השיחה.","קטן, כמו באג קוסמטי."],"blocking":["סליחה, יותם, אני מסיים שיחה.","עוד רגע אני מזיז אותה.","שלחתי לעצמי תזכורת בוואטסאפ."]},
  osnat: {"moved":["יותם, נוח לך להזיז אותה?","בטח, תודה ששאלת קודם.","איך אתה מרגיש עם המסלול הזה?"],"bumped":["הכול בסדר, תודה שבדקת.","זה היה מגע קטן, נכון?","בוא ננשום, הכול טוב."],"blocking":["סליחה, יותם, אני עם מועמדת.","אני זזה מיד, איך אתה מרגיש?","עוד שנייה, מסיימת שיחת גיוס."]},
  yaniv: {"moved":["רק בלי לגעת בנעילה, בסדר?","מאשר, תחת פיקוח סביר.","ההגה נעול, מטעמי אבטחה."],"bumped":["ראית משהו חשוד בפגוש?","תיעדת את האירוע, במקרה?","הכול בסדר, אבל נבדוק לוגים."],"blocking":["סליחה, מערכת הנעילה מתעדכנת.","אני פותח גישה עוד רגע.","רק אימות דו-שלבי, יותם."]},
  ido: {"moved":["כן.","תזיז חופשי.","שקט, הכול עובד."],"bumped":["לא נורא.","פגיעה דטרמיניסטית קטנה.","נדבר על זה בפודקאסט."],"blocking":["רגע.","אני זז.","המסלול חסום זמנית."]},
  tzvika: {"moved":["המקום הזה עבד מאז תשעים ושמונה.","תזיז, אבל תחזיר בדיוק.","זה לא באג, זו מסורת."],"bumped":["הפגוש כבר ראה גרסאות.","קטן, כמו תיקון לגאסי.","אין צורך לפתוח טיקט."],"blocking":["סליחה, זו החניה הקבועה שלי.","אני זז, לפי הנוהל הישן.","רגע, המערכת מתייצבת."]},
  amir: {"moved":["מהלך טקטי עם ערך ברור.","מבחינתי, זו סינרגיה בחניון.","תזיז, ונייצר מומנטום."],"bumped":["נפיקה מזה למידה ארגונית.","הסיכון היה מחושב היטב.","בוא נמנף את הרגע."],"blocking":["סליחה, אני מייצר צוואר בקבוק.","מיד אפתח נתיב אסטרטגי.","זו חסימה זמנית, לא כיוון."]},
  ronit: {"moved":["תודה, יותם, בעדינות בבקשה.","מעולה, רק לשמור מרחק.","הרכב נקי, כן?"],"bumped":["הכול בסדר, בוא נבדוק סימנים.","ראית שריטה חדשה אולי?","תודה שעצרת מיד."],"blocking":["סליחה, אני זזה בזהירות.","עוד רגע, אני בודקת מרווחים.","לא רציתי לחסום לך נתיב."]},
  daniel: {"moved":["בטח, רק הכבל מחובר.","תזיז בעדינות ליד העמדה.","הסוללה איתך, יותם."],"bumped":["הכול טוב, אין נזק לחשמל.","רק לא על שקע הטעינה.","קטן, כמו ירידת אחוז סוללה."],"blocking":["סליחה, הכבל קצת מגביל.","אני מנתק וזז מיד.","רק מסיים טעינה קצרה."]},
  sagi: {"moved":["שמעת על הקורקינט שלי?","בטח, הוא הרבה יותר זריז.","תזיז, אני כבר כמעט בקורקינט."],"bumped":["הכול טוב, הקורקינט עבר יותר.","שמעת על הקורקינט שלי?","מזל שלא נגעת בקורקינט."],"blocking":["סליחה, הקורקינט מסבך הכול.","אני זז, ממש כמו קורקינט.","שמעת על הקורקינט שלי?"]},
  gilad: {"moved":["מצוין, יותם, קדימה קדימה.","סומך עליך שתמצא דרך.","כל תנועה מקדמת אותנו."],"bumped":["הכול טוב, קורה לטובים.","תודה על האחריות, יותם.","נלמד ונמשיך קדימה."],"blocking":["סליחה, יותם, מפנים את הדרך.","עוד רגע כולנו יוצאים קדימה.","תודה על הסבלנות והיוזמה."]},
  ofer: {"moved":["תזיז, אני סוגר דיל.","ה-SUV זמני, באמת.","רק תשמור על המראה."],"bumped":["הכול טוב, נסגור את זה.","קטן, לא שובר עסקה.","ה-SUV בנוי לזה."],"blocking":["סליחה, ה-SUV קצת רחב.","אני זז אחרי השיחה הזאת.","זה זמני, ממש זמני."]},
  shuttle: {"moved":["תודה, יותם, המועמדים מחכים.","מעולה, זה משפר חוויית מועמד.","בעדינות, יש כאן קורות חיים."],"bumped":["הכול בסדר, אף מועמד לא נבהל.","תודה שבדקת, יותם.","בוא נשמור על חוויה נעימה."],"blocking":["סליחה, המועמדים עולים עכשיו.","עוד רגע מפנים את הנתיב.","אני מסיימת תדריך קצר."]},
  general: {"moved":["תודה, יותם, זה עזר מאוד.","מעולה, עכשיו יש מעבר.","איזה מזל שאתה כאן."],"bumped":["הכול בסדר, תודה שעצרת.","לא קרה כלום, באמת.","קטן ועדין, ממשיכים."],"blocking":["סליחה על החסימה, זזים מיד.","עוד רגע הדרך פנויה.","תודה על הסבלנות, יותם."]},
};

// the team chat, #חניון-b2 (Terra, 10 Nov): what they post while the lot is stuck / when Yotam gets out
const CHAT = {
  erez: {"start":["יותם, איתך. ממפה את החסימות.","אני עדיין למעלה, יורד אליכם עכשיו."],"done":["יפה יותם, אקסקיושן נקי תחת לחץ.","תודה כולם, זו עבודת צוות אמיתית."]},
  osnat: {"start":["אוי, נראה שהרכב שלי חלק מהסיפור.","אני בשיחת גיוס, משתדלת לסיים מהר."],"done":["כל הכבוד יותם, איזה קור רוח.","תודה על הסבלנות, צוות נהדר 💛"]},
  yaniv: {"start":["מישהו בדק שהמחסום לא ננעל מבחוץ?","הרכב שלי נעול, אבל אולי הוא חוסם."],"done":["יציאה מאושרת. לא זיהיתי חריגות אבטחה.","יותם, תודה שלא עקפת את המחסום."]},
  ido: {"start":["אני עם האוזניות, יורד בעוד דקה.","יכול להיות שהאוטו שלי מאחורי צביקה."],"done":["מעולה, יותם. נחזור לפרק ששמענו.","החניון פתר את עצמו, כמעט כמו API."]},
  tzvika: {"start":["הרכב שלי שם מאז לפני המיגרציה.","אני מגיע, אבל היציאה הזו תמיד רגישה."],"done":["יפה. לא נגעתם בכלום מיותר.","המערכת הישנה שוב הוכיחה יציבות."]},
  amir: {"start":["זו הזדמנות ליישר תנועה סביב יעד משותף.","אני עדיין בפגישה, הרכב שלי בחוץ."],"done":["מצוין, הפכנו חסם לתנופת ביצוע.","יותם הוביל מהלך ממוקד תוצאה."]},
  ronit: {"start":["רשמתי: חסימה זמנית, בעלים בדרך.","בבקשה לא להזיז רכבים ללא תיאום."],"done":["האירוע נסגר ללא נזק, תודה לכולם.","עדכנתי את הרישום. אפשר להמשיך בערב."]},
  daniel: {"start":["החשמלית שלי עדיין בטעינה, סליחה.","נשארו לה שבע דקות, ואז אזיז."],"done":["הטעינה הסתיימה בדיוק בזמן, מעולה.","יותם, סע בזהירות."]},
  sagi: {"start":["שמעתם על הקורקינט שלי? יורד איתו עכשיו.","הרכב שלי אולי ליד העמדה, בודק."],"done":["יש! הלקוח הפנימי שלנו יצא מרוצה.","יותם, ספר לכולם איך ניצחת."]},
  gilad: {"start":["צוות, נפתור את זה ברוח טקי-טק.","אני עוד במשרד, הרכב שלי בחניה."],"done":["אלופים. גם בחניון אנחנו יודעים להתקדם.","יותם, גאה בהתמדה שלך."]},
  ofer: {"start":["ה-SUV שלי שם, אבל זה זמני.","אני מסיים שיחה ויורד להזיז אותו."],"done":["נהדר, יותם. ה-SUV כבר לא מפריע.","תודה לכולם על גמישות עסקית."]},
};

// ───────────────────────── sound ─────────────────────────
const SND = { ctx: null, raw: {}, buf: {}, on: store.get(KEY.snd) !== '0', last: {}, master: null };
const SFX = [1,2,3,4,5,6,7,8].map((k) => 'slide-' + k).concat([1,2,3,4].map((k) => 'bump-' + k), [1,2,3,4,5].map((k) => 'honk-' + k), [1,2,3,4,5].map((k) => 'window-' + k), ['gate', 'pick-1', 'pick-2', 'start', 'win-1', 'win-2']);
for (const n of SFX) fetch(`assets/sfx/${n}.mp3?v=3`).then((r) => r.ok ? r.arrayBuffer() : null).then((b) => { if (b) { SND.raw[n] = b; decode(n); } }).catch(() => {});
function decode(n) {
  if (!SND.ctx || !SND.raw[n] || SND.buf[n]) return;
  const b = SND.raw[n]; SND.raw[n] = null;
  SND.ctx.decodeAudioData(b).then((x) => { SND.buf[n] = x; }).catch(() => {});
}
function audioUnlock() {
  if (SND.ctx) { if (SND.ctx.state === 'suspended' && !paused) SND.ctx.resume(); return; }
  try { SND.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  SND.master = SND.ctx.createGain(); SND.master.gain.value = SND.on ? 1 : 0; SND.master.connect(SND.ctx.destination);
  for (const n of SFX) decode(n);
  decodeMusic();
}
let music = null, musicBuf = null, musicRaw = null;
fetch('assets/music.mp3?v=2').then((r) => r.ok ? r.arrayBuffer() : null).then((b) => { musicRaw = b; decodeMusic(); }).catch(() => {});
function decodeMusic() { if (!SND.ctx || !musicRaw || musicBuf) return; const b = musicRaw; musicRaw = null; SND.ctx.decodeAudioData(b).then((x) => { musicBuf = x; if (state === 'play') musicOn(); }).catch(() => {}); }
function musicOn() { if (!SND.ctx || !musicBuf || music) return; const src = SND.ctx.createBufferSource(), g = SND.ctx.createGain(); src.buffer = musicBuf; src.loop = true; g.gain.value = 0.18; src.connect(g).connect(SND.master); src.start(); music = src; }
function musicOff() { if (music) { try { music.stop(); } catch (e) {} music = null; } }
function play(name, vol = 1) {
  if (!SND.ctx) return;
  const vars = SFX.filter((n) => n === name || n.startsWith(name + '-')).filter((n) => SND.buf[n]);
  if (!vars.length) return;
  let n = pick(vars);
  if (vars.length > 1 && n === SND.last[name]) n = vars[(vars.indexOf(n) + 1) % vars.length];
  SND.last[name] = n;
  const src = SND.ctx.createBufferSource(), gn = SND.ctx.createGain();
  src.buffer = SND.buf[n]; src.playbackRate.value = rnd(.95, 1.05); gn.gain.value = vol;
  src.connect(gn).connect(SND.master); src.start();
}
const SPK = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const MUTE = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
function sndIcons() { document.querySelectorAll('.sndBtn').forEach((b) => { b.innerHTML = SND.on ? SPK : MUTE; }); }
document.querySelectorAll('.sndBtn').forEach((b) => b.onclick = () => { audioUnlock(); SND.on = !SND.on; store.set(KEY.snd, SND.on ? '1' : '0'); if (SND.master) SND.master.gain.value = SND.on ? 1 : 0; sndIcons(); });
sndIcons();
addEventListener('pagehide', () => { if (SND.ctx) SND.ctx.suspend(); });
document.addEventListener('visibilitychange', () => { if (!SND.ctx) return; if (document.hidden) SND.ctx.suspend(); else if (!paused) SND.ctx.resume(); });

// ───────────────────────── pictures ─────────────────────────
const IMG = {};
const img = (k, src) => { const i = new Image(); i.src = src; IMG[k] = i; return i; };
img('floor', 'assets/floor.jpg');
img('lobby', 'assets/lobby.jpg?v=1');
for (const id in TEAM) { img('car-' + TEAM[id].car, `assets/cars/${TEAM[id].car}.webp`); img('face-' + TEAM[id].face, `assets/faces/${TEAM[id].face}.webp`); }
const POSES = { open: 'assets/yotam-open.webp', explain: 'assets/yotam-explain.webp', sad: 'assets/yotam-sad.webp' };
for (const k in POSES) img('pose-' + k, POSES[k]);

// the painted floor (1024x1385): the 6x6 grid sits at x 10, y 385, 150 px a space; the gate gap is on the right of row 2
const FL = { w: 1024, h: 1385, x0: 10, y0: 385, cell: 150, gateX: 962, gapT: 688, gapB: 832 };
const N = 6, EXIT_ROW = 2;

// ───────────────────────── layout ─────────────────────────
const cv = $('cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, S = 1, OX = 0, OY = 0, CELL = 50;   // S = floor picture scale, OX/OY = its top-left
const cssPx = (v) => { const d = document.createElement('div'); d.style.cssText = `position:fixed;top:${v};visibility:hidden`; document.body.appendChild(d); const t = d.getBoundingClientRect().top; d.remove(); return t; };
function layout() {
  DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  document.body.classList.toggle('turn', W > H * 1.15 && H < 520);
  const top = cssPx('var(--safe-t)') + 4;
  const stripH = Math.max(76, Math.min(118, H * 0.14));
  document.documentElement.style.setProperty('--stripH', stripH + 'px');
  document.documentElement.style.setProperty('--sayF', (H < 600 ? 14 : W < 360 ? 15 : 17) + 'px');
  const bottom = H - stripH - 16 - 52 - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-b')) || 0);
  // show the floor from the wall sign down; on short screens crop the wall so the grid stays big
  const cropTop = Math.max(0, Math.min(60, FL.y0 - 40 - (bottom - top) * 0.25));   // never above the sign (y 90)
  const vis = FL.h - cropTop - 70;
  S = Math.min(W / FL.w, (bottom - top) / vis);
  OX = (W - FL.w * S) / 2; OY = top - cropTop * S;   // pinned to the top; the lobby takes what is left
  CELL = FL.cell * S;
  const gy = OY + (FL.y0 + N * FL.cell) * S;
  $('chip').style.top = Math.min(gy + 4, bottom - 40) + 'px';
}
addEventListener('resize', layout);
layout();
const gx = (c) => OX + (FL.x0 + c * FL.cell) * S;
const gy = (r) => OY + (FL.y0 + r * FL.cell) * S;

// ───────────────────────── the lot ─────────────────────────
// piece: { r, c, len, h, id (team id), flip, pos (col if h, row if v), f (float pos while dragging) }
let pieces = [], start = null, opt = 0, moves = 0, penalty = 0, lotIdx = 0, lots = [], results = [];
let state = 'menu', paused = false, tutorial = false, drive = null, hintShow = null, livelockSaid = false;
let bank = null;
const dayTeam = new Set();
fetch('lots.json?v=3').then((r) => r.json()).then((j) => { bank = j; }).catch(() => {});

function dayLots() {
  const d = today();
  return bank.tiers.map((t, i) => t[hash(`${SLUG}|${d}|${i}`) % t.length]);
}
function makePieces(lot, seedKey) {
  const R = seeded(seedKey), short = SHORT.slice(), long = LONG.slice();
  const take = (a) => a.splice(Math.floor(R() * a.length), 1)[0];
  return lot.p.map(([r, c, len, h], i) => ({
    r, c, len, h: !!h, id: i === 0 ? 'yotam' : (len === 3 ? (long.length ? take(long) : take(short)) : (short.length ? take(short) : 'erez')),
    flip: i === 0 ? false : R() < 0.5, pos: h ? c : r, f: null,
  }));
}
function grid(skip = -1) {
  const g = Array.from({ length: N }, () => Array(N).fill(-1));
  pieces.forEach((p, i) => { if (i === skip) return; for (let k = 0; k < p.len; k++) { const r = p.h ? p.r : p.pos + k, c = p.h ? p.pos + k : p.c; g[r][c] = i; } });
  return g;
}
function bounds(i) {
  const p = pieces[i], g = grid(i), at = (q) => (p.h ? g[p.r][q] : g[q][p.c]);
  let lo = p.pos, hi = p.pos;
  while (lo - 1 >= 0 && at(lo - 1) < 0) lo--;
  while (hi + p.len < N && at(hi + p.len) < 0) hi++;
  let blockLo = lo - 1 >= 0 ? at(lo - 1) : -1, blockHi = hi + p.len < N ? at(hi + p.len) : -1;
  return { lo, hi, blockLo, blockHi };
}
function syncRC(p) { if (p.h) p.c = p.pos; else p.r = p.pos; }

function loadLot(i) {
  lotIdx = i; const lot = lots[i];
  clearPeeks();
  pieces = makePieces(lot, `${SLUG}|${today()}|${i}|cars`); opt = lot.opt; moves = 0; penalty = 0; livelockSaid = false; hintShow = null; drive = null;
  start = pieces.map((p) => p.pos);
  hud();
  say(pickNo(LINES.start, 'start'), 'open');
  const ids = [...new Set(pieces.slice(1).map((p) => p.id))].filter((id) => CHAT[id]);
  ids.forEach((id) => dayTeam.add(id));
  chatClear(); if (i === 0) chatMin = 2;
  const a = pick(ids), b = pick(ids.filter((x) => x !== a));
  chatLater(1500, a, 'start'); if (b) chatLater(7000, b, 'start');
}
function startGame() {
  if (!bank) { setTimeout(startGame, 200); return; }
  tutorial = false; lots = dayLots(); results = []; state = 'play'; dayTeam.clear();
  show(null); showHUD(true); loadLot(0); musicOn(); play('start', .6);
  chip('גררו', 'מכונית לאורכה');
  window.track && window.track('game_start', SLUG);
}
function resetLot() {
  clearPeeks();
  if (state !== 'play' && state !== 'tut') return;
  if (drive) return;
  pieces.forEach((p, i) => { p.pos = start[i]; p.f = null; syncRC(p); });
  if (!tutorial) { moves = 0; penalty = 0; livelockSaid = false; }
  hintShow = null; hud(); play('pick', .5);
  say(pickNo(LINES.restart, 'rs'), 'open');
}

// ───────────────────────── solver (hint) ─────────────────────────
function solveFirst() {
  const fixed = pieces.map((p) => ({ len: p.len, h: p.h, line: p.h ? p.r : p.c }));
  const s0 = pieces.map((p) => p.pos).join('');
  if (s0[0] === '4') return null;
  const next = (s) => {
    const g = new Int8Array(36).fill(-1);
    for (let i = 0; i < fixed.length; i++) { const f = fixed[i], p = +s[i]; for (let k = 0; k < f.len; k++) { const r = f.h ? f.line : p + k, c = f.h ? p + k : f.line; g[r * 6 + c] = i; } }
    const out = [];
    for (let i = 0; i < fixed.length; i++) { const f = fixed[i], p = +s[i], at = (q) => (f.h ? g[f.line * 6 + q] : g[q * 6 + f.line]);
      for (let q = p - 1; q >= 0 && at(q) < 0; q--) out.push([s.slice(0, i) + q + s.slice(i + 1), i, q]);
      for (let q = p + f.len; q < N && at(q) < 0; q++) out.push([s.slice(0, i) + (q - f.len + 1) + s.slice(i + 1), i, q - f.len + 1]); }
    return out;
  };
  const from = new Map([[s0, null]]), q = [s0];
  for (let k = 0; k < q.length && k < 120000; k++) {
    for (const [t, i, to] of next(q[k])) {
      if (from.has(t)) continue;
      from.set(t, [q[k], i, to]);
      if (t[0] === '4') {   // walk back to the first move
        let cur = t, step = from.get(cur), len = 1;
        while (step[0] !== s0) { cur = step[0]; step = from.get(cur); len++; }
        return { i: step[1], to: step[2], left: len };
      }
      q.push(t);
    }
  }
  return null;
}
function hint() {
  if (state !== 'play' || drive) return;
  audioUnlock();
  const h = solveFirst(); if (!h) return;
  hintShow = { i: h.i, to: h.to, t: 0 };
  if (!tutorial) { penalty += 3; const b = $('movesBox'); b.classList.remove('pen'); void b.offsetWidth; b.classList.add('pen'); { const r = $('movesBox').getBoundingClientRect(); popAt(r.left + r.width / 2, r.bottom + 34, '+3 תנועות', 'bad'); } }
  hud();
  const who = TEAM[pieces[h.i].id];
  say(pickNo(LINES.hint, 'hint').replace('{n}', h.i === 0 ? 'האוטו שלי' : who.name), 'explain', h.i === 0 ? null : pieces[h.i].id);
  play('pick', .6);
}

// ───────────────────────── HUD, words ─────────────────────────
function hud() {
  $('movesTxt').textContent = moves + penalty;
  $('movesSub').textContent = tutorial ? 'תנועות' : `מינימום ${opt}`;
  $('lotTxt').textContent = tutorial ? 'תרגול' : `${lotIdx + 1}/5`;
}
function showHUD(on) { $('hud').classList.toggle('on', on); $('strip').classList.toggle('on', on); if (!on) chip(null); }
let sayT = 0;
function say(text, pose = 'open', who = null) {
  const b = $('bubble');
  const w = who && TEAM[who] ? `<div class="who"><img src="assets/faces/${TEAM[who].face}.webp" alt="">${TEAM[who].name} · ${TEAM[who].role}</div>` : '';
  b.innerHTML = w + text.replace(/([A-Za-z][A-Za-z0-9 \-&.()]*[A-Za-z0-9)])/g, '<b dir="ltr">$1</b>');
  b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
  $('yHead').src = POSES[pose] || POSES.open;
  sayT = 4.5;
}
function chip(verb, rest) {
  const c = $('chip');
  if (!verb) { c.classList.remove('on'); return; }
  c.innerHTML = `<em>${verb}</em>${rest || ''}`; c.classList.add('on');
}
function popAt(x, y, text, cls = '') {
  const d = document.createElement('div'); d.className = 'pop ' + cls; d.textContent = text;
  d.style.left = x + 'px'; d.style.top = y + 'px'; $('fx').appendChild(d); setTimeout(() => d.remove(), 1200);
}
function tagAt(i) {
  const p = pieces[i], t = TEAM[p.id];
  const x = gx(p.c + (p.h ? p.len / 2 : .5)), y = gy(p.r) - 4;
  const d = document.createElement('div'); d.className = 'tag';
  d.innerHTML = `<img src="assets/faces/${t.face}.webp" alt=""><span>${t.name} <small>· ${t.role}</small></span>`;
  d.style.top = Math.max(60, y) + 'px';
  $('fx').querySelectorAll('.tag').forEach((e) => e.remove());
  $('fx').appendChild(d);
  const hw = d.offsetWidth / 2 + 6; d.style.left = Math.max(hw, Math.min(W - hw, x)) + 'px';
  setTimeout(() => d.remove(), 1700);
}
const peeks = [];   // { i, t, dur, side }
function peek(i, kind) {
  const p = pieces[i]; if (!p || i === 0 || p.gone) return;
  const t = TEAM[p.id], L = WIN[p.id] || WIN.general;
  const text = pickNo(Math.random() < .25 ? WIN.general[kind] : L[kind], p.id + kind);
  for (let k = peeks.length - 1; k >= 0; k--) if (peeks[k].i === i || peeks.length > 1) { peeks[k].el.remove(); peeks.splice(k, 1); }
  // the window on the side facing the middle of the board
  const side = p.h ? (p.r < N / 2 ? 1 : -1) : (p.c < N / 2 ? 1 : -1);
  const el = document.createElement('div'); el.className = 'peek';
  el.innerHTML = `<b>${t.name}</b>${text}`;
  $('fx').appendChild(el);
  const k = { i, t: 0, dur: 2.6, side, el };
  peeks.push(k); placePeek(k);
  play('window', .45);
}
function peekHead(k, full) {
  const p = pieces[k.i], w = (p.h ? p.len : 1) * CELL, h = (p.h ? 1 : p.len) * CELL;
  const cx = gx(p.c) + w / 2, cy = gy(p.r) + h / 2;
  const out = Math.min(1, k.t / .25, (k.dur - k.t) / .3);   // slides out, stays, slides back
  const e = full ? 1 : out <= 0 ? 0 : 1 - (1 - out) ** 3;
  const reach = CELL * .5;
  return p.h ? { x: cx, y: cy + k.side * reach * e, e } : { x: cx + k.side * reach * e, y: cy, e };
}
function placePeek(k) {
  const hd = peekHead(k, true), d = CELL * .62, bw = k.el.offsetWidth, hw = bw / 2 + 6;
  let y = hd.y - d * .55 - 8, x = Math.max(hw, Math.min(W - hw, hd.x));
  if (y - k.el.offsetHeight < cssPx('var(--safe-t)') + 4) y = hd.y + d * .55 + k.el.offsetHeight + 14;
  k.el.style.left = x + 'px'; k.el.style.top = y + 'px';
  k.el.style.setProperty('--tail', Math.max(14, Math.min(bw - 14, hd.x - x + bw / 2)) + 'px');
}
function tickPeeks(dt) {
  for (let k = peeks.length - 1; k >= 0; k--) { const q = peeks[k]; q.t += dt; if (q.t >= q.dur || !pieces[q.i]) { q.el.remove(); peeks.splice(k, 1); } }
}
function clearPeeks() { while (peeks.length) peeks.pop().el.remove(); }
// ───────────────────────── team chat ─────────────────────────
let chatQ = [], chatMin = 0;
function placeChat() {
  // between the lobby floor and Yotam's bubble, beside his head: two messages when there is room, one when tight
  const c = $('chat'), sr = $('strip').getBoundingClientRect(), head = $('yHead').getBoundingClientRect();
  const room = (sr.top || H - 170) + Math.max(0, (sr.height - 74) / 2) - 6 - lobbyFloor, list = $('chatList').children;
  c.style.top = lobbyFloor + 'px';
  c.style.right = Math.max(10, W - head.left + 6) + 'px';
  for (let k = 0; k < list.length; k++) list[k].style.display = room < 96 && k < list.length - 1 ? 'none' : '';
  c.classList.toggle('on', state === 'play' && room >= 52 && list.length > 0);
}
function post(id, kind) {
  const t = TEAM[id], L = CHAT[id] && CHAT[id][kind]; if (!t || !L) return;
  const m = document.createElement('div'); m.className = 'msg';
  chatMin = Math.min(59, chatMin + 1 + Math.floor(Math.random() * 3));
  m.innerHTML = `<img src="assets/faces/${t.face}.webp" alt=""><div><b>${t.name}</b><i>19:${String(chatMin).padStart(2, '0')}</i><br>${pickNo(L, id + 'c' + kind)}</div>`;
  const list = $('chatList'); list.appendChild(m);
  while (list.children.length > 2) list.firstElementChild.remove();
  placeChat();
}
function chatLater(ms, id, kind) { const lot = lotIdx; chatQ.push(setTimeout(() => { if (state === 'play' && lotIdx === lot) post(id, kind); }, ms)); }
function chatClear() { chatQ.forEach(clearTimeout); chatQ = []; $('chatList').innerHTML = ''; placeChat(); }
function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id)); }

// ───────────────────────── input: drag a car along its length ─────────────────────────
let drag = null;
function pieceAt(x, y) {
  const c = Math.floor((x - gx(0)) / CELL), r = Math.floor((y - gy(0)) / CELL);
  if (c < 0 || r < 0 || c >= N || r >= N) return -1;
  return grid()[r][c];
}
cv.addEventListener('pointerdown', (e) => {
  if ((state !== 'play' && state !== 'tut') || paused || drive) return;
  audioUnlock();
  const i = pieceAt(e.clientX, e.clientY);
  if (i < 0) return;
  if (tut.on && !tut.allows(i)) return;
  cv.setPointerCapture(e.pointerId);
  const p = pieces[i], b = bounds(i);
  drag = { i, id: e.pointerId, x0: e.clientX, y0: e.clientY, pos0: p.pos, b, moved: false, bumped: 0 };
  p.f = p.pos;
});
cv.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const p = pieces[drag.i], d = (p.h ? e.clientX - drag.x0 : e.clientY - drag.y0) / CELL;
  if (Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) > 8) drag.moved = true;
  const want = drag.pos0 + d;
  p.f = Math.max(drag.b.lo, Math.min(drag.b.hi, want));
  // pushing into a car: one bump, and Yotam's own car names who blocks him
  const over = want < drag.b.lo - .3 ? drag.b.blockLo : want > drag.b.hi + .3 ? drag.b.blockHi : -2;
  if (over !== -2 && drag.bumped !== (want < drag.b.lo ? -1 : 1)) {
    drag.bumped = want < drag.b.lo ? -1 : 1; play('bump', .6);
    if (drag.i === 0 && over >= 0) { say(pickNo(LINES.blocked, 'bl').replace('{n}', TEAM[pieces[over].id].name), 'sad', pieces[over].id); peek(over, 'blocking'); }
    else if (over > 0) peek(over, 'bumped');
  } else if (over === -2) drag.bumped = 0;
});
function endDrag(e) {
  if (!drag || (e && e.pointerId !== drag.id)) return;
  const i = drag.i, p = pieces[i], to = Math.round(p.f);
  p.f = null;
  if (!drag.moved) { tapCar(i); drag = null; return; }
  if (to !== drag.pos0) {
    p.pos = to; syncRC(p);
    if (state === 'play' || tutorial) moves++;
    play('slide', .7);
    if (hintShow) hintShow = null;
    if (tut.on) tut.event('move', i);
    if (i !== 0) peek(i, 'moved');
    if (!tutorial && !livelockSaid && moves > opt * 2 + 4) { livelockSaid = true; say(pickNo(LINES.livelock, 'll'), 'sad'); }
    hud();
    if (i === 0 && p.pos === N - 2) win();
  }
  drag = null;
}
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);
function tapCar(i) {
  const p = pieces[i];
  tagAt(i); play(i === 0 ? 'pick' : 'honk', i === 0 ? .6 : .3);
  if (i === 0) say('זה אני. האוטו הירוק עם הגלקסיה. צריך להביא אותו עד המחסום.', 'open');
  else say(pickNo(TEAM[p.id].lines, p.id), 'explain', p.id);
  if (tut.on) tut.event('tap', i);
}

// ───────────────────────── winning a lot ─────────────────────────
function win() {
  drive = { t: 0 }; hintShow = null; chip(null);
  play('gate', .8);
  if (!tutorial) { const ids = pieces.slice(1).map((p) => p.id).filter((id) => CHAT[id]); if (ids.length) post(pick(ids), 'done'); }
  const total = moves + penalty;
  if (!tutorial) results[lotIdx] = { moves: total, opt };
  const good = total <= opt;
  say(pickNo(good ? LINES.optimal : LINES.extra, good ? 'op' : 'ex'), good ? 'explain' : 'open');
}
function afterDrive() {
  drive = null;
  if (tut.on) { pieces[0].gone = true; tut.event('win', 0); return; }
  if (lotIdx === 4) return gameOver();
  const r = results[lotIdx];
  play('win', .6); clearPeeks();
  $('lotH').textContent = `חניון ${lotIdx + 1} – יצאתי!`;
  $('lotLine').innerHTML = $('bubble').innerHTML.replace(/<div class="who">.*?<\/div>/, '');
  $('lotHead').src = r.moves <= r.opt ? POSES.explain : POSES.open;
  $('lotStat').innerHTML = `<b>${r.moves}</b> תנועות · המינימום האפשרי: <b>${r.opt}</b>`;
  dots('lotDots', lotIdx + 1);
  show('lotDone');
}
function dots(id, done) { $(id).innerHTML = [0, 1, 2, 3, 4].map((i) => `<i class="${i < done ? 'done' : i === done ? 'now' : ''}"></i>`).join(''); }
$('nextBtn').onclick = () => { show(null); loadLot(lotIdx + 1); };

function gameOver() {
  state = 'over'; musicOff(); showHUD(false); play('win', .7);
  const total = results.reduce((a, r) => a + r.moves, 0), optSum = results.reduce((a, r) => a + r.opt, 0);
  const d = today(), dayRec = (store.get(KEY.day) || '').split('|'), prevDay = dayRec[0] === d ? +dayRec[1] : 0;
  const best = +(store.get(KEY.best) || 0);
  const newDay = !prevDay || total < prevDay;
  if (newDay) store.set(KEY.day, `${d}|${total}`);
  if (!best || total < best) store.set(KEY.best, total);
  $('overScore').innerHTML = `${total}<small>תנועות היום</small>`;
  $('overOpt').innerHTML = `המינימום של היום: <b>${optSum}</b>` + (total === optSum ? ' · מושלם!' : ` · ${total - optSum} מעל`);
  $('overRec').innerHTML = newDay && prevDay ? '<span class="newrec">שיא יומי חדש!</span>' : '';
  $('overLine').textContent = total === optSum ? '״חמישה חניונים, אפס overhead. אני ה-System Architect של החיים עצמם. רק שאף אחד לא פתח לי ticket.״'
    : '״חמישה חניונים. מחר אותו גרף, ואני כבר יודע איפה ה-bottleneck. זה בסדר, זה בסדר.״';
  dots('overDots', 5);
  $('overTeam').innerHTML = [...dayTeam].map((id) => `<a href="/c/${id}" target="_top"><img src="assets/faces/${TEAM[id].face}.webp" alt="">${TEAM[id].name}</a>`).join('');
  chatClear();
  show('over');
  window.track && window.track('game_over', SLUG);
  window.VerseFrame && VerseFrame.score && VerseFrame.score(total);
}
function showBest() {
  const d = today(), rec = (store.get(KEY.day) || '').split('|');
  $('bestStart').innerHTML = rec[0] === d ? `השיא שלך היום: <b>${rec[1]}</b> תנועות` : '5 חניונים חדשים כל יום · פחות תנועות = שיא';
}
showBest();

// ───────────────────────── drawing ─────────────────────────
let lastT = performance.now();
function frame(t) {
  const dt = Math.min(.05, (t - lastT) / 1000); lastT = t;
  if (!paused) tick(dt);
  draw(t / 1000);
  requestAnimationFrame(frame);
}
function tick(dt) {
  if (sayT > 0 && (sayT -= dt) <= 0) $('bubble').classList.remove('on');
  if (drive) { drive.t += dt; if (drive.t > 1.6) afterDrive(); }
  if (hintShow) hintShow.t += dt;
  if (tut.on) tut.update();
  tickPeeks(dt);
}
function draw(time) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#1b2333'; ctx.fillRect(0, 0, W, H);
  const fl = IMG.floor;
  if (fl.complete && fl.naturalWidth) ctx.drawImage(fl, OX, OY, FL.w * S, FL.h * S);
  drawLobby();
  if (state === 'menu') return;
  // parking lines
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(1.5, 5 * S); ctx.setLineDash([]);
  ctx.strokeRect(gx(0), gy(0), N * CELL, N * CELL);
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = Math.max(1, 3 * S);
  for (let k = 1; k < N; k++) {
    ctx.beginPath(); ctx.moveTo(gx(k), gy(0)); ctx.lineTo(gx(k), gy(N)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx(0), gy(k)); ctx.lineTo(gx(N), gy(k)); ctx.stroke();
  }
  // the exit lane: yellow chevrons in Yotam's row, pointing at the gate
  ctx.fillStyle = 'rgba(250,204,21,.35)';
  const ry = gy(EXIT_ROW) + CELL / 2;
  for (let k = 0; k < 3; k++) {
    const x = gx(N) - CELL * .18 - k * CELL * .26 + Math.sin(time * 3) * 2;
    ctx.beginPath(); ctx.moveTo(x, ry); ctx.lineTo(x - CELL * .14, ry - CELL * .16); ctx.lineTo(x - CELL * .22, ry - CELL * .16); ctx.lineTo(x - CELL * .08, ry); ctx.lineTo(x - CELL * .22, ry + CELL * .16); ctx.lineTo(x - CELL * .14, ry + CELL * .16); ctx.fill();
  }
  ctx.restore();
  drawGate();
  // hint ghost
  if (hintShow) {
    const p = pieces[hintShow.i], a = .35 + .25 * Math.sin(hintShow.t * 6);
    const r = p.h ? p.r : hintShow.to, c = p.h ? hintShow.to : p.c;
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#fde68a'; ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3;
    roundRect(gx(c) + 4, gy(r) + 4, (p.h ? p.len : 1) * CELL - 8, (p.h ? 1 : p.len) * CELL - 8, 12); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  // cars, the dragged one last
  const order = pieces.map((_, i) => i).sort((a, b) => (drag && drag.i === a ? 1 : 0) - (drag && drag.i === b ? 1 : 0));
  for (const i of order) drawCar(i, time);
  for (const k of peeks) drawPeek(k);
}
function drawPeek(k) {
  const p = pieces[k.i], f = IMG['face-' + TEAM[p.id].face], hd = peekHead(k), d = CELL * .62;
  if (!f.complete || !f.naturalWidth || hd.e <= 0) return;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  ctx.beginPath(); ctx.arc(hd.x, hd.y, d / 2 + 2, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.beginPath(); ctx.arc(hd.x, hd.y, d / 2, 0, 7); ctx.clip();
  ctx.drawImage(f, hd.x - d / 2, hd.y - d / 2, d, d); ctx.restore();
}
// the Techy-Tech lobby (elevator up to the office, badge reader, charger, Sagi's scooter) fills the space under the board
let lobbyFloor = 0;   // where the lobby's floor starts on screen (the chat card sits there)
function drawLobby() {
  const lb = IMG.lobby, y0 = Math.round(OY + (FL.h - 8) * S);
  if (!lb.complete || !lb.naturalWidth || y0 >= H) return;
  const ih = lb.naturalHeight - 30, sc = Math.min(Math.max(W / lb.naturalWidth, (H - y0) / ih), 1.3 * W / lb.naturalWidth), dw = lb.naturalWidth * sc, dh = ih * sc;
  ctx.drawImage(lb, 0, 30, lb.naturalWidth, ih, (W - dw) / 2, y0, dw, dh);
  const lf = Math.round(y0 + (lb.naturalHeight * 345 / 768 - 30) * sc + 6);
  if (lf !== lobbyFloor) { lobbyFloor = lf; placeChat(); }
  // a tall phone: the lobby floor goes on down to the bottom
  if (y0 + dh < H) ctx.drawImage(lb, 0, lb.naturalHeight - 120, lb.naturalWidth, 120, (W - dw) / 2, y0 + dh - 1, dw, H - y0 - dh + 1);
  const g = ctx.createLinearGradient(0, y0, 0, y0 + 14); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, 14);
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawGate() {
  const open = drive ? Math.min(1, drive.t / .35) : pieces[0] && pieces[0].gone ? 1 : 0;
  const px = OX + FL.gateX * S, py = OY + FL.gapT * S, len = (FL.gapB - FL.gapT) * S;
  ctx.save(); ctx.translate(px, py); ctx.rotate(-open * Math.PI / 2 * .95);
  const w = Math.max(5, 12 * S);
  for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? '#f8fafc' : '#dc2626'; ctx.fillRect(-w / 2, k * len / 6, w, len / 6 + .5); }
  ctx.restore();
  ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.arc(px, py, w * .9, 0, 7); ctx.fill();
}
function drawCar(i, time) {
  const p = pieces[i], t = TEAM[p.id], im = IMG['car-' + t.car];
  if (p.gone) return;
  let pos = p.f != null ? p.f : p.pos;
  let extra = 0;
  if (i === 0 && drive) extra = Math.max(0, drive.t - .25) ** 2 * 7;   // drives out through the gate
  const r = p.h ? p.r : pos, c = (p.h ? pos : p.c) + extra;
  const x = gx(c), y = gy(r), w = (p.h ? p.len : 1) * CELL, h = (p.h ? 1 : p.len) * CELL;
  const lift = drag && drag.i === i ? 1 : 0;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  if (!p.h) ctx.rotate(p.flip ? -Math.PI / 2 : Math.PI / 2); else if (p.flip) ctx.scale(-1, 1);
  const L = p.len * CELL * .93, T = CELL * .86;
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = (8 + lift * 10) * S * 2; ctx.shadowOffsetY = (3 + lift * 5) * S * 2;
  if (im.complete && im.naturalWidth) ctx.drawImage(im, -L / 2, -T / 2, L, T);
  ctx.shadowColor = 'transparent';
  if (i === 0 || (hintShow && hintShow.i === i)) {   // Yotam's car (and the hint's car) glows
    ctx.strokeStyle = i === 0 ? `rgba(190,242,100,${.55 + .3 * Math.sin(time * 4)})` : '#facc15'; ctx.lineWidth = 3;
    roundRect(-L / 2 - 2, -T / 2 - 2, L + 4, T + 4, T * .3); ctx.stroke();
  }
  ctx.restore();
  // the owner's face on the roof, always upright
  const f = IMG['face-' + t.face];
  if (f.complete && f.naturalWidth && !peeks.some((k) => k.i === i && peekHead(k).e > .15)) {
    const d = CELL * (i === 0 ? .6 : .52);
    const fx = x + w / 2 + (p.h ? (p.flip ? 1 : -1) * CELL * .18 * p.len / 2 : 0), fy = y + h / 2 + (p.h ? 0 : (p.flip ? 1 : -1) * CELL * .18 * p.len / 2);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 6;
    ctx.drawImage(f, fx - d / 2, fy - d / 2, d, d); ctx.restore();
  }
}
requestAnimationFrame(frame);

// ───────────────────────── buttons, keys ─────────────────────────
$('playBtn').onclick = () => { audioUnlock(); if (!store.get(KEY.tut)) tut.begin(); else startGame(); };
$('howBtn').onclick = () => { audioUnlock(); tut.begin(); };
$('againBtn').onclick = () => { audioUnlock(); startGame(); };
$('hintBtn').onclick = () => hint();
$('resetBtn').onclick = () => resetLot();
$('pauseBtn').onclick = () => {
  if (state !== 'play' && state !== 'tut') return;
  paused = true; musicOff(); SND.ctx && SND.ctx.suspend(); show('paused');
};
$('resumeBtn').onclick = () => { paused = false; SND.ctx && SND.ctx.resume(); show(null); if (state === 'play') musicOn(); };
$('quitBtn').onclick = () => { musicOff(); paused = false; SND.ctx && SND.ctx.resume(); state = 'menu'; clearPeeks(); chatClear(); tut.end(true); showHUD(false); showBest(); show('start'); };
addEventListener('keydown', (e) => {
  if (tut.on && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); tut.next(); }
  else if (tut.on && e.key === 'Escape') tut.end();
  else if (state === 'play' && (e.key === 'h' || e.key === 'ה')) hint();
  else if (state === 'play' && (e.key === 'r' || e.key === 'ר')) resetLot();
});

// ───────────────────────── tutorial ─────────────────────────
// its own little lot: Yotam in row 2, Erez's car blocking him at column 3, two more cars out of the way
const TUT_LOT = { p: [[2, 0, 2, 1], [1, 3, 2, 0], [0, 0, 2, 1], [3, 5, 3, 0], [4, 1, 2, 1]], opt: 2 };
const TUT_IDS = ['yotam', 'erez', 'osnat', 'gilad', 'sagi'];
const carSpot = (i, pad = 6) => { const p = pieces[i]; return { x: gx(p.c) - pad, y: gy(p.r) - pad, w: (p.h ? p.len : 1) * CELL + pad * 2, h: (p.h ? 1 : p.len) * CELL + pad * 2 }; };
const elSpot = (id, pad = 6) => { const r = $(id).getBoundingClientRect(); return { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 }; };
const STEPS = [
  { text: 'אני יותם, מטקי-טק. שבע בערב, חניון B2, וכל הצוות חסם את כולם. <b>Deadlock.</b>', spot: () => elSpot('strip', 4) },
  { text: 'המטרה: להוציא את <b>האוטו הירוק שלי</b> החוצה, דרך המחסום מימין.', spot: () => { const a = carSpot(0); return { x: a.x, y: a.y, w: OX + FL.w * S - a.x - 4, h: a.h }; } },
  { text: 'כל אוטו פה שייך למישהו מהצוות – הפרצוף על הגג אומר של מי. <b>הקישו</b> על האוטו של ארז.', spot: () => carSpot(1), try: 'tap', car: 1 },
  { text: 'מכוניות זזות רק קדימה ואחורה, לאורכן. <b>גררו</b> את האוטו של ארז מהדרך שלי.', spot: () => { const s = carSpot(1); return { x: s.x, y: gy(0) - 6, w: s.w, h: CELL * 5 + 12 }; }, try: 'clear', car: 1 },
  { text: 'הנתיב פנוי. עכשיו <b>גררו אותי</b> ימינה, עד המחסום.', spot: () => { const a = carSpot(0); return { x: a.x, y: a.y, w: gx(N) - a.x + 6, h: a.h }; }, try: 'win', car: 0 },
  { text: 'כל גרירה = <b>תנועה אחת</b>, לא משנה כמה רחוק. ליד המונה: המינימום האפשרי. פחות תנועות = שיא טוב יותר.', spot: () => elSpot('movesBox') },
  { text: '💡 <b>רמז</b> – אני מסביר מה להזיז (עולה 3 תנועות). ↺ – <b>Rollback</b>, החניון חוזר להתחלה.', spot: () => { const a = $('hintBtn').getBoundingClientRect(), b = $('resetBtn').getBoundingClientRect(); return { x: Math.min(a.left, b.left) - 6, y: a.top - 6, w: Math.abs(a.left - b.left) + a.width + 12, h: a.height + 12 }; } },
  { text: 'כל יום <b>5 חניונים</b>, מקל לקשה – אותם חניונים לכולם, ושיא יומי. מוכנים?', last: true },
];
const tut = {
  on: false, i: 0, wait: null,
  cur() { return this.on ? STEPS[this.i] : null; },
  begin() {
    clearPeeks(); show(null); showHUD(true); state = 'tut'; tutorial = true; this.on = true; this.i = 0;
    pieces = TUT_LOT.p.map(([r, c, len, h], k) => ({ r, c, len, h: !!h, id: TUT_IDS[k], flip: false, pos: h ? c : r, f: null }));
    start = pieces.map((p) => p.pos); opt = TUT_LOT.opt; moves = 0; penalty = 0; drive = null; hintShow = null; chip(null);
    hud(); $('tutCard').classList.add('on'); this.enter();
  },
  enter() {
    const s = STEPS[this.i];
    this.wait = s.try ? { id: s.try, done: false, shown: false } : null;
    $('tutText').innerHTML = s.text;
    $('tutCount').textContent = `${this.i + 1} / ${STEPS.length}`;
    $('tutBar').firstElementChild.style.width = ((this.i + 1) / STEPS.length * 100) + '%';
    $('tutNext').innerHTML = (s.last ? 'שחקו!' : 'הבא') + ' <span class="keyhint">(רווח)</span>';
    if (s.try === 'tap') chip('הקישו', 'על האוטו של ארז');
    else if (s.try === 'clear') chip('גררו', 'את ארז למעלה או למטה');
    else if (s.try === 'win') chip('גררו', 'את האוטו הירוק ימינה');
    else chip(null);
    this.update();
  },
  allows(i) { const s = STEPS[this.i]; return !s.try || s.car === i; },
  event(kind, i) {
    const w = this.wait; if (!w || w.done) return;
    if (w.id === 'tap' && kind === 'tap' && i === 1) w.done = true;
    if (w.id === 'clear' && kind === 'move' && i === 1 && grid()[EXIT_ROW][3] < 0) w.done = true;
    if (w.id === 'win' && kind === 'win') w.done = true;
  },
  next() {
    if (this.wait && !this.wait.done) return;
    if (++this.i >= STEPS.length) return this.end();
    this.enter();
  },
  end(quiet) {
    this.on = false; this.wait = null; $('tutCard').classList.remove('on'); $('tutDim').classList.remove('on');
    store.set(KEY.tut, '1'); tutorial = false; chip(null);
    if (!quiet) startGame();
  },
  update() {
    const s = STEPS[this.i], w = this.wait, sp = s.spot && s.spot();
    $('tutDim').classList.toggle('on', !!sp);
    if (sp) Object.assign($('tutHole').style, { left: sp.x + 'px', top: sp.y + 'px', width: sp.w + 'px', height: sp.h + 'px' });
    // the card sits away from the spotlight: under the HUD when the spot is low, above the strip when it is high
    const card = $('tutCard'), low = sp && sp.y + sp.h / 2 > H * .5;
    card.style.top = low ? 'calc(var(--safe-t) + 60px)' : 'auto';
    card.style.bottom = low ? 'auto' : `calc(var(--safe-b) + var(--stripH) + 72px)`;
    if (w && w.done && !w.shown) { w.shown = true; $('tutText').innerHTML = s.text + ' <span class="ok">יופי!</span>'; chip(null); }
    $('tutNext').disabled = !!(w && !w.done);
  },
};
$('tutNext').onclick = () => tut.next();
$('tutSkip').onclick = () => tut.end();

// ───────────────────────── test hook ─────────────────────────
window.DEADLOCK = {
  get state() { return state; }, get lot() { return lotIdx; }, get moves() { return moves + penalty; }, get opt() { return opt; },
  get pieces() { return pieces.map((p) => ({ id: p.id, r: p.r, c: p.c, len: p.len, h: p.h, pos: p.pos })); },
  get results() { return results; }, get tut() { return tut.on ? tut.i : -1; }, get ready() { return !!bank; },
  cell(r, c) { return { x: gx(c) + CELL / 2, y: gy(r) + CELL / 2, size: CELL }; },
  solve: () => solveFirst(),
  // slide car i to pos as a real move (tests)
  move(i, to) { const p = pieces[i], b = bounds(i); if (to < b.lo || to > b.hi || to === p.pos) return false; p.pos = to; syncRC(p); moves++; hud(); if (i === 0 && to === N - 2) win(); return true; },
  get signBottom() { return OY + 220 * S - cssPx('var(--safe-t)'); }, get peeks() { return peeks.map((k) => ({ id: pieces[k.i].id, text: k.el.textContent })); },
  skipDrive() { if (drive) drive.t = 9; },
};
