// The citizenship journey (stage 3 of the conversion plan; plan conversion-next v6, approved by him 2026-11-06): a resident
// becomes a citizen - a boarding pass, check-in with Miriam (an AI agent in her own voice - confused, breathes heavily, short lines - who
// asks 4-6 questions about why they came; skippable; from the answers the AI writes their department and classification),
// border control at Rabbi Demokratovich's booth (HIS lines word for word; between them the AI reacts in his voice to what
// they tapped or typed; simple fixed answers or their own words), the
// stamp with a real citizen number in order ("אזרח מייסד" for the first 1,000), the flight in (teaser 1) and the ID card.
// The journey is saved as it goes (citizens/<uid>); the citizen's line on the account: fans/<uid>.citizen.
// Key: VERSE_SITE_OPENAI_KEY (the site's features share it; Backstage → הוצאות shows its spend). The page: v2/site/verse/citizen.js.
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const bundled = require('./wiki-brain.json');
const proc = require('./process');

if (!admin.apps.length) admin.initializeApp();
const db = () => admin.firestore();
const KEY = defineSecret('VERSE_SITE_OPENAI_KEY');
const MODEL = 'gpt-5.6-terra';
const FOUNDING = 1000;
const MAX_Q = 5;
const CORS = [/^https:\/\/boostmind-b052c(--[\w-]+)?\.web\.app$/, /^https:\/\/(www\.)?shlomiverse\.com$/, /^http:\/\/localhost(:\d+)?$/];
// the booth (his ask, 2026-11-06: "buttons but a fixed script" felt dead): HIS lines stay, word for word and in order; before
// each of them the AI writes a short reaction of his to what the visitor just said. The answers (his notes 2026-11-07: the AI's
// buttons were bad): simple fixed ones on the yes/no lines, open text everywhere (line 2 = open text only). Nothing between the
// last answer and the stamp line. Beat 6 = "טסים פנימה" after the stamp.
const BOOTH_STEPS = 6;
const SCRIPT = [
  'שלום עכשיו. דרכון בבקשה.',
  'מה מטרת כניסתך לארצנו?',
  'מבקש אזרחות? יפה. אמור לי, האם אתה מקבל עליך עול מלכות דמוקרטיא?',
  'והאם אתה מכיר בסמכותו העליונה של בית הדין הגבוה לצדק?',
  'יפה מאוד. וכבר הורו שז״ל, שופטינו זכרונם לברכה: אין אזרחות בלא הסכמה, ואין הסכמה בלא טופס חתום כדין.',
];
const AFTER_STAMP = 'הכניסה אושרה. מעמד: אזרח. משך השהייה: עד שבג״ץ יפסוק אחרת.';
const OPTS = [['הנה הדרכון'], [], ['מקבל/ת', 'לא מקבל/ת'], ['מכיר/ה', 'לא מכיר/ה'], ['חותמים', 'לא חותמים']];
// Miriam's first question is always why they came (his ask: keep their reasons) - the same plain answers for everyone, so they count
const WHY_Q = 'למה באתם לשלומיוורס?';
const WHY_OPTS = ['ראיתי סרטון של השלומיוורס', 'מישהו שלח לי קישור', 'באתי לדבר עם הדמויות'];

let brain = bundled, brainMd5 = 'bundled', checked = 0;
async function brainNow() {
  if (Date.now() - checked < 180e3) return brain;
  checked = Date.now();
  try {
    const f = admin.storage().bucket('shlomiverse-private').file('wiki-brain.json');
    const [m] = await f.getMetadata();
    if (m.md5Hash !== brainMd5) { const [buf] = await f.download(); brain = JSON.parse(buf.toString('utf8')); brainMd5 = m.md5Hash; }
  } catch (e) { console.error('citizen brain', e.message); }
  return brain;
}
const short = (s, n) => { s = Array.isArray(s) ? s.join(' · ') : String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; };
const clip = (s, n) => String(s ?? '').slice(0, n);

// Miriam and Demokratovich are the chat's own characters (process.js: the same chat - map, voice, full material), told that this
// is a process and what its steps are (his ask 2026-11-07: "exactly the chat, with a clear instruction that it runs a process")
const CHECKIN = `You are at the CHECK-IN COUNTER for flights into the Shlomiverse. A resident of the site is checking in for their citizenship; after you comes Rabbi Demokratovich's passport control, where they get stamped.
The steps: you ask them 4 or 5 questions, one at a time, each following what they said (the first is always why they came - its question and answers are fixed). You don't really understand their answers, in your own way, but you're kind.
Shlomi's note for this scene: you breathe heavily; your breath out comes as a long "אהההה..." so people think you understood - but you didn't, you just breathe like that ("לא, אני לא הבנתי. אני פשוט נושמת ככה. מחניק פה."). Use it once or twice in the check-in, not every turn.
Each turn: "say" = your reaction to their last answer (on the first turn: your hello), one or two short sentences; "q" = the next question, plain and clear, up to 9 words - the visitor must understand it even though you don't; "opts" = 3 answers the visitor might tap, up to 5 words each, in the visitor's voice - real answers a person could give (they may be funny); "done" = true only after at least 4 answered questions - then "q" and "opts" are empty and "say" closes the check-in and sends them on to the rabbi.
Never write the bare name "שלומי" - the place is "השלומיוורס". Speak to the visitor in plural (אתם).`;
const BOOTH = `You sit in the PASSPORT-CONTROL BOOTH at the entrance to the Shlomiverse. The visitor, just checked in with Miriam, wants to become a citizen; you stamp them in at the end.
Shlomi wrote your lines for this scene. They are said word for word, in this order - you never change, skip or repeat them:
${SCRIPT.map((l, i) => `${i + 1}. ${l}`).join('\n')}
(then you stamp: "${AFTER_STAMP}")
After each line the visitor answers - with a simple button ("מקבל/ת", "חותמים"...) or in their own words. Your part now is "react": what you say right after their answer and right before your next line - one or two short sentences, reacting to exactly what they said, funny and in your voice. It must flow into your next line without saying what that line says. If they mock you or refuse, stay in character.
You speak to the visitor in the singular, as in your lines.`;
const BT = { type: 'object', additionalProperties: false, required: ['react'], properties: { react: { type: 'string' } } };
// what happened so far, the answer just given (k = which line it answers) and which line comes next
function boothInput(d, fan, bt, k, a) {
  const intro = `The visitor: ${fan.nick || '-'}.` + ((d.turns || []).length ? ' What they told Miriam: ' + d.turns.map((t) => `${t.q} -> ${t.a ?? '(skipped)'}`).join(' | ') : '');
  const past = bt.slice(0, k).map((t, i) => `Line ${i + 1}: ${SCRIPT[i]}\nThey: ${t.a}\nYou reacted: ${t.react}`).join('\n');
  return `${BOOTH}\n\n${intro}\n\n${past ? past + '\n' : ''}Line ${k + 1}: ${SCRIPT[k]}\nThey answered now: "${a}"\n\nYour next line (said right after your reaction): "${SCRIPT[k + 1]}". Write "react".`;
}
const btOf = (o) => ({ react: clip(String(o.react || '').split(AFTER_STAMP)[0].trim(), 140) });
const reacts = (i) => i + 1 < SCRIPT.length;   // the last answer goes straight to the stamp line

const TURN = { type: 'object', additionalProperties: false, required: ['say', 'q', 'opts', 'done'], properties: { say: { type: 'string' }, q: { type: 'string' }, opts: { type: 'array', items: { type: 'string' }, maxItems: 3 }, done: { type: 'boolean' } } };
const CLASS = { type: 'object', additionalProperties: false, required: ['dept', 'cls'], properties: { dept: { type: 'string' }, cls: { type: 'string' } } };

async function ask(key, instructions, input, schema, name, effort = 'low') {
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, instructions, input, reasoning: { effort }, max_output_tokens: 1400, store: false, prompt_cache_key: 'cz-' + name,
      text: { format: { type: 'json_schema', name, strict: true, schema } } }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`openai ${r.status} ${j.error?.message || ''}`);
  return JSON.parse((j.output || []).flatMap((o) => o.content || []).find((c) => c.type === 'output_text')?.text || '{}');
}
const talk = (turns) => CHECKIN + '\n\n' + (turns.length
  ? 'The check-in so far:\n' + turns.map((t, i) => `${i + 1}. you said: ${t.say} | asked: ${t.q} | they answered: ${t.a === null ? '(skipped this question)' : t.a}`).join('\n') + `\n\nYour next turn (${turns.filter((t) => t.a !== null).length} answered so far${turns.length >= MAX_Q ? ' - this is the last: close the check-in, done=true' : ''}).`
  : `They just arrived at your counter. Your first turn: "say" = your hello; "q" = "${WHY_Q}".`);
const turnOf = (o) => ({ say: clip(o.say, 260), q: clip(o.q, 160), opts: (o.opts || []).slice(0, 3).map((x) => clip(x, 60)), done: !!o.done });

async function classify(key, b, turns, nick) {
  return ask(key, `You are the Shlomiverse's population registry. From a new citizen's check-in with Miriam (below), write two lines for their passport, in Hebrew, funny, bureaucratic, never mean, gender-neutral:
- dept (מחלקה): the department of the Shlomiverse they belong to, up to 4 words (tone example: "ענייני מציאות חלופית").
- cls (סיווג): their classification, up to 5 words (tone example: "חשודים שיודעים יותר מדי").
If they skipped everything, make the lines about that.`, [{ role: 'user', content: `Name: ${nick || '-'}\n` + (turns.length ? turns.map((t) => `Q: ${t.q} | A: ${t.a === null ? '(skipped)' : t.a}`).join('\n') : '(skipped the whole check-in)') }], CLASS, 'class');
}

async function who(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  try { return await admin.auth().verifyIdToken(m[1]); } catch (e) { return null; }
}
const view = (d, fan) => ({ step: d.step || 'boarding', turns: (d.turns || []).map((t) => ({ say: t.say, q: t.q, opts: t.opts, a: t.a ?? null })), pending: d.pending || null,
  booth: d.booth || [], script: SCRIPT, opts: OPTS, bt: (d.bt || []).map((t) => ({ a: t.a ?? null, react: t.react || '' })), n: d.n || null, issued: d.stamped && d.stamped.toMillis ? d.stamped.toMillis() : null, founding: !!d.founding, dept: d.dept || null, cls: d.cls || null, nick: fan.nick || '', photo: fan.photo || null, sim: fan.sim || null });

async function handle(req) {
  const b = req.body || {}, op = b.op;
  const user = await who(req);
  if (!user) return { error: 'auth' };
  const key = process.env.FUNCTIONS_EMULATOR === 'true' ? process.env.VERSE_OPENAI_KEY : KEY.value();
  const fanRef = db().collection('fans').doc(user.uid), ref = db().collection('citizens').doc(user.uid);
  const [fanSnap, got] = await Promise.all([fanRef.get(), ref.get()]);
  const fan = fanSnap.exists ? fanSnap.data() : {};
  if (!fan.nick) return { error: 'resident' };   // residents only (an account with a name)
  let d = got.exists ? got.data() : null;

  if (op === 'state') return { ...(d ? view(d, fan) : { step: null, nick: fan.nick, photo: fan.photo || null, sim: fan.sim || null }) };

  if (op === 'start') {
    if (!d) { d = { uid: user.uid, step: 'boarding', turns: [], booth: [], created: FieldValue.serverTimestamp(), own: !!b.own }; await ref.set(d); }
    return view(d, fan);
  }
  if (!d) return { error: 'start' };

  // check-in with Miriam: her next turn (the first one when they arrive), after an answer / a skipped question / "skip it all"
  if (op === 'checkin') {
    const br = await brainNow();
    const turns = d.turns || [];
    if (d.step === 'boarding') { d.step = 'checkin'; }
    if (d.step !== 'checkin') return view(d, fan);
    if (b.all) {   // skip the whole check-in
      const c = await classify(key, br, turns.filter((t) => t.a !== undefined), fan.nick);
      const bt = [];
      await ref.update({ step: 'booth', turns, dept: clip(c.dept, 60), cls: clip(c.cls, 80), skippedAll: true, bt, pending: FieldValue.delete() });
      return view({ ...d, step: 'booth', dept: c.dept, cls: c.cls, bt, pending: null }, fan);
    }
    const pend = d.pending;
    if (pend && (b.pick !== undefined || b.text !== undefined || b.skip)) {
      const a = b.skip ? null : b.text !== undefined ? clip(String(b.text).trim(), 200) || null : (pend.opts || [])[Number(b.pick)] ?? null;
      turns.push({ ...pend, a });
      if (turns.length === 1) d.why = { a, typed: b.text !== undefined };   // the first question = why they came (his ask: keep their reasons)
    } else if (pend) return view(d, fan);   // nothing answered: the same question again (a reload)
    const o = turnOf((await proc.run(key, 'miriam', [], talk(turns), TURN, 'turn')).out);
    if (!turns.length) { o.q = WHY_Q; o.opts = WHY_OPTS; o.done = false; }
    if (o.done || turns.length >= MAX_Q) {
      const c = await classify(key, br, turns, fan.nick);
      const bt = [];
      const last = { say: o.say, q: '', opts: [], done: true };
      await ref.update({ ...(d.why ? { why: d.why } : {}), step: 'booth', turns, closing: last.say, dept: clip(c.dept, 60), cls: clip(c.cls, 80), bt, pending: FieldValue.delete() });
      return { ...view({ ...d, step: 'booth', turns, dept: c.dept, cls: c.cls, bt, pending: null }, fan), closing: last.say };
    }
    await ref.update({ step: 'checkin', turns, pending: o, ...(d.why ? { why: d.why } : {}) });
    return view({ ...d, step: 'checkin', turns, pending: o }, fan);
  }

  // the booth: his script, an answer per beat; the 5th beat is the stamp - the number is given here, in order
  // while they read a line: his reaction to each of its fixed answers, written ahead (a tap then answers at once)
  if (op === 'boothPre') {
    const bt = d.bt || [], i = (d.booth || []).length;
    if (d.step !== 'booth' || Number(b.i) !== i || !reacts(i) || !OPTS[i].length || (d.bpre && d.bpre.i === i)) return { ok: true };
    await ref.update({ bpre: { i, at: Date.now(), b: {} } });
    const br = await brainNow();
    const made = await Promise.all(OPTS[i].map(async (o) => { try { return btOf((await proc.run(key, 'demokratovich', [], boothInput(d, fan, bt, i, o), BT, 'booth')).out); } catch (e) { return null; } }));
    await ref.update({ bpre: { i, at: Date.now(), b: Object.fromEntries(made.map((x, k) => [k, x]).filter(([, x]) => x)) } });
    return { ok: true };
  }
  if (op === 'booth') {
    if (d.step !== 'booth') return view(d, fan);
    const booth = [...(d.booth || [])];
    const i = Number(b.i);
    if (i !== booth.length || i >= BOOTH_STEPS) return view(d, fan);
    const bt = [...(d.bt || [])];
    if (i < SCRIPT.length) {
      // their answer: a button (pick) or their own words (text); his reaction - the one written ahead, or now
      const pick = b.pick !== undefined ? Number(b.pick) : null;
      const a = pick !== null ? OPTS[i][pick] : clip(String(b.text || '').trim(), 120);
      if (!a) return { error: 'answer' };
      let step = reacts(i) ? null : { react: '' };
      if (!step && pick !== null) {
        let pre = d.bpre && d.bpre.i === i ? d.bpre : null;
        for (let t = 0; pre && !pre.b[pick] && Date.now() - pre.at < 9000 && t < 15; t++) {
          await new Promise((r) => setTimeout(r, 400));
          const again = (await ref.get()).data().bpre;
          pre = again && again.i === i ? again : null;
        }
        step = pre && pre.b[pick];
      }
      if (!step) { try { step = btOf((await proc.run(key, 'demokratovich', [], boothInput(d, fan, bt, i, a), BT, 'booth')).out); } catch (e) { step = { react: '' }; } }
      bt[i] = { a, typed: pick === null, react: step.react };
      booth.push(clip(a, 120));
    } else booth.push(clip(b.a, 60));
    d.bt = bt;
    if (booth.length < 5) { await ref.update({ booth, bt }); return view({ ...d, booth }, fan); }
    if (!d.n) {
      const n = await db().runTransaction(async (tx) => {
        const cRef = db().collection('verseMeta').doc('citizens'), c = await tx.get(cRef), me = await tx.get(ref);
        if (me.exists && me.data().n) return me.data().n;
        const k = (c.exists ? c.data().n || 0 : 0) + 1;
        tx.set(cRef, { n: k, t: FieldValue.serverTimestamp() }, { merge: true });
        tx.update(ref, { n: k, founding: k <= FOUNDING, stamped: FieldValue.serverTimestamp() });
        return k;
      });
      d.n = n; d.founding = n <= FOUNDING;
      await fanRef.set({ citizen: { n, founding: d.founding, dept: d.dept || null, cls: d.cls || null, t: Date.now() } }, { merge: true });
    }
    const step = booth.length >= BOOTH_STEPS ? 'flight' : 'booth';
    await ref.update({ booth, bt, step });
    return view({ ...d, booth, step }, fan);
  }

  // the flight seen (or skipped) -> the ID card; the card shared
  if (op === 'landed') { if (d.n) await ref.update({ step: 'done', done: FieldValue.serverTimestamp() }); return view({ ...d, step: d.n ? 'done' : d.step }, fan); }
  if (op === 'shared') { await ref.update({ shares: FieldValue.increment(1), shareVia: FieldValue.arrayUnion(clip(b.via || 'link', 12)) }); return { ok: true }; }
  return { error: 'op' };
}

exports.verseCitizen = onRequest({ region: 'europe-west1', cors: CORS, secrets: [KEY], memory: '256MiB', timeoutSeconds: 60, maxInstances: 6, concurrency: 40 }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'post' });
  try {
    const r = await handle(req);
    res.status(r && r.error ? (r.error === 'auth' || r.error === 'resident' ? 401 : 400) : 200).json(r);
  } catch (e) {
    console.error('verseCitizen', req.body && req.body.op, e.message);
    res.status(500).json({ error: 'server' });
  }
});

// Backstage (verseOwner op citizenStats): where the residents are in the journey
exports.owner = async (op) => {
  if (op !== 'citizenStats') return null;
  const snap = await db().collection('citizens').get();
  const docs = snap.docs.filter((x) => !x.data().own);
  const all = docs.map((x) => x.data());
  const at = { boarding: 0, checkin: 0, booth: 0, flight: 0, done: 0 };
  let shared = 0, skippedAll = 0;
  for (const d of all) { at[d.step || 'boarding'] = (at[d.step || 'boarding'] || 0) + 1; if (d.shares) shared++; if (d.skippedAll) skippedAll++; }
  const c = await db().collection('verseMeta').doc('citizens').get();
  // what they told Miriam (his ask, 2026-11-06: why they came matters) - every answer, newest first, with the account's name
  const ms = (t) => (t?.toMillis ? t.toMillis() : 0);
  const withAns = docs.filter((x) => (x.data().turns || []).length).sort((a, b) => ms(b.data().created) - ms(a.data().created)).slice(0, 200);
  const fans = withAns.length ? await db().getAll(...withAns.map((x) => db().collection('fans').doc(x.id))) : [];
  const answers = withAns.map((x, i) => { const d = x.data(), f = fans[i]?.data() || {};
    return { uid: x.id, nick: f.nick || '', t: ms(d.created), n: d.n || null, dept: d.dept || null, cls: d.cls || null, step: d.step || 'boarding',
      qa: (d.turns || []).map((t) => ({ q: t.q, a: t.a ?? null, opt: t.a != null && (t.opts || []).includes(t.a) })) }; });
  const why = {};
  for (const x of answers) { const a = x.qa[0]?.a; if (a) why[a] = (why[a] || 0) + 1; }
  return { started: all.length, at, citizens: c.exists ? c.data().n || 0 : 0, shared, skippedAll, why, answers };
};
