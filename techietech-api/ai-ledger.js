// What Anthropic costs, counted by us (his ask 2026-11-20: "everything should be collected, the director too"). OpenAI, EvoLink and
// ElevenLabs report their own spend per key (costs.js asks them); Anthropic gives none we can read (no admin key), so each feature's
// Sonnet / Opus calls are counted from their own cost, once, where they are made, into aiSpend/<UTC day> {<area>: {anthropic, n}}:
//   chat       wiki.js after every chat answer (the chain's director) - every answer, his own too (chat_logs skip his devices)
//   tziftzif   tz.js after every post / reply the chain writes (wiki-deep post()'s director)
// Syncs keeps its own per meeting (meeting-fn.js syncsCost) and the garden its own per visit (garden.js usage) - costs.js reads those.
// owner/aiLedger {<area>From: ms} = when this area's count started here (costs.js counts the chat from chat_logs before it).
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

// the Anthropic part of a chain's steps ({model, usd} - wiki-deep reply().log.steps / post().steps)
const anthropicOf = (steps) => (steps || []).reduce((a, s) => a + (/^claude/.test(String((s && s.model) || '')) ? Number(s.usd ?? s.cost ?? 0) || 0 : 0), 0);
const marked = new Set();
async function addAnthropic(area, usd) {
  if (!(usd > 0)) return;
  const db = admin.firestore(), day = new Date().toISOString().slice(0, 10);
  if (!marked.has(area)) {   // once per instance: the day this area's count began, if it isn't written yet
    marked.add(area);
    const ref = db.collection('owner').doc('aiLedger');
    const x = (await ref.get().catch(() => null))?.data() || {};
    if (!x[area + 'From']) await ref.set({ [area + 'From']: Date.now() }, { merge: true }).catch(() => {});
  }
  await db.collection('aiSpend').doc(day).set({ d: day, [area]: { anthropic: FieldValue.increment(Math.round(usd * 1e6) / 1e6), n: FieldValue.increment(1) } }, { merge: true });
}

module.exports = { anthropicOf, addAnthropic };
