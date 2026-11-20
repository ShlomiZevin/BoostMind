// ישיבת זום - the local try-out of the meeting engine (techietech-api/meeting.js). His ask 2026-11-20: "build it locally, show it
// to me, I will try it" - the engine first, design later. Nothing here goes live.
//   node scripts/meeting/server.mjs        -> http://localhost:4848
// The brain = the live one (gs://shlomiverse-private/wiki-brain.json, read once at start). Keys = the design keys
// (scripts/design.env: OPENAI_API_KEY + ANTHROPIC_API_KEY - missing on a computer -> node scripts/design-env.mjs). Never printed.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(HERE, '..', '..');
const require = createRequire(path.join(ROOT, 'techietech-api', 'package.json'));
const wiki = require('./wiki.js');
const meeting = require('./meeting.js');
const PORT = Number(process.env.PORT || 4848);

const env = fs.readFileSync(path.join(ROOT, 'scripts', 'design.env'), 'utf8');
const get = (n) => (env.match(new RegExp(`^${n}=(.*)$`, 'm')) || [])[1]?.trim();
const KEY = get('OPENAI_API_KEY'), AKEY = get('ANTHROPIC_API_KEY') || null;
if (!KEY) { console.error('no OPENAI_API_KEY in scripts/design.env (node scripts/design-env.mjs)'); process.exit(1); }

console.log('reading the brain...');
const brain = JSON.parse(execSync('gcloud storage cat gs://shlomiverse-private/wiki-brain.json', { encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 }));
const cur = wiki._fromBrain(brain, 'local');
console.log('brain:', Object.keys(cur.byId).length, 'residents; director on', AKEY ? 'Sonnet' : 'Terra');

const meetings = new Map();   // id -> { M, busy: Promise }
const body = (req) => new Promise((ok) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch (e) { ok({}); } }); });

async function run(res, m, guest = null) {
  res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-cache' });
  if (guest) res.write(JSON.stringify({ t: 'guest', text: guest }) + '\n');
  const emit = (e) => { res.write(JSON.stringify(e) + '\n'); if (e.t === 'line' || e.t === 'org') console.log(e.t === 'line' ? `  ${e.who}${e.cut ? ' (cut)' : ''}: ${e.text.slice(0, 80)}` : `  [org] ${e.next}${e.cut ? ' CUT' : ''}${e.end ? ' END' : ''} - ${e.why}`); };
  const p = meeting.round(m.M, emit).catch((e) => { console.error('round failed', e.message); emit({ t: 'error', msg: e.message.slice(0, 200) }); emit({ t: 'floor' }); });
  m.busy = p;
  await p;
  console.log(`  ($${m.M.cost.toFixed(4)} so far)`);
  res.end();
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'GET' && (u.pathname === '/' || u.pathname === '/index.html')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(HERE, 'page.html')));
  }
  if (req.method !== 'POST') { res.writeHead(404); return res.end(); }
  const b = await body(req);
  if (u.pathname === '/api/start') {
    const id = Math.random().toString(36).slice(2, 10);
    const M = meeting.newMeeting({ cur, key: KEY, akey: AKEY, room: b.room || [] });
    const m = { M, busy: null };
    meetings.set(id, m);
    console.log('meeting', id, M.room.join(', '));
    res.setHeader('x-meeting', id);
    res.setHeader('x-room', M.room.join(','));
    return run(res, m);
  }
  const m = meetings.get(b.id);
  if (!m) { res.writeHead(404); return res.end('{}'); }
  if (u.pathname === '/api/hand') { m.M.hand = true; res.writeHead(200); return res.end('{}'); }
  if (u.pathname === '/api/say') {
    if (m.M.ended) { res.writeHead(409); return res.end('{}'); }
    m.M.hand = true;
    if (m.busy) await m.busy;   // the line in the air finishes, then the guest's words
    meeting.guestSays(m.M, b.text || '');
    console.log(`  GUEST: ${String(b.text || '').slice(0, 80)}`);
    return run(res, m, String(b.text || '').slice(0, 600));
  }
  res.writeHead(404); res.end();
}).listen(PORT, () => console.log(`ישיבת זום: http://localhost:${PORT}`));
