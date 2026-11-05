// "המוח השני" - Shlomi's second brain (shlomiverse.com/mind/, his ask 2026-11-04): everything running through his head
// (ideas, to-dos, running jobs, thoughts - types he controls) and every Claude Code session working for him, on any
// project and either computer, in one place. One function, three doors:
//   /mind/api   - his page. `Key <owner key>` (the same private code as /backstage/ and /all/) or the mind key.
//   /mind/hook  - the Claude Code hooks on his computers (setup/hook.mjs): a session started / was asked / answered /
//                 needs a permission / ended. `Bearer <mind key>`. This is what makes every session show up by itself.
//   /mind/mcp   - an MCP server (streamable HTTP, stateless JSON) so any session can read and report. `Bearer <mind key>`.
// The mind key is made on first use and kept in mind_meta/secret (clients can't read mind_* - no rule matches); his
// page shows it in "חיבור מחשב" for the setup line of another computer.
// Deploy from this folder: firebase deploy --only functions:mind
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const webpush = require('web-push');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('crypto');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const OWNER_KEY_SHA256 = require('./owner.json').ownerKeySha256;
const ITEMS = db.collection('mind_items');
const SESSIONS = db.collection('mind_sessions');
const META = db.collection('mind_meta');
const wrongKey = new Map();
const OPENAI = defineSecret('WIKI_OPENAI_KEY');   // the voice notes on his page -> text
// notifications to his phone (the home-screen app): the same VAPID keys as the verse's push (verse.js)
const VAPID_PRIVATE = defineSecret('VERSE_VAPID_PRIVATE');
const VAPID_PUBLIC = 'BApNz6a4ZuFrPgaIEHGY9rvyKkwIvrJPsRjH0k01QYruVT2yz5ce-0fVuuIsk9vyprZ8Gq1nGxXajBL-EMD0hP0';
const PUSH = db.collection('mind_push');
// what buzzes his phone - he turns each on / off in the page's settings (config.push)
const PUSH_KINDS = { ask: true, done: true, remind: true, reply: false };

const STATUSES = ['open', 'active', 'waiting', 'done', 'parked'];
const STATUS_HE = { open: 'פתוח', active: 'בטיפול', waiting: 'מחכה לך', done: 'בוצע', parked: 'בהקפאה' };
const SESSION_STATES = ['new', 'working', 'waiting', 'needs', 'stuck', 'done', 'ended'];
const DEFAULT_TYPES = [
  { id: 'idea', name: 'רעיון', color: '#f5a524', icon: 'bulb' },
  { id: 'task', name: 'משימה', color: '#3b82f6', icon: 'check' },
  { id: 'reminder', name: 'תזכורת', color: '#ec4899', icon: 'bell' },
  { id: 'job', name: "ג'וב רץ", color: '#10b981', icon: 'gear' },
  { id: 'thought', name: 'מחשבה', color: '#8b5cf6', icon: 'brain' },
  { id: 'wait', name: 'מחכה למישהו', color: '#f97316', icon: 'hourglass' },
];
const LOG_MAX = 80;

const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const oneLine = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
// a prompt without the blocks tools add to it (<ide_selection>, <browser_instruction>...; cut off at the end = dropped)
const untag = (t) => String(t ?? '').replace(/<([a-zA-Z_-]+)[^>]*>[\s\S]*?(<\/\1>|$)/g, ' ').trim();
const newId = () => crypto.randomBytes(5).toString('base64url').replace(/[-_]/g, '').slice(0, 6).toLowerCase() || newId();

// ---------- access ----------
let secretCache = { key: null, at: 0 };
async function mindKey(create) {
  if (secretCache.key && Date.now() - secretCache.at < 60e3) return secretCache.key;
  const ref = META.doc('secret');
  let key = ((await ref.get()).data() || {}).key;
  if (!key && create) { key = 'mind_' + crypto.randomBytes(24).toString('base64url'); await ref.set({ key, c: Date.now() }); }
  secretCache = { key: key || null, at: Date.now() };
  return key;
}
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
// -> 'owner' | 'session' | null
async function who(req) {
  const now = Date.now(), fails = (wrongKey.get(req.ip) || []).filter((t) => now - t < 3600e3);
  if (fails.length >= 20) return 'blocked';
  const auth = req.get('authorization') || '';
  let ok = null;
  if (auth.startsWith('Key ')) {
    const got = crypto.createHash('sha256').update(auth.slice(4)).digest();
    if (crypto.timingSafeEqual(got, Buffer.from(OWNER_KEY_SHA256, 'hex'))) ok = 'owner';
  } else if (auth.startsWith('Bearer ')) {
    const key = await mindKey(false);
    if (key && same(auth.slice(7).trim(), key)) ok = 'session';
  }
  if (!ok) { fails.push(now); wrongKey.set(req.ip, fails); }
  return ok;
}

// ---------- config: his types, project names, computer names ----------
async function config() {
  const c = (await META.doc('config').get()).data() || {};
  return { types: c.types?.length ? c.types : DEFAULT_TYPES, projects: c.projects || {}, machines: c.machines || {}, push: { ...PUSH_KINDS, ...(c.push || {}) } };
}
const typeIds = async () => new Set((await config()).types.map((t) => t.id));

// ---------- items ----------
const shapeItem = (d) => ({ id: d.id, ...d.data() });
function logEntry(by, text, extra = {}) { return { t: Date.now(), by: oneLine(by, 80) || 'שלומי', text: clip(text, 2000), ...extra }; }

async function addItem(f, by) {
  const types = await typeIds();
  const id = newId();
  const now = Date.now();
  const item = {
    text: oneLine(f.text, 300), body: clip(f.body, 8000),
    type: types.has(f.type) ? f.type : 'idea',
    status: STATUSES.includes(f.status) ? f.status : 'open',
    project: oneLine(f.project, 60), pin: !!f.pin, due: /^\d{4}-\d{2}-\d{2}$/.test(f.due || '') ? f.due : '',
    tags: Array.isArray(f.tags) ? f.tags.map((t) => oneLine(t, 30)).filter(Boolean).slice(0, 10) : [],
    sessions: f.session ? [oneLine(f.session, 80)] : [], by: oneLine(by, 80) || 'שלומי', c: now, u: now,
    log: [logEntry(by, f.note || 'נוצר', { st: STATUSES.includes(f.status) ? f.status : 'open', ...(f.session ? { s: oneLine(f.session, 80) } : {}) })],
  };
  if (!item.text) throw new Error('text is empty');
  await ITEMS.doc(id).set(item);
  if (f.session) await linkSession(f.session, id);
  return { id, ...item };
}

async function updateItem(id, f, by) {
  const ref = ITEMS.doc(oneLine(id, 20).replace(/^#/, ''));
  const types = await typeIds();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('no item ' + id);
    const it = snap.data(), ch = {}, said = [];
    if (f.text != null && oneLine(f.text, 300)) ch.text = oneLine(f.text, 300);
    if (f.body != null) ch.body = clip(f.body, 8000);
    if (f.type != null && types.has(f.type) && f.type !== it.type) ch.type = f.type;
    if (f.project != null) ch.project = oneLine(f.project, 60);
    if (f.pin != null) ch.pin = !!f.pin;
    if (f.due != null) ch.due = /^\d{4}-\d{2}-\d{2}$/.test(f.due) ? f.due : '';
    if (Array.isArray(f.tags)) ch.tags = f.tags.map((t) => oneLine(t, 30)).filter(Boolean).slice(0, 10);
    if (f.status != null && STATUSES.includes(f.status) && f.status !== it.status) { ch.status = f.status; said.push(STATUS_HE[f.status]); }
    if (f.session) { const s = oneLine(f.session, 80); if (!(it.sessions || []).includes(s)) ch.sessions = [...(it.sessions || []), s].slice(-10); }
    if (!Object.keys(ch).length && !f.note) return { id: ref.id, ...it };
    ch.u = Date.now();
    if (f.note || ch.status || ch.sessions) {
      ch.log = [...(it.log || []), logEntry(by, f.note || (ch.status ? 'סטטוס: ' + said.join(', ') : 'לקח את זה'), {
        ...(ch.status ? { st: ch.status } : {}), ...(f.session ? { s: oneLine(f.session, 80) } : {}) })].slice(-LOG_MAX);
    }
    tx.update(ref, ch);
    return { id: ref.id, ...it, ...ch, _linked: f.session && ch.sessions ? oneLine(f.session, 80) : null, _st: ch.status || null };
  }).then(async (r) => {
    if (r._linked) await linkSession(r._linked, r.id); delete r._linked;
    if (by !== 'שלומי' && r._st === 'done') await pushMe('done', { title: 'בוצע: ' + r.text, body: f.note || '', url: '/mind/#' + r.id, tag: 'i:' + r.id });
    else if (by !== 'שלומי' && r._st === 'waiting') await pushMe('ask', { title: 'מחכה לך: ' + r.text, body: f.note || '', url: '/mind/#' + r.id, tag: 'i:' + r.id });
    delete r._st; return r;
  });
}

async function linkSession(sid, itemId) {
  await SESSIONS.doc(sessionDocId(sid)).set({ items: admin.firestore.FieldValue.arrayUnion(itemId), u: Date.now() }, { merge: true });
}
const sessionDocId = (sid) => oneLine(sid, 80).replace(/[\/\s]/g, '_') || 'unknown';

async function listItems({ status, type, project, query, limit = 200, includeDone } = {}) {
  const snap = await ITEMS.orderBy('u', 'desc').limit(1500).get();
  let items = snap.docs.map(shapeItem);
  if (status) { const s = [].concat(status); items = items.filter((i) => s.includes(i.status)); }
  else if (!includeDone) items = items.filter((i) => i.status !== 'done' && i.status !== 'parked');
  if (type) items = items.filter((i) => i.type === type);
  if (project) { const p = project.toLowerCase(); items = items.filter((i) => (i.project || '').toLowerCase().includes(p)); }
  if (query) { const q = query.toLowerCase(); items = items.filter((i) => (i.text + ' ' + i.body + ' ' + (i.tags || []).join(' ')).toLowerCase().includes(q)); }
  return items.slice(0, Math.min(+limit || 200, 1500));
}

// ---------- sessions (from the hooks, and what a session says about itself) ----------

// ---------- notifications ----------
// one notification to every device he turned them on (dead ones are dropped). kind = one of PUSH_KINDS.
async function pushMe(kind, { title, body, url, tag }) {
  try {
    const on = { ...PUSH_KINDS, ...((await config()).push || {}) };
    if (!on[kind]) return 0;
    const subs = await PUSH.get();
    if (subs.empty) return 0;
    webpush.setVapidDetails('mailto:shlomi@boostart.io', VAPID_PUBLIC, VAPID_PRIVATE.value());
    const payload = JSON.stringify({ title: oneLine(title, 120), body: oneLine(body, 240), url: url || '/mind/', tag: tag || kind });
    let sent = 0;
    await Promise.all(subs.docs.map(async (d) => {
      try { await webpush.sendNotification(d.data().sub, payload, { TTL: 86400, urgency: kind === 'ask' ? 'high' : 'normal' }); sent++; }
      catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await d.ref.delete(); else console.error('mind push', e.statusCode, e.body || e.message); }
    }));
    return sent;
  } catch (e) { console.error('mind push', e.message); return 0; }
}
const sessTitle = (s) => oneLine(s.name || s.first || s.project || 'סשן', 60);
const sessUrl = (id) => '/mind/#s=' + encodeURIComponent(id);
async function hook(b) {
  const id = sessionDocId(b.session_id);
  if (id === 'unknown') return;
  const ref = SESSIONS.doc(id), now = Date.now();
  const base = { id, u: now, machine: oneLine(b.machine, 60), cwd: oneLine(b.cwd, 300), project: oneLine(b.project, 60) };
  for (const k of Object.keys(base)) if (!base[k]) delete base[k];
  const ev = b.event;
  const r = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref), s = snap.data() || {};
    const ch = { ...base };
    if (!snap.exists) { ch.c = now; ch.state = 'new'; ch.prompts = 0; ch.items = []; }
    if (ev === 'SessionStart') { if (s.state === 'ended') ch.state = 'waiting'; ch.source = oneLine(b.source, 20); }
    else if (ev === 'UserPromptSubmit') {
      const p = clip(untag(b.prompt), 600);
      ch.state = 'working'; ch.ask = p; ch.askAt = now; ch.prompts = (s.prompts || 0) + 1; ch.mstate = ''; ch.note = '';
      if (!s.first) ch.first = p;
    } else if (ev === 'Stop') { ch.state = 'waiting'; ch.reply = clip(b.reply, 900); ch.replyAt = now; ch.note = ''; }
    else if (ev === 'Notification') { ch.state = 'needs'; ch.note = oneLine(b.message, 200); }
    else if (ev === 'Resumed') { if (s.state === 'needs') { ch.state = 'working'; ch.note = ''; } }
    else if (ev === 'SessionEnd') { ch.state = 'ended'; ch.endReason = oneLine(b.reason, 40); }
    else return null;
    tx.set(ref, ch, { merge: true });
    return { s: { ...s, ...ch }, was: s.state };
  });
  if (!r) return;
  // a session stopped for his permission -> his phone; a finished answer -> only if he turned "every answer" on
  if (ev === 'Notification' && r.was !== 'needs') await pushMe('ask', { title: sessTitle(r.s) + ' צריך אישור', body: r.s.note || 'מחכה שתאשר במחשב', url: sessUrl(id), tag: 's:' + id });
  else if (ev === 'Stop') await pushMe('reply', { title: sessTitle(r.s) + ' ענה', body: r.s.reply || '', url: sessUrl(id), tag: 's:' + id });
}

async function reportSession(f, by) {
  const id = sessionDocId(f.session_id || f.id);
  if (id === 'unknown') throw new Error('session_id is needed (the SessionStart hook tells you yours)');
  const ch = { id, u: Date.now() };
  if (f.name != null) ch.name = oneLine(f.name, 80);
  if (f.summary != null) ch.summary = clip(f.summary, 2000);
  if (f.state != null) {
    if (!['working', 'waiting', 'stuck', 'done', ''].includes(f.state)) throw new Error('state: working | waiting | stuck | done');
    ch.mstate = f.state; ch.mstateAt = Date.now();
  }
  if (f.question != null) ch.question = clip(f.question, 600);
  if (f.project) ch.project = oneLine(f.project, 60);
  if (f.cwd) ch.cwd = oneLine(f.cwd, 300);
  if (f.machine) ch.machine = oneLine(f.machine, 60);
  if (f.hidden != null) ch.hidden = !!f.hidden;
  if (Array.isArray(f.items) && f.items.length) ch.items = admin.firestore.FieldValue.arrayUnion(...f.items.map((x) => oneLine(x, 20).replace(/^#/, '')));
  const before = (await SESSIONS.doc(id).get()).data() || {};
  await SESSIONS.doc(id).set(ch, { merge: true });
  if (by !== 'שלומי') {
    const now = { ...before, ...ch };
    if (ch.question && ch.question !== before.question && ['waiting', 'stuck'].includes(now.mstate)) await pushMe('ask', { title: sessTitle(now) + ' שואל', body: ch.question, url: sessUrl(id), tag: 's:' + id });
    else if (ch.mstate === 'done' && before.mstate !== 'done') await pushMe('done', { title: sessTitle(now) + ' סיים', body: now.summary || '', url: sessUrl(id), tag: 's:' + id });
  }
  return { ok: true, id };
}

async function listSessions({ days = 14, project, state } = {}) {
  const since = Date.now() - Math.min(+days || 14, 120) * 864e5;
  const snap = await SESSIONS.where('u', '>=', since).orderBy('u', 'desc').limit(400).get();
  let s = snap.docs.map((d) => d.data()).filter((x) => x.prompts > 0 || x.name || x.summary);
  if (project) { const p = project.toLowerCase(); s = s.filter((x) => (x.project || '').toLowerCase().includes(p)); }
  if (state) s = s.filter((x) => shownState(x) === state);
  return s;
}
// the state a person should see: what the session said about itself wins while it's newer than his last message
const shownState = (s) => (s.mstate && (s.mstateAt || 0) >= (s.askAt || 0) && s.state !== 'needs' && s.state !== 'ended' ? s.mstate : s.state);

// ---------- the MCP door ----------
const STATE_HE = { new: 'חדש', working: 'עובד', waiting: 'תורך', needs: 'צריך אישור', stuck: 'תקוע', done: 'סיים', ended: 'נסגר' };
const ago = (t) => { const m = Math.round((Date.now() - t) / 6e4); return m < 60 ? m + 'm ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago'; };
const itemLine = (i, types) => `#${i.id} [${types[i.type] || i.type}] [${i.status}]${i.pin ? ' [pinned]' : ''}${i.project ? ' {' + i.project + '}' : ''} ${i.text}${i.sessions?.length ? '  (sessions: ' + i.sessions.join(', ') + ')' : ''}  - updated ${ago(i.u)}`;
const sessionLine = (s, machines) => `${s.id} [${shownState(s)}] {${s.project || '?'}} @${machines[s.machine] || s.machine || '?'} "${s.name || oneLine(s.first, 80)}" - ${ago(s.u)}${s.items?.length ? '  items: ' + s.items.map((x) => '#' + x).join(' ') : ''}`;

const TOOLS = [
  { name: 'mind_overview', description: "Shlomi's whole picture in one read: what is waiting for HIM, what sessions are doing, open items by project. Read this first when he asks what's going on / what's open / what's on his plate.",
    inputSchema: { type: 'object', properties: { project: { type: 'string', description: 'only this project (optional)' } } } },
  { name: 'mind_list_items', description: 'List items (ideas, tasks, running jobs, thoughts...). Default: not done and not parked. Use before adding, to avoid a duplicate, and to find the item a request belongs to.',
    inputSchema: { type: 'object', properties: { status: { type: 'string', enum: STATUSES }, type: { type: 'string' }, project: { type: 'string' }, query: { type: 'string', description: 'words to search in title/body/tags' }, include_done: { type: 'boolean' }, limit: { type: 'number' } } } },
  { name: 'mind_get_item', description: 'One item with its body and full timeline.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'mind_add_item', description: "Capture something for Shlomi: an idea he mentioned, a to-do for him, a job you started that keeps running, a follow-up he must not forget. Title short (Hebrew if he wrote Hebrew). Pass your session_id when you're the one handling it.",
    inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'short title' }, body: { type: 'string', description: 'details: what, where (paths/urls), why' }, type: { type: 'string', description: 'type id: idea | task | reminder | job | thought | wait, or one of his own (see mind_overview)' }, status: { type: 'string', enum: STATUSES }, project: { type: 'string' }, pin: { type: 'boolean' }, due: { type: 'string', description: 'YYYY-MM-DD' }, tags: { type: 'array', items: { type: 'string' } }, session_id: { type: 'string' }, note: { type: 'string', description: 'first timeline line' } }, required: ['text'] } },
  { name: 'mind_update_item', description: 'Change an item and/or add a timeline note: take it (status active + your session_id), report progress (note), ask him (status waiting + the question in note), finish (status done + what was done and where to see it).',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string', enum: STATUSES }, note: { type: 'string' }, session_id: { type: 'string' }, text: { type: 'string' }, body: { type: 'string' }, type: { type: 'string' }, project: { type: 'string' }, pin: { type: 'boolean' }, due: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['id'] } },
  { name: 'mind_report_session', description: "Tell Shlomi's page about THIS session: a clear name, a summary of what you did / are doing (where the results are), and your state. The hooks already track working / waiting by themselves - report the meaning: done (the job is finished), stuck (blocked, say why in question), waiting (you need his decision - put it in question).",
    inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, name: { type: 'string', description: 'short name of the work, e.g. "Mind app build"' }, summary: { type: 'string' }, state: { type: 'string', enum: ['working', 'waiting', 'stuck', 'done'] }, question: { type: 'string', description: 'what you need from him' }, project: { type: 'string' }, cwd: { type: 'string', description: 'the folder you work in (so he can resume you)' }, machine: { type: 'string' }, items: { type: 'array', items: { type: 'string' }, description: 'item ids this session handles' } }, required: ['session_id'] } },
  { name: 'mind_list_sessions', description: 'Claude Code sessions on all his computers (last N days): state, project, computer, what each was asked and said. Use to find who did something for him.',
    inputSchema: { type: 'object', properties: { days: { type: 'number' }, project: { type: 'string' }, state: { type: 'string', enum: SESSION_STATES } } } },
  { name: 'mind_get_session', description: "One session: its first and last ask, last reply, summary, items, and how to resume it.", inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
];

async function callTool(name, a = {}) {
  const cfg = await config();
  const types = Object.fromEntries(cfg.types.map((t) => [t.id, t.name]));
  const by = a.session_id ? 'session ' + oneLine(a.session_id, 12) : 'Claude';
  const byName = async () => { if (!a.session_id) return by; const s = (await SESSIONS.doc(sessionDocId(a.session_id)).get()).data(); return s?.name || (s?.project ? s.project + ' session' : by); };
  switch (name) {
    case 'mind_overview': {
      const [items, sessions] = await Promise.all([listItems({ project: a.project, limit: 600 }), listSessions({ days: 7, project: a.project })]);
      const forMe = (i) => i.status === 'waiting' || ((i.type === 'task' || i.type === 'reminder') && i.status === 'open');   // his to-dos wait for him too
      const waiting = items.filter(forMe);
      const needs = sessions.filter((s) => ['needs', 'stuck'].includes(shownState(s)) || (shownState(s) === 'waiting' && s.question));
      const working = sessions.filter((s) => shownState(s) === 'working');
      const byProject = {};
      for (const i of items.filter((x) => !forMe(x))) (byProject[i.project || '(no project)'] ||= []).push(i);
      return [
        `Types: ${cfg.types.map((t) => t.id + '=' + t.name).join(', ')}`, '',
        `## Waiting for Shlomi (${waiting.length + needs.length})`, ...waiting.map((i) => itemLine(i, types)),
        ...needs.map((s) => sessionLine(s, cfg.machines) + (s.question ? `\n   question: ${oneLine(s.question, 300)}` : '') + (s.note ? `\n   ${s.note}` : '')), '',
        `## Sessions working now (${working.length})`, ...working.map((s) => sessionLine(s, cfg.machines)), '',
        `## Open items by project`, ...Object.entries(byProject).flatMap(([p, l]) => [`### ${p} (${l.length})`, ...l.slice(0, 40).map((i) => itemLine(i, types))]),
      ].join('\n');
    }
    case 'mind_list_items': {
      const items = await listItems({ status: a.status, type: a.type, project: a.project, query: a.query, includeDone: a.include_done, limit: a.limit || 100 });
      return items.length ? items.map((i) => itemLine(i, types)).join('\n') : 'No items match.';
    }
    case 'mind_get_item': {
      const d = await ITEMS.doc(oneLine(a.id, 20).replace(/^#/, '')).get();
      if (!d.exists) throw new Error('no item ' + a.id);
      const i = shapeItem(d);
      return [itemLine(i, types), i.body ? '\n' + i.body : '', i.due ? 'due ' + i.due : '', i.tags?.length ? 'tags: ' + i.tags.join(', ') : '', '\nTimeline:',
        ...(i.log || []).map((l) => `- ${new Date(l.t).toISOString().slice(0, 16).replace('T', ' ')} ${l.by}${l.st ? ' [' + l.st + ']' : ''}: ${l.text}`)].filter(Boolean).join('\n');
    }
    case 'mind_add_item': {
      const it = await addItem({ ...a, session: a.session_id }, await byName());
      return `Added #${it.id}: ${it.text} [${it.type}/${it.status}]. Shlomi sees it at https://shlomiverse.com/mind/#${it.id}`;
    }
    case 'mind_update_item': {
      const it = await updateItem(a.id, { ...a, session: a.session_id }, await byName());
      return `Updated #${it.id}: ${it.text} [${it.status}]`;
    }
    case 'mind_report_session': { await reportSession(a); return 'Reported. Shlomi sees this session on https://shlomiverse.com/mind/#sessions'; }
    case 'mind_list_sessions': {
      const s = await listSessions(a);
      return s.length ? s.map((x) => sessionLine(x, cfg.machines) + (x.summary ? '\n   ' + oneLine(x.summary, 200) : x.ask ? '\n   last ask: ' + oneLine(x.ask, 160) : '')).join('\n') : 'No sessions.';
    }
    case 'mind_get_session': {
      const s = (await SESSIONS.doc(sessionDocId(a.id)).get()).data();
      if (!s) throw new Error('no session ' + a.id);
      return [sessionLine(s, cfg.machines), s.summary && 'summary: ' + s.summary, s.question && 'question: ' + s.question, s.first && 'first ask: ' + s.first,
        s.ask && 'last ask: ' + s.ask, s.reply && 'last reply: ' + s.reply, s.cwd && `resume: cd "${s.cwd}" && claude --resume ${s.id}`].filter(Boolean).join('\n');
    }
  }
  throw new Error('unknown tool ' + name);
}

async function mcp(msg) {
  const { id, method, params = {} } = msg;
  const reply = (result) => ({ jsonrpc: '2.0', id, result });
  if (id === undefined || id === null) return null;                    // a notification - nothing to answer
  if (method === 'initialize') {
    const v = ['2025-06-18', '2025-03-26', '2024-11-05'].includes(params.protocolVersion) ? params.protocolVersion : '2025-06-18';
    return reply({ protocolVersion: v, capabilities: { tools: {} }, serverInfo: { name: 'mind', title: "Shlomi's second brain", version: '1.0.0' },
      instructions: "Shlomi's one place for everything in his head and every Claude session working for him (all projects, all his computers). Report here: capture ideas/to-dos he mentions, take an item when you work on it, finish it with where the result is, and report your session's meaning (done / stuck / waiting + question). Page: https://shlomiverse.com/mind/" });
  }
  if (method === 'ping') return reply({});
  if (method === 'tools/list') return reply({ tools: TOOLS });
  if (method === 'tools/call') {
    try { return reply({ content: [{ type: 'text', text: await callTool(params.name, params.arguments || {}) }] }); }
    catch (e) { return reply({ content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true }); }
  }
  if (method === 'resources/list') return reply({ resources: [] });
  if (method === 'prompts/list') return reply({ prompts: [] });
  return { jsonrpc: '2.0', id, error: { code: -32601, message: 'method not found: ' + method } };
}

// ---------- his page ----------
async function pageOp(b) {
  switch (b.op) {
    case 'all': {
      const [items, sessions, cfg] = await Promise.all([listItems({ includeDone: true, limit: 1500 }), listSessions({ days: b.days || 30 }), config()]);
      return { items, sessions, config: cfg, now: Date.now() };
    }
    case 'add': return { item: await addItem(b.item || {}, 'שלומי') };
    case 'update': return { item: await updateItem(b.id, b.item || {}, 'שלומי') };
    case 'delete': await ITEMS.doc(oneLine(b.id, 20)).delete(); return { ok: true };
    case 'config': {
      const c = {};
      if (Array.isArray(b.types)) c.types = b.types.map((t) => ({ id: oneLine(t.id, 24).replace(/[^\w-]/g, '') || newId(), name: oneLine(t.name, 30), color: /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : '#64748b', icon: oneLine(t.icon, 20) || 'dot' })).filter((t) => t.name).slice(0, 20);
      if (b.machines && typeof b.machines === 'object') c.machines = Object.fromEntries(Object.entries(b.machines).slice(0, 20).map(([k, v]) => [oneLine(k, 60), oneLine(v, 30)]));
      if (b.projects && typeof b.projects === 'object') c.projects = Object.fromEntries(Object.entries(b.projects).slice(0, 60).map(([k, v]) => [oneLine(k, 60), { color: /^#[0-9a-f]{6}$/i.test(v?.color) ? v.color : '#64748b', name: oneLine(v?.name, 40) }]));
      if (b.push && typeof b.push === 'object') c.push = Object.fromEntries(Object.keys(PUSH_KINDS).filter((k) => typeof b.push[k] === 'boolean').map((k) => [k, b.push[k]]));
      await META.doc('config').set(c, { merge: true });
      return { config: await config() };
    }
    case 'session': return reportSession(b.session || {}, 'שלומי');
    case 'session_delete': await SESSIONS.doc(sessionDocId(b.id)).delete(); return { ok: true };
    case 'seen': {   // he opened / cleared these - they stop counting as new (until something new happens on them)
      const now = Date.now(), batch = db.batch();
      for (const id of (b.items || []).slice(0, 200)) batch.set(ITEMS.doc(oneLine(id, 20)), { seen: now }, { merge: true });
      for (const id of (b.sessions || []).slice(0, 200)) batch.set(SESSIONS.doc(sessionDocId(id)), { seen: now }, { merge: true });
      await batch.commit();
      return { ok: true, seen: now };
    }
    case 'connect': return { key: await mindKey(true) };
    case 'push_on': {   // this phone / computer gets notifications
      const sub = b.sub || {};
      if (!/^https:\/\//.test(sub.endpoint || '') || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error('subscription');
      await PUSH.doc(crypto.createHash('sha256').update(sub.endpoint).digest('hex').slice(0, 32)).set({ sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, ua: oneLine(b.ua, 200), c: Date.now() });
      return { ok: true, devices: (await PUSH.count().get()).data().count };
    }
    case 'push_off': if (b.endpoint) await PUSH.doc(crypto.createHash('sha256').update(String(b.endpoint)).digest('hex').slice(0, 32)).delete(); return { ok: true };
    case 'push_test': {
      const on = { ...(await config()).push }, sent = await (async () => { const k = Object.keys(on).find((x) => on[x]) || 'ask'; return pushMe(k, { title: 'המוח השני', body: 'ככה תיראה התראה. לחיצה פותחת את המוח.', url: '/mind/', tag: 'test' }); })();
      return { sent };
    }
    case 'organize': {   // what he said / typed -> anything on his table: new items, and changes to the ones he has
      // (done, update, a note, type, date, project, star, off the table). The AI sees his items and picks the actions.
      const said = clip(b.text, 6000);
      if (!said) throw new Error('text is empty');
      const cfg = await config();
      const all = (await ITEMS.orderBy('u', 'desc').limit(400).get()).docs.map(shapeItem);
      const known = [...new Set(all.map((i) => i.project).filter(Boolean))];
      const live = all.filter((i) => i.status !== 'done' && i.status !== 'parked').slice(0, 150);
      const gone = all.filter((i) => i.status === 'done' || i.status === 'parked').slice(0, 30);
      const focus = b.focus ? all.find((i) => i.id === oneLine(b.focus, 20)) : null;
      const line = (i) => `#${i.id} [${i.type}, ${i.status}${i.pin ? ', starred' : ''}${i.due ? ', due ' + i.due : ''}${i.project ? ', project ' + i.project : ''}] ${oneLine(i.text, 100)}${i.body ? ' - ' + oneLine(i.body, 120) : ''}`;
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const schema = { type: 'object', additionalProperties: false, required: ['reply', 'actions'], properties: { reply: { type: 'string' }, actions: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['do', 'id', 'text', 'body', 'note', 'type', 'project', 'status', 'pin', 'due'], properties: {
          do: { type: 'string', enum: ['add', 'update'] }, id: { type: 'string' },
          text: { type: 'string' }, body: { type: 'string' }, note: { type: 'string' },
          type: { type: 'string', enum: ['', ...cfg.types.map((t) => t.id)] }, project: { type: 'string' },
          status: { type: 'string', enum: ['', ...STATUSES] }, pin: { type: 'string', enum: ['', 'yes', 'no'] }, due: { type: 'string' } } } } } };
      const r = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { authorization: 'Bearer ' + OPENAI.value(), 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-5.6-terra', reasoning: { effort: 'none' }, max_output_tokens: 4000, store: false,
          text: { format: { type: 'json_schema', name: 'mind_actions', schema, strict: true } },
          instructions: `You run Shlomi's personal second brain from what he said or typed (often a voice note, Hebrew, maybe messy). He is a CTO of two companies and makes comedy videos; he works with many AI coding sessions.
He can tell you anything: new things to remember, or changes to things already on his table ("סיימתי את X", "תעביר את Y למחר", "תוסיף ל-Z ש...", "תמחק את", "זה כבר לא רלוונטי", "תסמן בכוכב", "תהפוך את זה לתזכורת"). Return the actions that do what he asked.
When what he says is about something already on his table (more details, a thought on it, news about it, "לגבי X", "עוד משהו על Y") - that is an UPDATE of that item (its new details go in body), never a new item next to it.
- do "add": a new item. One item per separate thing (split only when clearly unrelated). id "".
  text: a short clear title in his language, max ~70 chars, no "צריך ל" padding. body: everything else he said about it, cleaned up, nothing lost (names, numbers, links, why); "" if the title says it all.
  type: one of ${cfg.types.map((t) => `${t.id} (${t.name})`).join(', ')}. An idea = idea; something he must do = task; something he wants to be reminded of at a time ("תזכיר לי", "שלא אשכח") = reminder, with its due date; something running in the background = job; a reflection = thought; waiting for someone else = wait.
  project: one of his projects (${known.join(', ') || 'none yet'}) when it clearly belongs there, a new short name only if he names one, else "". status: "open"; "active" if he says it's being done now; "waiting" only if it waits for HIM to decide. pin "yes" only if he says it's important / urgent, else "".
- do "update": a change to an item below - id = its id without "#". Only when you are sure which item he means (by its title / project / what he describes); if unsure, add a new item instead and say so in reply. Fill ONLY what changes, "" = unchanged:
  text = a new title only if he renames it; body = new details he dictates for it (they are ADDED under the existing details); type; project ("-" = remove the project); status: done when he finished it / it happened, parked when he wants it off the table / deleted / not relevant any more (never delete), open to bring it back, active / waiting; pin yes / no; due YYYY-MM-DD ("none" = remove the date).
  note: always - one short line in his language saying what happened, e.g. "סיים - נשלח ללקוח", "נדחה למחר", "עודכן: דיברתי עם דני".
- due on add: YYYY-MM-DD if he gives a time ("מחר", "ביום ראשון", "עד סוף החודש"), else "". Today is ${today} (Israel).
- note on add: "".
- reply: one short line in his language. If he asked a question about his table ("מה פתוח לי?", "מה עם X?") answer it here from the list, briefly (a list = one thing per line, no numbers), and return no actions. Otherwise "" - the screen already shows what changed.${focus ? `\nHe is looking at item #${focus.id} right now - "this" / "זה" / "את זה" means it.` : ''}

His table now:
${live.map(line).join('\n') || '(empty)'}

Recently done / off the table:
${gone.map(line).join('\n') || '(none)'}`,
          input: [{ role: 'user', content: said }] }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error?.message || 'organize ' + r.status);
      const out = JSON.parse((j.output || []).flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('') || '{"actions":[]}');
      const acts = (out.actions || []).slice(0, 20), adds = acts.filter((a) => a.do === 'add'), items = [], changed = [];
      for (const a of acts) {
        if (a.do === 'add') {
          if (!oneLine(a.text, 300)) continue;
          items.push(await addItem({ text: a.text, body: a.body, type: a.type || 'idea', project: a.project === '-' ? '' : a.project, status: a.status || 'open',
            pin: a.pin === 'yes', due: a.due, note: (adds.length > 1 ? 'מתוך: ' : 'נאמר: ') + said }, 'שלומי'));
          continue;
        }
        const cur = all.find((i) => i.id === oneLine(a.id, 20).replace(/^#/, ''));
        if (!cur) continue;
        const f = {}, before = {};
        if (oneLine(a.text, 300) && a.text !== cur.text) { f.text = a.text; before.text = cur.text; }
        if (clip(a.body, 8000)) { f.body = (cur.body ? cur.body.replace(/\s+$/, '') + '\n\n' : '') + a.body; before.body = cur.body || ''; }
        if (a.type && a.type !== cur.type) { f.type = a.type; before.type = cur.type; }
        if (a.project) { f.project = a.project === '-' ? '' : a.project; before.project = cur.project || ''; }
        if (a.status && a.status !== cur.status) { f.status = a.status; before.status = cur.status; }
        if (a.pin) { f.pin = a.pin === 'yes'; before.pin = !!cur.pin; }
        if (a.due) { f.due = a.due === 'none' ? '' : a.due; before.due = cur.due || ''; }
        f.note = oneLine(a.note, 300) || 'עודכן';
        changed.push({ item: await updateItem(cur.id, f, 'שלומי'), before, note: f.note });
      }
      return { items, changed, reply: clip(out.reply, 1500) };
    }
    case 'transcribe': {   // the mic on his page: a recording -> Hebrew text (gpt-4o-transcribe)
      const buf = Buffer.from(String(b.audio || ''), 'base64');
      if (!buf.length || buf.length > 9e6) throw new Error('audio');
      const mime = oneLine(b.mime, 60) || 'audio/webm';
      const ext = /mp4|m4a|aac/.test(mime) ? 'mp4' : /ogg/.test(mime) ? 'ogg' : /wav/.test(mime) ? 'wav' : 'webm';
      const form = new FormData();
      form.append('file', new Blob([buf], { type: mime.split(';')[0] }), 'voice.' + ext);
      form.append('model', 'gpt-4o-transcribe');
      form.append('language', 'he');
      const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { authorization: 'Bearer ' + OPENAI.value() }, body: form });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error?.message || 'transcribe ' + r.status);
      // a silent recording can come back as a made-up line - the page also checks the level before it sends
      return { text: String(j.text || '').trim() };
    }
  }
  throw new Error('unknown op');
}

exports.mind = onRequest({ region: 'europe-west1', maxInstances: 3, memory: '256MiB', timeoutSeconds: 60, secrets: [OPENAI, VAPID_PRIVATE],
  cors: [/^https:\/\/boostmind-b052c(--[\w-]+)?\.web\.app$/, /^https:\/\/(www\.)?shlomiverse\.com$/, /^http:\/\/localhost(:\d+)?$/] }, async (req, res) => {
  res.set('cache-control', 'no-store');
  const door = req.path.replace(/\/+$/, '').split('/').pop();     // api | hook | mcp (through hosting: /mind/<door>)
  if (door === 'mcp' && req.method === 'GET') return res.status(405).set('allow', 'POST').end();
  if (req.method !== 'POST') return res.status(405).end();
  const role = await who(req);
  if (role === 'blocked') return res.status(429).json({ error: 'too_many' });
  if (!role) return res.status(401).json({ error: 'key' });
  try {
    if (door === 'hook') { await hook(req.body || {}); return res.json({ ok: true }); }
    if (door === 'mcp') {
      const body = req.body;
      if (Array.isArray(body)) { const out = (await Promise.all(body.map(mcp))).filter(Boolean); return out.length ? res.json(out) : res.status(202).end(); }
      const out = await mcp(body || {});
      return out ? res.json(out) : res.status(202).end();
    }
    if (door === 'api') {
      if (['connect', 'transcribe', 'organize', 'push_on', 'push_off', 'push_test'].includes(req.body?.op) && role !== 'owner') return res.status(403).json({ error: 'owner only' });
      return res.json(await pageOp(req.body || {}));
    }
    res.status(404).json({ error: 'door' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// every morning at 9: reminders and tasks whose day came (still open) -> one notification each (a few = one summary)
exports.mindDaily = onSchedule({ schedule: '0 9 * * *', timeZone: 'Asia/Jerusalem', region: 'europe-west1', secrets: [VAPID_PRIVATE], memory: '256MiB', timeoutSeconds: 60 }, async () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const due = (await listItems({ limit: 1500 })).filter((i) => i.due && i.due <= today && ['reminder', 'task'].includes(i.type) && ['open', 'active', 'waiting'].includes(i.status));
  if (!due.length) return;
  if (due.length <= 3) for (const i of due) await pushMe('remind', { title: (i.type === 'reminder' ? 'תזכורת: ' : 'להיום: ') + i.text, body: i.body || (i.due < today ? 'היה ל-' + i.due : ''), url: '/mind/#' + i.id, tag: 'i:' + i.id });
  else await pushMe('remind', { title: `${due.length} דברים להיום`, body: due.slice(0, 5).map((i) => i.text).join(' · '), url: '/mind/', tag: 'daily' });
});
