// Connect his Google accounts to the PA in Mind (his ask 2026-11-20: his work + Lybi addresses - "these are 2 calendars,
// connect and sync"). One sign-in per account in the browser; the refresh token lands in
// Firestore mind_meta/google (server-only - no client rule matches mind_*), where techietech-api/mind.js reads the
// calendars for the meetings view and the meeting pushes.
//   node scripts/mind/google-connect.mjs <address> [<address>]  -> these accounts, one after the other
//   node scripts/mind/google-connect.mjs                        -> re-connect every account already connected
// The OAuth client = the boostmind-b052c Desktop client (YT_CLIENT_ID / YT_CLIENT_SECRET in zoomcut/.env) - loopback
// redirect, nothing to register. Scopes: calendar read, mail read + drafts (the PA writes reply drafts, never sends alone).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(ROOT, 'techietech-api/package.json'));
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'boostmind-b052c' });
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, 'zoomcut/.env'), 'utf8').split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
const CLIENT_ID = env.YT_CLIENT_ID, CLIENT_SECRET = env.YT_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('YT_CLIENT_ID / YT_CLIENT_SECRET missing in zoomcut/.env');

const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.compose'];
const ref = admin.firestore().collection('mind_meta').doc('google');
// no address given = re-connect every account already connected (no addresses kept in this file)
const accounts = process.argv.slice(2).filter((a) => a.includes('@'));
if (process.argv.includes('--pick')) accounts.push('');   // Google's account picker - he chooses the account himself
if (!accounts.length) accounts.push(...Object.keys((await ref.get()).data()?.accounts || {}));
if (!accounts.length) { console.log('usage: node scripts/mind/google-connect.mjs <google address> [<another>]'); process.exit(1); }
let port, server, waiting;
server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  if (u.pathname !== '/cb') { res.writeHead(404).end(); return; }
  const code = u.searchParams.get('code'), err = u.searchParams.get('error');
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  if (!code) { res.end(`<h2 dir="rtl">לא חובר: ${err}</h2>`); waiting?.reject(new Error(err || 'no code')); return; }
  try {
    const tok = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: `http://127.0.0.1:${port}/cb`, grant_type: 'authorization_code' }) })).json();
    if (!tok.refresh_token) throw new Error(tok.error_description || tok.error || 'no refresh token');
    const me = await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: 'Bearer ' + tok.access_token } })).json();
    const email = String(me.email || '').toLowerCase();
    await ref.set({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, accounts: { [email]: { refresh: tok.refresh_token, scopes: tok.scope, c: Date.now(), err: admin.firestore.FieldValue.delete() } } }, { merge: true });
    res.end(`<h2 dir="rtl" style="font-family:sans-serif">${email} מחובר למוח השני. אפשר לסגור את החלון.</h2>`);
    waiting?.resolve({ email, scope: tok.scope });
  } catch (e) { res.end(`<h2 dir="rtl">לא חובר: ${e.message}</h2>`); waiting?.reject(e); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
port = server.address().port;

for (const acc of accounts) {
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: `http://127.0.0.1:${port}/cb`,
    response_type: 'code', scope: SCOPES.join(' '), access_type: 'offline', include_granted_scopes: 'true', ...(acc ? { prompt: 'consent', login_hint: acc } : { prompt: 'select_account consent' }) });
  console.log(`\n${acc || 'pick an account'}: sign in here ->\n${url}\n`);
  exec(`start "" "${url}"`);
  try {
    const r = await new Promise((resolve, reject) => { waiting = { resolve, reject }; setTimeout(() => reject(new Error('timeout (15 min)')), 15 * 60e3); });
    console.log(`connected: ${r.email}${r.email !== acc ? ` (asked for ${acc})` : ''}\n  scopes: ${r.scope}`);
  } catch (e) { console.log(`NOT connected ${acc}: ${e.message}`); }
}
server.close();
process.exit(0);
