// Timeline (Gantt) and architecture figures for the project pages. Plain HTML, solid colours, print-safe.
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// rows: [label, startCol, endCol(inclusive), note?]  — columns are 1-based month indexes
function gantt(title, months, rows) {
  const n = months.length;
  const head = months.map(m => `<div class="g-m">${esc(m)}</div>`).join('');
  const body = rows.map(([label, a, b, note, kind]) => `
    <div class="g-l">${esc(label)}</div>
    <div class="g-t" style="grid-template-columns:repeat(${n},1fr)">
      <div class="g-b${kind ? ' ' + kind : ''}" style="grid-column:${a}/${b + 1}">${note ? esc(note) : ''}</div>
    </div>`).join('');
  const html = `<figure class="fig"><figcaption>${esc(title)}</figcaption>
  <div class="gantt"><div class="g-l g-h"></div><div class="g-t g-h" style="grid-template-columns:repeat(${n},1fr)">${head}</div>${body}</div></figure>`;
  return { html, data: { type: 'gantt', title, months, rows } };
}

// layers: [layerTitle, [box, box, ...]]
function arch(title, layers) {
  const html = layers.map(([name, boxes], i) => `
    <div class="a-row"><div class="a-name">${esc(name)}</div><div class="a-boxes">${boxes.map(b => `<span>${esc(b)}</span>`).join('')}</div></div>
    ${i < layers.length - 1 ? '<div class="a-arrow">↓</div>' : ''}`).join('');
  return { html: `<figure class="fig"><figcaption>${esc(title)}</figcaption><div class="arch">${html}</div></figure>`, data: { type: 'arch', title, layers } };
}

const FIGS = {
  'builder-gantt': gantt('שלבי הפרויקט, 2026', ['אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳'], [
    ['מוקאפ, אפיון וארכיטקטורה', 1, 2, '5.4'],
    ['גרסה עובדת ראשונה', 2, 2, '21.5', 'ms'],
    ['עוזר AI לעריכת סוכנים', 2, 3, '25.5'],
    ['מאגרי ידע, דור שני', 3, 3, '19.6'],
    ['גרסאות ופרסום מבוקר', 3, 4, '15.7'],
    ['תצוגה חיה של מצב הסוכן', 4, 5, ''],
    ['סוכנים יזומים', 5, 6, '1.9'],
    ['חיבור כלי AI חיצוניים', 6, 6, '17.9'],
    ['פיתוח רציף, בדיקות ושחרורים', 2, 7, '', 'soft'],
  ]),
  'builder-arch': arch('ארכיטקטורה (ברמה כללית)', [
    ['משתמשים וערוצים', ['בוני סוכנים', 'Web chat', 'Widget להטמעה', 'WhatsApp']],
    ['ממשק הבנייה (React 19, TypeScript)', ['בנייה ויזואלית', 'עוזר AI', 'תצוגה חיה', 'גרסאות ופרסום']],
    ['שרת (Node.js, Express, Cloud Run)', ['API לבנייה', 'מנוע ההרצה', 'תכנון לפני מענה', 'כללים קבועים', 'זיכרון', 'תזמון']],
    ['נתונים', ['PostgreSQL (Cloud SQL)', 'Pinecone', 'Cloud Storage']],
    ['מודלים (שכבת ניתוב אחת)', ['Anthropic Claude', 'OpenAI', 'Google Gemini']],
  ]),
  'data-gantt': gantt('שלבי הפרויקט, דצמבר 2025 עד אוקטובר 2026', ['דצמ׳', 'ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳'], [
    ['תשתית: שרת, DB, Cloud Run', 1, 2, '31.12'],
    ['לקוח React ותשתית סוכנים', 2, 3, '19.1'],
    ['ערוץ WhatsApp', 3, 3, '2.2'],
    ['נתוני לקוח ראשון', 3, 3, '17.2'],
    ['עלייה לייצור', 3, 3, '20.2', 'ms'],
    ['דיוק נתונים, ביצועים, ניטור עלות', 4, 6, '12.3'],
    ['Aspect BI', 7, 8, '7.7'],
    ['Aspect Intelligence', 8, 8, '19.7'],
    ['מערך Verification', 9, 9, '10.8'],
    ['מודולים והשלמת מלאי', 9, 10, '27.8'],
    ['בייצור: פיתוח רציף ושחרורים', 3, 11, '', 'soft'],
  ]),
  'data-arch': arch('ארכיטקטורה', [
    ['משתמשים וערוצים', ['React SPA: צ׳אט, דשבורדים', 'Widget להטמעה', 'WhatsApp (Meta, Twilio)']],
    ['שרת: Node.js 22, Express 5 על Cloud Run', ['סוכנים (Crews)', 'שאילתות נתונים', 'בדיקת יכולת מקדימה', 'מהדר BI', 'חקירות יזומות', 'מודולים', 'ניטור שימוש ועלות']],
    ['נתונים', ['PostgreSQL פלטפורמה', 'PostgreSQL: Schema לכל לקוח', 'Pinecone', 'Cloud Storage']],
    ['טעינת נתונים', ['Google Drive', 'CSV / QVD', 'Shadow schema → Atomic swap', 'Cloud Scheduler']],
    ['מודלים (שכבת ניתוב אחת)', ['Anthropic Claude', 'OpenAI', 'Google Gemini']],
  ]),
};

// HTML per figure for the pages; DATA holds the raw inputs for the Word export
module.exports = Object.fromEntries(Object.entries(FIGS).map(([k, v]) => [k, v.html]));
module.exports.DATA = Object.fromEntries(Object.entries(FIGS).map(([k, v]) => [k, v.data]));
