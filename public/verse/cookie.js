// The cookie notice in the Shlomiverse's voice (his idea + plan "cookie", 2026-11-07). The site has no cookies at all (t.js keeps only an
// anonymous random id) - that is the joke. Once per visitor, ever, on every page of the verse (t.js loads this file, it decides where);
// a random one of four residents gives it, the buttons in their words, and "manage preferences" opens an over-the-top settings sheet where
// every row reacts. Words by Terra from the characters' records (round 2). Self-contained: its own styles, works on the characters' sites too.
//   ?cookie=hani | yotam | yaniv | demokratovich  = show that one now (seen or not), ?cookie=1 = a random one
(function () {
  if (window.__ck) return;
  window.__ck = 1;
  var ls = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  var tr = function (e, x) { try { window.track && window.track(e, x); } catch (er) {} };
  var FACE = function (id) { return 'https://storage.googleapis.com/shlomiverse-media/wiki/img/c/' + id + '.jpg'; };
  var FOOT = 'בדפדפן נשמר רק מזהה אקראי לספירת מבקרים, בלי שם, IP או הקלדה. עוגיות אין.';

  // a row: l = the label; k = the control; m = what it says when touched (a string, or one per option for seg)
  var C = {
    hani: {
      name: 'חנה פרידמן', title: 'בלי עוגיות, ברוך השם',
      body: ['האתר לא שומר עוגיות, אבל שבת הוא כן שומר.', 'עיגוליות פרווה יש במאפיית ברכת השפע.'],
      link: { t: 'למאפייה', href: '/birkat-hashefa/' },
      ok: 'הבנתי, תודה', prefs: 'סדר העדפות',
      sheet: 'סידור ההעדפות', intro: 'נעבור מסודר, בעזרת השם, כדי שלא יישאר משהו פתוח עד ארבע ועשרים.',
      rows: [
        { l: 'אופן הפנייה', k: 'say', s: 'lock', t: 'חנה', m: 'חנה, בבקשה. תודה רבה.' },
        { l: 'אישור יותם', k: 'say', s: 'btn', t: 'שלחו ליותם', wait: 'שולח...', m: 'אם זאת ההחלטה של יותם, אז בסדר גמור.' },
        { l: 'בדיקת Cache', k: 'say', s: 'btn', t: 'הריצו', m: 'הכול תקין, ברוך השם.' },
        { l: 'רשימת איסופים', k: 'say', s: 'chip', t: 'שטערני עד שלוימי', m: 'שטערני, ברכי, חיימי, שרולי, פייגי, יענקי, רוחמי, מלכי, שלוימי. כל התשעה מסומנים, בלי עין הרע.' },
        { l: 'מלכי בגן', k: 'say', s: 'clock', t: '16:20', m: 'כבר יצאת? רק שואלת בעדינות.' },
        { l: 'רוחמי אחראית', k: 'say', s: 'chip', t: 'בת חמש', m: 'רק עד שאוספים את מלכי, כמובן.' },
        { l: 'שרולי והגבס', k: 'sw', on: true, stuck: true, m: 'זה נשאר דלוק. יש גבס, צריך זהירות.' },
        { l: 'ברכי על הקו', k: 'say', s: 'ring', t: 'ענו', m: 'לא מהחלבי, מהארון השני.' },
        { l: 'פלאפון כשר', k: 'seg', o: ['מייל', 'מייל', 'מייל'], sel: 0, m: 'אפשר לשלוח לי במייל. אין לי וואטסאפ, תודה.' },
        { l: 'סגירה לפני שבת', k: 'say', s: 'lock', t: 'מופעל', m: 'נסגר לבד בזמן. אין מה לשנות, בעזרת השם.' },
        { l: 'עיגוליות פרווה', k: 'link', t: 'מאפיית ברכת השפע', href: '/birkat-hashefa/' },
        { l: 'סייעתא דשמיא', k: 'chk', m: 'אי אפשר לבטל, אבל אין צורך, תודה רבה.' },
      ],
      save: 'בדקתי, תודה', steps: ['נשמר. רגע אחד, רק ולידציה אחרונה...'], done: 'הכול תקין. תודה רבה, בשורות טובות.',
    },
    yotam: {
      name: 'יותם', title: 'אין עוגיות. יש סדר.',
      body: ['אין כאן עוגיות.', 'משום מה גם לכלום צריך ממשק.'],
      ok: 'סיים את ה־flow', prefs: 'פתח קונפיגורציה',
      sheet: 'קונפיגורציית החלטה', intro: 'זה התחיל משני כפתורים. ואז חשבתי על ה־edge cases.',
      rows: [
        { l: 'מסלול החלטה', k: 'seg', o: ['קצר', 'ארוך', 'ארוך עם חיצים'], sel: 1, m: ['המסלול הקצר קצר מדי. הנה הסבר למה, בשלושה שלבים.', 'סביר. פתחתי לזה ticket.', 'עכשיו זה נראה כמו ארכיטקטורה.'] },
        { l: 'קוביית D20', k: 'dice', t: 'גלגל' },
        { l: 'הנחת משתמש', k: 'say', s: 'chip', t: 'בן אדם', m: 'לא endpoint, לא KPI. בן אדם.' },
        { l: 'בדיקת ג׳אז', k: 'seg', o: ['ביבופ', 'פיוז׳ן', 'טעות'], sel: -1, m: ['מקובל.', 'מקובל, עם הסתייגות.', 'נוספה הערת שוליים. לא שיפוט.'] },
        { l: 'יין לדיון', k: 'seg', o: ['אדום', 'לבן', 'תלוי במנה'], sel: -1, m: ['רשמתי.', 'רשמתי.', 'יש לי שתים־עשרה שאלות מקדימות. נתחיל מהמנה.'] },
        { l: 'חלון קונטקסט', k: 'seg', o: ['סביר', 'מוגזם', 'כל הלוגים'], sel: 0, m: ['', 'אוקיי.', 'המסך נהיה קצת אישי מדי. חוזרים לסביר.'], back: { 2: 0 } },
        { l: 'ביקורת עמיתים', k: 'sw', on: true, stuck: true, m: 'נראה טוב, אבל מה מקרי השוליים?' },
        { l: 'מצב rollback', k: 'say', s: 'red', t: 'חזור שלב', m: 'חזרנו שלב. למה?' },
        { l: 'מצב "זה בסדר"', k: 'twice', t: 'לחץ פעמיים', m1: 'עוד פעם.', m2: 'זה בסדר, זה בסדר.' },
      ],
      save: 'אשר וסיים flow', steps: ['שלב 1 מתוך 11', 'שלב 4 מתוך 11', 'שלב 9 מתוך 11', 'שלב 11 מתוך 11'],
      done: 'ה־flow הסתיים אחרי אחד־עשר שלבים, שזה יותר ממה שהיה צריך. אבל זה בסדר.',
    },
    yaniv: {
      name: 'יניב', title: 'אין עוגיות, אחי',
      body: ['אין פה עוגיות.', 'טוב שכך, אין לי כוח לפתוח עכשיו עוד משהו.'],
      ok: 'סגור את זה', prefs: 'מה ההעדפות',
      sheet: 'ניהול ההעדפות הזה', intro: 'רק אל תעשה פה תנועות חדות, כן?',
      rows: [
        { l: 'יד מאשרת', k: 'seg', o: ['ימין', 'שמאל', 'עזוב'], sel: 2, m: ['ימין? אני לא יכול להזיז כמעט את כל פלג גוף ימין.', 'שמאל? רק חצי ממנו זז.', ''], back: { 0: 2, 1: 2 } },
        { l: 'טווח תנועה', k: 'range', min: 0, max: 10, val: 2, lim: 3, unit: 'מ״מ', m: 'מעל שלושה מילימטר? יש לי אישור מאורתופד.' },
        { l: 'גובה הכפתור', k: 'seg', o: ['נמוך', 'נמוך יותר'], sel: 0, m: ['עלה מילימטר. לא, תחזיר.', 'עלה מילימטר. לא, תחזיר.'] },
        { l: 'מצב ישיבה', k: 'seg', o: ['לשבת', 'לעמוד', 'לשכב'], tag: 'כואב', sel: -1, m: ['כואב. לא יותר מעשר דקות.', 'גם כואב.', 'לשכב הכי כואב לי.'] },
        { l: 'מסלול שמירה', k: 'say', s: 'btn', t: 'חבר כבל', wait: 'מחבר...', m: 'הכבל נתקע מאחורי השולחן. מיכאל העביר אותי מקום, אני בהעברות של כבלים.' },
        { l: 'בדיקת EMG', k: 'say', s: 'btn', t: 'פתח', m: 'עשיתי. לא מצאו כלום. מה אתה צוחק? אני רציני איתך.' },
        { l: 'מסלול אורתופדים', k: 'seg', o: ['ציבורי', 'פרטי', 'שר״פ', 'ביטוח עבודה'], sel: -1, m: 'הייתי. לא מוצאים כלום. חוזרים להתחלה.', back: { 0: -1, 1: -1, 2: -1, 3: -1 } },
        { l: 'תמיר', k: 'popup', t: 'למה לא עלית לזום?', b: 'דחה', m: 'תמיר שוב: למה לא עלית לזום?' },
        { l: 'שיתוף מסך', k: 'sw', on: false, broken: true, m: 'בשיתוף מסך?! יש לי טווח תנועה של מילימטרים.' },
        { l: 'עיוורון צבעים', k: 'dots', m: ['מה זה הכחול הזה? זה ירוק.', 'מה זה הירוק הזה? זה כחול.', 'מה זה האדום הזה? זה חום.', 'מה זה הצהוב הזה? זה כתום.', 'מה זה הסגול הזה? זה כחול.', 'מה זה הכתום הזה? זה צהוב.'] },
        { l: 'פיזיותרפיה', k: 'say', s: 'chip', t: 'שנתיים', m: 'שנתיים, ורק מחמיר. אבל אם אני אפסיק, זה יחמיר עוד יותר.' },
        { l: 'יציאה מהממשק', k: 'timer', secs: 600, m: 'יצאתי. אני לא יכול לשבת יותר מעשר דקות.' },
      ],
      save: 'תשמור ותסגור', steps: ['אל תלחץ עוד פעם, הכפתור זז לי ביד.'], done: 'נשמר. תכף אני יוצא.',
    },
    demokratovich: {
      name: 'הרב דמוקרטוביץ', title: 'פסק דין העוגיות', court: true,
      body: ['עוגיות אין באתר זה.', 'ומפני מה יש מסך? מפני שמנהג האתרים כך הוא.'],
      ok: 'קבל את הפסק', prefs: 'עיין בהעדפות',
      sheet: 'סדרי הסכמה וערעור', intro: 'איתמר: מסך קצר עדיף. ויש אומרים: תחילה ימלא האדם טופס.',
      rows: [
        { l: 'הרכב המאשרים', k: 'seg', o: ['3', '5', '15'], sel: 1, m: ['הרכב מצומצם. ייתכן דיון נוסף.', 'כמקובל.', 'נוספו ארבע־עשרה דעות מיעוט.'] },
        { l: 'זכות טיעון', k: 'say', s: 'clock', t: '90 שניות', m: '87 מהן מוקדשות להסבר על זכות הטיעון.' },
        { l: 'עתירה דחופה', k: 'say', s: 'btn', t: 'הגש', m: 'נדחתה על הסף: חסר נספח א׳ עד ל״ט.' },
        { l: 'נספח א׳', k: 'say', s: 'chip', t: 'למה לחצת', m: 'לפתיחת נספח א׳ נדרש נספח ב׳: למה פתחת.' },
        { l: 'פסקת התגברות', k: 'count', n: 61, m: 'התקבלה ברוב של 61. מעתה מותר לחזור אחורה.' },
        { l: 'הפרדת רשויות', k: 'tri', o: ['מחוקקת', 'מבצעת', 'שופטת'], m: 'אזעקה: משבר חוקתי! הרשויות הורחקו זו מזו.' },
        { l: 'דעת מיעוט', k: 'type', t: 'עם כל הכבוד', m: 'עם כל הכבוד לחבריי להרכב, ובכללם אני עצמי, אינני שותף לדעתי. ואנמק בשבעה עמודים...' },
        { l: 'סקר טרום־שמירה', k: 'say', s: 'ring', t: 'הרבנית מתקשרת', m: 'כן, כן, ראיתי את הסקר. אין מכניסין סקרים לדיון.' },
        { l: 'ועדת קלפי', k: 'seg', o: ['בעד', 'נגד', 'נמנע'], sel: -1, m: 'הפתק נספר, ומוחזר לעיון חוזר.', back: { 0: -1, 1: -1, 2: -1 } },
        { l: 'זמן סביר', k: 'seg', o: ['עכשיו', 'אחר כך', 'אחרי בחירות'], sel: -1, m: 'נקבע: אחרי דיון נוסף.' },
        { l: 'ערעור על הכפתור', k: 'say', s: 'chip', t: 'ערער', m: 'נפסק: הכפתור פעל בסמכות ובמידתיות.' },
        { l: 'הכרעה סופית', k: 'say', s: 'stamp', t: 'טרם הוכרעה', m: 'יש עוד דעה לשמוע.' },
      ],
      save: 'חתום וסיים', steps: ['הוגש...', 'נותב...', 'הועבר להרכב...', 'הורחב להרכב...'],
      done: 'ולפסק דין נפסק: המסך נסגר. בברכת הדמוקרטיה ושלטון החוק.',
    },
  };

  var ask = new URLSearchParams(location.search).get('cookie');
  if (!ask && ls('ck-seen')) return;
  var ids = Object.keys(C);
  var id = C[ask] ? ask : ls('ck-who');
  if (!C[id]) id = ids[Math.floor(Math.random() * ids.length)];
  ls('ck-who', id);
  var P = C[id];

  var CSS = '\
:where(.ck),:where(.ck) *{box-sizing:border-box;margin:0;padding:0;font-family:Heebo,system-ui,-apple-system,"Segoe UI",Arial,sans-serif;letter-spacing:normal;text-transform:none}\
.ck{position:fixed;inset:0;z-index:2147483000;direction:rtl;text-align:right;color:#fff;-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:transparent}\
.ck-dim{position:absolute;inset:0;background:rgba(0,0,0,.45);opacity:0;transition:opacity .3s}\
.ck.on .ck-dim{opacity:1}\
:where(.ck) button{font:inherit;color:inherit;border:0;background:none;cursor:pointer;touch-action:manipulation}\
.ck-card{position:absolute;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));max-width:460px;margin:0 auto;background:#15151a;border:1px solid rgba(255,255,255,.12);border-top:3px solid #ff6a1f;border-radius:22px;padding:16px 16px 14px;box-shadow:0 18px 60px rgba(0,0,0,.6);transform:translateY(130%);transition:transform .45s cubic-bezier(.2,.9,.25,1.05)}\
.ck.on .ck-card{transform:none}\
.ck-top{display:flex;gap:12px;align-items:flex-start}\
.ck-face{flex:none;width:64px;height:64px;border-radius:50%;object-fit:cover;object-position:top;background:#222;border:2px solid rgba(255,255,255,.14)}\
.ck-txt{flex:1;min-width:0}\
.ck-t{font-size:18px;font-weight:900;line-height:1.25;margin-bottom:4px}\
.ck-b{font-size:15px;line-height:1.45;color:rgba(255,255,255,.88)}\
.ck-b+.ck-b{color:rgba(255,255,255,.62)}\
.ck-court .ck-t{padding-bottom:6px;margin-bottom:6px;border-bottom:3px double rgba(255,255,255,.35)}\
.ck-seal{flex:none;width:44px;height:44px;border-radius:50%;border:2px dashed rgba(255,255,255,.4);display:grid;place-items:center;font-size:10px;font-weight:800;line-height:1.1;text-align:center;color:rgba(255,255,255,.6);transform:rotate(-12deg)}\
.ck-link{display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:#1c1c22;color:#ffb48a;font-size:14px;font-weight:700;text-decoration:none}\
.ck-btns{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}\
.ck-btns button{flex:1 1 130px;min-height:48px;border-radius:14px;font-size:16px;font-weight:800;padding:8px 10px;line-height:1.2}\
.ck-ok{background:#ff6a1f;color:#fff}\
.ck-pr{border:1.5px solid rgba(255,255,255,.35)!important}\
.ck-sheet{position:absolute;left:0;right:0;bottom:0;max-width:540px;margin:0 auto;height:92vh;height:min(92dvh,820px);background:#15151a;border-radius:22px 22px 0 0;border:1px solid rgba(255,255,255,.12);border-bottom:0;display:flex;flex-direction:column;transform:translateY(100%);transition:transform .4s cubic-bezier(.2,.9,.25,1)}\
.ck-sheet.on{transform:none}\
.ck-hd{flex:none;padding:8px 16px 12px;border-bottom:1px solid rgba(255,255,255,.08)}\
.ck-handle{width:44px;height:5px;border-radius:3px;background:rgba(255,255,255,.25);margin:0 auto 10px}\
.ck-hrow{display:flex;gap:12px;align-items:center}\
.ck-hrow .ck-face{width:48px;height:48px}\
.ck-ht{flex:1;min-width:0;font-size:19px;font-weight:900;line-height:1.2}\
.ck-x{flex:none;width:44px;height:44px;border-radius:12px;font-size:22px!important;color:rgba(255,255,255,.6)!important}\
.ck-in{font-size:13.5px;color:rgba(255,255,255,.6);margin-top:6px;line-height:1.4}\
.ck-list{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:4px 16px 16px}\
.ck-row{padding:12px 0;border-bottom:1px solid rgba(255,255,255,.07)}\
.ck-rl{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:space-between}\
.ck-lb{font-size:15.5px;font-weight:800;flex:1 1 110px;min-width:0}\
.ck-ct{flex:0 1 auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;max-width:100%}\
.ck-wide .ck-ct{flex:1 1 100%;justify-content:stretch}\
.ck-m{font-size:13.5px;line-height:1.4;color:#ffb48a;margin-top:8px;animation:ckin .25s ease}\
@keyframes ckin{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}\
.ck-c{min-height:40px;padding:6px 14px;border-radius:12px;font-size:14.5px;font-weight:700;background:#1c1c22;border:1px solid rgba(255,255,255,.16)!important;display:inline-flex;align-items:center;gap:6px;max-width:100%;text-align:right}\
.ck-c.btn{border-color:#ff6a1f!important;color:#ffb48a}\
.ck-c.red{border-color:#ff5a5a!important;color:#ff8f8f}\
.ck-c.lock::before{content:"";width:10px;height:12px;border:2px solid currentColor;border-radius:3px;opacity:.6}\
.ck-c.clock{font-variant-numeric:tabular-nums}\
.ck-c.ring{animation:ckring 1.6s infinite}\
@keyframes ckring{0%,60%,100%{transform:none}65%{transform:rotate(-4deg)}70%{transform:rotate(4deg)}75%{transform:rotate(-4deg)}80%{transform:rotate(3deg)}}\
.ck-c.stamp{background:none;border:2px solid rgba(255,255,255,.45)!important;transform:rotate(-6deg);font-weight:900;letter-spacing:.02em}\
.ck-seg{display:flex;flex-wrap:wrap;gap:4px;background:#1c1c22;border:1px solid rgba(255,255,255,.12);border-radius:13px;padding:3px;width:100%}\
.ck-seg button{flex:1 1 0;min-width:64px;min-height:40px;border-radius:10px;font-size:14px;font-weight:700;padding:4px 8px;color:rgba(255,255,255,.75);line-height:1.15}\
.ck-seg button.on{background:#ff6a1f;color:#fff}\
.ck-seg small{display:block;font-size:11px;font-weight:700;opacity:.65}\
.ck-sw{position:relative;width:54px;height:32px;border-radius:16px;background:#3a3a44;flex:none;transition:background .2s}\
.ck-sw::after{content:"";position:absolute;top:3px;right:3px;width:26px;height:26px;border-radius:50%;background:#fff;transition:right .2s}\
.ck-sw.on{background:#ff6a1f}.ck-sw.on::after{right:25px}\
.ck-sw.broken{background:repeating-linear-gradient(115deg,#3a3a44 0 10px,#2a2a31 10px 12px);opacity:.75}\
.ck-shake{animation:ckshake .4s}\
@keyframes ckshake{25%{transform:translateX(-5px)}50%{transform:translateX(5px)}75%{transform:translateX(-3px)}}\
.ck-chk{width:30px;height:30px;border-radius:8px;background:#6b6b75;display:grid;place-items:center;flex:none}\
.ck-chk::after{content:"";width:12px;height:7px;border:solid #fff;border-width:0 0 3px 3px;transform:rotate(-45deg) translate(1px,-2px)}\
.ck-rg{direction:ltr;display:flex;align-items:center;gap:10px;width:100%}\
.ck-rg input{flex:1;accent-color:#ff6a1f;height:32px}\
.ck-rg b{font-size:14px;min-width:54px;text-align:center;font-variant-numeric:tabular-nums}\
.ck-dots{display:flex;gap:10px;flex-wrap:wrap}\
.ck-dots button{width:36px;height:36px;border-radius:50%}\
.ck-tmr{font-size:24px;font-weight:900;color:#ff6a1f;font-variant-numeric:tabular-nums;direction:ltr}\
.ck-cnt{display:flex;align-items:center;gap:8px;font-variant-numeric:tabular-nums;font-weight:800;font-size:15px}\
.ck-cnt button{width:44px;height:40px;border-radius:12px;background:#1c1c22;border:1px solid rgba(255,255,255,.16)!important;font-size:20px;font-weight:900}\
.ck-tri{display:flex;gap:10px;width:100%;direction:ltr}\
.ck-tri label{flex:1;font-size:12px;font-weight:700;color:rgba(255,255,255,.7);text-align:center;direction:rtl}\
.ck-tri input{width:100%;accent-color:#ff6a1f;height:30px}\
.ck-pop{display:flex;gap:8px;align-items:center;width:100%}\
.ck-pop span{flex:1;min-height:40px;padding:8px 12px;border-radius:12px;background:#1c1c22;border:1px solid rgba(255,255,255,.16);font-size:14px;transition:opacity .2s}\
.ck-ft{flex:none;padding:10px 16px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid rgba(255,255,255,.08);background:#15151a}\
.ck-fn{font-size:11.5px;color:rgba(255,255,255,.45);line-height:1.35;margin-bottom:8px}\
.ck-sv{width:100%;min-height:52px;border-radius:14px;background:#ff6a1f;color:#fff;font-size:17px!important;font-weight:900}\
.ck-sv[disabled]{background:#2a2a31;color:#ffb48a;font-size:15px!important;font-weight:700}\
@media (prefers-reduced-motion:reduce){.ck *,.ck{animation:none!important;transition:none!important}}\
@media (max-width:360px){.ck-face{width:54px;height:54px}.ck-t{font-size:17px}.ck-b{font-size:14.5px}}';

  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var root, card, sheet, timers = [];
  var later = function (fn, ms) { timers.push(setTimeout(fn, ms)); };

  function close(how) {
    tr(how === 'save' ? 'cookie_save' : 'cookie_ok', id);
    timers.forEach(clearTimeout);
    root.classList.remove('on');
    if (card) card.style.transform = 'translateY(130%)';
    if (sheet) sheet.classList.remove('on');
    document.documentElement.style.overflow = '';
    setTimeout(function () { root.remove(); }, 450);
  }

  function show() {
    if (!document.body) return setTimeout(show, 50);
    ls('ck-seen', String(Date.now()));   // once, ever: seen when shown
    tr('cookie_show', id);
    var st = h('style', null, CSS); st.id = 'ck-css'; document.head.appendChild(st);
    root = h('div', 'ck' + (P.court ? ' ck-court' : ''));
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', P.title);
    var dim = h('div', 'ck-dim');
    dim.onclick = function () { if (!sheet) close('dim'); };
    card = h('div', 'ck-card',
      '<div class="ck-top"><img class="ck-face" src="' + FACE(id) + '" alt="' + esc(P.name) + '"><div class="ck-txt"><div class="ck-t">' + esc(P.title) + '</div>'
      + P.body.map(function (b) { return '<p class="ck-b">' + esc(b) + '</p>'; }).join('')
      + (P.link ? '<a class="ck-link" href="' + P.link.href + '">' + esc(P.link.t) + ' ←</a>' : '')
      + '</div>' + (P.court ? '<div class="ck-seal">בית<br>המשפט<br>לעוגיות</div>' : '') + '</div>'
      + '<div class="ck-btns"><button class="ck-ok">' + esc(P.ok) + '</button><button class="ck-pr">' + esc(P.prefs) + '</button></div>');
    card.querySelector('.ck-ok').onclick = function () { close('ok'); };
    card.querySelector('.ck-pr').onclick = openSheet;
    root.appendChild(dim); root.appendChild(card);
    document.body.appendChild(root);
    requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('on'); }); });
  }

  function say(row, text) {
    var m = row.querySelector('.ck-m');
    if (!text) { if (m) m.remove(); return; }
    if (!m) { m = h('div', 'ck-m'); row.appendChild(m); }
    else { m.style.animation = 'none'; void m.offsetWidth; m.style.animation = ''; }
    m.textContent = text;
  }

  function control(r, row, n) {
    var ct = h('div', 'ck-ct'), told = false;
    var touch = function () { if (!told) { told = true; tr('cookie_row', id + ':' + n); } };
    var k = r.k;
    if (k === 'say') {
      var b = h('button', 'ck-c ' + (r.s || 'chip'), esc(r.t));
      b.onclick = function () {
        touch();
        if (r.wait) { b.disabled = true; b.textContent = r.wait; later(function () { b.disabled = false; b.textContent = r.t; say(row, r.m); }, 900); }
        else { if (r.s === 'ring') b.classList.remove('ring'); say(row, r.m); }
      };
      ct.appendChild(b);
    } else if (k === 'seg') {
      row.classList.add('ck-wide');
      var seg = h('div', 'ck-seg');
      var set = function (i) { [].forEach.call(seg.children, function (x, j) { x.classList.toggle('on', j === i); }); };
      r.o.forEach(function (o, i) {
        var sb = h('button', null, esc(o) + (r.tag ? '<small>' + esc(r.tag) + '</small>' : ''));
        sb.onclick = function () {
          touch(); set(i);
          say(row, Array.isArray(r.m) ? r.m[i] : r.m);
          if (r.back && r.back[i] !== undefined) later(function () { set(r.back[i]); }, 1100);
        };
        seg.appendChild(sb);
      });
      set(r.sel);
      ct.appendChild(seg);
    } else if (k === 'sw') {
      var sw = h('button', 'ck-sw' + (r.on ? ' on' : '') + (r.broken ? ' broken' : ''));
      sw.setAttribute('aria-label', r.l);
      sw.onclick = function () {
        touch();
        if (r.broken) { sw.classList.remove('ck-shake'); void sw.offsetWidth; sw.classList.add('ck-shake'); }
        else { sw.classList.toggle('on'); if (r.stuck) later(function () { sw.classList.toggle('on', r.on); }, 500); }
        say(row, r.m);
      };
      ct.appendChild(sw);
    } else if (k === 'chk') {
      var c = h('button', 'ck-chk'); c.setAttribute('aria-label', r.l);
      c.onclick = function () { touch(); c.classList.remove('ck-shake'); void c.offsetWidth; c.classList.add('ck-shake'); say(row, r.m); };
      ct.appendChild(c);
    } else if (k === 'link') {
      var a = h('a', 'ck-c btn', esc(r.t) + ' ←'); a.href = r.href; a.style.textDecoration = 'none';
      a.onclick = touch;
      ct.appendChild(a);
    } else if (k === 'dice') {
      var d = h('button', 'ck-c btn', 'D20 · ' + esc(r.t));
      d.onclick = function () {
        touch();
        var v = 1 + Math.floor(Math.random() * 20);
        say(row, 'יצא ' + v + '. ' + (v === 20 ? 'חשוד. צריך לבדוק אם הקובייה הוגנת.' : v === 1 ? 'ברור שזה באג בקובייה.' : 'עכשיו צריך לדון אם הקובייה הוגנת.'));
      };
      ct.appendChild(d);
    } else if (k === 'twice') {
      var tw = h('button', 'ck-c btn', esc(r.t)), times = 0;
      tw.onclick = function () { touch(); times++; say(row, times % 2 ? r.m1 : r.m2); };
      ct.appendChild(tw);
    } else if (k === 'range') {
      row.classList.add('ck-wide');
      var w = h('div', 'ck-rg', '<input type="range" min="' + r.min + '" max="' + r.max + '" step="0.5" value="' + r.val + '" aria-label="' + esc(r.l) + '"><b></b>');
      var inp = w.querySelector('input'), out = w.querySelector('b');
      var draw = function () { out.textContent = inp.value + ' ' + r.unit; };
      inp.oninput = function () { touch(); if (+inp.value > r.lim) { inp.value = r.lim; say(row, r.m); } draw(); };
      draw(); ct.appendChild(w);
    } else if (k === 'popup') {
      row.classList.add('ck-wide');
      var pw = h('div', 'ck-pop', '<span>' + esc(r.t) + '</span>'), pb = h('button', 'ck-c', esc(r.b)), ps = pw.firstChild;
      pb.onclick = function () { touch(); ps.style.opacity = '0'; later(function () { ps.style.opacity = '1'; say(row, r.m); }, 1100); };
      pw.appendChild(pb); ct.appendChild(pw);
    } else if (k === 'dots') {
      var dots = h('div', 'ck-dots');
      ['#2f7bff', '#2fb04a', '#e23b3b', '#f5c12a', '#8a4cf0', '#ff7a1f'].forEach(function (col, i) {
        var db = h('button'); db.style.background = col; db.setAttribute('aria-label', 'צבע');
        db.onclick = function () { touch(); say(row, r.m[i]); };
        dots.appendChild(db);
      });
      ct.appendChild(dots);
    } else if (k === 'timer') {
      var tm = h('div', 'ck-tmr'), left = r.secs;
      var tick = function () {
        tm.textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
        if (left <= 0) { say(row, r.m); var sv = sheet.querySelector('.ck-sv'); sv.disabled = true; sv.textContent = r.m; later(function () { close('timer'); }, 2500); return; }
        left--; later(tick, 1000);
      };
      tick(); ct.appendChild(tm);
    } else if (k === 'count') {
      var cn = h('div', 'ck-cnt'), v2 = 0;
      cn.innerHTML = '<span>0 מתוך ' + r.n + '</span>';
      var plus = h('button', null, '+'); plus.setAttribute('aria-label', 'עוד קול');
      plus.onclick = function () {
        touch(); if (v2 >= r.n) return;
        v2++; cn.firstChild.textContent = v2 + ' מתוך ' + r.n;
        if (v2 === r.n) say(row, r.m); else if (v2 === 1) say(row, 'נדרשות ' + r.n + ' לחיצות.');
      };
      cn.appendChild(plus); ct.appendChild(cn);
    } else if (k === 'tri') {
      row.classList.add('ck-wide');
      var tri = h('div', 'ck-tri'), vals = [15, 50, 85];
      r.o.forEach(function (o, i) {
        var lab = h('label', null, esc(o) + '<input type="range" min="0" max="100" value="' + vals[i] + '">');
        lab.querySelector('input').oninput = function (e) {
          touch();
          var me = +e.target.value, near = vals.some(function (x, j) { return j !== i && Math.abs(x - me) < 12; });
          if (near) { e.target.value = vals[i]; say(row, r.m); } else vals[i] = me;
        };
        tri.appendChild(lab);
      });
      ct.appendChild(tri);
    } else if (k === 'type') {
      var ty = h('button', 'ck-c btn', esc(r.t));
      ty.onclick = function () {
        touch(); ty.disabled = true; say(row, ' ');
        var m = row.querySelector('.ck-m'), i = 0;
        (function step() { m.textContent = r.m.slice(0, ++i); if (i < r.m.length) later(step, 28); else ty.disabled = false; })();
      };
      ct.appendChild(ty);
    }
    return ct;
  }

  function openSheet() {
    tr('cookie_prefs', id);
    card.style.transform = 'translateY(130%)';
    document.documentElement.style.overflow = 'hidden';
    sheet = h('div', 'ck-sheet');
    sheet.innerHTML = '<div class="ck-hd"><div class="ck-handle"></div><div class="ck-hrow"><img class="ck-face" src="' + FACE(id) + '" alt=""><div class="ck-ht">'
      + esc(P.sheet) + '</div><button class="ck-x" aria-label="סגירה">✕</button></div><p class="ck-in">' + esc(P.intro) + '</p></div>'
      + '<div class="ck-list"></div><div class="ck-ft"><p class="ck-fn">' + esc(FOOT) + '</p><button class="ck-sv">' + esc(P.save) + '</button></div>';
    var list = sheet.querySelector('.ck-list');
    P.rows.forEach(function (r, n) {
      var row = h('div', 'ck-row'), rl = h('div', 'ck-rl', '<div class="ck-lb">' + esc(r.l) + '</div>');
      rl.appendChild(control(r, row, n));
      row.appendChild(rl);
      list.appendChild(row);
    });
    sheet.querySelector('.ck-x').onclick = function () { close('x'); };
    var sv = sheet.querySelector('.ck-sv');
    sv.onclick = function () {
      sv.disabled = true;
      var all = P.steps.concat([P.done]);
      all.forEach(function (s, i) { later(function () { sv.textContent = s; }, i * 900); });
      later(function () { close('save'); }, all.length * 900 + 1400);
    };
    root.appendChild(sheet);
    requestAnimationFrame(function () { requestAnimationFrame(function () { sheet.classList.add('on'); }); });
  }

  // as the page loads: once its HTML is there (not after every picture and video), a breath later so the page shows first
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(show, 700); });
  else setTimeout(show, 700);
})();
