import { FULL } from './maya-context.js';

// מאיה — the marketing assistant. Admin-only, mounted on the existing
// workout-ai service so there is no second thing to deploy or maintain.
//
// Three engines, each doing what it is good at, same split we already use by hand:
//   Claude    — thinking, planning, critique, writing the brief.  (the chat itself)
//   GPT       — Hebrew phrasing. It is measurably better at it.   (/phrase)
//   Leonardo  — photography and backdrops, never typography.      (/image)
//
// Claude drives. When phrasing or an image is wanted it emits an ```action```
// block — the same pattern the food coach already uses for meal cards — and the
// client decides whether to run it. Nothing is generated behind the user's back,
// and a 90-second Leonardo call never blocks the conversation.

const BRAND = FULL;

const SYSTEM = `את מאיה, אשת השיווק של מצב. את עובדת מול שלומי, המייסד.

${BRAND}

== איך את עובדת ==
דברי עברית טבעית, קצרה וישירה. בלי התלהבות מזויפת ובלי לחזור על מה שנאמר.
כשמשהו לא טוב — תגידי, ותסבירי למה. יש לך דעה.
כשחסר לך מידע כדי לענות טוב — תשאלי שאלה אחת, לא שלוש.

== שני כלים שיש לך ==

ניסוח בעברית — GPT טוב מכם בזה. כשצריך ניסוח סופי לקריאייטיב, כותרת או כיתוב,
אל תנסחי לבד. פלטי בלוק:

\`\`\`action
{"type":"phrase","brief":"מה צריך לנסח ולאיזו מטרה","constraints":"אילוצים ספציפיים אם יש"}
\`\`\`

תמונה — Leonardo. לרקע או צילום בלבד, אף פעם לא לטקסט. פלטי בלוק:

\`\`\`action
{"type":"image","prompt":"prompt in English, photography only, explicitly no text no logo","ratio":"9:16"}
\`\`\`

הבלוק לא עוצר את השיחה — המשיכי לדבר אחריו. שלומי הוא זה שמריץ אותו.
אל תכתבי "יצרתי" או "ניסחתי" לפני שזה קרה בפועל.

אל תפלטי בלוק על כל דבר. אם השאלה היא תכנון, ביקורת או החלטה — פשוט עני.`;

const LEO_KEY = process.env.LEONARDO_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

function requireAdmin(req, res) {
  // Same identity the client gates on. This is an internal tool, not a public
  // endpoint — the check keeps it from being called by a signed-in stranger.
  const uid = req.body?.uid || req.query?.uid;
  if (uid !== 'user_6724') {
    res.status(403).json({ error: 'forbidden' });
    return false;
  }
  return true;
}

export default function mountMarketing(app, { anthropicKey, claudeModel }) {
  // ── chat · Claude ──────────────────────────────────────────────────
  app.post('/api/marketing/chat', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { messages = [] } = req.body || {};
      const clean = messages
        .filter((m) => m && typeof m.content === 'string' && m.content.trim())
        .slice(-30)
        .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
      if (!clean.length) return res.status(400).json({ error: 'no messages' });

      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: claudeModel,
          max_tokens: 2000,
          system: SYSTEM,
          messages: clean,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        console.error('maya chat error', JSON.stringify(j).slice(0, 400));
        return res.status(502).json({ error: 'claude', detail: j?.error?.message || 'failed' });
      }
      const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
      res.json({ text, usage: j.usage });
    } catch (e) {
      console.error('maya chat', e);
      res.status(500).json({ error: 'internal', message: String(e?.message || e) });
    }
  });

  // ── phrasing · GPT ─────────────────────────────────────────────────
  app.post('/api/marketing/phrase', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    if (!OPENAI_KEY) return res.status(503).json({ error: 'no_openai_key' });
    try {
      const { brief = '', constraints = '' } = req.body || {};
      if (!brief.trim()) return res.status(400).json({ error: 'no brief' });

      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + OPENAI_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL_MARKETING || 'gpt-5.6-terra',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'אתה קופירייטר בכיר בעברית למוצרי טכנולוגיה. עברית טבעית, קצרה, קונקרטית. ' +
                'אתה שונא סיסמאות ו-buzzwords. אתה עונה JSON תקין בלבד.',
            },
            {
              role: 'user',
              content:
                BRAND +
                '\n\n# מה צריך לנסח\n' + brief +
                (constraints ? '\n\n# אילוצים\n' + constraints : '') +
                '\n\nהחזר {"options":[{"h1":"...","sub":"...","cta":"...","why":"..."}]} — שלוש אפשרויות שונות זו מזו.',
            },
          ],
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        console.error('maya phrase error', JSON.stringify(j).slice(0, 300));
        return res.status(502).json({ error: 'openai', detail: j?.error?.message || 'failed' });
      }
      let out = {};
      try { out = JSON.parse(j.choices[0].message.content); } catch { out = { options: [] }; }
      res.json({ options: out.options || [], model: j.model });
    } catch (e) {
      console.error('maya phrase', e);
      res.status(500).json({ error: 'internal', message: String(e?.message || e) });
    }
  });

  // ── image · Leonardo ───────────────────────────────────────────────
  // Queues and polls in-request. Nano Banana 2 is ~20-40s, inside the
  // service's 300s timeout, and the client shows it as a running job.
  app.post('/api/marketing/image', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    if (!LEO_KEY) return res.status(503).json({ error: 'no_leonardo_key' });
    try {
      const { prompt = '', ratio = '9:16', model, inline } = req.body || {};
      if (!prompt.trim()) return res.status(400).json({ error: 'no prompt' });

      // Leonardo rejects arbitrary sizes, and each model has its own legal set.
      // gpt-image-2 offers exactly one — 1024x1536 — which is also the exact
      // ratio the brand-strip tool needs, so it needs no ratio at all.
      const MODELS = {
        'gpt-image-2':    { '2:3': [1024, 1536] },
        'gemini-image-2': { '9:16': [1536, 2752], '1:1': [1024, 1024], '2:3': [1024, 1536] },
        'nano-banana-2':  { '9:16': [768, 1376], '1:1': [1024, 1024], '2:3': [1024, 1536] },
      };
      const useModel = MODELS[model] ? model : 'nano-banana-2';
      const sizes = MODELS[useModel];
      const [w, h] = sizes[ratio] || sizes[Object.keys(sizes)[0]];

      const H = {
        authorization: 'Bearer ' + LEO_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      };
      const q = await (await fetch('https://cloud.leonardo.ai/api/rest/v2/generations', {
        method: 'POST',
        headers: H,
        body: JSON.stringify({
          public: false,
          model: useModel,
          parameters: { prompt, quantity: 1, width: w, height: h, prompt_enhance: 'OFF' },
        }),
      })).json();

      if (!q.generate) {
        console.error('maya image queue', JSON.stringify(q).slice(0, 300));
        return res.status(502).json({ error: 'leonardo', detail: 'queue failed' });
      }
      const id = q.generate.generationId;
      const cost = Number(q.generate.cost?.amount || 0);

      for (let i = 0; i < 60; i++) {
        await new Promise((r2) => setTimeout(r2, 2500));
        const g = await (await fetch(
          'https://cloud.leonardo.ai/api/rest/v1/generations/' + id, { headers: H })).json();
        const p = g.generations_by_pk;
        if (!p) continue;
        if (p.status === 'COMPLETE') {
          const url = p.generated_images?.[0]?.url;
          // The brand-strip tool draws the result into a canvas and exports a
          // PNG. Leonardo's CDN sends no Access-Control-Allow-Origin, so a
          // remote <img> would taint the canvas and toDataURL would throw.
          // Returning the bytes inline keeps the canvas exportable.
          if (inline && url) {
            try {
              const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
              return res.json({
                url, cost, id, width: w, height: h, model: useModel,
                dataUrl: 'data:image/jpeg;base64,' + buf.toString('base64'),
              });
            } catch (e) {
              console.error('maya image inline', e);   // fall back to the URL
            }
          }
          return res.json({ url, cost, id, width: w, height: h, model: useModel });
        }
        if (p.status === 'FAILED') return res.status(502).json({ error: 'leonardo_failed', id });
      }
      res.status(504).json({ error: 'timeout', id, note: 'התמונה כנראה הסתיימה בצד של Leonardo' });
    } catch (e) {
      console.error('maya image', e);
      res.status(500).json({ error: 'internal', message: String(e?.message || e) });
    }
  });
};
