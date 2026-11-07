// Plans in Backstage (2026-11-06, his ask: "planning briefs, drafts, mockups in Backstage - I see the plan there, approve
// it, comment on specific things; an ongoing tool for future Shlomiverse plans"). A plan = one HTML page (the brief with
// its mockups) + its pictures; he comments on any part of it and approves or asks for changes; sessions publish plans and
// read his comments with scripts/plans/plan.mjs. Everything private: Firestore `plans` (no client rule = nobody reads it)
// and the pictures in the private bucket shlomiverse-studio/plans/<id>/, shown to Backstage through signed links.
// Called only from verseOwner (his key): ops plans, plan, planPut, planComment, planDone, planStatus.
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

const LOCAL = process.env.FUNCTIONS_EMULATOR === 'true';
const BUCKET = LOCAL ? 'demo-shlomiverse.appspot.com' : 'shlomiverse-studio';
const STATUS = ['draft', 'waiting', 'approved', 'changes'];   // טיוטה / מחכה לך / אושר / צריך שינויים
const db = () => admin.firestore();
const idOk = (s) => /^[a-z0-9][a-z0-9-]{1,60}$/.test(String(s || ''));
const nameOk = (s) => /^[\w.-]{1,80}$/.test(String(s || '')) && !String(s).includes('..');
const clip = (s, n) => String(s ?? '').slice(0, n);
const ms = (t) => (t && t.toMillis ? t.toMillis() : null);

async function urlOf(path) {
  const f = admin.storage().bucket(BUCKET).file(path);
  if (LOCAL) return `http://127.0.0.1:9199/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media`;
  const [u] = await f.getSignedUrl({ action: 'read', expires: Date.now() + 6 * 3600e3 });   // signBlob: the functions' account holds Token Creator on itself
  return u;
}

async function owner(op, b) {
  const plans = db().collection('plans');
  if (op === 'plans') {
    const snap = await plans.orderBy('updated', 'desc').limit(100).get();
    const out = await Promise.all(snap.docs.filter((d) => !d.data().archived).map(async (d) => {
      const x = d.data(), open = await d.ref.collection('comments').where('done', '==', false).where('by', '==', 'shlomi').count().get();   // only his own open notes count
      return { id: d.id, title: x.title, summary: x.summary || '', status: x.status, version: x.version || 1, updated: ms(x.updated), created: ms(x.created), published: ms(x.published || x.updated), replacedBy: x.replacedBy || null, open: open.data().count, cover: x.cover ? await urlOf(`plans/${d.id}/${x.cover}`) : null };
    }));
    return { plans: out };
  }
  if (op === 'plan') {
    if (!idOk(b.id)) return { error: 'id' };
    const d = await plans.doc(b.id).get();
    if (!d.exists) return { error: 'missing' };
    const x = d.data();
    const files = Object.fromEntries(await Promise.all((x.files || []).map(async (n) => [n, await urlOf(`plans/${d.id}/${n}`)])));
    const cs = await d.ref.collection('comments').orderBy('t', 'asc').limit(500).get();
    return { plan: { id: d.id, title: x.title, summary: x.summary || '', status: x.status, version: x.version || 1, updated: ms(x.updated), html: x.html, files },
      comments: cs.docs.map((c) => ({ id: c.id, ...c.data(), t: ms(c.data().t) })) };
  }
  // a session publishes (or updates) a plan: the page + its pictures (base64). A new version goes back to "waiting for him";
  // his comments stay.
  if (op === 'planPut') {
    if (!idOk(b.id) || !b.title || !b.html) return { error: 'id_title_html' };
    const ref = plans.doc(b.id), now = FieldValue.serverTimestamp(), got = await ref.get();
    const had = { exists: got.exists && !!got.data().title, data: () => got.data() || {} };   // pictures sent first (planFiles) don't make it an old plan
    const names = [];
    for (const f of (Array.isArray(b.files) ? b.files : []).slice(0, 60)) {
      if (!nameOk(f.name) || !f.b64) continue;
      await admin.storage().bucket(BUCKET).file(`plans/${b.id}/${f.name}`).save(Buffer.from(f.b64, 'base64'), { contentType: f.type || 'image/jpeg', resumable: false, metadata: { cacheControl: 'private, max-age=3600' } });
      names.push(f.name);
    }
    const files = [...new Set([...(got.exists ? got.data().files || [] : []), ...names])];
    await ref.set({ title: clip(b.title, 200), summary: clip(b.summary, 600), html: clip(b.html, 900000), files, cover: nameOk(b.cover) ? b.cover : (had.exists ? had.data().cover || null : null),
      status: STATUS.includes(b.status) ? b.status : 'waiting', version: had.exists ? (had.data().version || 1) + 1 : 1, updated: now, published: now, replacedBy: null, ...(had.exists ? {} : { created: now }) }, { merge: true });
    // a newer round replaces older plans (his ask 2026-11-07): they stay on his list, greyed, "replaced by" this one
    for (const old of (Array.isArray(b.replaces) ? b.replaces : []).slice(0, 10)) if (idOk(old) && old !== b.id) await plans.doc(old).set({ replacedBy: b.id }, { merge: true });
    if (had.exists) await ref.collection('comments').add({ kind: 'version', text: clip(b.note || 'גרסה חדשה', 2000), by: 'claude', t: now, done: true });
    return { ok: true, id: b.id, files: names.length };
  }
  // pictures in small batches before the page itself (planPut), so no request is too big; the version doesn't move
  if (op === 'planFiles') {
    if (!idOk(b.id)) return { error: 'id' };
    const ref = plans.doc(b.id), names = [];
    for (const f of (Array.isArray(b.files) ? b.files : []).slice(0, 8)) {
      if (!nameOk(f.name) || !f.b64) continue;
      await admin.storage().bucket(BUCKET).file(`plans/${b.id}/${f.name}`).save(Buffer.from(f.b64, 'base64'), { contentType: f.type || 'image/jpeg', resumable: false, metadata: { cacheControl: 'private, max-age=3600' } });
      names.push(f.name);
    }
    if (names.length) await ref.set({ files: FieldValue.arrayUnion(...names) }, { merge: true });
    return { ok: true, files: names.length };
  }
  // a comment on a part of the plan (anchor = which part; '' = the whole plan). by: 'shlomi' (Backstage) | 'claude' (a session)
  if (op === 'planComment') {
    if (!idOk(b.id)) return { error: 'id' };
    const text = clip(String(b.text || '').trim(), 4000);
    if (!text) return { error: 'empty' };
    const ref = plans.doc(b.id);
    if (!(await ref.get()).exists) return { error: 'missing' };
    const c = await ref.collection('comments').add({ kind: 'comment', anchor: clip(b.anchor, 120), label: clip(b.label, 200), text, by: b.by === 'claude' ? 'claude' : 'shlomi',
      reply: clip(b.reply, 40) || null, t: FieldValue.serverTimestamp(), done: b.by === 'claude' });   // a session's answer is never open
    await ref.set({ updated: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true, id: c.id };
  }
  if (op === 'planDone') {   // a comment handled (or opened again)
    if (!idOk(b.id) || !idOk(String(b.comment || '').toLowerCase())) return { error: 'id' };
    await db().collection('plans').doc(b.id).collection('comments').doc(b.comment).update({ done: b.done !== false });
    return { ok: true };
  }
  // a round that a newer plan replaced leaves his list (his ask 2026-11-07: "take the two previous rounds off the list"); kept, not deleted
  if (op === 'planArchive') {
    if (!idOk(b.id)) return { error: 'id' };
    await plans.doc(b.id).set({ archived: b.archived !== false, updated: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true };
  }
  if (op === 'planStatus') {   // his verdict on the whole plan, with an optional note
    if (!idOk(b.id) || !STATUS.includes(b.status)) return { error: 'status' };
    const ref = plans.doc(b.id), now = FieldValue.serverTimestamp();
    await ref.set({ status: b.status, updated: now, ...(b.status === 'approved' ? { approved: now } : {}) }, { merge: true });
    await ref.collection('comments').add({ kind: 'status', status: b.status, text: clip(String(b.note || '').trim(), 4000), by: 'shlomi', t: now, done: b.status === 'approved' });
    return { ok: true };
  }
  return null;
}

module.exports = { owner };
