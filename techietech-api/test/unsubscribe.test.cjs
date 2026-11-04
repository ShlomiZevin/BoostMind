// node techietech-api/test/unsubscribe.test.cjs - the "stop mails" link really stops them: the choices page and Gmail's
// one-click button write the person's choice, and the mailer then skips them. Firestore is a small fake here.
process.env.FUNCTIONS_EMULATOR = 'true';
const assert = require('assert');
const admin = require('firebase-admin');

// a fake Firestore: collection(x).doc(id).get / set(merge)
const store = {};
const fake = {
  collection: (c) => ({ doc: (id) => ({
    get: async () => ({ exists: !!store[c + '/' + id], data: () => store[c + '/' + id] }),
    set: async (v, o) => { store[c + '/' + id] = o?.merge ? { ...(store[c + '/' + id] || {}), ...v } : v; },
  }) }),
};
admin.apps.push({});            // "already initialised"
Object.defineProperty(admin, 'firestore', { value: () => fake, configurable: true, writable: true });

const mail = require('../mail');
const mailer = require('../mailer');
const key = 'mail|local';
const t = (uid) => mail.unsubToken(uid, key);

function call(method, query, body = {}) {
  return new Promise((resolve) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, send(b) { resolve({ code: this.code, body: String(b) }); } };
    mailer.verseMail({ method, query, body, headers: {}, get: () => '' }, res);
  });
}
const state = (uid) => store['mailUsers/' + uid] || {};
const plan = (uid) => mailer.plan({ users: [{ uid, email: uid + '@x.com' }], state: { [uid]: state(uid) }, follows: {},
  events: [{ id: 'game_x', kind: 'game', t: Date.now() - 3600e3 }], now: Date.now(), cfg: { on: true } });

(async () => {
  // a forged or broken link changes nothing
  let r = await call('GET', { u: 'a', t: 'wrong' });
  assert.equal(r.code, 400);
  r = await call('POST', { u: 'a', t: t('b'), one: '1' });
  assert.equal(r.code, 400);
  assert.equal(state('a').off, undefined);

  // the choices page opens with everything on
  r = await call('GET', { u: 'a', t: t('a') });
  assert.equal(r.code, 200);
  assert.ok(r.body.includes('להפסיק את כל המיילים'));
  assert.equal((r.body.match(/checked/g) || []).length, 3);

  // Gmail's own "unsubscribe" button (one click, POST) -> stopped, and the mailer skips them - even the welcome
  r = await call('POST', { u: 'a', t: t('a'), one: '1' }, { 'List-Unsubscribe': 'One-Click' });
  assert.equal(state('a').off, true);
  assert.equal(plan('a').length, 0);

  // the page's "stop all mails" button
  r = await call('POST', {}, { u: 'b', t: t('b'), all: 'off' });
  assert.equal(state('b').off, true);
  assert.ok(r.body.includes('לא נשלח יותר מיילים'));
  assert.equal(plan('b').length, 0);
  // and the page then shows nothing ticked
  r = await call('GET', { u: 'b', t: t('b') });
  assert.equal((r.body.match(/checked/g) || []).length, 0);

  // unticking everything and saving = stopped too
  await call('POST', {}, { u: 'c', t: t('c') });
  assert.equal(state('c').off, true);
  assert.equal(plan('c').length, 0);

  // games only: on, and only games
  await call('POST', {}, { u: 'd', t: t('d'), game: 'on' });
  assert.deepEqual(state('d').prefs, { story: false, video: false, game: true });
  assert.equal(state('d').off, false);

  // changing their mind: ticking again turns mail back on
  await call('POST', {}, { u: 'b', t: t('b'), story: 'on', video: 'on', game: 'on' });
  assert.equal(state('b').off, false);
  assert.equal(plan('b')[0].kind, 'welcome');

  console.log('unsubscribe: all passed');
})().catch((e) => { console.error(e); process.exit(1); });
