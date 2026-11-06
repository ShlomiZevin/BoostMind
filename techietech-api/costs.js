// Backstage -> הוצאות: what the AI costs him, asked from the providers themselves (his ask, 2026-11-06: "I don't want to
// start tracking ourselves - it's a lot of work and less accurate than just asking the API key how much did you spend").
//
//   OpenAI      one project "Shlomiverse" with a key per area (studio, chat, site, design + Mind's own), "Plaxzy" its own;
//               the organization's Costs API (admin key) by key and line item -> dollars per day, per area, per kind
//               (images / text / audio / transcription). The old shared keys (Trader project: "Shlomi-Verse", "Plaxzy")
//               stay in the history under their area.
//   ElevenLabs  credits per day by product (music, voices, sound effects...) and per API key, + the plan (credits only:
//               a monthly price for a pile of credits - no invented price per credit).
// Asked at most once an hour (owner/costs keeps the last answer); `fresh` asks again.
const admin = require('firebase-admin');
const { defineSecret } = require('firebase-functions/params');

const OPENAI_ADMIN = defineSecret('OPENAI_ADMIN_KEY');
const ELEVEN = defineSecret('ELEVENLABS_ADMIN_KEY');
const SECRETS = [OPENAI_ADMIN, ELEVEN];
const DAYS = 90;
const HOUR = 3600e3;

// which area a key belongs to - by its project and name (new keys: name them <area>, or shlomiverse-<area>)
const AREAS = {
  studio: 'סטודיו', chat: 'צ\'אט', site: 'אתר', design: 'עיצוב וסשנים', 'shlomiverse-old': 'מפתח משותף ישן', mind: 'המוח', plaxzy: 'Plaxzy',
};
function areaOf(project, name) {
  const p = String(project || '').toLowerCase(), n = String(name || '').toLowerCase();
  if (p.includes('plaxzy') || n.includes('plaxzy')) return { group: 'plaxzy', area: p.includes('plaxzy') ? n.replace(/^plaxzy-?/, '') || 'plaxzy' : 'plaxzy' };
  if (n === 'mind') return { group: 'mind', area: 'mind' };
  if (p === 'shlomiverse') return { group: 'shlomiverse', area: n.replace(/^shlomiverse-/, '') };
  if (n.replace(/[^a-z]/g, '') === 'shlomiverse') return { group: 'shlomiverse', area: 'shlomiverse-old' };
  return null;   // Aspect, clients' keys... not his verse's
}
const kindOf = (item) => {
  const s = String(item || '').toLowerCase();
  if (/image/.test(s)) return 'images';
  if (/transcri|whisper/.test(s)) return 'transcription';
  if (/tts|audio|speech|realtime/.test(s)) return 'audio';
  if (/moderation/.test(s)) return 'moderation';
  return 'text';
};
const dayOf = (sec) => new Date(sec * 1000).toISOString().slice(0, 10);

async function openai(key) {
  const get = async (u) => {
    const r = await fetch('https://api.openai.com/v1/organization' + u, { headers: { authorization: 'Bearer ' + key } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`openai ${u.split('?')[0]}: ${j.error?.message || r.status}`);
    return j;
  };
  const projects = (await get('/projects?limit=100&include_archived=true')).data;
  const keys = {};   // key id -> {project, name}
  await Promise.all(projects.map(async (p) => {
    const ks = (await get(`/projects/${p.id}/api_keys?limit=100`)).data;
    for (const k of ks) keys[k.id] = { project: p.name, name: k.name || k.owner?.service_account?.name || k.owner?.user?.name || '' };
  }));
  const pname = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const rows = [];
  let page = '';
  const start = Math.floor(Date.now() / 1000) - DAYS * 86400;
  for (let i = 0; i < 20; i++) {
    const j = await get(`/costs?start_time=${start}&bucket_width=1d&limit=180&group_by=project_id&group_by=api_key_id&group_by=line_item${page ? '&page=' + page : ''}`);
    for (const b of j.data) for (const r of b.results || []) {
      const k = keys[r.api_key_id] || { project: pname[r.project_id] || r.project_id, name: '' };
      const a = areaOf(k.project, k.name);
      if (!a || !r.amount?.value) continue;
      rows.push({ d: dayOf(b.start_time), src: 'openai', ...a, kind: kindOf(r.line_item), usd: r.amount.value });
    }
    if (!j.has_more) break;
    page = j.next_page;
  }
  return rows;
}

// ElevenLabs: credits per key per day; dollars = credits x what a credit costs on his plan
async function eleven(key) {
  const get = async (u) => {
    const r = await fetch('https://api.elevenlabs.io' + u, { headers: { 'xi-api-key': key } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`elevenlabs ${u.split('?')[0]}: ${j.detail?.message || j.detail?.status || r.status}`);
    return j;
  };
  const sub = await get('/v1/user/subscription');
  const end = Date.now(), start = end - DAYS * 864e5;
  const stats = (bt) => get(`/v1/usage/character-stats?start_unix=${start}&end_unix=${end}&breakdown_type=${bt}&aggregation_interval=day&include_workspace_metrics=true`);
  const [byKey, byProduct] = await Promise.all([stats('api_keys'), stats('product_type')]);
  // credits, not dollars: his plan is a monthly price for a pile of credits - no invented price per credit
  // (by product: music / TTS / STS / sound effects...; by key: once each area has its own key - the old one isn't counted per key)
  const rows = [];
  for (const [kind, list] of Object.entries(byProduct.usage || {}))
    (byProduct.time || []).forEach((t, i) => { const c = list[i] || 0; if (c) rows.push({ d: new Date(t).toISOString().slice(0, 10), src: 'elevenlabs', group: 'shlomiverse', area: 'all', kind, credits: c }); });
  const keys = [];
  for (const [name, list] of Object.entries(byKey.usage || {})) {
    const a = areaOf(/plaxzy/i.test(name) ? 'plaxzy' : 'shlomiverse', name) || { group: 'shlomiverse', area: name };
    (byKey.time || []).forEach((t, i) => { const c = list[i] || 0; if (c) keys.push({ d: new Date(t).toISOString().slice(0, 10), ...a, credits: c }); });
  }
  return { rows, keys, plan: { tier: sub.tier, used: sub.character_count, limit: sub.character_limit, resets: sub.next_character_count_reset_unix, period: sub.billing_period } };
}

async function owner(op, b) {
  if (op !== 'costs') return null;
  const db = admin.firestore(), ref = db.collection('owner').doc('costs'), was = (await ref.get()).data();
  if (was && !b.fresh && Date.now() - was.at < HOUR) return was;
  const out = { at: Date.now(), days: DAYS, areas: AREAS, rows: [], errors: [] };
  const [oa, el] = await Promise.allSettled([openai(OPENAI_ADMIN.value()), eleven(ELEVEN.value())]);
  if (oa.status === 'fulfilled') out.rows.push(...oa.value); else out.errors.push(String(oa.reason?.message || oa.reason));
  if (el.status === 'fulfilled') { out.rows.push(...el.value.rows); out.eleven = { ...el.value.plan, keys: el.value.keys }; } else out.errors.push(String(el.reason?.message || el.reason));
  // one row per day / source / group / area / kind
  const sum = {};
  for (const r of out.rows) {
    const k = [r.d, r.src, r.group, r.area, r.kind].join('|');
    const s = (sum[k] ||= { d: r.d, src: r.src, group: r.group, area: r.area, kind: r.kind, usd: 0, credits: 0 });
    s.usd += r.usd || 0; s.credits += r.credits || 0;
  }
  out.rows = Object.values(sum).map((s) => ({ ...s, usd: Math.round(s.usd * 10000) / 10000 }));
  await ref.set(out);
  return out;
}

module.exports = { owner, SECRETS, areaOf, kindOf };
