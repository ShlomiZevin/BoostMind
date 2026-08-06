import { useState } from 'react'

const MODES = [
  { id: 'flat', label: 'בלי נורמליזציה' },
  { id: 'norm', label: 'מנורמל (טבלאות)' },
  { id: 'doc', label: 'מסמכים (NoSQL)' },
  { id: 'mix', label: 'Postgres — משולב' },
]

export default function DbCompare() {
  const [mode, setMode] = useState('flat')

  return (
    <div>
      <div className="switcher">
        {MODES.map((m) => (
          <button key={m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'flat' && (
        <div>
          <p>
            הדרך הנאיבית: טבלה אחת ענקית שבה כל שורה מכילה <strong>הכל</strong>. שימי לב מה קורה לשם ולטלפון
            של מיכל — הם חוזרים בכל שורה.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>id</th>
                  <th>שם קוסמטיקאית</th>
                  <th>טלפון שלה</th>
                  <th>עיר</th>
                  <th>שם לקוחה</th>
                  <th>טיפול</th>
                  <th>מחיר</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>מיכל לוי</td>
                  <td>050-1111111</td>
                  <td>רעננה</td>
                  <td>דנה</td>
                  <td>מניקור ג'ל</td>
                  <td>180</td>
                </tr>
                <tr>
                  <td>2</td>
                  <td>מיכל לוי</td>
                  <td>050-1111111</td>
                  <td>רעננה</td>
                  <td>יעל</td>
                  <td>פדיקור</td>
                  <td>150</td>
                </tr>
                <tr>
                  <td>3</td>
                  <td>מיכל לוי</td>
                  <td>050-1111111</td>
                  <td>רעננה</td>
                  <td>נועה</td>
                  <td>מניקור ג'ל</td>
                  <td>180</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="callout warn">
            <div className="callout-title">למה זה בעיה</div>
            <p>
              מיכל מחליפה מספר טלפון — צריך לעדכן 3 שורות. אם שכחת אחת, יש לך שני מספרים סותרים לאותה אישה
              ואף אחד לא יודע מה נכון. זה נקרא <strong>אי־עקביות</strong> (inconsistency), וזה הסיוט של כל
              בסיס נתונים.
            </p>
          </div>
        </div>
      )}

      {mode === 'norm' && (
        <div>
          <p>
            נורמליזציה: כל עובדה נשמרת <strong>במקום אחד בדיוק</strong>. במקום לכפול את מיכל, שומרים אותה
            פעם אחת בטבלה משלה, וכל השאר <em>מצביעים</em> עליה דרך המזהה שלה.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th colSpan={4}>professionals — הקוסמטיקאיות</th>
                </tr>
                <tr>
                  <th>id 🔑</th>
                  <th>name</th>
                  <th>phone</th>
                  <th>city</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>42</td>
                  <td>מיכל לוי</td>
                  <td>050-1111111</td>
                  <td>רעננה</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th colSpan={4}>appointments — התורים</th>
                </tr>
                <tr>
                  <th>id 🔑</th>
                  <th>pro_id 🔗</th>
                  <th>client_name</th>
                  <th>service</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>42</td>
                  <td>דנה</td>
                  <td>מניקור ג'ל</td>
                </tr>
                <tr>
                  <td>2</td>
                  <td>42</td>
                  <td>יעל</td>
                  <td>פדיקור</td>
                </tr>
                <tr>
                  <td>3</td>
                  <td>42</td>
                  <td>נועה</td>
                  <td>מניקור ג'ל</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            🔑 <code>Primary Key</code> — המזהה הייחודי של השורה. 🔗 <code>Foreign Key</code> — עמודה
            שמצביעה על מפתח בטבלה אחרת.
          </p>
          <p>
            עכשיו מיכל מחליפה טלפון? שורה אחת מתעדכנת, וכל שלושת התורים "רואים" את המספר החדש. כדי לקבל את
            הנתונים ביחד עושים <code>JOIN</code>:
          </p>
          <div className="codeblock">
            <div className="codeblock-head">
              <span>SQL</span>
            </div>
            <pre>{`SELECT a.id, a.client_name, p.name, p.phone
FROM appointments a
JOIN professionals p ON p.id = a.pro_id;`}</pre>
          </div>
        </div>
      )}

      {mode === 'doc' && (
        <div>
          <p>
            גישה אחרת לגמרי: אין טבלאות. יש <strong>מסמכים</strong> — בעצם אובייקטי JSON, כל אחד עומד בפני
            עצמו. ככה עובדים Firestore ו-MongoDB.
          </p>
          <div className="codeblock">
            <div className="codeblock-head">
              <span>professionals/42 — מסמך אחד</span>
            </div>
            <pre>{`{
  "id": 42,
  "name": "מיכל לוי",
  "phone": "050-1111111",
  "city": "רעננה",
  "services": [
    { "name": "מניקור ג'ל", "price": 180, "minutes": 60 },
    { "name": "פדיקור",     "price": 150, "minutes": 45 }
  ],
  "portfolio": [
    { "url": "https://cdn.../nails1.jpg", "tags": ["פרנץ'", "קצר"] },
    { "url": "https://cdn.../nails2.jpg", "tags": ["אומברה"] }
  ],
  "rating": 4.8
}`}</pre>
          </div>
          <div className="grid-2">
            <div className="mini">
              <h4>✅ מה טוב בזה</h4>
              <p>
                קריאה אחת מביאה את כל מה שצריך למסך הפרופיל — בלי JOIN, בלי 4 שאילתות. מהיר מאוד, וגמיש:
                אפשר להוסיף שדה חדש למסמך אחד בלי לגעת באחרים.
              </p>
            </div>
            <div className="mini">
              <h4>⚠️ מה רע בזה</h4>
              <p>
                אין מבנה מחייב, אז קל לייצר בלגן. ואם אותו מידע יושב בכמה מסמכים — חזרנו לבעיית הכפילות.
                שאילתות מורכבות ("כל הקוסמטיקאיות ברעננה עם 5 תורים החודש") הופכות לכאב ראש.
              </p>
            </div>
          </div>
        </div>
      )}

      {mode === 'mix' && (
        <div>
          <p>
            PostgreSQL נותן את <strong>שניהם באותו בסיס נתונים</strong>. הדברים שחייבים להיות מדויקים
            ומקושרים — טבלאות רגילות. הדברים הגמישים שמשתנים כל הזמן — עמודת <code>JSONB</code>.
          </p>
          <div className="codeblock">
            <div className="codeblock-head">
              <span>SQL — יצירת טבלה</span>
            </div>
            <pre>{`CREATE TABLE professionals (
  id        SERIAL PRIMARY KEY,      -- מנורמל
  name      TEXT NOT NULL,           -- מנורמל
  phone     TEXT UNIQUE NOT NULL,    -- מנורמל
  city      TEXT NOT NULL,           -- מנורמל
  profile   JSONB DEFAULT '{}'       -- גמיש! ← מסמך בתוך עמודה
);

-- profile יכול להכיל כל מבנה:
-- { "bio": "...", "instagram": "@michal",
--   "styles": ["אומברה","פרנץ'"], "homeVisits": true }

-- ואפשר גם לחפש בתוכו:
SELECT * FROM professionals
WHERE city = 'רעננה'
  AND profile -> 'homeVisits' = 'true';`}</pre>
          </div>
          <div className="callout tip">
            <div className="callout-title">הכלל הפשוט</div>
            <p>
              מידע ש<strong>מקשרים אליו</strong> (משתמשים, תורים, תשלומים) — טבלה מנורמלת. מידע
              ש<strong>רק מציגים</strong> ומשתנה כל שבוע (הגדרות פרופיל, תגיות, העדפות) — JSONB. זה מה
              שעובד בפועל, וזה מה שאני משתמש בו.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
