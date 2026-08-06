import { useState } from 'react'

const ACTORS = [
  { id: 'client', emoji: '📱', name: 'הדפדפן של דנה', color: 'client' },
  { id: 'server', emoji: '⚙️', name: 'השרת (Cloud Run)', color: 'server' },
  { id: 'db', emoji: '🗄️', name: 'PostgreSQL', color: 'db' },
]

const STEPS = [
  {
    at: 'client',
    title: 'דנה לוחצת "קבעי תור"',
    text: 'המסך הזה הוא React שרץ בדפדפן שלה. הלחיצה מפעילה פונקציה ב-JavaScript. עדיין שום דבר לא יצא מהמכשיר שלה.',
    code: `// רץ בדפדפן — Client
function onBook() {
  fetch('https://api.nailz.app/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      proId: 42,
      serviceId: 7,
      startsAt: '2026-08-12T15:00:00Z'
    })
  })
}`,
  },
  {
    at: 'client',
    title: 'הבקשה יוצאת לדרך',
    text: 'הדפדפן אורז את הנתונים ל-HTTP request ושולח אותו דרך האינטרנט. זו "מעטפה" עם כתובת, שיטה (POST), ותוכן (JSON).',
    code: `POST /appointments HTTP/1.1
Host: api.nailz.app
Content-Type: application/json
Authorization: Bearer eyJhbGciOi...

{ "proId": 42, "serviceId": 7,
  "startsAt": "2026-08-12T15:00:00Z" }`,
  },
  {
    at: 'server',
    title: 'השרת מקבל ובודק מי זו',
    text: 'ה-Token שנשלח מזהה שזו דנה ולא מישהי אחרת. זה Authentication — אימות זהות. בלי זה כל אחד היה יכול לקבוע תורים בשם אחרים.',
    code: `// רץ על השרת — Node.js + Express
app.post('/appointments', auth, async (req, res) => {
  const user = req.user     // { id: 118, name: 'דנה' }
  const { proId, serviceId, startsAt } = req.body
  // ...`,
  },
  {
    at: 'server',
    title: 'השרת אוכף את החוקים',
    text: 'האם השעה פנויה? האם הקוסמטיקאית עובדת ביום הזה? האם לדנה אין כבר תור באותה שעה? כל ההיגיון הזה חייב לרוץ בשרת — כי בקליינט אפשר לעקוף אותו.',
    code: `  if (!isWithinWorkingHours(proId, startsAt))
    return res.status(400).json({ error: 'מחוץ לשעות הפעילות' })

  const taken = await db.query(
    'SELECT 1 FROM appointments WHERE pro_id=$1 AND starts_at=$2',
    [proId, startsAt]
  )
  if (taken.rows.length)
    return res.status(409).json({ error: 'השעה תפוסה' })`,
  },
  {
    at: 'db',
    title: 'בסיס הנתונים שומר את התור',
    text: 'עכשיו הרשומה נכתבת לדיסק. מכאן היא קיימת לנצח — גם אם השרת ייכבה, גם אם דנה תסגור את הדפדפן.',
    code: `INSERT INTO appointments
  (client_id, pro_id, service_id, starts_at, status)
VALUES (118, 42, 7, '2026-08-12 15:00', 'confirmed')
RETURNING id;

-- ← מחזיר: id = 9041`,
  },
  {
    at: 'server',
    title: 'השרת מחזיר תשובה',
    text: 'הוא אורז את התוצאה כ-JSON ומחזיר קוד סטטוס 201 — "נוצר בהצלחה". תוך כדי הוא גם שולח SMS לקוסמטיקאית. גם זה משהו שרק שרת יכול לעשות.',
    code: `HTTP/1.1 201 Created
Content-Type: application/json

{ "id": 9041,
  "startsAt": "2026-08-12T15:00:00Z",
  "pro": { "id": 42, "name": "מיכל" },
  "status": "confirmed" }`,
  },
  {
    at: 'client',
    title: 'הקליינט מציג את התוצאה',
    text: 'React מקבל את התשובה, מעדכן את ה-state, וכל מסך שתלוי במידע הזה מצייר את עצמו מחדש אוטומטית. דנה רואה "התור נקבע ✓" — והכל לקח 300 מילי-שניות.',
    code: `// חזרה בדפדפן — Client
const appt = await res.json()
setAppointments(prev => [...prev, appt])
// React מצייר מחדש לבד. לא נגענו ב-HTML.`,
  },
]

export default function RequestFlow() {
  const [i, setI] = useState(0)
  const step = STEPS[i]

  return (
    <div className="flow">
      <div className="flow-stage">
        {ACTORS.map((a) => (
          <div
            key={a.id}
            className={`flow-actor ${step.at === a.id ? 'hot' : ''}`}
            style={{ '--actor-color': `var(--${a.color})` }}
          >
            <span className="emoji">{a.emoji}</span>
            <span className="name">{a.name}</span>
          </div>
        ))}
      </div>

      <div className="flow-step">
        <div className="flow-step-head">
          <span className="flow-step-num">{i + 1}</span>
          <span className="flow-step-title">{step.title}</span>
        </div>
        <p>{step.text}</p>
        <pre>{step.code}</pre>
      </div>

      <div className="flow-controls">
        <button className="btn" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>
          ← אחורה
        </button>
        <button
          className="btn primary"
          onClick={() => setI(i === STEPS.length - 1 ? 0 : i + 1)}
        >
          {i === STEPS.length - 1 ? '↺ מהתחלה' : 'הבא →'}
        </button>
        <div className="flow-dots">
          {STEPS.map((_, n) => (
            <button
              key={n}
              className={`flow-dot ${n === i ? 'on' : ''}`}
              onClick={() => setI(n)}
              aria-label={`שלב ${n + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
