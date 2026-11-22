// Proves firestore.rules before a deploy, without the emulator (no Java here): the Firebase Rules API runs the local
// rules file against test cases on Google's side (projects.test) - nothing is deployed, no data is touched.
//   node scripts/security/rules-test.cjs            (needs gcloud signed in with access to the project)
// Each case: who (null = no token), method, path, the stored doc (resource) and the incoming doc (data), ALLOW / DENY.
// The admin addresses are taken from the rules file itself (isWholosAdmin's list), so none are written here.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const P = 'boostmind-b052c';
const SRC = fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8');
const D = '/databases/(default)/documents/';
const ADMINS = /in \[([^\]]+)\]/.exec(SRC)[1].split(',').map((s) => s.trim().replace(/'/g, ''));

const anon = null;
const fan = { uid: 'fanUid123', token: { email: 'fan@example.com', email_verified: true } };
const owner = { uid: 'ownerAuthUid', token: { email: ADMINS[0], email_verified: true } };
const admin2 = { uid: 'admin2Uid', token: { email: ADMINS[1], email_verified: true } };
const fakeOwner = { uid: 'x', token: { email: ADMINS[0], email_verified: false } };

const order = { orderNum: 'GP-1', name: 'Test', phone: '000', city: 'c', street: 's', notes: '', items: [{ id: 's1', qty: 1 }],
  subtotal: 80, shipping: 35, total: 115, hasPhysical: true, status: 'new', source: 'yotamverse', email: 'fan@example.com', uid: 'fanUid123' };
const ev = { type: 'home_view', ts: 1795305600000, visitor: 'v_1', session: 's_1', path: '/wholos/', referrer: null, ua: 'iPhone Safari' };

const C = [
  // --- the Shlomiverse: read-only, own fan doc only
  ['own fan doc', fan, 'get', 'fans/fanUid123', null, null, 'ALLOW'],
  ['other fan doc', fan, 'get', 'fans/otherUid456', null, null, 'DENY'],
  ['own notes', fan, 'list', 'fans/fanUid123/notes/n1', null, null, 'ALLOW'],
  ['other notes', fan, 'list', 'fans/otherUid456/notes/n1', null, null, 'DENY'],
  ['write own fan doc', fan, 'update', 'fans/fanUid123', { role: 'fan' }, { role: 'owner' }, 'DENY'],
  ['create own fan doc', fan, 'create', 'fans/fanUid123', null, { admin: true }, 'DENY'],
  ['write own saves', fan, 'create', 'fans/fanUid123/saves/x', null, { a: 1 }, 'DENY'],
  ['comment visible', anon, 'get', 'comments/c1', { hidden: false }, null, 'ALLOW'],
  ['comment hidden', anon, 'get', 'comments/c1', { hidden: true }, null, 'DENY'],
  ['write comment', fan, 'create', 'comments/c1', null, { hidden: false, text: 'x' }, 'DENY'],
  ['sticker live', anon, 'get', 'stickers/s1', { status: 'live', hidden: false, uid: 'z' }, null, 'ALLOW'],
  ['own pending sticker', fan, 'get', 'stickers/s1', { status: 'pending', hidden: false, uid: 'fanUid123' }, null, 'ALLOW'],
  ['other pending sticker', fan, 'get', 'stickers/s1', { status: 'pending', hidden: false, uid: 'z' }, null, 'DENY'],
  ['videoStats', anon, 'get', 'videoStats/_top', {}, null, 'ALLOW'],
  ['records day', anon, 'get', 'records/verse-fly_2026-11-22', {}, null, 'ALLOW'],
  ['records player entry', fan, 'get', 'records/verse-fly_2026-11-22/players/otherUid456', {}, null, 'DENY'],
  ['pikoJobs fan', fan, 'get', 'pikoJobs/j1', {}, null, 'DENY'],
  ['pikoJobs owner', owner, 'get', 'pikoJobs/j1', {}, null, 'ALLOW'],
  ['pikoJobs unverified', fakeOwner, 'get', 'pikoJobs/j1', {}, null, 'DENY'],
  // --- function-only collections
  ...['requests/r1', 'siteUsers/fanUid123', 'downloads/d1', 'guard/g1', 'catalogVideos/v1', 'greetings/g1', 'greetingVoice/g', 'syncsCost/x',
    'aiSpend/x', 'owner/x', 'meetings/m1', 'chatNotes/c', 'sheetEdits/s', 'scriptCraft/s', 'mailUsers/fanUid123', 'verseMeta/tz',
    'mundial-chat/x', 'mundial-players/x', 'mundial/x', 'party-rsvp/x', 'analytics_days/x'].flatMap((p) => [
    [`${p} read`, fan, 'get', p, {}, null, 'DENY'],
    [`${p} write`, fan, 'create', p, null, { a: 1 }, 'DENY'],
  ]),
  // --- storyboards (no sign-in app)
  ['storyboard read', anon, 'list', 'storyboards/b1', {}, null, 'ALLOW'],
  ['storyboard edit', anon, 'update', 'storyboards/b1', { title: 'a' }, { title: 'b' }, 'ALLOW'],
  ['storyboard delete', anon, 'delete', 'storyboards/b1', { title: 'a' }, null, 'DENY'],
  // --- the shop
  ['order read anon', anon, 'list', 'gp-orders/o1', order, null, 'DENY'],
  ['order read fan', fan, 'get', 'gp-orders/o1', order, null, 'DENY'],
  ['order read owner', owner, 'list', 'gp-orders/o1', order, null, 'ALLOW'],
  ['order create anon', anon, 'create', 'gp-orders/o1', null, order, 'ALLOW'],
  ['order create paid', anon, 'create', 'gp-orders/o1', null, { ...order, status: 'paid' }, 'DENY'],
  ['order create extra field', anon, 'create', 'gp-orders/o1', null, { ...order, admin: true }, 'DENY'],
  ['order create huge notes', anon, 'create', 'gp-orders/o1', null, { ...order, notes: 'x'.repeat(3000) }, 'DENY'],
  ['order update anon', anon, 'update', 'gp-orders/o1', order, { ...order, status: 'done' }, 'DENY'],
  ['order delete anon', anon, 'delete', 'gp-orders/o1', order, null, 'DENY'],
  ['products read', anon, 'list', 'gp-products/p1', {}, null, 'ALLOW'],
  ['products write anon', anon, 'create', 'gp-products/p1', null, { a: 1 }, 'DENY'],
  ['shop settings write fan', fan, 'update', 'gp-shop/settings', {}, { adminPass: 'x' }, 'DENY'],
  ['shop settings write owner', owner, 'update', 'gp-shop/settings', {}, { shipping: 30 }, 'ALLOW'],
  // --- legacy Wholos
  ['users_index read all anon', anon, 'list', 'users_index/u1', { email: 'x' }, null, 'DENY'],
  ['users_index read other', fan, 'get', 'users_index/otherUid456', { authUid: 'otherUid456', email: 'x' }, null, 'DENY'],
  ['users_index read own', fan, 'get', 'users_index/fanUid123', { authUid: 'fanUid123' }, null, 'ALLOW'],
  ['users_index read coach row', fan, 'get', 'users_index/otherUid456', { role: 'coacher' }, null, 'ALLOW'],
  ['users_index list admin', admin2, 'list', 'users_index/u1', { email: 'x' }, null, 'ALLOW'],
  ['users_index create own', fan, 'create', 'users_index/fanUid123', null, { uid: 'fanUid123', authUid: 'fanUid123', email: 'a', signInCount: 1 }, 'ALLOW'],
  ['users_index bump own', fan, 'update', 'users_index/fanUid123', { uid: 'fanUid123', authUid: 'fanUid123', signInCount: 1 }, { uid: 'fanUid123', authUid: 'fanUid123', signInCount: 2 }, 'ALLOW'],
  ['users_index self-admin', fan, 'update', 'users_index/fanUid123', { uid: 'fanUid123' }, { uid: 'fanUid123', isAdmin: true }, 'DENY'],
  ['users_index self-admin on create', fan, 'create', 'users_index/fanUid123', null, { uid: 'fanUid123', isAdmin: true }, 'DENY'],
  ['users_index self coacher', fan, 'update', 'users_index/fanUid123', { uid: 'fanUid123' }, { uid: 'fanUid123', role: 'coacher' }, 'ALLOW'],
  ['users_index self other role', fan, 'update', 'users_index/fanUid123', { uid: 'fanUid123' }, { uid: 'fanUid123', role: 'owner' }, 'DENY'],
  ['users_index write other', fan, 'update', 'users_index/otherUid456', { uid: 'otherUid456' }, { uid: 'otherUid456', email: 'evil' }, 'DENY'],
  ['users_index admin grants', owner, 'update', 'users_index/otherUid456', { uid: 'otherUid456' }, { uid: 'otherUid456', isAdmin: true }, 'ALLOW'],
  ['analytics read anon', anon, 'list', 'analytics_events/e1', ev, null, 'DENY'],
  ['analytics read fan', fan, 'list', 'analytics_events/e1', ev, null, 'DENY'],
  ['analytics read admin', owner, 'list', 'analytics_events/e1', ev, null, 'ALLOW'],
  ['analytics landing create', anon, 'create', 'analytics_events/e1', null, ev, 'ALLOW'],
  ['analytics fake verse row', anon, 'create', 'analytics_events/e1', null, { ...ev, t: 1, e: 'signin' }, 'DENY'],
  ['analytics no type', anon, 'create', 'analytics_events/e1', null, { ts: 1 }, 'DENY'],
  ['ai_usage read anon', anon, 'list', 'ai_usage/a1', {}, null, 'DENY'],
  ['ai_usage server create', anon, 'create', 'ai_usage/a1', null, { cost_usd: 0.01 }, 'ALLOW'],
  ['reports read anon', anon, 'list', 'users/user_6724/reports/r1', {}, null, 'DENY'],
  ['reports read admin', owner, 'list', 'users/user_6724/reports/r1', {}, null, 'ALLOW'],
  ['reports create own', fan, 'create', 'users/user_6724/reports/r1', null, { authorUid: 'fanUid123', title: 'x' }, 'ALLOW'],
  ['reports create anon', anon, 'create', 'users/user_6724/reports/r1', null, { authorUid: 'z' }, 'DENY'],
  ['reports delete fan', fan, 'delete', 'users/user_6724/reports/r1', { authorUid: 'fanUid123' }, null, 'DENY'],
  ['own tree', fan, 'create', 'users/fanUid123/mealLogs/m1', null, { a: 1 }, 'ALLOW'],
  ['other tree', fan, 'get', 'users/otherUid456/mealLogs/m1', {}, null, 'DENY'],
  ['owner any tree', owner, 'get', 'users/user_6724/profile/main', {}, null, 'ALLOW'],
  ['chat read other', fan, 'get', 'users/otherUid456/chatThreads/t1', {}, null, 'DENY'],
  ['chat delete anon', anon, 'delete', 'users/otherUid456/chatThreads/t1', {}, null, 'DENY'],
  ['chat server write', anon, 'create', 'users/otherUid456/chatThreads/t1/messages/m1', null, { text: 'hi' }, 'ALLOW'],
  ['exercises read', anon, 'list', 'exercises/e1', {}, null, 'ALLOW'],
  ['exercises write fan', fan, 'update', 'exercises/e1', {}, { he: 'x' }, 'DENY'],
  ['exercises write admin', admin2, 'update', 'exercises/e1', {}, { he: 'x' }, 'ALLOW'],
  ['authAliases read other', fan, 'get', 'authAliases/otherUid456', {}, null, 'DENY'],
  ['authAliases write own', fan, 'create', 'authAliases/fanUid123', null, { legacyUid: 'u' }, 'ALLOW'],
  ['vault other', fan, 'get', 'vaults/otherUid456', {}, null, 'DENY'],
];

const testCases = C.map(([, who, method, p, res, data, expectation]) => {
  const request = { method, path: D + p, time: new Date().toISOString() };
  if (who) request.auth = who;
  if (data) request.resource = { data };
  const t = { expectation, request, pathEncoding: 'PLAIN',
    // no trainee has a coach in these cases (isCoachOf -> exists() false)
    functionMocks: [{ function: 'exists', args: [{ anyValue: {} }], result: { value: false } }] };
  if (res) t.resource = { data: res };
  return t;
});

(async () => {
  const T = execSync('gcloud auth print-access-token').toString().trim();
  const r = await fetch(`https://firebaserules.googleapis.com/v1/projects/${P}:test`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + T, 'x-goog-user-project': P, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: SRC }] }, testSuite: { testCases } }),
  });
  const j = await r.json();
  if (!r.ok) { console.error(JSON.stringify(j, null, 1).slice(0, 3000)); process.exit(1); }
  if (j.issues && j.issues.length) console.log('issues:', JSON.stringify(j.issues).slice(0, 2000));
  let bad = 0;
  (j.testResults || []).forEach((t, i) => {
    const ok = t.state === 'SUCCESS';
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${C[i][0]} (${C[i][6]})${ok ? '' : ' ' + JSON.stringify(t.debugMessages || t.errorPosition || '')}`);
  });
  console.log(`${C.length - bad}/${C.length} passed`);
  process.exit(bad ? 1 : 0);
})();
