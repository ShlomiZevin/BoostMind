import { useState } from 'react'

const LAYERS = [
  {
    id: 'client',
    color: 'client',
    icon: '📱',
    name: 'Client · הקליינט',
    sub: 'מה שרץ על המכשיר של המשתמשת — הדפדפן שלה',
    detail: {
      what: 'הקוד שמצייר את המסך. רץ אצל המשתמשת, על הטלפון או המחשב שלה. כל מה שרואים ולוחצים עליו.',
      tech: ['HTML — השלד של הדף', 'CSS — העיצוב', 'JavaScript — ההתנהגות', 'React — הכלי שמנהל את הכל'],
      can: 'לצייר מסכים, להגיב ללחיצות, לשמור מידע זמני, לשלוח בקשות לשרת.',
      cant: 'לשמור מידע לצמיתות, להחזיק סודות, לסמוך על עצמו — כל אחד יכול לפרוץ את מה שרץ אצלו.',
    },
  },
  {
    id: 'server',
    color: 'server',
    icon: '⚙️',
    name: 'Server · השרת',
    sub: 'תוכנית שרצה 24/7 במחשב מרוחק ומקבלת בקשות',
    detail: {
      what: 'המוח. מקבל בקשות מהקליינט, בודק שמותר, מדבר עם בסיס הנתונים, מחזיר תשובה.',
      tech: ['Node.js — להריץ JavaScript מחוץ לדפדפן', 'Express — לכתוב API בקלות', 'Python — למחקר ולניתוח נתונים בלבד'],
      can: 'לגשת ל-DB, להחזיק סודות, לאכוף חוקים, לשלוח מיילים ו-SMS, לחייב בכרטיס אשראי.',
      cant: 'לצייר מסך. הוא לא רואה כלום — הוא רק שולח ומקבל נתונים.',
    },
  },
  {
    id: 'db',
    color: 'db',
    icon: '🗄️',
    name: 'Database · בסיס הנתונים',
    sub: 'הזיכרון לטווח ארוך — מה שנשאר גם אחרי כיבוי',
    detail: {
      what: 'ארון תיוק ענק ומסודר. כל התורים, המשתמשות, התמונות והביקורות נשמרים כאן וגם אחרי שנה יהיו שם.',
      tech: ['PostgreSQL — טבלאות מסודרות + גמישות של JSON', 'SQL — השפה שמדברים איתו'],
      can: 'לשמור מיליוני שורות, למצוא שורה אחת בשבריר שנייה, לוודא שהמידע תקין ועקבי.',
      cant: 'להחליט לבד. הוא לא חושב — הוא רק שומר ומחזיר בדיוק מה שביקשו ממנו.',
    },
  },
  {
    id: 'cloud',
    color: 'cloud',
    icon: '☁️',
    name: 'Cloud · הענן',
    sub: 'המחשבים של גוגל שמריצים את כל מה שלמעלה',
    detail: {
      what: 'הבניין שבו הכל גר. במקום להחזיק מחשב בבית שדולק 24/7, שוכרים מקום אצל גוגל.',
      tech: ['Firebase Hosting — לקליינט', 'Google Cloud Run — לשרת', 'Cloud SQL — לבסיס הנתונים'],
      can: 'להיות זמין תמיד, לגדול אוטומטית כשיש הרבה משתמשות, לתת כתובת אמיתית באינטרנט עם HTTPS.',
      cant: 'לתקן קוד גרוע. הענן רק מריץ — האחריות על מה שרץ היא שלך.',
    },
  },
]

const CONNECTORS = ['HTTP request / response', 'SQL query', 'רץ בתוך']

export default function Diagram() {
  const [open, setOpen] = useState('client')

  return (
    <div className="diagram">
      <div className="diagram-rows">
        {LAYERS.map((l, i) => (
          <div key={l.id}>
            <button
              className={`layer ${open === l.id ? 'selected' : ''}`}
              style={{ '--layer-color': `var(--${l.color})` }}
              onClick={() => setOpen(open === l.id ? null : l.id)}
            >
              <span className="layer-icon">{l.icon}</span>
              <span style={{ minWidth: 0 }}>
                <span className="layer-name">
                  <span className="swatch" />
                  {l.name}
                </span>
                <span className="layer-sub">{l.sub}</span>
              </span>
              <span style={{ marginInlineStart: 'auto', color: 'var(--dim)', fontSize: 13, flex: 'none' }}>
                {open === l.id ? '−' : '+'}
              </span>
            </button>

            {open === l.id && (
              <div className="layer-detail">
                <h4>מה זה בעצם</h4>
                <p>{l.detail.what}</p>
                <h4>הטכנולוגיות</h4>
                <ul>
                  {l.detail.tech.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <h4 style={{ marginTop: 10 }}>מה הוא יכול</h4>
                <p>{l.detail.can}</p>
                <h4>מה הוא לא יכול</h4>
                <p style={{ marginBottom: 0 }}>{l.detail.cant}</p>
              </div>
            )}

            {i < LAYERS.length - 1 && (
              <div className="connector">
                <span>↕ {CONNECTORS[i]}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
