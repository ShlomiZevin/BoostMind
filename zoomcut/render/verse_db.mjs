// The characters and their worlds as the Shlomiverse's database has them (2026-11-06, his rule: "I don't want
// duplication and git stuff where we don't need it" - the studio reads and saves them where the site does). One door:
// versePublish (techietech-api/content.js) - catalogCharacters/<id>, catalogSeries/<id>; every change logged there
// (who, the value before - `node scripts/verse/content.mjs log character <id>`). No file copy: a short memory cache only.
//   characters()            every character in the studio's shape (`order` order) - site {url, notes} as character.json had it
//   worlds()                {<world name>: {name, site, brief}} - what index.json's worlds were (the key character.world uses)
//   putCharacter(id, patch) set / create one: null / '' / [] clears a field (the database ignores empty values)
//   faces()                 {id: the face on the site} - for a character with no picture on this computer
// The record's `site` is the url and `site_notes` the notes; here they are one `site` {url, notes}, as the studio always had.
// A put of only the studio's own fields (voice, pace, links, videos, sources, portrait, assets, tier, site_notes) doesn't
// recompose the site; anything else does (a few seconds) - never fire dozens of those in a row (GCS rate-limits it).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERSE_API = 'https://europe-west1-boostmind-b052c.cloudfunctions.net/versePublish';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BY = `${os.hostname()} Shlomiverse Studio`;
const TTL = 60e3;  // (his edits on the site / another computer show here within a minute; the studio's own at once)

function key() {
  if (process.env.VERSE_PUBLISH_KEY) return process.env.VERSE_PUBLISH_KEY;
  try { const m = fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(/^VERSE_PUBLISH_KEY=(.+)$/m); if (m) return m[1].trim().replace(/^["']|["']$/g, ''); } catch {}
  return '';
}
async function api(body) {
  const k = key();
  if (!k) throw new Error('no VERSE_PUBLISH_KEY in zoomcut/.env (node render/cloud/keys.mjs pull)');
  const r = await fetch(process.env.VERSE_PUBLISH_URL || VERSE_API, { method: 'POST', headers: { authorization: 'Key ' + k, 'content-type': 'application/json' }, body: JSON.stringify({ by: BY, ...body }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`versePublish ${body.op}: ${j.error || r.status}${j.detail ? ' - ' + j.detail : ''}`);
  return j;
}

// the record <-> the studio's shape
const fromRecord = ({ site, site_notes, ...c }) => ({ ...c, ...(site || site_notes ? { site: { url: site || '', notes: site_notes || '' } } : {}) });
// the fields a character record takes (techietech-api/content.js KINDS.character - the database drops any other)
const FIELDS = ['order', 'name', 'name_en', 'aka', 'world', 'series', 'role', 'tagline', 'bio', 'ask', 'catchphrases', 'color', 'site', 'relations',
  'brief', 'personality', 'speech', 'behavior', 'comedy', 'themes', 'dont', 'look', 'writing_rules',
  'voice', 'pace', 'links', 'videos', 'sources', 'portrait', 'assets', 'tier', 'site_notes'];
const empty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);

const cache = {};  // kind -> {at, items, p}
async function list(kind) {
  const c = cache[kind];
  if (c?.items && Date.now() - c.at < TTL) return c.items;
  if (c?.p) return c.p;
  const p = api({ op: 'list', kind, full: true }).then((j) => { cache[kind] = { at: Date.now(), items: j.items || [] }; return cache[kind].items; })
    .catch((e) => { if (c?.items) { cache[kind] = { ...c, p: null }; return c.items; } cache[kind] = null; throw e; });  // (offline: the last list it had)
  cache[kind] = { ...(c || {}), p };
  return p;
}

export async function characters() {
  return (await list('character')).map(fromRecord).sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || String(a.id).localeCompare(String(b.id)));
}
export async function character(id) { return (await characters()).find((c) => c.id === id) || null; }
export async function worlds() {
  return Object.fromEntries((await list('series')).filter((s) => s.world).map((s) => [s.world, { name: s.name || s.world, site: s.site || '', brief: s.brief || '' }]));
}

/** Set (or create) one character: {field: value}; null / '' / [] / {} clears it; `site` = {url, notes} | url | null. */
export async function putCharacter(id, patch) {
  const all = await list('character'), now = all.find((x) => x.id === id);
  const bad = Object.keys(patch || {}).filter((k) => k !== 'id' && !FIELDS.includes(k));
  if (bad.length) throw new Error(`the database has no field ${bad.join(', ')} for a character`);  // (it would drop them without a word)
  const set = {}, clear = [];
  for (let [k, v] of Object.entries(patch || {})) {
    if (k === 'id') continue;
    if (k === 'site') {  // {url, notes} -> site + site_notes (null = both go; a part left out stays as it is)
      const s = v == null ? { url: null, notes: null } : typeof v === 'string' ? { url: v } : v;
      for (const [part, rk] of [['url', 'site'], ['notes', 'site_notes']]) {
        if (!(part in s)) continue;
        if (!empty(s[part])) set[rk] = s[part]; else if (now?.[rk] != null) clear.push(rk);
      }
      continue;
    }
    if (empty(v)) { if (now && now[k] != null) clear.push(k); } else set[k] = v;
  }
  if (!now) {
    if (!set.name) throw new Error('a new character needs a name');
    set.order = Math.max(0, ...all.map((x) => +x.order || 0)) + 1;  // (at the end, as index.json's order did)
  }
  if (!Object.keys(set).length && !clear.length) return fromRecord(now);
  await api({ op: 'put', kind: 'character', id, ...set, ...(clear.length ? { clear } : {}) });
  // the record as it is now (the answer only names what changed): into the cache at once - the page shows it
  const g = await api({ op: 'get', kind: 'character', id }).catch(() => null);
  const rec = g && (({ kind: _k, created: _c, _src: _s, ...r }) => ({ ...r, updated: Date.now() }))(g);
  if (cache.character?.items && rec) cache.character.items = [...cache.character.items.filter((x) => x.id !== id), rec];
  else if (cache.character) cache.character.at = 0;
  return rec ? fromRecord(rec) : null;
}

// each character's face on the site ({id: url}, the live wiki.json's img - versioned): shown where this computer has no
// picture of its own. {} when it can't be read.
let faceCache = { at: 0, map: {} };
export async function faces() {
  if (Date.now() - faceCache.at < 5 * TTL) return faceCache.map;
  try {
    const w = await (await fetch('https://storage.googleapis.com/shlomiverse-media/wiki/data/wiki.json')).json();
    const cs = Array.isArray(w.characters) ? w.characters : Object.entries(w.characters || {}).map(([id, v]) => ({ id, ...v }));
    faceCache = { at: Date.now(), map: Object.fromEntries(cs.filter((c) => c.img).map((c) => [c.id, c.img])) };
  } catch { faceCache.at = Date.now() - 4 * TTL; }  // (a minute before it tries again)
  return faceCache.map;
}

export function invalidate() { for (const k of Object.keys(cache)) if (cache[k]) cache[k].at = 0; }
