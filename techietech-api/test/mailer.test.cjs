// node techietech-api/test/mailer.test.cjs - the mail rules, without Firestore: one a day, welcome first, choices, off,
// stories only for followers (unless sent to everyone), Shabbat and night hours. Needs the API's node_modules.
const assert = require('assert');
const { plan, sendingHours } = require('../mailer');

const H = 3600e3;
const at = (iso) => Date.parse(iso);                     // Israel is UTC+2 in November
const now = at('2026-11-05T10:00:00Z');                  // Thursday 12:00 in Israel
const cfg = { on: true };
const u = (uid, extra = {}) => ({ uid, email: uid + '@x.com', name: uid, ...extra });
const ev = (id, kind, hoursAgo, extra = {}) => ({ id, kind, t: now - hoursAgo * H, ...extra });
const events = [ev('game_a', 'game', 3), ev('video_b', 'video', 2), ev('story_c', 'story', 1, { char: 'hani', everyone: false })];
const welcomed = { welcomed: now - 70 * H, last: now - 70 * H };   // the news waits 3 days after the last mail (NEWS_GAP)

const r = (users, state, follows = {}, evs = events, c = cfg) => Object.fromEntries(plan({ users, state, follows, events: evs, now, cfg: c }).map((p) => [p.uid, p]));

// a new account gets the welcome first - and only the welcome
let out = r([u('new')], {});
assert.equal(out.new.kind, 'welcome');
assert.equal(out.new.events.length, 0);

// welcomed yesterday, three things happened today: ONE mail with all it may see (the story is not for a non-follower)
out = r([u('a')], { a: welcomed });
assert.equal(out.a.kind, 'digest');
assert.deepEqual(out.a.events.map((e) => e.id), ['game_a', 'video_b']);

// a follower of Hani sees her story too
out = r([u('a')], { a: welcomed }, { a: ['hani'] });
assert.deepEqual(out.a.events.map((e) => e.id), ['game_a', 'video_b', 'story_c']);

// a story sent to everyone reaches everyone
out = r([u('a')], { a: welcomed }, {}, [ev('story_d', 'story', 1, { char: 'yotam', everyone: true })]);
assert.equal(out.a.kind, 'story');

// already mailed today (even 3 hours ago, or late last night < 20h) -> nothing
assert.equal(r([u('a')], { a: { welcomed: now - 50 * H, last: now - 3 * H } }).a, undefined);
assert.equal(r([u('a')], { a: { welcomed: now - 50 * H, last: now - 14 * H } }).a, undefined);

// the welcome was today -> the news waits for tomorrow
assert.equal(r([u('a')], { a: { welcomed: now - 2 * H, last: now - 2 * H } }).a, undefined);

// a story posted just before someone's welcome still reaches them with their first news (the welcome sets the cursor 3 days back)
out = r([u('a')], { a: { welcomed: now - 70 * H, last: now - 70 * H, cursor: now - 70 * H - 3 * 24 * H } }, {}, [ev('story_e', 'story', 74, { char: 'yotam', everyone: true })]);
assert.equal(out.a.kind, 'story');

// news at most once in 3 days (2026-11-08): news 2 days ago -> nothing today, even with new things; 3 days -> all of it in one digest
assert.equal(r([u('a')], { a: { ...welcomed, newsAt: now - 48 * H, last: now - 48 * H, cursor: now - 48 * H } }).a, undefined);
out = r([u('a')], { a: { ...welcomed, newsAt: now - 70 * H, last: now - 70 * H, cursor: now - 70 * H } });
assert.equal(out.a.kind, 'digest');
assert.deepEqual(out.a.events.map((e) => e.id), ['game_a', 'video_b']);
// a personal mail yesterday (an idea step - not news) doesn't push the news back
out = r([u('a')], { a: { ...welcomed, newsAt: now - 80 * H, last: now - 22 * H, cursor: now - 80 * H } });
assert.equal(out.a.kind, 'digest');

// stopped everything -> never; even before the welcome
assert.equal(r([u('a')], { a: { ...welcomed, off: true } }).a, undefined);
assert.equal(r([u('a')], { a: { off: true } }).a, undefined);

// chose games only
out = r([u('a')], { a: { ...welcomed, prefs: { story: false, video: false, game: true } } });
assert.equal(out.a.kind, 'game');

// nothing new since the last mail -> nothing (no mail "just because")
assert.equal(r([u('a')], { a: { ...welcomed, cursor: now - 0.5 * H } }).a, undefined);

// old news (over a week) is not news
assert.equal(r([u('a')], { a: { welcomed: now - 20 * 24 * H, last: now - 20 * 24 * H } }, {}, [ev('game_old', 'game', 8 * 24)]).a, undefined);

// the switch off: only the addresses in `only`
out = r([u('a'), u('shlomi', { email: 'Shlomi@BoostArt.io' })], {}, {}, events, { on: false, only: ['shlomi@boostart.io'] });
assert.deepEqual(Object.keys(out), ['shlomi']);

// hours: no mail on Shabbat, none at night
assert.equal(sendingHours(at('2026-11-05T10:00:00Z')), true);    // Thu 12:00
assert.equal(sendingHours(at('2026-11-06T13:00:00Z')), false);   // Fri 15:00
assert.equal(sendingHours(at('2026-11-07T12:00:00Z')), false);   // Sat 14:00
assert.equal(sendingHours(at('2026-11-07T18:30:00Z')), true);    // Sat 20:30
assert.equal(sendingHours(at('2026-11-05T21:00:00Z')), false);   // Thu 23:00
assert.equal(sendingHours(at('2026-11-05T06:00:00Z')), false);   // Thu 08:00

// the embassy's letter (2026-11-08): only once the release switches it on; the day after the welcome, before the news; once;
// never to a citizen; the welcome still comes first; one a day still holds
const czCfg = { on: true, cz: true };
const P = (users, state, citizens = new Set(), c = czCfg) => Object.fromEntries(plan({ users, state, follows: {}, events, now, cfg: c, citizens }).map((p) => [p.uid, p]));
assert.equal(r([u('a')], { a: welcomed }).a.kind, 'digest');                                  // switch off: the news as before
out = P([u('a'), u('b'), u('c'), u('new'), u('today')], { a: welcomed, b: welcomed, c: { ...welcomed, cz: now - 50 * H }, today: { ...welcomed, last: now - 2 * H } }, new Set(['b']));
assert.equal(out.a.kind, 'citizen');                                                         // before the day's news
assert.equal(out.a.events.length, 0);
assert.equal(out.b.kind, 'digest');                                                          // a citizen: never
assert.equal(out.c.kind, 'digest');                                                          // had it: never again
assert.equal(out.new.kind, 'welcome');                                                       // the welcome first
assert.equal(out.today, undefined);                                                          // mailed today: nothing
console.log('mailer rules: all passed');
