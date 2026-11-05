// An idea's way, end to end on the local emulators (project demo-shlomiverse - nothing live):
//   cd v2 && firebase emulators:exec --project demo-shlomiverse --only auth,firestore,functions "node ../techietech-api/test/idea-status.emu.mjs"
// A writer's idea with a voter: 'liked' from the owner op = a bell note + the mail (mailLog, or mailQueue on Shabbat /
// at night) to the writer, once; 'live' with a video = the writer hears again and the voter gets a bell note; the wall
// shows the step and the video page the writer's credit (v2/dev.mjs --site on :5050).
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire('C:/workspace/BoostMind/zoomcut/render/package.json');
const puppeteer = require('puppeteer-core');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
const KEY = fs.readFileSync(path.join(ROOT, 'techietech-api/.env.local'), 'utf8').split(/\r?\n/).find((l) => l.startsWith('VERSE_LOCAL_OWNER_KEY='))?.slice(22).trim().replace(/^["']|["']$/g, '');
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const FS = 'http://127.0.0.1:8080/v1/projects/demo-shlomiverse/databases/(default)/documents';
const OWN = 'http://127.0.0.1:5001/demo-shlomiverse/europe-west1/verseOwner';
const H = { 'content-type': 'application/json', authorization: 'Bearer owner' };
const W = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/wiki/data/wiki.json'), 'utf8'));
const video = W.videos.find((v) => !v.archive && !v.url && v.src);

const user = async (n) => (await (await fetch(`${AUTH}/accounts:signUp?key=x`, { method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: `${n}${Date.now()}@test.local`, password: 'secret123', displayName: n, returnSecureToken: true }) })).json()).localId;
const put = (p, fields) => fetch(`${FS}/${p}`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields }) });
const list = async (p) => ((await (await fetch(`${FS}/${p}`, { headers: H })).json()).documents || []);
const step = async (id, status, videoId) => {
  const r = await fetch(`${OWN}?op=ideaStatus`, { method: 'POST', headers: { authorization: 'Key ' + KEY, 'content-type': 'application/json' }, body: JSON.stringify({ id, status, videoId }) });
  const j = await r.json(); assert.ok(r.ok, JSON.stringify(j)); return j;
};
const str = (v) => ({ stringValue: v });

const writer = await user('writer'), voter = await user('voter');
const id = 'idea' + Date.now().toString(36);
await put(`ideas/${id}`, { text: str('מה עם דמות נוספת - הדתי מחמד'), kind: str('character'), uid: str(writer), nick: str('חסדי השם'), votes: { integerValue: '1' },
  hidden: { booleanValue: false }, t: { timestampValue: new Date().toISOString() } });
await put(`ideaVoters/${id}`, { uids: { arrayValue: { values: [str(voter)] } } });

const r1 = await step(id, 'liked');
assert.equal(r1.told, true);
let notes = await list(`fans/${writer}/notes`);
assert.ok(notes.some((n) => n.fields.kind?.stringValue === 'idea' && n.fields.status?.stringValue === 'liked'), 'the writer has the bell note');
const mails = [...await list('mailLog'), ...await list('mailQueue')].filter((m) => JSON.stringify(m.fields).includes(id));
assert.ok(mails.length >= 1, 'the mail went out (or waits for decent hours)');
assert.equal((await step(id, 'liked')).told, false, 'the same step never tells twice');
console.log(`ok  liked: bell + mail (${mails[0].name.includes('mailQueue') ? 'queued for decent hours' : 'sent'}) to the writer, once`);

const r2 = await step(id, 'live', video.id);
assert.equal(r2.told, true); assert.equal(r2.voters, 1);
notes = await list(`fans/${voter}/notes`);
assert.ok(notes.some((n) => n.fields.status?.stringValue === 'liveVoter'), 'the voter hears it went live');
console.log('ok  live: the writer told again, the voter gets a bell note');

// the Shlomiverse answers the idea: shown on it, the writer gets a bell note
let r = await fetch(`${OWN}?op=ideaReply`, { method: 'POST', headers: { authorization: 'Key ' + KEY, 'content-type': 'application/json' }, body: JSON.stringify({ id, text: 'רעיון מעולה, כבר כותבים' }) });
assert.ok(r.ok);
notes = await list(`fans/${writer}/notes`);
assert.ok(notes.some((n) => n.fields.status?.stringValue === 'reply'), 'the writer hears about the answer');
console.log('ok  the answer: on the idea, the writer told');

// his own +1 (the official account) on a fresh idea = "the Shlomiverse liked it"
const tok = async (n) => (await (await fetch(`${AUTH}/accounts:signUp?key=x`, { method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: `${n}${Date.now()}@test.local`, password: 'secret123', returnSecureToken: true }) })).json());
const me = await tok('official');
await put(`fans/${me.localId}`, { nick: str('שלומיוורס'), official: { booleanValue: true } });
const id2 = 'idea2' + Date.now().toString(36);
await put(`ideas/${id2}`, { text: str('עוד רעיון'), kind: str('episode'), uid: str(writer), nick: str('חסדי השם'), votes: { integerValue: '0' }, hidden: { booleanValue: false }, t: { timestampValue: new Date().toISOString() } });
r = await fetch('http://127.0.0.1:5001/demo-shlomiverse/europe-west1/verse', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + me.idToken },
  body: JSON.stringify({ data: { op: 'vote', ideaId: id2, on: true } }) });
const vj = await r.json();
assert.ok(vj.result?.liked, 'his +1 marks it liked: ' + JSON.stringify(vj));
const i2 = (await (await fetch(`${FS}/ideas/${id2}`, { headers: H })).json()).fields;
assert.equal(i2.status?.stringValue, 'liked');
console.log('ok  his own +1 = השלומיוורס אהב (the writer gets the liked bell + mail, not a plain +1)');

const site = spawn('node', [path.join(ROOT, 'v2/dev.mjs'), '--site'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const b = await puppeteer.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', headless: 'new' });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idea-'));
try {
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await p.goto(`http://localhost:5050/community?idea=${id}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await p.waitForSelector(`#idea-${id} .idea-step.s-live`, { timeout: 20000 });
  assert.match(await p.$eval(`#idea-${id} .idea-reply`, (e) => e.textContent), /כבר כותבים/, 'the answer shows under the idea');
  assert.match(await p.$eval(`#idea-${id} .idea-step a`, (a) => a.getAttribute('href')), new RegExp(video.id), 'the badge links to its video');
  await p.$eval(`#idea-${id}`, (e) => e.scrollIntoView({ block: 'center' }));
  await p.screenshot({ path: path.join(dir, 'wall.png') });
  await p.goto(`http://localhost:5050/v/${video.id}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await p.waitForSelector('[data-credit]:not([hidden])', { timeout: 20000 });
  assert.match(await p.$eval('[data-credit]', (a) => a.textContent), /חסדי השם/);
  await p.screenshot({ path: path.join(dir, 'video.png') });
  console.log('ok  the wall shows the step with its video, the video page credits the writer');
  console.log('screens: ' + dir);
} finally { await b.close(); site.kill(); }
console.log('idea-status: all good');
process.exit(0);
