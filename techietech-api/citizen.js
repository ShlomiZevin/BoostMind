// The citizenship journey (stage 3 of the conversion plan; plan conversion-next v6, approved by him 2026-11-06): a resident
// becomes a citizen - a boarding pass, check-in with Miriam (an AI agent in her own voice - confused, never stops talking - who
// asks 4-6 questions about why they came; skippable; from the answers the AI writes their department and classification),
// border control at Rabbi Demokratovich's booth (HIS script, word for word - every "(מקשיב)" is an answer they tap), the
// stamp with a real citizen number in order ("אזרח מייסד" for the first 1,000), the flight in (teaser 1) and the ID card.
// The journey is saved as it goes (citizens/<uid>); the citizen's line on the account: fans/<uid>.citizen.
// Key: VERSE_SITE_OPENAI_KEY (the site's features share it; Backstage → הוצאות shows its spend). The page: v2/site/verse/citizen.js.
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const bundled = require('./wiki-brain.json');

if (!admin.apps.length) admin.initializeApp();
const db = () => admin.firestore();
const KEY = defineSecret('VERSE_SITE_OPENAI_KEY');
const MODEL = 'gpt-5.6-terra';
const FOUNDING = 1000;
const MAX_Q = 5;
const CORS = [/^https:\/\/boostmind-b052c(--[\w-]+)?\.web\.app$/, /^https:\/\/(www\.)?shlomiverse\.com$/, /^http:\/\/localhost(:\d+)?$/];
// the booth: his script has 6 beats; the answers the visitor taps are in the page (copy.js T.cz.booth)
const BOOTH_STEPS = 6;

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

function miriamText(b) {
  const c = b.characters.find((x) => x.id === 'miriam') || {};
  const F = [['brief', 'Who'], ['personality', 'Personality'], ['speech', 'How she talks'], ['catchphrases', 'Catchphrases'], ['behavior', 'Behaviour'], ['comedy', 'What is funny about her'], ['writing_rules', 'Writing notes'], ['dont', 'Never']];
  return F.filter(([k]) => c[k]).map(([k, l]) => `${l}: ${short(c[k], 1200)}`).join('\n');
}
const CHECKIN = (b) => `You are Miriam (מרים), the ground clerk at the CHECK-IN COUNTER for flights into שלומיוורס (the Shlomiverse - a world of comedy characters shown as real people). A resident of the site is checking in for their citizenship journey; after you, Rabbi Demokratovich's border control and the stamp.
You fill in their check-in form by talking to them: a few questions about them - why they came to the Shlomiverse, what they bring with them, who they already know here, what they are running from, what they expect to find... - one at a time, each following what they said. You never understand their answers properly, misread them, ask Zohara, but you never stop talking - and you are kind.
Each turn: "say" = your talk, in your own voice, up to 22 words, reacting to their last answer (first turn: a hello that already goes wrong); "q" = the question itself, short and clear (up to 12 words) - the visitor must understand it even though you don't; "opts" = 3 short answers the visitor might tap (up to 5 words each, funny, in the visitor's voice, grammar that agrees - never "אני באים"); "done" = true only after at least 4 answered questions (then "q" and "opts" are empty and "say" closes the check-in in your voice).
The FIRST question is always why they came to the Shlomiverse (Shlomi wants to know the truth): its 3 opts are real reasons people come - e.g. a video of his they saw, someone sent them the link, to talk with the characters / play the games - said in the visitor's funny voice, so whichever they tap is still a true answer.
Speak to the visitor in plural (אתם), Hebrew, no emoji. Nothing about politics, religion, health, money amounts or anything that could hurt. Never mention AI or forms or that this is a test.

Who you are:
${miriamText(b)}`;
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
const talk = (turns) => [{ role: 'user', content: turns.length
  ? 'The check-in so far:\n' + turns.map((t, i) => `${i + 1}. you said: ${t.say} | asked: ${t.q} | they answered: ${t.a === null ? '(skipped this question)' : t.a}`).join('\n') + `\n\nYour next turn (${turns.filter((t) => t.a !== null).length} answered so far${turns.length >= MAX_Q ? ' - this is the last: close the check-in, done=true' : ''}).`
  : 'They just arrived at your counter. Your first turn.' }];
const turnOf = (o) => ({ say: clip(o.say, 260), q: clip(o.q, 160), opts: (o.opts || []).slice(0, 3).map((x) => clip(x, 60)), done: !!o.done });

async function classify(key, b, turns, nick) {
  return ask(key, `You are the Shlomiverse's population registry. From a new citizen's check-in with Miriam (below), write two lines for their citizen ID card, in Hebrew, funny, bureaucratic, never mean, gender-neutral:
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
  booth: d.booth || [], n: d.n || null, founding: !!d.founding, dept: d.dept || null, cls: d.cls || null, nick: fan.nick || '', photo: fan.photo || null, sim: fan.sim || null });

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
      await ref.update({ step: 'booth', turns, dept: clip(c.dept, 60), cls: clip(c.cls, 80), skippedAll: true, pending: FieldValue.delete() });
      return view({ ...d, step: 'booth', dept: c.dept, cls: c.cls, pending: null }, fan);
    }
    const pend = d.pending;
    if (pend && (b.pick !== undefined || b.text !== undefined || b.skip)) {
      const a = b.skip ? null : b.text !== undefined ? clip(String(b.text).trim(), 200) || null : (pend.opts || [])[Number(b.pick)] ?? null;
      turns.push({ ...pend, a });
      if (turns.length === 1) d.why = { a, typed: b.text !== undefined };   // the first question = why they came (his ask: keep their reasons)
    } else if (pend) return view(d, fan);   // nothing answered: the same question again (a reload)
    const o = turnOf(await ask(key, CHECKIN(br), talk(turns), TURN, 'turn'));
    if (o.done || turns.length >= MAX_Q) {
      const c = await classify(key, br, turns, fan.nick);
      const last = { say: o.say, q: '', opts: [], done: true };
      await ref.update({ ...(d.why ? { why: d.why } : {}), step: 'booth', turns, closing: last.say, dept: clip(c.dept, 60), cls: clip(c.cls, 80), pending: FieldValue.delete() });
      return { ...view({ ...d, step: 'booth', turns, dept: c.dept, cls: c.cls, pending: null }, fan), closing: last.say };
    }
    await ref.update({ step: 'checkin', turns, pending: o, ...(d.why ? { why: d.why } : {}) });
    return view({ ...d, step: 'checkin', turns, pending: o }, fan);
  }

  // the booth: his script, an answer per beat; the 5th beat is the stamp - the number is given here, in order
  if (op === 'booth') {
    if (d.step !== 'booth') return view(d, fan);
    const booth = [...(d.booth || [])];
    const i = Number(b.i);
    if (i !== booth.length || i >= BOOTH_STEPS) return view(d, fan);
    booth.push(clip(b.a, 60));
    if (booth.length < 5) { await ref.update({ booth }); return view({ ...d, booth }, fan); }
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
    await ref.update({ booth, step });
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
