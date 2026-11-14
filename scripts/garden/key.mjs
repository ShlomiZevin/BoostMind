// רופא הגינה's private links (techietech-api/garden.js). A gardener = gardeners/<sha256(key)>; the key itself lives
// only in his link shlomiverse.com/garden/?k=<key> (shown once, when made). Runs with this computer's gcloud login.
//   node scripts/garden/key.mjs add "<name>"     a new gardener + his link
//   node scripts/garden/key.mjs list
//   node scripts/garden/key.mjs revoke "<name>"
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const PROJECT = 'boostmind-b052c';
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/gardeners`;
const token = execFileSync(process.platform === 'win32' ? 'cmd' : 'gcloud', [...(process.platform === 'win32' ? ['/c', 'gcloud'] : []), 'auth', 'print-access-token'], { windowsHide: true }).toString().trim();
const H = { authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT, 'content-type': 'application/json' };
const call = async (url, o = {}) => {
  const r = await fetch(url, { ...o, headers: H });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${j.error?.message || ''}`);
  return j;
};
const val = (f) => f?.stringValue ?? f?.booleanValue ?? f?.timestampValue ?? f?.integerValue ?? null;
const all = async () => ((await call(`${DOCS}?pageSize=100`)).documents || []).map((d) => ({ id: d.name.split('/').pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, val(v)])) }));

const [cmd, name] = process.argv.slice(2);
if (cmd === 'add') {
  if (!name) throw new Error('add "<name>"');
  if ((await all()).some((c) => c.name === name && c.active)) throw new Error(`"${name}" already has an active link - revoke it first`);
  const key = crypto.randomBytes(12).toString('base64url');
  const id = crypto.createHash('sha256').update(key).digest('hex');
  await call(`${DOCS}?documentId=${id}`, { method: 'POST', body: JSON.stringify({ fields: {
    name: { stringValue: name }, active: { booleanValue: true }, created: { timestampValue: new Date().toISOString() } } }) });
  console.log(`link for "${name}" (shown once - open it on his phone and add it to the home screen):\nhttps://shlomiverse.com/garden/?k=${key}`);
} else if (cmd === 'list') {
  for (const c of await all()) console.log(`${c.active ? 'active ' : 'revoked'}  ${c.name}  asks:${c.asks || 0}  ${c.created}`);
} else if (cmd === 'revoke') {
  const list = (await all()).filter((c) => c.name === name && c.active);
  if (!list.length) throw new Error(`no active link named "${name}"`);
  for (const c of list) await call(`${DOCS}/${c.id}?updateMask.fieldPaths=active`, { method: 'PATCH', body: JSON.stringify({ fields: { active: { booleanValue: false } } }) });
  console.log(`revoked ${list.length} link(s) for "${name}"`);
} else console.log('add "<name>" | list | revoke "<name>"');
