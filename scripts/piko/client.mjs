// Piko's API keys for his other tools (startdoing.co.il ...) - techietech-api/piko.js, piko-api.md.
// A key is shown ONCE, when it is made; Firestore keeps only its sha256 (pikoClients/<hash>), so a lost key = a new one.
// Runs with this computer's gcloud login (Firestore REST), no key in the code.
//   node scripts/piko/client.mjs add <name> [--library]   a new key; --library = what it makes goes into the Shlomiverse library too
//   node scripts/piko/client.mjs list
//   node scripts/piko/client.mjs revoke <name>
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const PROJECT = 'boostmind-b052c';
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/pikoClients`;
const token = execFileSync(process.platform === 'win32' ? 'cmd' : 'gcloud', [...(process.platform === 'win32' ? ['/c', 'gcloud'] : []), 'auth', 'print-access-token'], { windowsHide: true }).toString().trim();
const H = { authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT, 'content-type': 'application/json' };
const call = async (url, o = {}) => {
  const r = await fetch(url, { ...o, headers: H });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${j.error?.message || ''}`);
  return j;
};
const val = (f) => f?.stringValue ?? f?.booleanValue ?? f?.timestampValue ?? null;
const all = async () => ((await call(`${DOCS}?pageSize=100`)).documents || []).map((d) => ({ id: d.name.split('/').pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, val(v)])) }));

const [cmd, name] = process.argv.slice(2);
if (cmd === 'add') {
  if (!name) throw new Error('add <name>');
  if ((await all()).some((c) => c.name === name && c.active)) throw new Error(`"${name}" already has an active key - revoke it first`);
  const key = 'pk_' + crypto.randomBytes(24).toString('hex');
  const id = crypto.createHash('sha256').update(key).digest('hex');
  await call(`${DOCS}?documentId=${id}`, { method: 'POST', body: JSON.stringify({ fields: {
    name: { stringValue: name }, active: { booleanValue: true }, library: { booleanValue: process.argv.includes('--library') },
    prefix: { stringValue: key.slice(0, 7) }, created: { timestampValue: new Date().toISOString() } } }) });
  console.log(`key for "${name}" (shown once - keep it in that tool's server env, never in a page):\n${key}`);
} else if (cmd === 'list') {
  for (const c of await all()) console.log(`${c.active ? 'active ' : 'revoked'}  ${c.name}  ${c.prefix}…  library:${c.library}  ${c.created}`);
} else if (cmd === 'revoke') {
  const list = (await all()).filter((c) => c.name === name && c.active);
  if (!list.length) throw new Error(`no active key named "${name}"`);
  for (const c of list) await call(`${DOCS}/${c.id}?updateMask.fieldPaths=active`, { method: 'PATCH', body: JSON.stringify({ fields: { active: { booleanValue: false } } }) });
  console.log(`revoked ${list.length} key(s) for "${name}"`);
} else {
  console.log('add <name> [--library] | list | revoke <name>');
}
