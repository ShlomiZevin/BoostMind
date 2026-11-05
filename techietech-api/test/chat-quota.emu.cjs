// The chat's question limits and "bring a friend", on the local emulators (project demo-shlomiverse - nothing live):
//   cd v2 && firebase emulators:exec --project demo-shlomiverse --only auth,firestore,functions "node ../techietech-api/test/chat-quota.emu.cjs"
// (VERSE_OPENAI_KEY / WIKI_OPENAI_KEY in the environment for the replies - v2/dev.mjs shows where it comes from).
// Checks: an account gets 10 a day; a friend through an invite link (a new account) = 20 for both, counted once, the own
// link not counted; the reply at the wall answers first and gives tomorrow + the invite card in the character's voice;
// after it the chat says 'done'. Without an account: 3, then the sign-in reply (answer first, then [[signin]]), then 'signin'.
const assert = require('assert');
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const FS = 'http://127.0.0.1:8080/v1/projects/demo-shlomiverse/databases/(default)/documents';
const API = 'http://127.0.0.1:5001/demo-shlomiverse/europe-west1/wikiChat';
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
const live = !!process.env.VERSE_OPENAI_KEY;   // the character replies need a key; the counting doesn't

async function user(n) {
  const r = await (await fetch(`${AUTH}/accounts:signUp?key=x`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `${n}${Date.now()}@test.local`, password: 'secret123', returnSecureToken: true }) })).json();
  return { uid: r.localId, tok: r.idToken };
}
const post = (tok, body) => fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify(body) });
const peek = async (u, inv) => (await post(u.tok, { peek: true, v: 'emu', ...(inv ? { inv } : {}) })).json();
const setUsed = (doc, n) => fetch(`${FS}/quota/${doc}?updateMask.fieldPaths=n`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: 'Bearer owner' },
  body: JSON.stringify({ fields: { n: { integerValue: String(n) } } }) });
const ask = (tok, v, q, mode = 'hani') => post(tok, { v, mode, messages: [{ role: 'user', content: q }] });

(async () => {
  // signed in: 10 a day, and a friend through the link
  const A = await user('a'), B = await user('b');
  assert.deepEqual(await peek(A), { left: 10, limit: 10, signed: true });
  const b1 = await peek(B, A.uid);
  assert.equal(b1.invite, 'ok'); assert.equal(b1.limit, 20);
  assert.equal((await peek(B, A.uid)).invite, 'had', 'a friend counts once');
  assert.equal((await peek(A)).limit, 20, 'the inviter got 10 more today');
  assert.equal((await peek(A, A.uid)).invite, 'self', 'the own link does not count');
  assert.equal((await peek(A)).limit, 20);
  console.log('ok  10 a day; a friend through the link = 20 for both, once; own link not counted');

  if (live) {
    await setUsed(`chatq_u${A.uid}_${day}`, 20);
    const r = await ask(A.tok, 'emu', 'חני, איך את מספיקה עבודה ותשעה ילדים?');
    assert.equal(r.status, 200);
    const text = await r.text();
    assert.match(text, /\[\[invite\]\]\s*$/, 'the wall reply ends with the invite card');
    assert.match(text, /מחר/, 'it says tomorrow');
    assert.match(text, /חבר/, 'it says bring a friend');
    assert.ok(text.split('\n\n').length >= 3, 'an answer first, then the tomorrow / friend part, then the card');
    const after = await ask(A.tok, 'emu', 'עוד שאלה');
    assert.equal(after.status, 429); assert.equal((await after.json()).why, 'done');
    console.log('ok  the reply at today\'s wall answers, then tomorrow + a friend + [[invite]]; then done');

    // without an account: 3, then the sign-in reply (an answer first), then the wall
    const v = 'emu' + Date.now().toString(36);
    for (let i = 0; i < 3; i++) assert.equal((await ask(null, v, 'היי חני')).status, 200);
    const s = await (await ask(null, v, 'מה שלומך היום?')).text();
    assert.match(s, /\[\[signin\]\]\s*$/); assert.ok(s.split('\n\n').length >= 2, 'an answer before the invitation');
    const w = await ask(null, v, 'ועוד אחת');
    assert.equal(w.status, 429); assert.equal((await w.json()).why, 'signin');
    console.log('ok  without an account: 3, then an answer + the sign-in invitation, then the wall');
  } else console.log('(no VERSE_OPENAI_KEY - the replies were not checked)');
  console.log('chat-quota: all good');
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
