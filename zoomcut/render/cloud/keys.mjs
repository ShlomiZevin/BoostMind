// The studio's keys live in Google Secret Manager (boostmind-b052c): ONE secret, studio-keys, holding them all as JSON -
// the same on every computer he works at. (One secret per key costs ~$3 a month in versions and reads; one secret stays
// in the free tier. Each change replaces the version and the old one is destroyed.) zoomcut/.env is this computer's copy, written from the cloud at startup, so every
// reader (the studio, tools/, the Python pipeline) works as before. A key that changes here - a token the studio
// renews (Instagram / Facebook expiry, TikTok's refresh token that is replaced on every use), or one he adds - goes up
// as a new version; another computer's renewal comes down within minutes and right before a publish. Values are never
// printed or logged. Why not the Vault: it opens only with his password in a browser - a server can't read it.
//   node render/cloud/keys.mjs push    this computer's .env (+ the email / Telegram keys) -> the cloud
//   node render/cloud/keys.mjs pull    the cloud -> .env
//   node render/cloud/keys.mjs list    the key names only
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { PROJECT, ROOT } from './layout.mjs';

export const SECRET = 'studio-keys';
const ENV = path.join(ROOT, '.env');
const API = `https://secretmanager.googleapis.com/v1/projects/${PROJECT}`;
// keys the studio used to borrow from other projects' files (email, Telegram) - kept with its own from now on
const BORROWED = { 'C:/workspace/aspect/aspect-agent-server/.env': ['GMAIL_USER', 'GMAIL_APP_PASSWORD'], 'C:/workspace/xplace-auto-bidder/.env': ['TELEGRAM_TOKEN', 'TELEGRAM_CHAT_ID'] };

let tok = null;
const token = () => (tok && tok.until > Date.now() ? Promise.resolve(tok.v) : new Promise((ok, fail) =>
  execFile('cmd', ['/c', 'gcloud', 'auth', 'print-access-token'], { windowsHide: true }, (e, out) => {
    if (e) return fail(new Error('gcloud login needed (gcloud auth login)'));
    tok = { v: out.trim(), until: Date.now() + 40 * 60e3 }; ok(tok.v);
  })));
const call = async (url, opts = {}) => {
  const r = await fetch(url, { ...opts, headers: { authorization: `Bearer ${await token()}`, 'content-type': 'application/json', ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(`secret manager ${r.status}: ${j.error?.message || ''}`.slice(0, 200)); e.status = r.status; throw e; }
  return j;
};

export const parse = (text) => {
  const out = {};
  for (const l of String(text || '').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
};
const readEnv = (f = ENV) => { try { return parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } };
// the file with these values: his lines keep their order, changed ones in place, new ones at the end
function writeEnv(vals) {
  let lines = []; try { lines = fs.readFileSync(ENV, 'utf8').split(/\r?\n/); } catch {}
  const done = new Set();
  lines = lines.map((l) => { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/); if (!m || !(m[1] in vals)) return l; done.add(m[1]); return `${m[1]}=${vals[m[1]]}`; });
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  for (const [k, v] of Object.entries(vals)) if (!done.has(k)) lines.push(`${k}=${v}`);
  fs.writeFileSync(ENV, lines.join('\n') + '\n');
}

// all the keys, as the cloud has them now ({} when the secret isn't made yet)
export async function pull() {
  try { const j = await call(`${API}/secrets/${SECRET}/versions/latest:access`); return JSON.parse(Buffer.from(j.payload.data, 'base64').toString('utf8')); }
  catch (e) { if (e.status === 404) return {}; throw e; }
}
// these keys changed: one new version with everything (read just before, so another computer's change isn't lost),
// then the older versions are destroyed (an active version is billed; his history isn't kept in the cloud)
export async function put(vals) {
  const all = { ...(await pull()), ...vals };
  try { await call(`${API}/secrets?secretId=${SECRET}`, { method: 'POST', body: JSON.stringify({ replication: { automatic: {} }, labels: { app: 'sketch-studio' } }) }); }
  catch (e) { if (e.status !== 409) throw e; }
  const v = await call(`${API}/secrets/${SECRET}:addVersion`, { method: 'POST', body: JSON.stringify({ payload: { data: Buffer.from(JSON.stringify(all), 'utf8').toString('base64') } }) });
  const list = await call(`${API}/secrets/${SECRET}/versions?filter=${encodeURIComponent('state:ENABLED OR state:DISABLED')}`);
  for (const x of list.versions || []) if (x.name !== v.name) await call(`https://secretmanager.googleapis.com/v1/${x.name}:destroy`, { method: 'POST', body: '{}' }).catch(() => {});
  return all;
}

// ---- in the studio: the cloud -> .env at startup, .env changes -> the cloud, the cloud's renewals -> .env ---------
export function startKeys({ log = console.log } = {}) {
  let base = null;  // the values as they were last agreed with the cloud
  let busy = Promise.resolve();
  const once = (f) => (busy = busy.then(f, f).catch((e) => log('keys: ' + e.message)));
  const sync = () => once(async () => {
    const cloud = await pull(), local = readEnv();
    const up = {}, down = {};
    for (const k of new Set([...Object.keys(cloud), ...Object.keys(local)])) {
      const c = cloud[k], l = local[k], b = base?.[k];
      if (c === l) continue;
      if (l == null) down[k] = c;                                      // not on this computer yet
      else if (c == null) up[k] = l;                                   // a key he added here
      else if (base && l !== b && c === b) up[k] = l;                  // renewed here
      else down[k] = c;                                                // renewed on another computer (or first start: the cloud is the truth)
    }
    if (Object.keys(up).length) await put(up);
    if (Object.keys(down).length) writeEnv(down);
    base = { ...cloud, ...up };
    const n = Object.keys(up).length + Object.keys(down).length;
    if (n) log(`keys: ${Object.keys(up).length} up, ${Object.keys(down).length} down (${[...Object.keys(up), ...Object.keys(down)].join(', ')})`);
  });
  sync();
  // a change of the file (the studio renewed a token, he pasted a key): up within a few seconds
  fs.watchFile(ENV, { interval: 3000 }, () => sync());
  const t = setInterval(sync, 5 * 60e3); t.unref?.();
  return { fresh: () => sync() };  // (before a publish: another computer may have renewed a token)
}

// ---- the command line ----------------------------------------------------------------------------------------------
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.slice(1))) {
  const cmd = process.argv[2];
  if (cmd === 'list') console.log(Object.keys(await pull()).sort().join(' '));
  else if (cmd === 'pull') { const c = await pull(); writeEnv(c); console.log(`${Object.keys(c).length} keys written to zoomcut/.env (names: ${Object.keys(c).join(', ')})`); }
  else if (cmd === 'push') {
    const vals = readEnv();
    for (const [f, ks] of Object.entries(BORROWED)) { const o = readEnv(f); for (const k of ks) if (o[k] && !vals[k]) vals[k] = o[k]; }
    const have = await pull(), diff = Object.fromEntries(Object.entries(vals).filter(([k, v]) => have[k] !== v));
    if (Object.keys(diff).length) await put(diff);
    console.log(`${Object.keys(diff).length} of ${Object.keys(vals).length} keys sent (the rest were already there): ${Object.keys(vals).join(', ')}`);
  } else console.log('push | pull | list');
}
