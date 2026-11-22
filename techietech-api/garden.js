// רופא הגינה (shlomiverse.com/garden/) - 2026-11-14, his ask: a dead-simple Hebrew site for a man over 70, not technical,
// with a smartphone and a garden full of trees: take a photo, maybe say a question (or not), and get what the plant is,
// what is seen, whether there is a problem and what to do. A "read to me" button, and his plants are remembered so a
// later photo of the same tree continues its story.
//
// No sign-in (his call): every gardener has a private link shlomiverse.com/garden/?k=<key>. Firestore keeps only the
// key's sha256 (gardeners/<hash>) - keys are made with scripts/garden/key.mjs. Everything of a gardener lives under
// gardeners/<hash>/plants + /visits; photos and read-aloud audio in the private bucket shlomiverse-studio/garden/<hash>/
// (shown through short signed links).
//
// AI (one call per tap, his cost rules): the question by voice = gpt-4o-transcribe; the look at the plant = Claude Opus 5.5
// (VERSE_ANTHROPIC_KEY; Terra only as its fallback) with the photo, his plant list and that plant's history, a JSON answer; read aloud = gpt-4o-mini-tts,
// made only when he taps and kept, so a second tap is free. Key: VERSE_SITE_OPENAI_KEY (the site's features share it;
// Backstage -> הוצאות shows its spend). The page: public/garden/index.html. Hosting: /garden/api/** -> this function.
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');
const guard = require('./guard');
const ag = require('./ai-guard');   // limits across instances, the day's money, the key door (2026-11-22)

if (!admin.apps.length) admin.initializeApp();
const OPENAI = defineSecret('VERSE_SITE_OPENAI_KEY');
const ANTHROPIC = defineSecret('VERSE_ANTHROPIC_KEY');   // the Console key "Shlomiverse" (the chat's director uses it too)
const REGION = 'europe-west1';
const BUCKET = 'shlomiverse-studio';
// the look at the plant: Claude (his call, 2026-11-14 - Terra needed two guesses and his help on a plant Claude named at
// once); Terra answers only when Claude refuses or fails, so the gardener never gets an error for it
const CLAUDE = 'claude-opus-5-5';
const EFFORT = 'medium';
const MODEL = 'gpt-6.1-terra';
const CORS = [/^https:\/\/boostmind-b052c(--[\w-]+)?\.web\.app$/, /^https:\/\/(www\.)?shlomiverse\.com$/, /^http:\/\/localhost(:\d+)?$/];
const PER_DAY = 60;            // asks a day per gardener - far above a real day in the garden, a wall if a link leaks
const PER_HOUR = 20;           // and an hour (a leaked link can't burn the day in a minute)
const DAY_USD = 10;            // the garden's money for the whole Israel day, all gardeners together (a real day: well under $1)
// $ per 1M tokens: Claude Opus 5.5 (costs.js AN_PRICE) and Terra (its fallback)
const OPUS = { in: 4, read: 0.2, write: 5, out: 20 }, TERRA = { in: 2, cached: 0.2, out: 12 };
const costOf = (u = {}) => (/claude/.test(String(u.model || ''))
  ? ((u.input_tokens || 0) * OPUS.in + (u.cache_read_input_tokens || 0) * OPUS.read + (u.cache_creation_input_tokens || 0) * OPUS.write + (u.output_tokens || 0) * OPUS.out) / 1e6
  : (((u.input_tokens || 0) - (u.input_tokens_details?.cached_tokens || 0)) * TERRA.in + (u.input_tokens_details?.cached_tokens || 0) * TERRA.cached + (u.output_tokens || 0) * TERRA.out) / 1e6);

const db = () => admin.firestore();
const bucket = () => admin.storage().bucket(BUCKET);
const clip = (s, n) => String(s ?? '').trim().slice(0, n);
const ms = (t) => (t && t.toMillis ? t.toMillis() : t || null);
const fail = (status, error) => Object.assign(new Error(error), { status });
const hash = (k) => crypto.createHash('sha256').update(String(k)).digest('hex');
// an id from the page into a Firestore path: letters / digits / - _ only (never "/" or ".."), else a 404
const okId = (v) => { const id = ag.docId(v); if (!id) throw fail(404, 'id'); return id; };
const newId = () => Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
const signed = async (path) => (path ? (await bucket().file(path).getSignedUrl({ action: 'read', expires: Date.now() + 12 * 3600e3 }))[0] : null);

// ---------------------------------------------------------------- who is asking ----------------------------------------------------------------
// wrong keys are counted per network and for the whole door (ai-guard.js): 20 a day locks a network for a day; 200 an hour
// (a guessing script) and only networks that got in before are let through for the hour - the gardener's phone keeps working
async function gardener(req) {
  const h = req.get('authorization') || '';
  const k = h.startsWith('Key ') ? h.slice(4).trim() : clip(req.query.k, 100);
  if (!k) return null;
  if (await ag.doorLocked('garden', req)) throw fail(429, 'too_many');
  const d = /^[A-Za-z0-9_-]{8,100}$/.test(k) ? await db().collection('gardeners').doc(hash(k)).get() : null;
  if (!d || !d.exists || !d.data().active) {
    console.warn('garden wrong key', ag.chain(req).join(' > '));   // the address chain, to read who guesses (Cloud Logging only)
    await ag.doorFailed('garden', req, { perNet: 20, all: 200 });
    return null;
  }
  await ag.doorPassed('garden', req);
  return { id: d.id, ref: d.ref, ...d.data() };
}

// ---------------------------------------------------------------- OpenAI ----------------------------------------------------------------
const auth = () => ({ authorization: `Bearer ${OPENAI.value()}` });

// a recording is what its bytes say it is (webm / mp4 / mp3 / wav from guard.js, ogg here)
const audioKind = (buf) => guard.fileKind(buf, ['webm', 'mp4', 'mp3', 'wav']) || (buf.slice(0, 4).toString('latin1') === 'OggS' ? 'ogg' : '');
async function transcribe(b64, mime) {
  const buf = Buffer.from(String(b64 || '').replace(/^data:[^,]*,/, ''), 'base64');
  if (!buf.length) return '';
  if (buf.length > 9e6 || !audioKind(buf)) throw fail(400, 'audio');
  mime = clip(mime, 60) || 'audio/webm';
  const ext = /mp4|m4a|aac/.test(mime) ? 'mp4' : /mpeg|mp3/.test(mime) ? 'mp3' : /ogg/.test(mime) ? 'ogg' : /wav/.test(mime) ? 'wav' : 'webm';
  const form = new FormData();
  form.append('file', new Blob([buf], { type: mime.split(';')[0] }), 'question.' + ext);
  form.append('model', 'gpt-4o-transcribe');
  form.append('language', 'he');
  form.append('prompt', 'שאלה של גנן על צמח, עץ או פרח בגינה.');
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: auth(), body: form });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('garden transcribe', r.status, j.error?.message); throw fail(502, 'transcribe'); }
  return clip(j.text, 1500);
}

// The fixed instructions come first and never change (the OpenAI cache reuses them); everything about him comes after.
const INSTRUCTIONS = `אתה "רופא הגינה": גנן ומומחה צמחים ישראלי ותיק, חם וסבלני. מי שכותב לך הוא אדם מבוגר (מעל 70), לא טכנולוגי,
שמגדל בגינה הביתית שלו בישראל הרבה עצים וצמחים. הוא שולח תמונה של צמח, ולפעמים גם שאלה שאמר בקול (תמלול - יכולות להיות בו טעויות).

מה לעשות:
1. זהה את הצמח מהתמונה (שם עברי מקובל בישראל, ושם מדעי). אם אתה לא בטוח - אמור את זה בכנות ותן את הניחוש הסביר.
2. תאר במשפטים פשוטים מה אתה רואה בתמונה: עלים, פרי, פריחה, גזע, אדמה, מזיקים, כתמים, יובש - מה שרלוונטי.
3. קבע אם יש בעיה: "ok" (נראה בריא), "small" (בעיה קטנה / משהו לשים לב אליו), "problem" (בעיה שצריך לטפל בה עכשיו), "unknown" (אי אפשר לדעת מהתמונה).
4. תן צעדים מעשיים ומדויקים, שאדם מבוגר יכול לעשות לבד בגינה: מה, כמה, מתי, ובאיזה מוצר (שם כללי של חומר, למשל "דשן ברזל (כלאט ברזל)", "שמן קיץ") - בלי שמות מותגים. התחשב בעונה בישראל (התאריך מופיע בהודעה) ובאקלים הישראלי.
5. אם הוא שאל שאלה - ענה עליה ישירות ובהתחלה, בשדה answer. אם לא שאל - answer ריק.
6. אם יש לו כבר צמחים שמורים (ברשימה) ואותו צמח בתמונה הוא כנראה אחד מהם (אותו סוג צמח, ואין לו עוד אחד כזה, או שהתיאור מתאים) - החזר את המזהה שלו ב-same_plant. אחרת same_plant ריק.
7. אם קיבלת היסטוריה של הצמח - השתמש בה: השווה למה שנאמר בפעם הקודמת (השתפר? החמיר?), ואל תחזור על עצות שכבר נתת בלי סיבה.
8. אם בתמונה אין צמח בכלל, או שהיא מטושטשת מדי - כתוב זאת בעדינות ב-seen, status "unknown", ובצעדים: איך לצלם טוב יותר (קרוב יותר, באור יום, העלה מקרוב וגם כל העץ).

איך לכתוב: עברית פשוטה, חמה ומכבדת, כמו שכן שמבין בגינון. משפטים קצרים. בלי מונחים מקצועיים בלי הסבר. בלי אימוג'י. פנה אליו בלשון זכר יחיד.
עד 4 צעדים. כל צעד משפט אחד קצר וברור (עד 20 מילים) - מה עושים, כמה ומתי. answer עד 3 משפטים קצרים. seen עד 3 משפטים. status_line משפט קצר אחד (למשל "נראה בריא ויפה", "יש בעיה קטנה: חוסר ברזל").
note: שורה קצרה לזיכרון שלך על הצמח הזה (מה ראית ומה המלצת), כדי שבפעם הבאה תוכל להמשיך מאותה נקודה.
tip: עצה קצרה אחת לעונה הזאת לצמח הזה (או ריק).
corrected_name / corrected_latin: אם הוא אומר לך מה הצמח באמת (למשל "זה עץ ז'אקה", "זה לא אבוקדו, זה מנגו") - הוא מכיר את הגינה שלו: האמן לו
(אלא אם זה בלתי אפשרי לגמרי), כתוב את השם שאמר (בשם המקובל בעברית) ואת השם המדעי שלו, וגם plant_name ו-latin יהיו השם הזה, והתשובה תהיה על הצמח הזה. אחרת - שניהם ריקים.`;

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['plant_name', 'latin', 'sure', 'answer', 'status', 'status_line', 'seen', 'steps', 'tip', 'note', 'same_plant', 'corrected_name', 'corrected_latin'],
  properties: {
    plant_name: { type: 'string' }, latin: { type: 'string' }, sure: { type: 'boolean' },
    answer: { type: 'string' },
    status: { type: 'string', enum: ['ok', 'small', 'problem', 'unknown'] },
    status_line: { type: 'string' }, seen: { type: 'string' },
    steps: { type: 'array', items: { type: 'string' } },
    tip: { type: 'string' }, note: { type: 'string' }, same_plant: { type: 'string' }, corrected_name: { type: 'string' }, corrected_latin: { type: 'string' },
  },
};

function brief({ question, plants, history }) {
  const today = new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'long', year: 'numeric' });
  const lines = [`התאריך היום: ${today}.`];
  if (plants.length) lines.push('הצמחים השמורים שלו (מזהה | שם | מה ידוע):\n' + plants.map((p) => `${p.id} | ${p.name} | ${p.note || ''}`).join('\n'));
  else lines.push('אין לו עדיין צמחים שמורים.');
  if (history) lines.push(`זו תמונה של צמח שכבר שמור אצלו: ${history.name} (מזהה ${history.id}). מה היה בפעמים הקודמות (מהישן לחדש):\n` +
    history.visits.map((v) => `- ${v.date}: ${v.question ? `שאל: "${v.question}". ` : ''}${v.status_line}. ${v.note || ''}`).join('\n'));
  lines.push(question ? `השאלה שלו (תמלול של מה שאמר): "${question}"` : 'הוא לא שאל שאלה - רק שלח את התמונה.');
  return lines.join('\n\n');
}
const tidy = (a) => { a.steps = (a.steps || []).map((s) => clip(s, 400)).filter(Boolean).slice(0, 5); return a; };

const MEDIA_OF = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
let anthropic = null;
async function lookClaude(photo, text, effort = EFFORT) {
  if (!anthropic) { const { Anthropic } = require('@anthropic-ai/sdk'); anthropic = new Anthropic({ apiKey: ANTHROPIC.value(), maxRetries: 1, timeout: 40000 }); }
  const r = await anthropic.beta.messages.create({
    model: CLAUDE, max_tokens: 8000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    output_config: { effort, format: { type: 'json_schema', schema: SCHEMA } },
    system: INSTRUCTIONS,
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: (photo.match(/^data:(image\/[a-z]+);/) || [])[1] || 'image/jpeg', data: photo.replace(/^data:[^,]*,/, '') } },
      { type: 'text', text }] }],
  });
  if (r.stop_reason === 'refusal') throw new Error('claude refusal: ' + (r.stop_details?.category || ''));
  if (r.stop_reason === 'max_tokens') throw new Error('claude max_tokens');
  const out = (r.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { a: tidy(JSON.parse(out)), usage: { model: r.model || CLAUDE, ...(r.usage || {}) } };
}

async function lookTerra(photo, brief) {
  const r = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { ...auth(), 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, instructions: INSTRUCTIONS, reasoning: { effort: 'low' }, max_output_tokens: 4000,
      text: { format: { type: 'json_schema', name: 'garden_answer', schema: SCHEMA, strict: true } },
      input: [{ role: 'user', content: [{ type: 'input_text', text: brief }, { type: 'input_image', image_url: photo, detail: 'high' }] }] }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('garden terra', r.status, j.error?.message); throw fail(502, 'model'); }
  const text = (j.output || []).flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('');
  let a;
  try { a = JSON.parse(text); } catch { throw fail(502, 'bad_answer'); }
  return { a: tidy(a), usage: { model: MODEL, ...(j.usage || {}) } };
}

async function look({ photo, question, plants, history }) {
  const text = brief({ question, plants, history });
  try { return await lookClaude(photo, text); } catch (e) {
    console.warn('garden: claude failed, Terra answers -', e.message);
    return await lookTerra(photo, text);
  }
}

// what "read to me" says - the same words as on the screen, in their order
const spoken = (v) => {
  const a = v.answer || {};
  return [a.answer, `${a.plant_name}.`, a.status_line, a.seen, a.steps?.length ? 'מה לעשות:' : '', ...(a.steps || []).map((s, i) => `${i + 1}. ${s}`), a.tip ? `טיפ: ${a.tip}` : '']
    .filter(Boolean).join('\n');
};
const VOICE = 'דבר בעברית ישראלית טבעית, במבטא ישראלי, בקול חם ורגוע של גנן ותיק. לאט וברור, עם הפסקות קטנות בין המשפטים - המאזין אדם מבוגר.';
async function speak(text) {
  const r = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { ...auth(), 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: 'ash', input: clip(text, 3800), response_format: 'mp3',
      instructions: VOICE }) });
  if (!r.ok) { console.error('garden tts', r.status, (await r.text()).slice(0, 200)); throw fail(502, 'tts'); }
  return Buffer.from(await r.arrayBuffer());
}

// ---------------------------------------------------------------- the gardener's data ----------------------------------------------------------------
const plantOut = async (p) => ({ id: p.id, name: p.name, latin: p.latin || '', status: p.lastStatus || 'unknown', statusLine: p.lastStatusLine || '',
  count: p.count || 0, last: ms(p.lastAt), photo: await signed(p.lastPhoto).catch(() => null) });
const visitOut = async (v) => ({ id: v.id, plantId: v.plantId, at: ms(v.at), question: v.question || '', answer: v.answer, photo: await signed(v.photo).catch(() => null) });

async function plants(g) {
  const s = await g.ref.collection('plants').orderBy('lastAt', 'desc').limit(200).get();
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// one plant's visits, newest first (a plant has a handful - no composite index needed)
async function visitsOf(g, pid) {
  const s = await g.ref.collection('visits').where('plantId', '==', pid).limit(300).get();
  return s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((x, y) => (ms(y.at) || 0) - (ms(x.at) || 0));
}

async function ask(g, b) {
  // a wall against a leaked link (counted per Israeli day)
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  const used = g.day === day ? g.used || 0 : 0;
  if (used >= PER_DAY) throw fail(429, 'day_limit');
  // the same walls counted in Firestore across instances (the counter above can be raced by parallel asks), by network too
  if (await ag.gate([[`garden:g:${g.id}`, PER_DAY, guard.DAY], [`garden:gh:${g.id}`, PER_HOUR, guard.HOUR], [`garden:net:${ag.net(g.req)}`, 80, guard.DAY]])) throw fail(429, 'day_limit');
  if (await ag.overBudget('garden', DAY_USD)) { console.error('garden: the day\'s money ceiling reached'); throw fail(429, 'day_limit'); }

  const list = await plants(g);
  let plant = b.plantId ? list.find((p) => p.id === ag.docId(b.plantId)) : null;
  let photoBuf = null, photoPath = null, photoKind = 'jpg';
  const raw = String(b.photo || '').replace(/^data:[^,]*,/, '');
  if (raw) {
    photoBuf = Buffer.from(raw, 'base64');
    if (photoBuf.length < 1000 || photoBuf.length > 8e6) throw fail(400, 'photo');
    photoKind = guard.fileKind(photoBuf, ['jpg', 'png', 'webp']);   // the real bytes: a picture, nothing else
    if (!photoKind) throw fail(400, 'photo');
  } else if (plant?.lastPhoto) {
    // a follow-up question on a saved plant without a new photo: its last photo
    [photoBuf] = await bucket().file(plant.lastPhoto).download();
    photoPath = plant.lastPhoto;
  } else throw fail(400, 'photo');

  const question = clip(b.text, 1500) || await transcribe(b.audio, b.mime);
  let history = null;
  if (plant) {
    const vs = (await visitsOf(g, plant.id)).slice(0, 6).reverse();
    history = { id: plant.id, name: plant.name, visits: vs.map((v) => ({
      date: new Date(ms(v.at)).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' }), question: v.question, status_line: v.answer?.status_line, note: v.answer?.note })) };
  }
  const { a, usage } = await look({ photo: `data:${MEDIA_OF[photoKind]};base64,` + photoBuf.toString('base64'), question,
    plants: plant ? [] : list.slice(0, 80).map((p) => ({ id: p.id, name: p.name, note: p.note })), history });
  ag.spend('garden', costOf(usage) + (b.audio && !b.text ? 0.01 : 0));

  if (!plant && a.same_plant) plant = list.find((p) => p.id === a.same_plant) || null;
  const matched = !!plant && !b.plantId;
  const vid = newId();
  if (!photoPath) {
    photoPath = `garden/${g.id}/${vid}.jpg`;
    await bucket().file(photoPath).save(photoBuf, { contentType: MEDIA_OF[photoKind], resumable: false, metadata: { cacheControl: 'private, max-age=31536000' } });
  }
  const keep = !!(plant || clip(a.plant_name, 80));   // a photo with no plant in it makes no plant
  // he said what the plant really is ("זה עץ ז'אקה") -> the saved plant takes that name (2026-11-14: a correction left
  // his jackfruit saved as "אבוקדו")
  const fixed = clip(a.corrected_name, 80);
  const name = fixed || plant?.name || clip(a.plant_name, 80) || 'צמח';
  const latin = fixed ? clip(a.corrected_latin, 120) : plant?.latin || clip(a.latin, 120);
  const pref = plant ? g.ref.collection('plants').doc(plant.id) : g.ref.collection('plants').doc(newId());
  const visit = { plantId: keep ? pref.id : null, at: FieldValue.serverTimestamp(), photo: photoPath, question, answer: a, usage, matched };
  await g.ref.collection('visits').doc(vid).set(visit);
  if (keep) await pref.set({ name, latin, note: clip(a.note, 400),
    lastAt: FieldValue.serverTimestamp(), lastPhoto: photoPath, lastStatus: a.status, lastStatusLine: clip(a.status_line, 200),
    count: FieldValue.increment(1), ...(plant ? {} : { created: FieldValue.serverTimestamp() }) }, { merge: true });
  await g.ref.set({ day, used: used + 1, last: FieldValue.serverTimestamp(), asks: FieldValue.increment(1) }, { merge: true });
  return { visit: { id: vid, plantId: keep ? pref.id : null, at: Date.now(), question, answer: a, photo: await signed(photoPath), matched },
    plant: keep ? { id: pref.id, name, isNew: !plant, renamed: !!(fixed && plant && fixed !== plant.name) } : null };
}

// "זה צמח אחר": the visit moves to a new plant of its own (or to another saved plant)
async function move(g, vid, to) {
  const vref = g.ref.collection('visits').doc(okId(vid)), v = (await vref.get()).data();
  if (!v) throw fail(404, 'visit');
  const old = v.plantId ? g.ref.collection('plants').doc(v.plantId) : null;
  let target;
  if (to && to !== 'new') {
    target = g.ref.collection('plants').doc(okId(to));
    if (!(await target.get()).exists) throw fail(404, 'plant');
  } else target = g.ref.collection('plants').doc(newId());
  if (target.id === v.plantId) return { plantId: v.plantId };
  await vref.update({ plantId: target.id, matched: false });
  const a = v.answer || {};
  await target.set({ ...(to && to !== 'new' ? {} : { name: clip(a.plant_name, 80) || 'צמח', latin: clip(a.latin, 120), created: FieldValue.serverTimestamp() }),
    note: clip(a.note, 400), lastAt: v.at, lastPhoto: v.photo, lastStatus: a.status, lastStatusLine: clip(a.status_line, 200), count: FieldValue.increment(1) }, { merge: true });
  // the plant it left: back to its own latest visit, or gone when that was its only one
  if (!old) return { plantId: target.id };
  const rest = (await visitsOf(g, old.id)).filter((x) => x.id !== vref.id);
  if (!rest.length) await old.delete();
  else {
    const l = rest[0];
    await old.set({ lastAt: l.at, lastPhoto: l.photo, lastStatus: l.answer?.status, lastStatusLine: clip(l.answer?.status_line, 200), note: clip(l.answer?.note, 400), count: FieldValue.increment(-1) }, { merge: true });
  }
  return { plantId: target.id };
}

async function rename(g, pid, name) {
  name = clip(name, 60);
  if (!name) throw fail(400, 'name');
  const ref = g.ref.collection('plants').doc(okId(pid));
  if (!(await ref.get()).exists) throw fail(404, 'plant');
  await ref.update({ name });
  return { ok: true };
}

// read-aloud: once per answer anyway (kept), and at most PER_DAY a day per gardener within the day's money
const ttsOk = async (g) => !(await ag.gate([[`garden:tts:${g.id}`, PER_DAY, guard.DAY]])) && !(await ag.overBudget('garden', DAY_USD));
async function audio(g, vid) {
  const vref = g.ref.collection('visits').doc(okId(vid)), v = (await vref.get()).data();
  if (!v) throw fail(404, 'visit');
  if (!v.audio) {
    if (!(await ttsOk(g))) throw fail(429, 'day_limit');
    ag.spend('garden', 0.01);
    const path = `garden/${g.id}/${vref.id}.mp3`;
    await bucket().file(path).save(await speak(spoken(v)), { contentType: 'audio/mpeg', resumable: false });
    await vref.update({ audio: path });
    v.audio = path;
  }
  return { url: await signed(v.audio) };
}

// "read to me" as a stream: the phone's <audio> plays this address straight away (GET, ?k=), the voice starts in about a
// second instead of after the whole answer is made (~11 s); what streamed is kept, so the next tap is a plain file
async function speech(g, vid, res) {
  const vref = g.ref.collection('visits').doc(okId(vid)), v = (await vref.get()).data();
  if (!v) throw fail(404, 'visit');
  if (v.audio) return res.redirect(302, await signed(v.audio));
  if (!(await ttsOk(g))) throw fail(429, 'day_limit');
  ag.spend('garden', 0.01);
  const r = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { ...auth(), 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: 'ash', input: clip(spoken(v), 3800), response_format: 'mp3', instructions: VOICE }) });
  if (!r.ok || !r.body) { console.error('garden speech', r.status); throw fail(502, 'tts'); }
  res.status(200).set({ 'content-type': 'audio/mpeg', 'cache-control': 'no-store' });
  const chunks = [];
  for await (const c of r.body) { chunks.push(Buffer.from(c)); res.write(c); }
  res.end();
  const path = `garden/${g.id}/${vref.id}.mp3`;
  await bucket().file(path).save(Buffer.concat(chunks), { contentType: 'audio/mpeg', resumable: false });
  await vref.update({ audio: path });
}

// the home-screen app opens on his own link (iPhone keeps a home-screen app's storage apart from Safari's)
const manifest = (k) => ({
  id: '/garden/', name: 'רופא הגינה', short_name: 'רופא הגינה', description: 'מצלמים צמח ומקבלים תשובה',
  start_url: '/garden/?k=' + encodeURIComponent(k), scope: '/garden/', display: 'standalone', orientation: 'portrait', dir: 'rtl', lang: 'he',
  background_color: '#f7f2e8', theme_color: '#1e613a',
  icons: [{ src: '/garden/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/garden/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/garden/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
});

// ---------------------------------------------------------------- the API ----------------------------------------------------------------
async function route(req, res) {
  const parts = req.path.replace(/^\/garden\/api/, '').split('/').filter(Boolean);
  const [a, b, c] = parts;
  if (a === 'manifest' && req.method === 'GET') {
    const k = clip(req.query.k, 100);
    res.set('content-type', 'application/manifest+json').set('cache-control', 'private, max-age=3600');
    return res.send(JSON.stringify(manifest(k)));
  }
  const g = await gardener(req);
  if (!g) throw fail(401, 'key');
  g.req = req;
  res.set('cache-control', 'no-store');
  if (a === 'me' && req.method === 'GET') return res.json({ name: g.name || '', plants: await Promise.all((await plants(g)).map(plantOut)) });
  if (a === 'ask' && req.method === 'POST') return res.json(await ask(g, req.body || {}));
  if (a === 'plant' && b && !c && req.method === 'GET') {
    const p = await g.ref.collection('plants').doc(okId(b)).get();
    if (!p.exists) throw fail(404, 'plant');
    const vs = (await visitsOf(g, p.id)).slice(0, 60);
    return res.json({ plant: await plantOut({ id: p.id, ...p.data() }), visits: await Promise.all(vs.map(visitOut)) });
  }
  if (a === 'plant' && b && c === 'name' && req.method === 'POST') return res.json(await rename(g, b, (req.body || {}).name));
  if (a === 'visit' && b && !c && req.method === 'GET') {
    const v = await g.ref.collection('visits').doc(okId(b)).get();
    if (!v.exists) throw fail(404, 'visit');
    return res.json({ visit: await visitOut({ id: v.id, ...v.data() }) });
  }
  if (a === 'visit' && b && c === 'move' && req.method === 'POST') return res.json(await move(g, b, (req.body || {}).to));
  if (a === 'visit' && b && c === 'audio' && req.method === 'POST') return res.json(await audio(g, b));
  if (a === 'visit' && b && c === 'speech' && req.method === 'GET') return speech(g, b, res);
  throw fail(404, 'route');
}

exports.garden = onRequest({ region: REGION, secrets: [OPENAI, ANTHROPIC], cors: CORS, invoker: 'public', maxInstances: 3, memory: '512MiB', timeoutSeconds: 120 }, async (req, res) => {
  try { await route(req, res); } catch (e) {
    if (!e.status || e.status >= 500) console.error('garden', req.method, req.path, e.message);
    if (res.headersSent) return res.end();
    // a 4xx says what was wrong with the request (key, photo, day_limit...); a 5xx only that it failed - never the provider's words
    res.status(e.status || 500).json({ error: e.status && e.status < 500 ? e.message : e.status === 502 ? 'busy' : 'server' });
  }
});
exports._test = { look, lookClaude, lookTerra, brief, spoken, INSTRUCTIONS, SCHEMA };
