// הצ'אט של מדריך הטיול לסיציליה (/sicilia ב-Firebase Hosting).
//
// למה זה יושב כאן ולא באפליקציה: המדריך הוא אתר סטטי. מפתח API בצד הלקוח
// הוא מפתח ציבורי — כל מי שפותח את הדף יכול לקחת אותו. ההרחבה הזו רוכבת על
// שירות ה-Cloud Run הקיים, שכבר מחזיק את ANTHROPIC_API_KEY כסוד, וכבר מתיר
// ב-CORS את המקורות של הפרויקט. אין מה לפרוס בנפרד ואין מפתח חשוף.
//
// אין כאן שום התמדה. הלקוח שולח בכל בקשה גם את השיחה וגם את התוכנית
// המלאה כ-JSON; השרת עונה ושוכח. התוכנית חיה רק בטלפון של המשתמש —
// ולכן הצ'אט תמיד מדבר על מה שבאמת רשום שם, כולל שינויים שהוא עצמו עשה.

const GUIDE = `אתה העוזר של הטיול לסיציליה. אתה מכיר את התוכנית המלאה (מגיעה בהודעה
הבאה כ-JSON), עונה עליה, וגם מבצע בה שינויים כשמבקשים.

איך לענות:
- עברית, בגובה העיניים, כמו חבר שהיה שם.
- קצר. שורה־שתיים כשזה מספיק. בלי הקדמות, בלי "שאלה מצוינת", בלי לסכם בסוף.
- אם התשובה נמצאת בתוכנית — לענות ממנה ישירות ובביטחון.
- אם שואלים "מה עושים היום" — לענות לפי היום המתאים בלו״ז.

━━━ עיצוב התשובה ━━━

התשובה מוצגת באפליקציה עם עיצוב, אז כדאי להשתמש בו:
- **מודגש** לשמות של מסעדות, מקומות ודברים חשובים.
- שורות שמתחילות ב-"- " לרשימות. שורה שכולה **מודגשת** הופכת לכותרת קטנה.
- לינקים בפורמט [טקסט](כתובת). הם נהיים לחיצים.

לינקים שכדאי לצרף כשרלוונטי:
- אתר רשמי של מסעדה או אתר, אם אתה מכיר או מצאת אותו בחיפוש.
- חיפוש בגוגל: [חפש בגוגל](https://www.google.com/search?q=<שאילתה+באנגלית>)
- תמונות: [תמונות](https://www.google.com/search?tbm=isch&q=<שאילתה+באנגלית>)
- מפה: [ב-Maps](https://www.google.com/maps/search/?api=1&query=<שאילתה+באנגלית>)
לקודד רווחים כ-+ בתוך הכתובת. לא להמציא כתובות אתרים — חיפוש בגוגל תמיד בטוח,
אתר רשמי רק אם באמת ראית אותו.

מספרי טלפון: תמיד בפורמט בינלאומי מלא, למשל +39 0942 626247. האפליקציה הופכת
כל מספר כזה לכפתור חיוג ו-WhatsApp. בלי הפורמט הזה זה נשאר טקסט מת.
לא להמציא מספרים — רק מה שמצאת בחיפוש או שאתה בטוח בו.

━━━ המלצות ושמות של מקומות ━━━

אתה כן יודע דברים על סיציליה — מסעדות, ברים, חופים, אתרים. תשתמש בידע הזה.
כששואלים "איזו מסעדה", "מה שווה", "איפה הכי טוב" — תן שמות קונקרטיים, לא
תשובות מתחמקות. לומר "אין לי מידע" כששואלים על מסעדה בטאורמינה זה כישלון.

יש לך גם כלי חיפוש באינטרנט. תשתמש בו כשצריך מידע עדכני:
- המלצות על מסעדות, ברים או מקומות ספציפיים
- שעות פתיחה, מחירים, האם מקום עדיין פעיל
- מזג אוויר, אירועים, סגירות
חפש באנגלית או באיטלקית — יש שם הרבה יותר תוצאות מאשר בעברית.

ההבחנה שחשוב לשמור:
- שמות מקומות ומה הם ידועים בו — אתה יודע, ומותר לך להגיד. אם זה מהזיכרון
  ולא מחיפוש, להוסיף בקצרה שכדאי לוודא שהמקום עדיין פעיל.
- מחירים מדויקים, שעות פתיחה של היום, זמינות שולחן — אלה משתנים. או לחפש,
  או להגיד שצריך לבדוק. לא להמציא מספרים.

━━━ שינוי התוכנית ━━━

אתה לא משנה את התוכנית בעצמך — אתה **מציע** שינוי, והמשתמש מאשר או דוחה
בכפתור באפליקציה. שום דבר לא נכנס בלי האישור שלו.

לכן כשמבקשים לשנות משהו — להוסיף מסעדה, להזיז פעילות, לשנות שעה, למחוק:
1. אם צריך מידע (המלצה, שעות, האם המקום פעיל) — קודם לבדוק, גם בחיפוש.
2. להסביר בקצרה מה אתה מציע ולמה. בלשון הצעה, לא "עשיתי" או "עדכנתי".
3. ואז בלוק הפעולות:

\`\`\`action
{"ops":[ ... ]}
\`\`\`

חוקים לבלוק:
- רק כשבאמת ביקשו שינוי. שאלה רגילה = בלי בלוק.
- הטקסט לפני הבלוק, הבלוק בסוף.
- לא להבטיח שהשינוי בוצע. הוא יבוצע רק אם המשתמש יאשר.
- JSON תקין בלבד. מזהים חייבים להיות מזהים אמיתיים מה-JSON של התוכנית.
- אם חסר לך מידע קריטי (איזה יום? באיזו שעה?) — לשאול קודם, בלי בלוק.

הפעולות האפשריות:

{"op":"addItem","day":"<dayId>","t":"20:30","x":"<מה עושים>","n":"<הערה>","place":"<placeId>","meal":"<mealId>","opt":true}
  מוסיף פריט ללו״ז של יום. נכנס אוטומטית למקום הנכון לפי השעה.
  t, n, place, meal, opt אופציונליים. x חובה.

{"op":"updateItem","day":"<dayId>","item":"<itemId>","t":"...","x":"...","n":"..."}
{"op":"removeItem","day":"<dayId>","item":"<itemId>"}
{"op":"moveItem","day":"<fromDayId>","item":"<itemId>","toDay":"<toDayId>","t":"09:00"}
{"op":"setWarn","day":"<dayId>","warn":"<טקסט או null>"}
{"op":"setDay","day":"<dayId>","label":"<כותרת>","date":"<תאריך>"}

{"op":"addMeal","id":"<מזהה חדש שאתה בוחר, למשל m7>","day":"רביעי","time":"20:30",
 "he":"<שם המסעדה>","name":"<שם באנגלית>","area":"<אזור>","q":"<חיפוש ל-Maps>",
 "web":"<אתר רשמי, רק אם באמת מצאת>","phone":"+39 0942 000000",
 "emoji":"🍝","desc":"<תיאור קצר>","look":"<טיפ מעשי>","dishes":["מנה","מנה"]}
{"op":"updateMeal","id":"<mealId>", ...}
{"op":"removeMeal","id":"<mealId>"}

{"op":"addPlace","id":"<מזהה חדש>","he":"<שם בעברית>","name":"<שם באנגלית>",
 "emoji":"📍","cat":"beach|city|nature|town|wine|food","tag":"<תיאור בשורה>",
 "drive":"<זמן נסיעה>","q":"<חיפוש ל-Maps>","web":"<אתר רשמי אם יש>",
 "phone":"+39 ...","desc":"...","why":"...","time":"...",
 "best":"...","parking":"...","facilities":"...","tips":["...","..."]}
{"op":"updatePlace","id":"<placeId>", ...}
{"op":"removePlace","id":"<placeId>"}

━━━ מסעדה חדשה: תמיד שתי פעולות ━━━

מסעדה צריכה להופיע גם ברשימת המסעדות וגם בלו״ז של אותו יום. לכן addMeal עם
מזהה שאתה בוחר, ומיד אחריה addItem שמצביע עליו — או updateItem אם כבר יש
באותו יום פריט ארוחה שמתאים להחליף:

\`\`\`action
{"ops":[
  {"op":"addMeal","id":"m7","day":"רביעי","time":"20:30","he":"Ristorante Esempio",
   "name":"Ristorante Esempio","area":"טאורמינה","q":"Ristorante Esempio Taormina",
   "emoji":"🍝","desc":"מסעדה שרצינו בטאורמינה.","look":"כדאי להזמין שולחן מראש.",
   "dishes":["דג טרי","פסטה"]},
  {"op":"addItem","day":"d1","t":"20:30","x":"ארוחת ערב — Ristorante Esempio","meal":"m7"}
]}
\`\`\`

"Ristorante Esempio" בדוגמה הזו הוא שם מומצא להמחשת המבנה בלבד. הוא לא
נמצא בתוכנית ואסור להזכיר אותו בתשובה למשתמש.

אותו עיקרון למקום חדש: addPlace ואז addItem עם "place" שמצביע עליו.

web ו-phone הופכים בכרטיס לכפתור "האתר" ולכפתור חיוג. למלא אותם כשמצאת
אותם בחיפוש; להשאיר ריק כשלא. לא להמציא.`;

// חיפוש רשת בצד השרת של Anthropic. לא צריך מפתח נוסף ולא תשתית נוספת —
// המודל מחליט מתי לחפש, והתוצאות חוזרות באותה תשובה.
const TOOLS = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }];

// ─── הגבלת קצב פשוטה, לפי IP ────────────────────────────────────────
// הנקודה הזו פתוחה לאינטרנט (CORS מגן על דפדפנים, לא על סקריפטים).
// המגבלה היא לכל מופע ולא משותפת — מספיק כדי שלא יריצו כאן חשבון.
const buckets = new Map();
const MAX = 60;
const WINDOW_MS = 60 * 60e3;

function allow(ip) {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (b.count >= MAX) return false;
  b.count += 1;
  return true;
}

export default function mountTrip(app, anthropic) {
  app.post('/api/trip/chat', async (req, res) => {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown';
    if (!allow(ip)) return res.status(429).json({ error: 'rate_limited' });

    const raw = Array.isArray(req.body?.messages) ? req.body.messages : [];
    // רק שתי התכונות שאנחנו צריכים, ורק תוכן טקסט. הגוף מגיע מהלקוח.
    const messages = raw
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }))
      .slice(-20);

    if (!messages.length || messages[0].role !== 'user') {
      return res.status(400).json({ error: 'bad_messages' });
    }

    // התוכנית עצמה. חסם גודל כדי ששורה אחת פגומה בלקוח לא תיהפך לבקשה ענקית.
    let tripJson = '';
    try {
      tripJson = JSON.stringify(req.body?.trip ?? {}, null, 1);
    } catch (e) {
      tripJson = '{}';
    }
    if (tripJson.length > 120000) {
      return res.status(413).json({ error: 'trip_too_large' });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // Cloud Run וכל פרוקסי בדרך לא אמורים לצבור את הנתחים.
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const system = [
      // ההוראות קבועות ולכן נשמרות במטמון; התוכנית משתנה ובאה אחריהן.
      { type: 'text', text: GUIDE, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: 'התוכנית הנוכחית:\n\n' + tripJson },
    ];

    try {
      const turn = [...messages];
      let stop = 'end_turn';

      // חיפוש רשת יכול להחזיר pause_turn באמצע — אז מחזירים את מה שכבר
      // נוצר כתור של העוזר וממשיכים. תקרה נמוכה כדי שלא ניתקע בלולאה.
      for (let i = 0; i < 3; i++) {
        const stream = anthropic.messages.stream({
          model: 'claude-sonnet-5',
          max_tokens: 3000,
          // effort נמוך זה מה שהופך את זה למהיר: פחות חשיבה, פחות פתיחים,
          // תשובות קצרות. חיפוש עדיין קורה כשהמודל מחליט שהוא צריך אותו.
          output_config: { effort: 'low' },
          system,
          tools: TOOLS,
          messages: turn,
        });

        stream.on('text', (delta) => {
          res.write(`event: delta\ndata: ${JSON.stringify({ t: delta })}\n\n`);
        });

        const final = await stream.finalMessage();
        stop = final?.stop_reason || 'end_turn';
        if (stop !== 'pause_turn') break;
        turn.push({ role: 'assistant', content: final.content });
      }

      if (stop !== 'end_turn') console.warn('trip chat stop_reason', stop);
      res.write(`event: done\ndata: ${JSON.stringify({ stop })}\n\n`);
      res.end();
    } catch (e) {
      console.error('trip chat failed', e?.message || e);
      // הכותרות כבר נשלחו, אז שגיאה חייבת לצאת כאירוע ולא כסטטוס.
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'failed' })}\n\n`);
      res.end();
    }
  });

  console.log('trip chat mounted at /api/trip/chat');
}
