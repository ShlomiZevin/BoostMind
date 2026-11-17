// The events log (his ask, 2026-11-16: "an event table, so we know that until a specific date it was then some event, and
// we can check stats until then and from then"). A dated list of what happened - a release, a mail to everyone, a new
// game, a marketing push, an outage - that Backstage draws on every day chart and compares before / after.
// Private: Firestore `siteEvents` (no client rule = nobody reads it), one doc each:
//   { day: 'YYYY-MM-DD' (Israel), title, kind, note?, link?, at?: 'HH:MM' (when that day it went live - Backstage's "since
//     the event" starts there; none = the time it was logged, if logged that day), counts?: [metric keys counted differently
//     from this event on - e.g. a new player counts video plays its own way], by: 'owner' | 'session' | 'auto', t }
// Called only from verseOwner (his key): ops events, eventAdd, eventEdit, eventDel. Sessions: scripts/stats/event.mjs.
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

const db = () => admin.firestore();
const KINDS = ['release', 'mail', 'content', 'marketing', 'incident', 'other'];
const BY = ['owner', 'session', 'auto'];
const ms = (t) => (t && t.toMillis ? t.toMillis() : null);
const one = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const dayOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d + 'T12:00:00Z')) && new Date(d + 'T12:00:00Z').toISOString().slice(0, 10) === d;
const idOk = (s) => /^[A-Za-z0-9]{10,40}$/.test(String(s || ''));
const row = (d) => { const x = d.data(); return { id: d.id, ...x, t: ms(x.t), ...(x.edited ? { edited: ms(x.edited) } : {}) }; };

// the fields of one event, checked: { ok } or { error } - `part` = only what was sent (an edit)
function clean(b, part) {
  const out = {};
  if (!part || b.day !== undefined) { const d = String(b.day || ''); if (!dayOk(d)) return { error: 'day' }; out.day = d; }
  if (!part || b.title !== undefined) { const t = one(b.title, 120); if (!t) return { error: 'title' }; out.title = t; }
  if (!part || b.kind !== undefined) { const k = String(b.kind || 'other'); if (!KINDS.includes(k)) return { error: 'kind' }; out.kind = k; }
  if (!part || b.note !== undefined) out.note = String(b.note ?? '').trim().slice(0, 2000);
  if (!part || b.link !== undefined) {
    const l = String(b.link ?? '').trim();
    if (l && (!/^https?:\/\/\S+$/.test(l) || l.length > 500)) return { error: 'link' };
    out.link = l;
  }
  if (!part || b.at !== undefined) { const a = String(b.at ?? '').trim(); if (a && !/^([01]\d|2[0-3]):[0-5]\d$/.test(a)) return { error: 'at' }; out.at = a; }
  if (!part || b.counts !== undefined) {
    const c = Array.isArray(b.counts) ? b.counts : String(b.counts ?? '').split(',');
    out.counts = [...new Set(c.map((x) => String(x).trim()).filter((x) => /^[a-z_]{1,30}$/.test(x)))].slice(0, 12);
  }
  if (!part && b.by !== undefined) { if (!BY.includes(b.by)) return { error: 'by' }; out.by = b.by; }
  return { ok: out };
}

// every event (newest first), optionally only {from, to} (days, both included) - few enough to read whole
async function list(b = {}) {
  const snap = await db().collection('siteEvents').orderBy('day', 'desc').limit(1000).get();
  const from = dayOk(String(b.from || '')) ? b.from : '', to = dayOk(String(b.to || '')) ? b.to : '';
  return snap.docs.map(row).filter((e) => (!from || e.day >= from) && (!to || e.day <= to))
    .sort((a, c) => c.day.localeCompare(a.day) || (c.t || 0) - (a.t || 0));
}

async function owner(op, b) {
  const col = db().collection('siteEvents');
  if (op === 'events') return { events: await list(b) };
  if (op === 'eventAdd') {
    const c = clean(b, false);
    if (c.error) return c;
    const ref = col.doc();
    await ref.set({ by: 'owner', ...c.ok, t: FieldValue.serverTimestamp() });
    return { ok: true, id: ref.id };
  }
  if (op === 'eventEdit') {
    if (!idOk(b.id)) return { error: 'id' };
    const c = clean(b, true);
    if (c.error) return c;
    if (!Object.keys(c.ok).length) return { error: 'empty' };
    const ref = col.doc(b.id);
    if (!(await ref.get()).exists) return { error: 'event' };
    await ref.update({ ...c.ok, edited: FieldValue.serverTimestamp() });
    return { ok: true, id: b.id };
  }
  if (op === 'eventDel') {
    if (!idOk(b.id)) return { error: 'id' };
    await col.doc(b.id).delete();
    return { ok: true };
  }
  return null;
}

module.exports = { owner, list, clean, KINDS };
