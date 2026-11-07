// The citizenship journey (stage 3 of the conversion plan; plan conversion-next v6, approved by him 2026-11-06): a resident
// becomes a citizen - a boarding pass, check-in with Miriam (an AI agent in her own voice - confused, breathes heavily, short lines - who
// asks the registry's questions; skippable; from the answers the AI writes their department and classification),
// border control at Rabbi Demokratovich's booth (HIS lines word for word; between them the AI reacts in his voice to what
// they tapped or typed; simple fixed answers or their own words), the
// stamp with a real citizen number in order ("אזרח מייסד" for the first 1,000), the flight in (teaser 1) and the ID card.
// "ספרו לנו עליכם" (plan cz-sim-r3, his yes 2026-11-07): Miriam's questions and two lines of the booth are the person's profile
// in costume (about.js) - each asks only a field still missing; every answer is saved there once.
// The journey is saved as it goes (citizens/<uid>); the citizen's line on the account: fans/<uid>.citizen.
// Key: VERSE_SITE_OPENAI_KEY (the site's features share it; Backstage → הוצאות shows its spend). The page: v2/site/verse/citizen.js.
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const bundled = require('./wiki-brain.json');
const proc = require('./process');
const about = require('./about');

if (!admin.apps.length) admin.initializeApp();
const db = () => admin.firestore();
const KEY = defineSecret('VERSE_SITE_OPENAI_KEY');
const MODEL = 'gpt-5.6-terra';
const FOUNDING = 1000;
const OWNER_EMAIL = 'shlomi@boostart.io';
const CORS = [/^https:\/\/boostmind-b052c(--[\w-]+)?\.web\.app$/, /^https:\/\/(www\.)?shlomiverse\.com$/, /^http:\/\/localhost(:\d+)?$/];
// the booth (his ask, 2026-11-06: "buttons but a fixed script" felt dead): HIS lines stay, word for word and in order; before
// each of them the AI writes a short reaction of his to what the visitor just said. The answers (his notes 2026-11-07: the AI's
// buttons were bad): simple fixed ones on the yes/no lines, open text everywhere (line 2 = open text only). Nothing between the
// last answer and the stamp line. The beat after the stamp = "טסים פנימה".
const SCRIPT = [
  'שלום עכשיו. דרכון בבקשה.',
  'מה מטרת כניסתך לארצנו?',
  'מבקש אזרחות? יפה. אמור לי, האם אתה מקבל עליך עול מלכות דמוקרטיא?',
  'והאם אתה מכיר בסמכותו העליונה של בית הדין הגבוה לצדק?',
  'יפה מאוד. וכבר הורו שז״ל, שופטינו זכרונם לברכה: אין אזרחות בלא הסכמה, ואין הסכמה בלא טופס חתום כדין.',
];
const AFTER_STAMP = 'הכניסה אושרה. מעמד: אזרח. משך השהייה: עד שבג״ץ יפסוק אחרת.';
const OPTS = [['הנה הדרכון'], [], ['מקבל/ת', 'לא מקבל/ת'], ['מכיר/ה', 'לא מכיר/ה'], ['חותמים', 'לא חותמים']];
// two lines the booth adds only when the profile still misses them (plan cz-sim-r3 mockups bday / push): the birthday right after
// "דרכון בבקשה", the notifications right before his last line. Kept on the citizen's doc as d.script once the booth starts.
const LINE_BDAY = { kind: 'bday', field: 'bday', pre: 'הדרכון חסר שדה אחד, ואין דרכון בלי תאריך לידה.', t: 'תאריך לידה, לצורך הדרכון?', opts: [] };
const LINE_PUSH = { kind: 'push', field: 'push', pre: 'אזרח מחויב להתעדכן בפסיקות.', t: 'האם אתה מסכים לקבל צווים מהשלטונות?', opts: ['מסכים/ה', 'לא מסכים/ה'], vals: ['yes', 'no'], note: 'צווים = התראה כשדמות שבחרתם מעלה משהו חדש' };
const NO_BDAY = 'מעדיפים לא לומר';
const baseScript = () => SCRIPT.map((t, i) => ({ kind: 'line', t, opts: OPTS[i] }));
function scriptFor(ab) {
  const m = new Set(about.missing(ab, ['bday', 'push']));
  const lines = baseScript();
  if (m.has('push')) lines.splice(lines.length - 1, 0, LINE_PUSH);
  if (m.has('bday')) lines.splice(1, 0, LINE_BDAY);
  return lines;
}
// journeys that reached the booth before the per-person script keep the plain one
const scriptOf = (d) => (d.script && d.script.length ? d.script : baseScript());
const said = (l) => (l.pre ? l.pre + ' ' : '') + l.t;

// Miriam's questions = the profile's fields (plan cz-sim-r3): fixed wording (the mockups' lines), only the ones still missing, in
// this order; her words before each stay AI. A returning profile with fewer than 3 left gets 1-3 of her own questions, so the
// check-in is never empty. Her old first question (why they came) is gone - "מאיפה טסתם אלינו?" took its place.
const SLOTS = {
  source: { kind: 'pick', q: 'מאיפה טסתם אלינו?' },
  fav: { kind: 'chars', q: 'את מי באתם לבקר?' },
  first: { kind: 'pick', q: 'מה תעשו פה קודם?' },
  wish: { kind: 'text', q: 'ומה הייתם רוצים לעשות כאן?' },
};
const SLOT_ORDER = ['source', 'fav', 'first', 'wish'];
const MIN_TURNS = 3;
// the wish box's suggestions (tap = fills the box), from the characters they just picked
function wishSugg(fav, names) {
  const n = (fav || []).map((id) => String(names[id] || '').replace(/\s*\([^)]*\)/g, '').trim()).filter(Boolean);   // 'נהור (ציון) מינוף' -> 'נהור מינוף'
  return [n[0] ? `לדבר עם ${n[0]}` : 'לדבר עם הדמויות', n[1] ? `לראות עוד סרטונים של ${n[1]}` : 'לראות את כל הסרטונים', 'לשבור שיא באחד המשחקים'];
}
const WHY_Q = 'למה באתם לשלומיוורס?';   // the old first question - Backstage still counts it in the records that have it

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
const clip = (s, n) => String(s ?? '').slice(0, n);
// what a character SAYS is never cut mid-word (round 4 check: the rabbi's reaction ended "...כבר ק"): over the limit it ends at
// the last full sentence, else at the last word
const sayClip = (s, n) => {
  const t = String(s ?? '').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n), end = Math.max(...['.', '?', '!', '…', ':'].map((c) => cut.lastIndexOf(c)));
  return end > n * 0.4 ? cut.slice(0, end + 1) : cut.slice(0, cut.lastIndexOf(' ')).replace(/[,\s]+$/, '') + '…';
};

// Miriam and Demokratovich are the chat's own characters (process.js: the same chat - map, voice, full material), told that this
// is a process and what its steps are (his ask 2026-11-07: "exactly the chat, with a clear instruction that it runs a process")
const CHECKIN = `You are at the CHECK-IN COUNTER for flights into the Shlomiverse. A resident of the site is checking in for their citizenship; after you comes Rabbi Demokratovich's passport control, where they get stamped.
The steps: the registry's check-in form asks the visitor a few questions, one per screen, and you are the clerk at the counter. Before each question you say something ("say"): on the first one your hello, after that your reaction to what they just answered. Most questions are the form's own - their wording is fixed and shown to the visitor right under your words, so you never ask them yourself and never repeat them; your "say" only leads into them. When the form has nothing left you ask a question of your own. You don't really understand their answers, in your own way, but you're kind.
Shlomi's note for this scene: you breathe heavily; your breath out comes as a long "אהההה..." so people think you understood - but you didn't, you just breathe like that ("לא, אני לא הבנתי. אני פשוט נושמת ככה. מחניק פה."). Use it once or twice in the check-in, not every turn.
"say" = one or two short sentences. Your own question, when you are asked to write one: "q" plain and clear, up to 9 words, about the visitor - the visitor must understand it even though you don't; "opts" = 3 answers the visitor might tap, up to 5 words each, in the visitor's voice - real answers a person could give (they may be funny).
Never write the bare name "שלומי" - the place is "השלומיוורס". Speak to the visitor in plural (אתם).`;
const boothPrompt = (lines) => `You sit in the PASSPORT-CONTROL BOOTH at the entrance to the Shlomiverse. The visitor, just checked in with Miriam, wants to become a citizen; you stamp them in at the end.
Shlomi wrote your lines for this scene. They are said word for word, in this order - you never change, skip or repeat them:
${lines.map((l, i) => `${i + 1}. ${said(l)}`).join('\n')}
(then you stamp: "${AFTER_STAMP}")
After each line the visitor answers - with a simple button ("מקבל/ת", "חותמים"...) or in their own words. Your part now is "react": what you say right after their answer and right before your next line - one or two short sentences, reacting to exactly what they said, funny and in your voice. It must flow into your next line without saying what that line says. If they mock you or refuse, stay in character.
You speak to the visitor in the singular, as in your lines.`;
const BT = { type: 'object', additionalProperties: false, required: ['react'], properties: { react: { type: 'string' } } };
// what happened so far, the answer just given (k = which line it answers) and which line comes next
function boothInput(d, fan, bt, k, a) {
  const lines = scriptOf(d);
  const intro = `The visitor: ${fan.nick || '-'}.` + ((d.turns || []).length ? ' What they told Miriam: ' + d.turns.map((t) => `${t.q} -> ${t.a ?? '(skipped)'}`).join(' | ') : '');
  const past = bt.slice(0, k).map((t, i) => `Line ${i + 1}: ${said(lines[i])}\nThey: ${t.a}\nYou reacted: ${t.react}`).join('\n');
  return `${boothPrompt(lines)}\n\n${intro}\n\n${past ? past + '\n' : ''}Line ${k + 1}: ${said(lines[k])}\nThey answered now: "${a}"\n\nYour next line (said right after your reaction): "${said(lines[k + 1])}". Write "react".`;
}
const btOf = (o) => ({ react: sayClip(String(o.react || '').split(AFTER_STAMP)[0].trim(), 200) });
const reacts = (d, i) => i + 1 < scriptOf(d).length;   // the last answer goes straight to the stamp line

const SAY = { type: 'object', additionalProperties: false, required: ['say'], properties: { say: { type: 'string' } } };
const OWN = { type: 'object', additionalProperties: false, required: ['say', 'q', 'opts'], properties: { say: { type: 'string' }, q: { type: 'string' }, opts: { type: 'array', items: { type: 'string' }, maxItems: 3 } } };
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
// her task for the next turn: the check-in so far + what comes now (a form question / her own / the closing)
function talk(turns, next) {
  const so = turns.length ? 'The check-in so far:\n' + turns.map((t, i) => `${i + 1}. you said: ${t.say} | ${t.field ? 'the form asked' : 'you asked'}: ${t.q} | they answered: ${t.a === null ? '(skipped this question)' : t.a}`).join('\n') + '\n\n' : 'They just arrived at your counter.\n\n';
  const now = next === 'close' ? 'That was the last question. Write "say": your reaction to their last answer, then close the check-in and send them on to the rabbi.'
    : next === 'own' ? `The form has nothing left to ask - write a question of your own (${turns.length ? '"say" = your reaction to their last answer' : '"say" = your hello'}; "q"; "opts").`
      : `Next the form asks: "${SLOTS[next].q}". Write "say" = ${turns.length ? 'your reaction to their last answer' : 'your hello'}, leading into it - without asking it.`;
  return CHECKIN + '\n\n' + so + now;
}
// the next screen at the counter: the form's question (its fixed words + its answers) or one of hers, with her words before it
async function nextTurn(key, d, turns, I) {
  const k = turns.length, plan = d.plan || [], slot = plan[k];
  if (!slot) {
    const o = (await proc.run(key, 'miriam', [], talk(turns, 'close'), SAY, 'say')).out;
    return { close: sayClip(o.say, 260) };
  }
  if (slot === 'own') {
    const o = (await proc.run(key, 'miriam', [], talk(turns, 'own'), OWN, 'turn')).out;
    return { say: sayClip(o.say, 260), q: clip(o.q, 160), kind: 'pick', opts: (o.opts || []).slice(0, 3).map((x) => clip(x, 60)) };
  }
  const o = (await proc.run(key, 'miriam', [], talk(turns, slot), SAY, 'say')).out;
  const f = about.FIELDS[slot], t = { say: sayClip(o.say, 260), q: SLOTS[slot].q, kind: SLOTS[slot].kind, field: slot, opts: [] };
  if (f.kind === 'pick') { t.vals = Object.keys(f.opts); t.opts = Object.values(f.opts); }
  if (slot === 'wish') {
    const fav = (turns.find((x) => x.field === 'fav') || {}).v || ((await about.get(d.uid)).fav || {}).v;
    t.sugg = wishSugg(fav, I.names);
  }
  return t;
}

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
// who may start the journey over (his ask 2026-11-07, plan cz-sim-r3): his own account, the emulator, and test accounts he lists
// in verseMeta/testers { uids: [...] }
async function tester(user) {
  if (process.env.FUNCTIONS_EMULATOR === 'true') return true;
  if (user.email === OWNER_EMAIL && user.email_verified) return true;
  const t = await db().collection('verseMeta').doc('testers').get();
  return !!(t.exists && (t.data().uids || []).includes(user.uid));
}
const turnView = (t) => ({ say: t.say, q: t.q, kind: t.kind || 'pick', field: t.field || null, opts: t.opts || [], sugg: t.sugg || null, a: t.a ?? null });
const view = (d, fan) => {
  const lines = scriptOf(d);
  return { step: d.step || 'boarding', turns: (d.turns || []).map(turnView), pending: d.pending ? turnView(d.pending) : null,
    booth: d.booth || [], script: lines.map((l) => l.t), opts: lines.map((l) => l.opts || []), lines: lines.map((l) => ({ kind: l.kind, pre: l.pre || '', note: l.note || '' })),
    bday: d.bdayDraft ? { raw: d.bdayDraft.raw, date: d.bdayDraft.date || null } : null,
    bt: (d.bt || []).map((t) => ({ a: t.a ?? null, react: t.react || '' })), n: d.n || null, issued: d.stamped && d.stamped.toMillis ? d.stamped.toMillis() : null, founding: !!d.founding, dept: d.dept || null, cls: d.cls || null, nick: fan.nick || '', photo: fan.photo || null, sim: fan.sim || null, test: !!d.test };
};

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

  // "להתחיל מחדש (בדיקה)" / "להחזיר את המצב שלי" (his ask 2026-11-07): the journey from zero without touching his real one. The
  // first reset moves his citizen doc, his profile and the account's citizen + simulation lines aside (citizenBackups/<uid>);
  // a reset over a test run never overwrites that backup. Restore puts them back as they were and drops the backup.
  if (op === 'reset' || op === 'restore') {
    if (!(await tester(user))) return { error: 'auth' };
    const bRef = db().collection('citizenBackups').doc(user.uid), aRef = db().collection('about').doc(user.uid);
    const [bak, ab] = await Promise.all([bRef.get(), aRef.get()]);
    const batch = db().batch();
    if (op === 'reset') {
      if (!bak.exists) batch.set(bRef, { citizen: d, about: ab.exists ? ab.data() : null, fan: { citizen: fan.citizen || null, sim: fan.sim || null }, t: FieldValue.serverTimestamp() });
      batch.delete(ref); batch.delete(aRef);
      batch.set(fanRef, { citizen: FieldValue.delete(), sim: FieldValue.delete() }, { merge: true });
      await batch.commit();
      return { ok: true };
    }
    if (!bak.exists) return { ok: true, nothing: true };
    const x = bak.data();
    if (x.citizen) batch.set(ref, x.citizen); else batch.delete(ref);
    if (x.about) batch.set(aRef, x.about); else batch.delete(aRef);
    batch.set(fanRef, { citizen: x.fan && x.fan.citizen ? x.fan.citizen : FieldValue.delete(), sim: x.fan && x.fan.sim ? x.fan.sim : FieldValue.delete() }, { merge: true });
    batch.delete(bRef);
    await batch.commit();
    return { ok: true };
  }
  if (op === 'canReset') return { ok: await tester(user), backup: (await db().collection('citizenBackups').doc(user.uid).get()).exists };

  if (op === 'state') return { ...(d ? view(d, fan) : { step: null, nick: fan.nick, photo: fan.photo || null, sim: fan.sim || null }) };

  if (op === 'start') {
    if (!d) {
      // a test run (a backup of the real journey is waiting): it never takes a new citizen number (see the stamp)
      const test = (await db().collection('citizenBackups').doc(user.uid).get()).exists;
      d = { uid: user.uid, step: 'boarding', turns: [], booth: [], created: FieldValue.serverTimestamp(), own: !!b.own, ...(test ? { test: true } : {}) };
      await ref.set(d);
    }
    return view(d, fan);
  }
  if (!d) return { error: 'start' };
  d.uid = user.uid;

  // on to the booth: the department + classification from all the turns, and this person's script (the two profile lines only if missing)
  async function toBooth(turns, br, extra = {}) {
    const [c, ab] = await Promise.all([classify(key, br, turns, fan.nick), about.get(user.uid)]);
    const script = scriptFor(ab), bt = [];
    await ref.update({ step: 'booth', turns, dept: clip(c.dept, 60), cls: clip(c.cls, 80), bt, script, pending: FieldValue.delete(), ...extra });
    return view({ ...d, step: 'booth', turns, dept: c.dept, cls: c.cls, bt, script, pending: null, ...extra }, fan);
  }
  const saveAbout = (field, v, raw, I) => about.save(user.uid, { [field]: v }, 'miriam', { raw: raw ? { [field]: raw } : {}, ids: about.idsFor(field, I) }).catch((e) => console.error('citizen about', field, e.message));

  // check-in with Miriam: her next turn (the first one when they arrive), after an answer / a skipped question / "skip it all"
  if (op === 'checkin') {
    const [br, I] = await Promise.all([brainNow(), about.ids()]);
    const turns = d.turns || [];
    if (d.step === 'boarding') {
      // what this person's profile still misses decides her questions (plan cz-sim-r3)
      const slots = about.missing(await about.get(user.uid), SLOT_ORDER);
      d.plan = [...slots, ...Array(Math.max(0, MIN_TURNS - slots.length)).fill('own')];
      d.step = 'checkin';
    }
    if (d.step !== 'checkin') return view(d, fan);
    const pend = d.pending;
    if (b.all) {   // skip the whole check-in: the question on screen counts as skipped; the ones they never saw stay unasked
      if (pend && pend.field) await saveAbout(pend.field, null, null, I);
      return toBooth(turns.filter((t) => t.a !== undefined), br, { skippedAll: true });
    }
    let mapping = null, answered = false;
    if (pend && (b.pick !== undefined || b.text !== undefined || b.chars !== undefined || b.skip)) {
      const t = { ...pend };
      if (b.skip) { t.a = null; t.v = null; }
      else if (t.kind === 'chars') {
        const v = about.clean('fav', b.chars, I.chars);
        if (!v) return { error: 'answer' };
        t.v = v; t.a = v.map((id) => I.names[id] || id).join(', ');
      } else if (b.text !== undefined) {
        t.a = clip(String(b.text).trim(), 200) || null; t.typed = true;
        // their own words on a form question: the AI says which answer they mean (the words are kept too); "מאיפה" defaults to other
        if (t.field && t.kind === 'pick') mapping = t.a ? about.mapText(key, t.field, t.a).then((v) => v || (t.field === 'source' ? 'other' : null)) : Promise.resolve(null);
        else if (t.field) t.v = t.a;
      } else {
        const i = Number(b.pick);
        t.a = (t.opts || [])[i] ?? null;
        if (t.vals) t.v = t.vals[i] ?? null;
      }
      turns.push(t);
      answered = true;
    } else if (pend) return view(d, fan);   // nothing answered: the same question again (a reload)
    // her next words (and, for typed words on a form question, which answer they meant) - side by side
    const [o, mv] = await Promise.all([nextTurn(key, d, turns, I), mapping]);
    const last = turns[turns.length - 1];
    if (last && mapping) last.v = mv;
    if (answered && last.field) await saveAbout(last.field, last.v === undefined ? null : last.v, last.typed ? last.a : null, I);
    if (o.close) {
      const r = await toBooth(turns, br, { closing: o.close, plan: d.plan });
      return { ...r, closing: o.close };
    }
    await ref.update({ step: 'checkin', turns, pending: o, plan: d.plan || [] });
    return view({ ...d, step: 'checkin', turns, pending: o }, fan);
  }

  // the booth's birthday line (plan cz-sim-r3 mockup bday): their free words -> a date ("נרשם: 22 באוגוסט 1994"); kept as a draft
  // until they go on ("לא נכון? כתבו שוב" = this again)
  if (op === 'bday') {
    const lines = scriptOf(d), i = (d.booth || []).length;
    if (d.step !== 'booth' || Number(b.i) !== i || !lines[i] || lines[i].kind !== 'bday') return view(d, fan);
    if ((d.bdayTries || 0) >= 12) return { error: 'answer' };
    const raw = clip(String(b.text || '').trim(), 80);
    if (!raw) return { error: 'answer' };
    const date = await about.parseDate(key, raw);
    d.bdayDraft = { i, raw, date: date || null };
    await ref.update({ bdayDraft: d.bdayDraft, bdayTries: FieldValue.increment(1) });
    return view(d, fan);
  }

  // the booth: his script, an answer per beat; after the last line the stamp - the number is given here, in order
  // while they read a line: his reaction to each of its fixed answers, written ahead (a tap then answers at once)
  if (op === 'boothPre') {
    const bt = d.bt || [], i = (d.booth || []).length, line = scriptOf(d)[i];
    if (d.step !== 'booth' || Number(b.i) !== i || !reacts(d, i) || !line || !(line.opts || []).length || (d.bpre && d.bpre.i === i)) return { ok: true };
    await ref.update({ bpre: { i, at: Date.now(), b: {} } });
    const made = await Promise.all(line.opts.map(async (o) => { try { return btOf((await proc.run(key, 'demokratovich', [], boothInput(d, fan, bt, i, o), BT, 'booth')).out); } catch (e) { return null; } }));
    await ref.update({ bpre: { i, at: Date.now(), b: Object.fromEntries(made.map((x, k) => [k, x]).filter(([, x]) => x)) } });
    return { ok: true };
  }
  if (op === 'booth') {
    if (d.step !== 'booth') return view(d, fan);
    const lines = scriptOf(d), steps = lines.length + 1;
    const booth = [...(d.booth || [])];
    const i = Number(b.i);
    if (i !== booth.length || i >= steps) return view(d, fan);
    const bt = [...(d.bt || [])];
    if (i < lines.length) {
      const line = lines[i];
      // their answer: a button (pick), their own words (text), or on the birthday line the date they confirmed / "מעדיפים לא לומר"
      const pick = b.pick !== undefined ? Number(b.pick) : null;
      let a, save = null;
      if (line.kind === 'bday') {
        if (b.skip) { a = NO_BDAY; save = null; }
        else if (d.bdayDraft && d.bdayDraft.i === i && d.bdayDraft.date) { a = d.bdayDraft.raw; save = d.bdayDraft.date; }
        else return { error: 'answer' };
      } else {
        a = pick !== null ? (line.opts || [])[pick] : clip(String(b.text || '').trim(), 120);
        if (!a) return { error: 'answer' };
      }
      // the notifications line: the button's value, or their own words read by the AI (yes / no / neither)
      let pushV = Promise.resolve(undefined);
      if (line.kind === 'push') pushV = pick !== null ? Promise.resolve(line.vals[pick]) : about.mapText(key, 'push', a);
      let step = reacts(d, i) ? null : { react: '' };
      if (!step && pick !== null) {
        let pre = d.bpre && d.bpre.i === i ? d.bpre : null;
        for (let t = 0; pre && !pre.b[pick] && Date.now() - pre.at < 9000 && t < 15; t++) {
          await new Promise((r) => setTimeout(r, 400));
          const again = (await ref.get()).data().bpre;
          pre = again && again.i === i ? again : null;
        }
        step = pre && pre.b[pick];
      }
      const [react, pv] = await Promise.all([
        step ? step : proc.run(key, 'demokratovich', [], boothInput(d, fan, bt, i, a), BT, 'booth').then((r) => btOf(r.out)).catch(() => ({ react: '' })),
        pushV,
      ]);
      bt[i] = { a, typed: pick === null && line.kind !== 'bday', react: react.react };
      booth.push(clip(a, 120));
      if (line.kind === 'bday') await about.save(user.uid, { bday: save }, 'demokratovich', { raw: save ? { bday: a } : {} }).catch((e) => console.error('citizen bday', e.message));
      if (line.kind === 'push') await about.save(user.uid, { push: pv === undefined ? null : pv }, 'demokratovich', { raw: pick === null ? { push: a } : {} }).catch((e) => console.error('citizen push', e.message));
      if (line.kind === 'push') bt[i].push = pv || null;
    } else booth.push(clip(b.a, 60));
    d.bt = bt;
    if (booth.length < lines.length) { await ref.update({ booth, bt }); return view({ ...d, booth }, fan); }
    if (!d.n && !d.stamped) {
      // a test run (citizenBackups/<uid> exists - his "start over") keeps his real number and never moves the counter
      const bak = d.test ? await db().collection('citizenBackups').doc(user.uid).get() : null;
      const real = bak && bak.exists && bak.data().citizen ? bak.data().citizen : null;
      const n = d.test ? (real && real.n) || 0 : await db().runTransaction(async (tx) => {
        const cRef = db().collection('verseMeta').doc('citizens'), c = await tx.get(cRef), me = await tx.get(ref);
        if (me.exists && me.data().n) return me.data().n;
        const k = (c.exists ? c.data().n || 0 : 0) + 1;
        tx.set(cRef, { n: k, t: FieldValue.serverTimestamp() }, { merge: true });
        tx.update(ref, { n: k, founding: k <= FOUNDING, stamped: FieldValue.serverTimestamp() });
        return k;
      });
      if (d.test) await ref.update({ n, founding: !!(real && real.founding), stamped: FieldValue.serverTimestamp() });
      d.n = n; d.founding = d.test ? !!(real && real.founding) : n <= FOUNDING;
      await fanRef.set({ citizen: { n, founding: d.founding, dept: d.dept || null, cls: d.cls || null, t: Date.now() } }, { merge: true });
    }
    const step = booth.length >= steps ? 'flight' : 'booth';
    await ref.update({ booth, bt, step });
    return view({ ...d, booth, step }, fan);
  }

  // the flight seen (or skipped) -> the ID card; the card shared
  if (op === 'landed') { if (d.n || d.stamped) await ref.update({ step: 'done', done: FieldValue.serverTimestamp() }); return view({ ...d, step: d.n || d.stamped ? 'done' : d.step }, fan); }
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
  const docs = snap.docs.filter((x) => !x.data().own && !x.data().test);
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
      qa: (d.turns || []).map((t) => ({ q: t.q, a: t.a ?? null, opt: t.a != null && !t.typed && (t.kind === 'chars' || (t.opts || []).includes(t.a)) })) }; });
  // why they came: the old first question, in the records that still have it (since plan cz-sim-r3 the profile's "מאיפה" is in "מה למדנו")
  const why = {};
  for (const x of answers) { const a = x.qa[0] && x.qa[0].q === WHY_Q ? x.qa[0].a : null; if (a) why[a] = (why[a] || 0) + 1; }
  return { started: all.length, at, citizens: c.exists ? c.data().n || 0 : 0, shared, skippedAll, why, answers };
};

exports._test = { scriptFor, scriptOf, SLOTS, SLOT_ORDER, wishSugg, talk, handle };
