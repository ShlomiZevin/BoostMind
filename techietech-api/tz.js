// ציפציפ (shlomiverse.com/tziftzif) + חרדות (shlomiverse.com/charadot) - the residents' own X and the verse's news channel
// (his ideas 2026-11-08, Mind #z7qpxx; built BESIDE the verse at his ask, connected to the main site later).
// His calls on the engine (2026-11-08): like real Twitter it is MAINLY news - politics and current affairs (their own lives
// are in the verse already); posts go up by themselves and visitors report what offends -> it pops up to him; every
// resident posts, the loved / relevant ones more - and WHO posts is an algorithm in code, not the AI; stories may run
// over days but life stays regular, something big only once in a while; each site's AI spend on its own key.
// - The residents post short posts, reply to and quote each other: about the day's real news (the news sites' RSS) and
//   about what חרדות (the verse's news channel, ח24 - fear, clickbait, a reality show of disasters) made of it. Visitors
//   read, stamp a post with its writer's catchphrase, reply (tagging @<id> brings that resident's answer, verseTzOnPost)
//   and report.
// - The engine runs 3 times a day (verseTzRun): the headlines -> `candidates()` weighs every resident (loved = videos,
//   his stars, how visitors reacted to their posts; minus who posted lately; spread over worlds) and draws ~10 -> one
//   small call checks for a bad day (a terror attack, a disaster, national mourning: the whole day stays SILENT - his
//   rule) and matches headlines to candidates -> ח24 writes its articles (its own key) -> the residents' posts are
//   written in each one's voice (their profile from the chat's brain) -> they go live spread over the hours until the
//   next run, so the timeline moves all day for the price of 3 runs.
// - Until `open` (verseMeta/tz) only his account reads anything - the pages show "soon" to everyone else.
// Data (Firestore): tzPosts, tzArticles, tzRuns, tzStamps, tzReports, verseMeta/tz; pictures in gs://shlomiverse-media/tz/.
// Keys (OpenAI project "Shlomiverse", Backstage → הוצאות shows each): VERSE_TZ_OPENAI_KEY (shlomiverse-tziftzif) for the
// posts, answers and moderation; VERSE_CH24_OPENAI_KEY (shlomiverse-charadot) for ח24's articles and pictures.
// Pages: public/tziftzif/, public/charadot/.
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('crypto');
const webpush = require('web-push');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const bundled = require('./wiki-brain.json');

if (!admin.apps.length) admin.initializeApp();
const db = () => admin.firestore();
const LOCAL = !!process.env.FUNCTIONS_EMULATOR;
const TZ_KEY = defineSecret('VERSE_TZ_OPENAI_KEY');
const CH_KEY = defineSecret('VERSE_CH24_OPENAI_KEY');
const VAPID_PRIVATE = defineSecret('VERSE_VAPID_PRIVATE');
const SECRETS = LOCAL ? [] : [TZ_KEY, CH_KEY, VAPID_PRIVATE];   // locally the emulator never asks Secret Manager
const tzKey = () => (LOCAL ? process.env.VERSE_OPENAI_KEY : TZ_KEY.value());
const chKey = () => (LOCAL ? process.env.VERSE_OPENAI_KEY : CH_KEY.value());
const VAPID_PUBLIC = 'BApNz6a4ZuFrPgaIEHGY9rvyKkwIvrJPsRjH0k01QYruVT2yz5ce-0fVuuIsk9vyprZ8Gq1nGxXajBL-EMD0hP0';   // as in verse.js
const HIM = 'rJLlCV393shl7njhzWZmoaE15Yp2';   // his account - reports reach his phone
const MODEL = 'gpt-5.6-terra';
const IMG_MODEL = 'gpt-image-2.6-flare';
const MEDIA = 'shlomiverse-media';
const OWNER = 'shlomi@boostart.io';
const CORS = [/^https:\/\/boostmind-b052c(--[\w-]+)?\.web\.app$/, /^https:\/\/(www\.)?shlomiverse\.com$/, /^http:\/\/localhost(:\d+)?$/];
const REPLIES_A_DAY = 10;
const PER_RUN = 10;            // residents drawn as candidates each run (the AI matches them to the news; ~7 posts a run, ~20 a day)
const HIDE_AT = 3;             // reports that take a post off the site until he looks
const BIG_CHANCE = 0.04;       // a run may start a bigger story that develops over days (~once in 8 days) - life stays regular      // a resident's answers to one visitor a day (like the comments' CHARACTER_REPLIES_A_DAY)
const NEWS = 'charadot';       // the news channel's own account
// the news sites the residents read (their RSS - free, no AI): many, both sides of the map, news / economy / culture, and at
// most PER_FEED fresh items from each, so no one paper sets the tone (his note 2026-11-08: "why only Israel Hayom?")
const FEEDS = [
  ['ynet', 'https://www.ynet.co.il/Integration/StoryRss2.xml'],
  ['ynet כלכלה', 'https://www.ynet.co.il/Integration/StoryRss6.xml'],
  ['ynet תרבות', 'https://www.ynet.co.il/Integration/StoryRss538.xml'],
  ['וואלה', 'https://rss.walla.co.il/feed/1'],
  ['N12', 'https://rcs.mako.co.il/rss/news-israel.xml'],
  ['מעריב', 'https://www.maariv.co.il/Rss/RssChadashot'],
  ['הארץ', 'https://www.haaretz.co.il/srv/htz---all-articles'],
  ['TheMarker', 'https://www.themarker.com/srv/tm-all-articles'],
  ['ישראל היום', 'https://www.israelhayom.co.il/rss.xml'],
  ['גלובס', 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=2'],
  ['דבר', 'https://www.davar1.co.il/feed/'],
  ['סרוגים', 'https://www.srugim.co.il/feed'],
  ['ice', 'https://www.ice.co.il/rss/'],
  ['זמן ישראל', 'https://www.zman.co.il/feed/'],
];
const PER_FEED = 4;
// the loved / central residents get more room (his call: "more room to the relevant and loveable, but I want all"); he
// changes the list in Backstage → ציפציפ (verseMeta/tz.stars), and can take anyone out (verseMeta/tz.off)
const STARS = ['hani', 'yotam', 'demokratovich', 'rosenblum', 'avram', 'genz', 'gilad', 'osnat', 'vova', 'nahor', 'dorit', 'ayelet',
  'miriam', 'savta', 'taxi-driver', 'news-anchor', 'yudit', 'daniel', 'neighbor'];
// impressions of real people go by a verse name and handle on ציפציפ - never the real name (his rule 2026-11-08: "find a
// different name for every impression"; a first pass - he improves them in verseMeta/tz.aliases, which wins over these)
const ALIASES = {
  bennett: { name: 'נפתלי בנטל', handle: 'bentel' },
  feiglin: { name: 'משה פייגלייט', handle: 'feiglight' },
  eisenkot: { name: 'גדי איזהקוט', handle: 'eizekot' },
  'yinon-magal': { name: 'ינון מגלגל', handle: 'megalgel' },
  'yotam-zamri': { name: 'יותם זעמרי', handle: 'zaamri' },
  'dor-eckstein': { name: 'דור אקסטרים', handle: 'dor_extreme' },
  matan: { name: 'מתן ניסטרדמוס', handle: 'nistradamus' },
  'danny-buller': { name: 'דני מבולבלר', handle: 'mevulbaler' },
  'alex-daniel': { name: 'אלכס זוגניאל', handle: 'zugniel' },
  'naor-zion': { name: 'נאור עצבון', handle: 'atzbon' },
  'avi-shushan': { name: 'אבי שוש-און', handle: 'shush_on' },
  hatzroni: { name: 'פרופסור מעלוני', handle: 'prof_maaloni' },
  'mordechai-david': { name: 'מרדכי חוסם', handle: 'hosem' },
  'neve-dromi': { name: 'נווה צפוני', handle: 'neve_tzfoni' },
  oded: { name: 'עודד קלישאש', handle: 'klishash' },
  alon: { name: 'אלון טיפון', handle: 'tifun' },
  'omer-koli': { name: 'עומר קוליטוב', handle: 'kolitov' },
};
// children post rarely (and never about politics - the writing rules)
const KIDS = ['sruli', 'feigy', 'shterni', 'brachi', 'chaimi', 'yanky', 'ruchami', 'malki', 'shloimi', 'nephew', 'teen', 'omer-student'];
const DEFAULTS = { open: false, auto: true, img: true, silent: null, stars: STARS, off: ['shloimi'], arc: null, aliases: {} };
let AL = ALIASES;   // the aliases in force (ALIASES + his changes), set by config()

const day = (t = Date.now()) => new Date(t + 2 * 3600e3).toISOString().slice(0, 10);   // Israel's date (close enough all year)
const clip = (s, n) => String(s ?? '').trim().slice(0, n);
const short = (s, n) => { s = Array.isArray(s) ? s.join(' · ') : String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; };
const newId = () => crypto.randomBytes(9).toString('base64url').replace(/[-_]/g, '').slice(0, 12).toLowerCase();
const ms = (t) => (t && t.toMillis ? t.toMillis() : t || 0);
const meta = () => db().collection('verseMeta').doc('tz');
async function config() { const d = (await meta().get()).data() || {}; const c = { ...DEFAULTS, ...d }; AL = { ...ALIASES, ...(c.aliases || {}) }; return c; }
const nameOf = (c) => (AL[c.id] && AL[c.id].name) || c.name;

// the characters, from the same brain as the chat (gs://shlomiverse-private/wiki-brain.json, looked at every 3 minutes)
let brain = bundled, brainMd5 = 'bundled', checked = 0;
async function brainNow() {
  if (LOCAL || Date.now() - checked < 180e3) return brain;
  checked = Date.now();
  try {
    const f = admin.storage().bucket('shlomiverse-private').file('wiki-brain.json');
    const [m] = await f.getMetadata();
    if (m.md5Hash !== brainMd5) { const [buf] = await f.download(); brain = JSON.parse(buf.toString('utf8')); brainMd5 = m.md5Hash; }
  } catch (e) { console.error('tz brain', e.message); }
  return brain;
}
const byId = (b) => Object.fromEntries(b.characters.map((c) => [c.id, c]));
// one line per resident for the picking call (fixed text, so OpenAI's cache serves it run after run)
const rosterLine = (c) => `${c.id} | ${nameOf(c)} | ${c.world} | ${short(c.role, 90)} | ${short((c.relations || []).map((r) => (typeof r === 'string' ? r : `${r.id || r.name}: ${r.rel || r.relation || ''}`)), 140)}`;
// the full voice of a resident for the writing call
const voice = (c) => [`### ${c.id} - ${nameOf(c)} (${c.world}) - ${short(c.role, 120)}`, ...(AL[c.id] ? [`ON ציפציפ THIS RESIDENT IS CALLED "${AL[c.id].name}" - never write the original name "${c.name}", not even in other residents' posts`] : []),
  `personality: ${short(c.personality, 400)}`, `catchphrases: ${short(c.catchphrases, 200)}`, `speech: ${short(c.speech, 500)}`,
  `writing rules: ${short(c.writing_rules, 450)}`, `never: ${short(c.dont, 300)}`,
  `relations: ${short((c.relations || []).map((r) => (typeof r === 'string' ? r : `${r.id || r.name}: ${r.rel || r.relation || ''}`)), 300)}`].join('\n');

// ---------- OpenAI ----------
async function ask(k, instructions, input, schema, name, effort = 'low', max = 2400) {
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { authorization: `Bearer ${k}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, instructions, input, reasoning: { effort }, max_output_tokens: max, store: false,
      prompt_cache_key: 'tz-' + name, text: { format: { type: 'json_schema', name, strict: true, schema } } }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`openai ${r.status} ${j.error?.message || ''}`);
  const text = (j.output || []).flatMap((o) => o.content || []).find((c) => c.type === 'output_text')?.text || '';
  const u = j.usage || {};
  return { out: JSON.parse(text), u: [u.input_tokens || 0, u.input_tokens_details?.cached_tokens || 0, u.output_tokens || 0] };
}
const S = (props) => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props });
const str = { type: 'string' }, int = { type: 'integer' }, bool = { type: 'boolean' };
const arr = (items, min, max) => ({ type: 'array', items, ...(min != null ? { minItems: min } : {}), ...(max != null ? { maxItems: max } : {}) });

async function moderate(text) {
  try {
    const r = await fetch('https://api.openai.com/v1/moderations', { method: 'POST', headers: { authorization: `Bearer ${tzKey()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: text }) });
    if (!r.ok) throw new Error('moderation ' + r.status);
    return { ok: !(await r.json()).results[0].flagged };
  } catch (e) { console.error('tz moderate', e.message); return { ok: true, unchecked: true }; }
}

// ---------- the news (RSS) ----------
const unxml = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const tag = (item, name) => { const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(item); return m ? unxml(m[1]) : ''; };
async function headlines(hours = 10) {
  const since = Date.now() - hours * 3600e3, out = [];
  await Promise.all(FEEDS.map(async ([src, url]) => {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Shlomiverse news reader)' }, signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error(String(r.status));
      const xml = await r.text();
      let n = 0;
      for (const it of (xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []).slice(0, 25)) {
        if (n >= PER_FEED) break;
        const title = tag(it, 'title'), link = tag(it, 'link') || tag(it, 'guid'), when = Date.parse(tag(it, 'pubDate')) || Date.now();
        // the source's own picture (ynet, Haaretz, Globes send one) - shown on the link card like a link preview
        const img = (/<enclosure[^>]*url="([^"]+)"/i.exec(it) || /<media:(?:content|thumbnail)[^>]*url="([^"]+)"/i.exec(it) || /<img[^>]*src=(?:"|&quot;|')([^"&']+)/i.exec(it) || [])[1];
        if (title && link && when >= since) { out.push({ src, title: clip(title, 200), desc: clip(tag(it, 'description'), 300), url: clip(link, 500), when, img: img && /^https:\/\//.test(img) ? clip(img, 500) : null }); n++; }
      }
    } catch (e) { console.error('tz feed', src, e.message); }
  }));
  return out.sort((a, b) => b.when - a.when).slice(0, 56);
}
// a story whose feed sends no picture (Israel Hayom, N12, Maariv): the picture the article itself shows when shared
// (its og:image) - always that story's own photo
async function ogImage(url) {
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Shlomiverse news reader)' }, signal: AbortSignal.timeout(7000) });
    const html = (await r.text()).slice(0, 300000);
    const m = /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i.exec(html) || /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i.exec(html);
    return m && /^https:\/\//.test(m[1]) ? clip(m[1].replace(/&amp;/g, '&'), 500) : null;
  } catch (e) { return null; }
}

// ---------- the engine ----------
// WHO posts this run - an algorithm, not the AI (his call). Every resident has a weight:
//   loved:   1 + log2(1 + their videos)   x2 for his stars   x(1 + log2(1 + stamps+replies on their posts in 14 days) / 3)
//   rested:  min(1, (hours since their last post + 1) / 12) - who just posted waits; a long silence is fine
//   kids:    x0.25
// and ~10 are drawn by weight without repeating, at most 3 from one world - the AI then matches them to the news.
async function candidates(cfg, C) {
  const off = new Set(cfg.off || []), stars = new Set(cfg.stars || STARS);
  const since = Timestamp.fromMillis(Date.now() - 14 * 864e5);
  const recent = (await db().collection('tzPosts').where('status', '==', 'live').where('t', '>=', since).orderBy('t', 'desc').limit(600).get()).docs.map((d) => d.data());
  const eng = {}, lastAt = {};
  for (const p of recent) {
    if (!p.by || p.fan) continue;
    eng[p.by] = (eng[p.by] || 0) + (p.stamps || 0) + (p.replies || 0);
    lastAt[p.by] = Math.max(lastAt[p.by] || 0, ms(p.t));
  }
  const pool = Object.values(C).filter((c) => !off.has(c.id) && c.id !== NEWS).map((c) => {
    const loved = (1 + Math.log2(1 + (c.videos || []).length)) * (stars.has(c.id) ? 2 : 1) * (1 + Math.log2(1 + (eng[c.id] || 0)) / 3);
    const hours = lastAt[c.id] ? (Date.now() - lastAt[c.id]) / 3600e3 : 999;
    return { c, w: loved * Math.min(1, (hours + 1) / 12) * (KIDS.includes(c.id) ? 0.25 : 1) };
  });
  const out = [], perWorld = {};
  while (out.length < PER_RUN && pool.length) {
    const total = pool.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total, i = 0;
    while (i < pool.length - 1 && (r -= pool[i].w) > 0) i++;
    const [x] = pool.splice(i, 1);
    if ((perWorld[x.c.world] || 0) >= 3) continue;
    perWorld[x.c.world] = (perWorld[x.c.world] || 0) + 1;
    out.push(x.c);
  }
  return out;
}

const PICK_RULES = `You are the editor of "ציפציפ", a social network exactly like X / Twitter that exists inside the Shlomiverse - a comedy universe whose residents are treated as REAL people living in a parallel universe (never call them characters, never a parody). Like real Twitter it is MAINLY about the news: politics and current affairs (אקטואליה), and the residents' takes on them. The verse also has its own TV news channel, "חרדות" (short form ח24): a satire of what news really does - engineering minds, pouring poison, storms, clickbait, rage bait, a reality show of disasters made only to keep people anxious and watching.
Three times a day you get the latest real Israeli headlines and today's CANDIDATES (the residents who may post now). Your job:
1. BAD DAY CHECK - FIRST, ABOVE EVERYTHING: a bad day is a day of national pain: a terror attack (פיגוע), a war event / rocket fire with people killed or wounded, a disaster with people killed (an earthquake, a collapse, a big fire with dead), hostages, a national day of mourning or a funeral of victims of these. Then bad_day = true, items = [] - nobody in the verse posts anything today. When in doubt whether a headline is one of THESE, it is a bad day. Everyday tragedies - a road accident, a fire, a crime, an illness - are NOT a bad day: just never pick them.
2. Otherwise pick 2-3 headlines that Twitter would be talking about right now - politics, the government and the Knesset, the economy and prices, legal and civic affairs, tech, education, transport, culture and sport controversies. Never pick: deaths, crime victims, sexual offences, illness of a named person, minors, anything that could hurt real people.
3. For each headline choose 2-4 of the candidates (only from the candidates list) whose world, job or personality gives them a real take - the obvious one and a surprising one; when two candidates have a relation (family, colleagues, rivals) let them argue. Use each candidate at most once. Leave out candidates who have nothing real to say. article = true when ח24 should turn the headline into a dramatic article (1-2 per run, the juiciest ones).
4. head = the headline's number. angle = one short English line: the take (the resident's own life / worldview against the news).
5. STORY: life in the verse stays regular - no big events. If the input says an ongoing story exists, at most one item may let a resident mention it. If the input says a big story MAY start, you may set new_story to one short English line: something bigger that happens inside the verse and will develop over the next days (realistic for that world, not a disaster) - otherwise new_story = "".`;
const PICK_SCHEMA = S({ bad_day: bool, why: str, items: arr(S({ head: int, angle: str, article: bool, cast: arr(str, 1, 4) }), 0, 3), new_story: str });

const ARTICLE_RULES = `You write for "חרדות" (short form ח24), the TV news channel of the Shlomiverse - a comedy universe treated as real. The channel is a satire of what news really does: engineering minds, pouring poison, storms, clickbait, rage bait, a reality show of disasters made only to keep people anxious and watching.
It must be FUNNY: over-the-top hysteria about ordinary news - doomsday words, a countdown, "פאניקה", "הלם", rhetorical questions that answer nothing, a panel of experts who agree it's the end, a hint that you should keep watching; the more ordinary the news, the bigger the drama.
For each real headline write: headline - sensational, clickbait, fear ("האם זה הסוף?", "דרמה", "סערה", "בלעדי", "הישארו איתנו"), at most 90 characters; sub - one sub-headline line; body - 3 short paragraphs that inflate the story into a looming disaster, quote anonymous "בכירים" and "מומחים", reveal nothing new and end on a cliffhanger; tag - one Hebrew section word (פוליטיקה, כלכלה, צרכנות, טכנולוגיה, חינוך, תחבורה, תרבות, ספורט, מזג אוויר); post - the channel's own post about the article on ציפציפ: one dramatic line, like a breaking-news tweet.
The FACTS stay the headline's - only the tone is inflated. Never invent a quote, an action or a private detail of a real person; no insults about religion, origin, gender or body. Hebrew, no emoji, no hashtags.`;
const ARTICLE_SCHEMA = S({ articles: arr(S({ headline: str, sub: str, body: arr(str, 2, 4), tag: str, post: str })) });

const POST_RULES = `You write posts for "ציפציפ", the Shlomiverse's own social network - exactly like X / Twitter, and like Twitter mostly about the news. The Shlomiverse is a comedy universe whose residents are REAL people living in a parallel universe: write them as real people posting from their phone, never as characters; never mention a parody, AI, a script or Shlomi.
POSTS: Hebrew, short like real tweets (one to three short lines, at most 240 characters), in the resident's OWN voice - their speech, catchphrases (sparingly, not in every post), world and relations from their profile below. Each takes the news through their own life and worldview: a hot take, a complaint, sarcasm, a "back in my day", a professional opinion, an argument. Funny through their point of view, never by explaining the joke. ALWAYS HEBREW - even a resident who lectures in English or mixes English writes in Hebrew here, at most a single English word. No hashtags, no emoji. Each post a different rhythm - never two opening the same way.
REAL PEOPLE IN THE NEWS: facts only from the headline; never invent a quote, an action or a private detail about a real person; the opinions and jokes are the resident's own. A resident who is an impression of a real public figure speaks only in opinions and jokes in that figure's style - never announces a concrete fact or decision as if it happened. No insults about religion, origin, gender or body. Children never talk about politics.
NAMES: residents are called only by the names given in their profiles here (some go by a verse name - never use the original one).
STRUCTURE per item, in order: reply_to = -1 for a post of its own, or the index (in this item's posts list) of an earlier post it answers - residents with a relation reply to each other. quote = "article" when the post quotes ח24's post about the item (only when the item has an article), else "none". link = true when the post shares the real news link (at most once per item, never on a reply).`;
const POST_SCHEMA = S({ items: arr(S({ posts: arr(S({ by: str, text: str, reply_to: int, quote: { type: 'string', enum: ['article', 'none'] }, link: bool }), 1, 5) })) });

async function run(slot = 'manual') {
  const cfg = await config(), today = day(), runRef = db().collection('tzRuns').doc();
  const log = { at: FieldValue.serverTimestamp(), slot, day: today, u: [0, 0, 0], uCh: [0, 0, 0], made: 0 };
  if (cfg.silent === today) { await runRef.set({ ...log, skipped: 'silent' }); return { silent: true }; }
  const heads = await headlines();
  // a headline the residents already reacted to in the last runs is not news any more
  const recent = await db().collection('tzRuns').orderBy('at', 'desc').limit(6).get();
  const used = new Set(recent.docs.flatMap((d) => d.data().used || []));
  const fresh = heads.filter((h) => !used.has(h.url)).slice(0, 40);
  const b = await brainNow(), C = byId(b);
  const cands = await candidates(cfg, C), candIds = new Set(cands.map((c) => c.id));
  const last = await db().collection('tzPosts').where('status', '==', 'live').orderBy('t', 'desc').limit(20).get();
  const lastLines = last.docs.map((d) => d.data()).filter((p) => !p.fan && p.by !== NEWS).map((p) => `${p.by}: ${clip(p.text, 120)}`);
  const now = new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
  const arc = cfg.arc && cfg.arc.until > Date.now() ? cfg.arc : null, mayStart = !arc && Math.random() < BIG_CHANCE;

  const pick = await ask(tzKey(), PICK_RULES, [{ role: 'user', content: `Now (Israel): ${now}.
LATEST HEADLINES:
${fresh.map((h, i) => `${i}. [${h.src}] ${h.title}${h.desc ? ' - ' + clip(h.desc, 160) : ''}`).join('\n') || '(none)'}

CANDIDATES (id | name | world | role | relations):
${cands.map(rosterLine).join('\n')}

POSTED IN THE LAST RUNS (don't repeat a take):
${lastLines.join('\n') || '(nothing yet)'}

STORY: ${arc ? `ongoing story in the verse (since ${day(arc.at)}): ${arc.text}` : mayStart ? 'a big story MAY start this run (optional).' : 'no ongoing story; keep life regular.'}` }],
    PICK_SCHEMA, 'pick', 'medium', 1500);
  log.u = pick.u.slice();
  if (pick.out.bad_day) {
    await meta().set({ silent: today, silentWhy: clip(pick.out.why, 300), silentAt: FieldValue.serverTimestamp() }, { merge: true });
    await runRef.set({ ...log, bad: true, why: clip(pick.out.why, 300), heads: fresh.length });
    return { bad: true, why: pick.out.why };
  }
  if (mayStart && clip(pick.out.new_story, 1)) await meta().set({ arc: { text: clip(pick.out.new_story, 300), at: Date.now(), until: Date.now() + 4 * 864e5 } }, { merge: true });
  const items = pick.out.items.map((it) => ({ ...it, h: fresh[it.head], cast: [...new Set(it.cast)].filter((id) => candIds.has(id)) })).filter((it) => it.h && it.cast.length);
  if (!items.length) { await runRef.set({ ...log, heads: fresh.length, cands: [...candIds], why: clip(pick.out.why, 300), made: 0 }); return { made: 0 }; }

  // every chosen story gets its own picture (its feed's, else the article page's og:image)
  await Promise.all(items.filter((it) => !it.h.img).map(async (it) => { it.h.img = await ogImage(it.h.url); }));
  // ח24's articles first (its own key), so the residents can quote the channel
  const withArt = items.filter((it) => it.article).slice(0, 2);
  if (withArt.length) {
    const art = await ask(chKey(), ARTICLE_RULES, [{ role: 'user', content: withArt.map((it, i) => `${i}. [${it.h.src}] ${it.h.title}${it.h.desc ? ' - ' + it.h.desc : ''}`).join('\n') }],
      ARTICLE_SCHEMA, 'article', 'low', 3000);
    log.uCh = art.u.slice();
    withArt.forEach((it, i) => { it.art = art.out.articles[i] || null; });
  }
  const who = [...new Set(items.flatMap((it) => it.cast))];
  const write = await ask(tzKey(), POST_RULES, [{ role: 'user', content: `THE RESIDENTS WHO POST NOW:\n${who.map((id) => voice(C[id])).join('\n\n')}\n\nITEMS:\n${items.map((it, i) =>
    `${i}. REAL HEADLINE [${it.h.src}]: ${it.h.title}${it.h.desc ? ' - ' + it.h.desc : ''}\n   take: ${it.angle}\n   who posts: ${it.cast.join(', ')}\n   ח24's post about it: ${it.art ? it.art.post : '(no article)'}`).join('\n')}${arc ? `\n\nONGOING STORY in the verse (one resident may mention it in passing): ${arc.text}` : ''}` }],
    POST_SCHEMA, 'write', 'medium', 3500);
  write.u.forEach((n, i) => { log.u[i] += n; });

  const out = await save(items, write.out.items, { run: runRef.id });
  log.made = out.posts.length;
  if (out.dropped.length || write.out.items.length !== items.length) console.error('tz dropped', JSON.stringify({ dropped: out.dropped, items: items.length, written: write.out.items.length, cast: items.map((it) => it.cast) }));
  await runRef.set({ ...log, dropped: out.dropped, written: write.out.items.length, heads: fresh.length, cands: [...candIds], why: clip(pick.out.why, 300), used: items.map((it) => it.h.url), articles: out.articles.map((a) => a.id), posts: out.posts.map((p) => p.id) });
  // every article gets its picture (1-2 a run, low quality, on ח24's key) - an article without one looked broken (his note)
  if (cfg.img) await Promise.all(out.articles.map((a) => picture(a).catch((e) => console.error('tz picture', e.message))));
  if (cfg.auto) await publish(out.posts.map((p) => p.id), out.articles.map((a) => a.id), spread(slot));
  return { made: out.posts.length, articles: out.articles.length, run: runRef.id };
}
// how long a run's posts take to go up: until the next run (morning -> noon, noon -> evening), the evening's until ~23:00
const spread = (slot) => (slot === 'morning' ? 4.5 : slot === 'noon' ? 5.5 : slot === 'evening' ? 3.5 : 0.5) * 3600e3;

// the drafts of one run: ח24's article + its post first, then the residents' posts in their order (a reply after its parent)
async function save(items, written, { run }) {
  const posts = [], articles = [], dropped = [], batch = db().batch(), made = FieldValue.serverTimestamp();
  let order = 0;
  items.forEach((it, i) => {
    const w = written[i] || { posts: [] }, allowed = new Set(it.cast);
    const link = { url: it.h.url, title: it.h.title, src: it.h.src, img: it.h.img || null };
    let newsPost = null;
    if (it.art && it.art.headline) {
      const a = { id: newId(), headline: clip(it.art.headline, 160), sub: clip(it.art.sub, 260), body: (it.art.body || []).map((p) => clip(p, 900)).filter(Boolean),
        tag: clip(it.art.tag, 20), kind: 'real', src: link, img: null, status: 'draft', t: null, made, run };
      newsPost = { id: newId(), by: NEWS, text: clip(it.art.post || a.headline, 280), parent: null, quote: null, article: a.id, link: null, status: 'draft', t: null, made, run, order: order++, replies: 0, stamps: 0, quotes: 0 };
      newsPost.root = newsPost.id;
      a.post = newsPost.id;
      articles.push(a); posts.push(newsPost);
    }
    const mine = [];
    (w.posts || []).forEach((p, k) => {
      if (!allowed.has(p.by) || !clip(p.text, 1)) { dropped.push(`${i}:${clip(p.by, 30)}`); mine.push(null); return; }
      const parent = p.reply_to >= 0 && p.reply_to < k ? mine[p.reply_to] : null;
      const doc = { id: newId(), by: p.by, text: clip(p.text, 280), parent: parent ? parent.id : null, quote: !parent && p.quote === 'article' && newsPost ? newsPost.id : null,
        article: null, link: !parent && p.link ? link : null, status: 'draft', t: null, made, run, order: order++, replies: 0, stamps: 0, quotes: 0 };
      doc.root = parent ? parent.root : doc.id;
      mine.push(doc); posts.push(doc);
    });
  });
  for (const a of articles) batch.set(db().collection('tzArticles').doc(a.id), a);
  for (const p of posts) batch.set(db().collection('tzPosts').doc(p.id), p);
  await batch.commit();
  return { posts, articles, dropped };
}

async function picture(a) {
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST', headers: { authorization: `Bearer ${chKey()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: IMG_MODEL, size: '1536x1024', quality: 'low', n: 1, output_format: 'jpeg',
      prompt: `A dramatic TV-news style photo illustration for this headline of a sensational news channel: "${a.headline}". ${a.sub}
Cinematic, moody, slightly over-dramatic like breaking-news b-roll. No text, no letters, no logos, no captions. No real or identifiable people - only anonymous figures from behind or far away, objects and places.` }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`image ${r.status} ${j.error?.message || ''}`);
  const path = `tz/${a.id}.jpg`;
  await admin.storage().bucket(MEDIA).file(path).save(Buffer.from(j.data[0].b64_json, 'base64'), { contentType: 'image/jpeg', resumable: false, metadata: { cacheControl: 'public, max-age=31536000' } });
  const url = `https://storage.googleapis.com/${MEDIA}/${path}`;
  await db().collection('tzArticles').doc(a.id).update({ img: url });
  return url;
}

// going live: the posts appear one after the other (a few minutes apart, in their order) so the timeline unfolds; the
// counts on the parents / quoted posts go up as they do
async function publish(postIds = [], articleIds = [], span = 0) {
  if ((await config()).silent === day()) return { error: 'silent' };
  const P = db().collection('tzPosts'), A = db().collection('tzArticles');
  const docs = (await Promise.all(postIds.map((id) => P.doc(id).get()))).filter((d) => d.exists && d.data().status === 'draft').map((d) => d.data())
    .sort((a, b) => ms(a.made) - ms(b.made) || a.order - b.order);
  // spread over `span` (the run's window) with a little jitter, never closer than 2 minutes; by hand (span 0) 4 minutes apart
  const now = Date.now(), batch = db().batch(), gap = docs.length > 1 && span ? Math.max(2 * 60e3, span / docs.length) : 4 * 60e3;
  docs.forEach((p, i) => {
    const at = now + i * gap + (i && span ? Math.round((Math.random() - 0.5) * gap * 0.5) : 0);
    batch.update(P.doc(p.id), { status: 'live', t: Timestamp.fromMillis(at) });
    if (p.parent) batch.update(P.doc(p.parent), { replies: FieldValue.increment(1) });
    if (p.quote) batch.update(P.doc(p.quote), { quotes: FieldValue.increment(1) });
  });
  const arts = (await Promise.all(articleIds.map((id) => A.doc(id).get()))).filter((d) => d.exists && d.data().status === 'draft');
  arts.forEach((d) => batch.update(d.ref, { status: 'live', t: Timestamp.fromMillis(now) }));
  await batch.commit();
  return { ok: true, posts: docs.length, articles: arts.length };
}

// ---------- what the pages read ----------
const pub = (p) => ({ id: p.id, by: p.by, fan: p.fan || null, text: p.text, parent: p.parent, root: p.root, quote: p.quote || null, article: p.article || null,
  link: p.link || null, t: ms(p.t), replies: p.replies || 0, stamps: p.stamps || 0, quotes: p.quotes || 0 });
const pubArt = (a, full) => ({ id: a.id, headline: a.headline, sub: a.sub, tag: a.tag, kind: a.kind, src: a.src || null, img: a.img || null, t: ms(a.t), post: a.post || null, ...(full ? { body: a.body || [] } : {}) });
const liveNow = (q) => q.where('status', '==', 'live').where('t', '<=', Timestamp.now()).orderBy('t', 'desc');
async function quoted(list) {
  const ids = [...new Set(list.map((p) => p.quote).filter(Boolean))].filter((id) => !list.some((p) => p.id === id));
  if (!ids.length) return {};
  const got = await db().getAll(...ids.map((id) => db().collection('tzPosts').doc(id)));
  return Object.fromEntries(got.filter((d) => d.exists && d.data().status === 'live').map((d) => [d.id, pub(d.data())]));
}
async function articlesOf(list) {
  const ids = [...new Set(list.map((p) => p.article).filter(Boolean))];
  if (!ids.length) return {};
  const got = await db().getAll(...ids.map((id) => db().collection('tzArticles').doc(id)));
  return Object.fromEntries(got.filter((d) => d.exists).map((d) => [d.id, pubArt(d.data())]));
}
async function mine(uid, list) {
  if (!uid || !list.length) return [];
  const got = await db().getAll(...list.map((p) => db().collection('tzStamps').doc(`${p.id}_${uid}`)));
  return got.filter((d) => d.exists).map((d) => d.data().post);
}
// the timeline: the residents' top posts, newest first, each with up to two of the residents' replies hanging under it
async function feed(uid, before) {
  let q = liveNow(db().collection('tzPosts')).limit(150);
  if (before) q = q.where('t', '<', Timestamp.fromMillis(+before));
  const all = (await q.get()).docs.map((d) => pub(d.data()));
  const tops = all.filter((p) => !p.parent && !p.fan).slice(0, 30), topIds = new Set(tops.map((p) => p.id));
  const under = {};
  [...all].reverse().forEach((p) => { if (p.parent && !p.fan && topIds.has(p.root) && (under[p.root] || []).length < 2) (under[p.root] = under[p.root] || []).push(p); });
  const shown = [...tops, ...Object.values(under).flat()];
  return { posts: tops.map((p) => ({ ...p, under: under[p.id] || [] })), quoted: await quoted(shown), articles: await articlesOf(shown), stamped: await mine(uid, shown),
    more: tops.length === 30 ? tops[tops.length - 1].t : null };
}
async function thread(uid, id) {
  const d = await db().collection('tzPosts').doc(clip(id, 20)).get();
  if (!d.exists || d.data().status !== 'live') return { error: 'gone' };
  const p = pub(d.data());
  const all = (await db().collection('tzPosts').where('root', '==', p.root).where('status', '==', 'live').get()).docs.map((x) => pub(x.data()))
    .filter((x) => x.t <= Date.now()).sort((a, b) => a.t - b.t);
  const list = all.some((x) => x.id === p.id) ? all : [p, ...all];
  return { post: p, thread: list, quoted: await quoted(list), articles: await articlesOf(list), stamped: await mine(uid, list) };
}
async function resident(uid, char, before) {
  let q = liveNow(db().collection('tzPosts').where('by', '==', clip(char, 30))).limit(40);
  if (before) q = q.where('t', '<', Timestamp.fromMillis(+before));
  const list = (await q.get()).docs.map((d) => pub(d.data())).filter((p) => !p.fan);
  return { posts: list, quoted: await quoted(list), articles: await articlesOf(list), stamped: await mine(uid, list), more: list.length === 40 ? list[list.length - 1].t : null };
}
// the verse's home page module (the Shlomiverse Conversion session designs it): ח24's newest article + the newest top
// posts, and `quiet` when nothing came today (a silent day, or no run yet) - so the home says "מהימים האחרונים"
async function home(cfg) {
  const [arts, all] = await Promise.all([liveNow(db().collection('tzArticles')).limit(1).get(), liveNow(db().collection('tzPosts')).limit(40).get()]);
  const tops = all.docs.map((d) => pub(d.data())).filter((p) => !p.parent && !p.fan).slice(0, 5);
  const q = await quoted(tops), startToday = Date.parse(day() + 'T00:00:00+02:00');
  return { lead: arts.docs[0] ? pubArt(arts.docs[0].data()) : null,
    posts: tops.map((p) => ({ id: p.id, by: p.by, text: p.text, t: p.t, stamps: p.stamps, replies: p.replies, article: p.article, quote: p.quote && q[p.quote] ? { id: p.quote, by: q[p.quote].by, text: q[p.quote].text } : null })),
    silent: cfg.silent === day(), quiet: cfg.silent === day() || !tops.length || tops[0].t < startToday,
    // the verse names of the impressions it shows (id -> {name, handle}, like op=me), so the home needs one call
    names: Object.fromEntries([...new Set(tops.flatMap((p) => [p.by, p.quote && q[p.quote] && q[p.quote].by]))].filter((id) => id && AL[id]).map((id) => [id, AL[id]])) };
}
async function front() {
  const list = (await liveNow(db().collection('tzArticles')).limit(30).get()).docs.map((d) => pubArt(d.data()));
  return { articles: list };
}
async function article(id) {
  const d = await db().collection('tzArticles').doc(clip(id, 20)).get();
  if (!d.exists || d.data().status !== 'live') return { error: 'gone' };
  const a = pubArt(d.data(), true);
  // the residents' reactions: the posts that quote the channel's post about it, and the replies to it
  const R = a.post ? (await db().collection('tzPosts').where('status', '==', 'live').where('t', '<=', Timestamp.now()).orderBy('t', 'desc').limit(150).get()).docs.map((x) => pub(x.data()))
    .filter((p) => !p.fan && (p.quote === a.post || p.parent === a.post)) : [];
  const more = (await liveNow(db().collection('tzArticles')).limit(8).get()).docs.map((x) => pubArt(x.data())).filter((x) => x.id !== a.id).slice(0, 6);
  return { article: a, reactions: R.reverse(), more };
}

// ---------- what visitors do ----------
async function fanOf(user) {
  const f = (await db().collection('fans').doc(user.uid).get()).data() || {};
  return { uid: user.uid, nick: clip(f.nick || (user.name || '').split(' ')[0] || 'תושב/ת', 30), photo: f.photo || user.picture || null, official: !!f.official || undefined };
}
async function spend(kind, uid, limit) {
  const ref = db().collection('quota').doc(`${kind}_${uid}_${day()}`);
  return db().runTransaction(async (tx) => {
    const n = ((await tx.get(ref)).data() || {}).n || 0;
    if (n >= limit) return false;
    tx.set(ref, { n: n + 1, t: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
}
async function reply(user, b) {
  const text = clip(b.text, 280);
  if (!text) return { error: 'empty' };
  const par = await db().collection('tzPosts').doc(clip(b.parent, 20)).get();
  if (!par.exists || par.data().status !== 'live') return { error: 'gone' };
  if (!(await spend('tzpost', user.uid, 60))) return { error: 'limit' };
  const m = await moderate(text);
  if (!m.ok) return { error: 'flagged' };
  const p = par.data(), fan = isOwner(user) ? OFFICIAL : await fanOf(user);
  const doc = { id: newId(), by: null, fan, text, parent: p.id, root: p.root, quote: null, article: null, link: null, status: 'live', t: Timestamp.now(), made: FieldValue.serverTimestamp(),
    order: 0, replies: 0, stamps: 0, quotes: 0, ...(m.unchecked ? { unchecked: true } : {}) };
  await db().batch().set(db().collection('tzPosts').doc(doc.id), doc).update(par.ref, { replies: FieldValue.increment(1) }).commit();
  return { ok: true, post: pub({ ...doc, t: Date.now() }) };
}
async function stamp(user, b) {
  const P = db().collection('tzPosts').doc(clip(b.id, 20)), S1 = db().collection('tzStamps').doc(`${clip(b.id, 20)}_${user.uid}`);
  return db().runTransaction(async (tx) => {
    const [p, s] = await Promise.all([tx.get(P), tx.get(S1)]);
    if (!p.exists || p.data().status !== 'live') return { error: 'gone' };
    if (s.exists) { tx.delete(S1); tx.update(P, { stamps: FieldValue.increment(-1) }); return { ok: true, on: false }; }
    tx.set(S1, { uid: user.uid, post: p.id, t: FieldValue.serverTimestamp() }); tx.update(P, { stamps: FieldValue.increment(1) });
    return { ok: true, on: true };
  });
}

// a visitor reports a post (offensive / wrong): it pops up to him - Backstage → ציפציפ and a push to his phone; at HIDE_AT
// reports it leaves the site until he looks
async function report(user, b) {
  const P = db().collection('tzPosts').doc(clip(b.id, 20)), R = db().collection('tzReports').doc(`${clip(b.id, 20)}_${user.uid}`);
  const r = await db().runTransaction(async (tx) => {
    const [p, had] = await Promise.all([tx.get(P), tx.get(R)]);
    if (!p.exists) return { error: 'gone' };
    if (had.exists) return { ok: true, again: true };
    const n = (p.data().reports || 0) + 1;
    tx.set(R, { post: p.id, uid: user.uid, email: user.email || null, why: clip(b.why, 300), t: FieldValue.serverTimestamp(), open: true });
    tx.update(P, { reports: n, ...(n >= HIDE_AT && p.data().status === 'live' ? { status: 'hidden', hiddenBy: 'reports' } : {}) });
    return { ok: true, n, text: p.data().text, by: p.data().by || (p.data().fan && p.data().fan.nick) };
  });
  if (r.ok && !r.again) await pushHim({ title: `דיווח בציפציפ${r.n >= HIDE_AT ? ' - הפוסט הוסתר' : ''}`, body: `${r.by}: ${clip(r.text, 90)}${b.why ? ` · "${clip(b.why, 60)}"` : ''}`,
    url: 'https://shlomiverse.com/backstage/#tz', tag: 'tz-report' }).catch((e) => console.error('tz push', e.message));
  return r.ok ? { ok: true } : r;
}
async function pushHim(payload) {
  const priv = LOCAL ? process.env.VERSE_VAPID_PRIVATE : VAPID_PRIVATE.value();
  if (!priv) return 0;
  webpush.setVapidDetails('mailto:' + OWNER, VAPID_PUBLIC, priv);
  const subs = await db().collection('pushSubs').where('uid', '==', HIM).get();
  await Promise.all(subs.docs.map((d) => webpush.sendNotification(d.data().sub, JSON.stringify({ icon: '/tziftzif/img/icon-192.png', ...payload }), { TTL: 86400 }).catch(() => {})));
  return subs.size;
}

// a citizen's own post (his rule 2026-11-08: citizens post too, not only reply); his account posts as ציפציפ itself - the
// official account (the logo, the name, the check)
async function post(user, b) {
  const text = clip(b.text, 280);
  if (!text) return { error: 'empty' };
  if (!(await spend('tzpost', user.uid, 60))) return { error: 'limit' };
  const m = await moderate(text);
  if (!m.ok) return { error: 'flagged' };
  const fan = isOwner(user) ? OFFICIAL : await fanOf(user);
  const doc = { id: newId(), by: null, fan, text, parent: null, quote: null, article: null, link: null, status: 'live', t: Timestamp.now(), made: FieldValue.serverTimestamp(),
    order: 0, replies: 0, stamps: 0, quotes: 0, ...(m.unchecked ? { unchecked: true } : {}) };
  doc.root = doc.id;
  await db().collection('tzPosts').doc(doc.id).set(doc);
  return { ok: true, post: pub({ ...doc, t: Date.now() }) };
}

// a visitor tagged a resident (@<id>) in a reply: that resident answers in person, under the visitor's reply
async function answer(doc) {
  const cfg = await config();
  const off = new Set(cfg.off || []);
  const byHandle = Object.fromEntries(Object.entries(AL).map(([id, a]) => [a.handle, id]));   // @bentel -> bennett
  const tagged = [...new Set((doc.text.match(/@([a-z][a-z0-9_-]{1,30})/g) || []).map((s) => byHandle[s.slice(1)] || s.slice(1)))].filter((id) => !off.has(id));
  if (!tagged.length || cfg.silent === day()) return;
  const b = await brainNow(), C = byId(b), id = tagged.find((x) => C[x]);
  if (!id || !(await spend('tzreply', doc.fan.uid, REPLIES_A_DAY))) return;
  const all = (await db().collection('tzPosts').where('root', '==', doc.root).where('status', '==', 'live').get()).docs.map((d) => d.data()).sort((a, b) => ms(a.t) - ms(b.t)).slice(-12);
  const lines = all.map((p) => `${p.fan ? `${p.fan.nick} (a visitor)` : p.by}: ${p.text}`).join('\n');
  const r = await ask(tzKey(), `${POST_RULES}\nNow ONE resident answers a visitor who tagged them in a thread on ציפציפ. Write only the answer: their voice, short (at most 200 characters), talking to the visitor, on the thread's topic. Never reveal anything about AI, never break the world.`,
    [{ role: 'user', content: `THE RESIDENT:\n${voice(C[id])}\n\nTHE THREAD:\n${lines}\n\nThe visitor ${doc.fan.nick} wrote: ${doc.text}` }],
    S({ text: str }), 'answer', 'low', 600);
  const text = clip(r.out.text, 280);
  if (!text) return;
  const a = { id: newId(), by: id, text, parent: doc.id, root: doc.root, quote: null, article: null, link: null, status: 'live', t: Timestamp.now(),
    made: FieldValue.serverTimestamp(), order: 0, replies: 0, stamps: 0, quotes: 0, to: doc.fan.uid };
  await db().batch().set(db().collection('tzPosts').doc(a.id), a).update(db().collection('tzPosts').doc(doc.id), { replies: FieldValue.increment(1) }).commit();
}

async function who(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  try { return await admin.auth().verifyIdToken(m[1]); } catch (e) { return null; }
}
const isOwner = (u) => !!u && u.email === OWNER && u.email_verified;
const citizen = async (uid) => { const f = (await db().collection('fans').doc(uid).get()).data() || {}; return !!(f.citizen && f.citizen.n); };
// his account = ציפציפ's official account (his rule 2026-11-08)
const OFFICIAL = { uid: HIM, nick: 'ציפציפ', photo: '/tziftzif/img/avatar.png', official: true };

async function handle(req) {
  const b = req.method === 'GET' ? req.query : req.body || {}, op = b.op, user = await who(req), cfg = await config();
  if (!cfg.open && !isOwner(user)) return { error: 'soon' };
  const uid = user && user.uid;
  if (op === 'feed') return feed(uid, b.before);
  if (op === 'post') return thread(uid, b.id);
  if (op === 'resident') return resident(uid, b.char, b.before);
  if (op === 'front') return front();
  if (op === 'home') return home(cfg);
  if (op === 'me') {   // what the page needs to know about the visitor: signed in, a citizen (a passport), who they follow on the verse
    if (!user) return { signed: false, citizen: false, owner: false, follows: [], names: AL };
    const f = (await db().collection('fans').doc(user.uid).get()).data() || {};
    return { signed: true, owner: isOwner(user), citizen: isOwner(user) || !!(f.citizen && f.citizen.n), follows: f.follows || [], names: AL };
  }
  if (op === 'article') return article(b.id);
  if (!user) return { error: 'sign_in' };
  if (req.method !== 'POST') return { error: 'post' };
  if (op === 'report') return report(user, b);   // anyone signed in may report what offends (a safety valve)
  // posting, replying and stamping are for the verse's citizens (his rule 2026-11-08) - a citizen finished the citizenship journey
  if (!isOwner(user) && !(await citizen(user.uid))) return { error: 'citizen' };
  if (op === 'post') return post(user, b);
  if (op === 'reply') return reply(user, b);
  if (op === 'stamp') return stamp(user, b);
  return { error: 'op' };
}

exports.verseTz = onRequest({ region: 'europe-west1', cors: CORS, secrets: SECRETS, memory: '512MiB', timeoutSeconds: 60, maxInstances: 10, concurrency: 40 }, async (req, res) => {
  try {
    const r = await handle(req);
    res.status(r && r.error ? (r.error === 'sign_in' ? 401 : r.error === 'soon' ? 403 : r.error === 'limit' ? 429 : r.error === 'gone' ? 404 : 400) : 200).json(r);
  } catch (e) {
    console.error('verseTz', e.message);
    res.status(500).json({ error: 'server' });
  }
});

// morning, noon and evening (Israel)
exports.verseTzRun = onSchedule({ schedule: '0 8,13,19 * * *', timeZone: 'Asia/Jerusalem', region: 'europe-west1', secrets: SECRETS, memory: '512MiB', timeoutSeconds: 300 }, async () => {
  const h = new Date(Date.now() + 2 * 3600e3).getUTCHours();
  try { console.log('verseTzRun', JSON.stringify(await run(h < 11 ? 'morning' : h < 16 ? 'noon' : 'evening'))); } catch (e) { console.error('verseTzRun', e.message); }
});

// a visitor's reply that tags a resident -> the resident's answer (Firestore triggers run in me-west1, like verseOnComment)
exports.verseTzOnPost = onDocumentCreated({ document: 'tzPosts/{id}', region: 'me-west1', secrets: SECRETS, timeoutSeconds: 60 }, async (ev) => {
  const doc = ev.data && ev.data.data();
  if (!doc || !doc.fan || !/@[a-z]/.test(doc.text || '')) return;
  await config();   // the aliases (verse handles) in force
  try { await answer(doc); } catch (e) { console.error('verseTzOnPost', e.message); }
});

// ---------- link previews (his note 2026-11-08: "nice social links") ----------
// Hosting sends /tziftzif/p|u|a/<id> and /charadot/a/<id> here; the answer is the site's own page with THAT post's /
// resident's / article's title, line and picture in its <head>. While the sites are closed (open=false) the preview stays
// the site's own - nothing leaks. Any failure = the page with its default preview, never an error.
const SITE = 'https://shlomiverse.com';
const pageCache = {};
async function pageOf(url) {
  const c = pageCache[url];
  if (c && Date.now() - c.t < 60e3) return c.v;
  const r = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
  if (!r.ok) { if (c) return c.v; throw new Error('template ' + r.status); }
  const v = await r.text();
  pageCache[url] = { v, t: Date.now() };
  return v;
}
let wikiData = null, wikiAt = 0;
async function wikiNow() {
  if (wikiData && Date.now() - wikiAt < 120e3) return wikiData;
  try { const w = await (await fetch('https://storage.googleapis.com/shlomiverse-media/wiki/data/wiki.json')).json(); wikiData = Object.fromEntries((w.characters || []).map((c) => [c.id, c])); wikiAt = Date.now(); } catch (e) {}
  return wikiData || {};
}
const ex = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const one = (s, n = 200) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
function injectHead(html, p, url) {
  const set = (re, tag) => { html = re.test(html) ? html.replace(re, tag) : html.replace('</head>', tag + '\n</head>'); };
  const title = ex(one(p.title, 90)), desc = ex(one(p.desc));
  set(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  set(/<meta name="description"[^>]*>/, `<meta name="description" content="${desc}">`);
  set(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${title}">`);
  set(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${desc}">`);
  set(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${ex(url)}">`);
  if (p.img) {
    set(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${ex(p.img)}">`);
    html = html.replace(/<meta property="og:image:(width|height)"[^>]*>\n?/g, '');
    set(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${ex(p.img)}">`);
  }
  return html;
}
async function previewOf(site, kind, id) {
  const cfg = await config();
  if (!cfg.open) return null;
  const W = await wikiNow(), name = (by) => (by === NEWS ? 'חרדות · ח24' : (AL[by] && AL[by].name) || (W[by] && W[by].name) || by);
  const face = (by) => (by === NEWS ? `${SITE}/charadot/img/icon-512.png` : (W[by] && W[by].img) || null);
  if (kind === 'p') {
    const d = await db().collection('tzPosts').doc(clip(id, 20)).get(), p = d.exists && d.data();
    if (!p || p.status !== 'live') return null;
    const who = p.fan ? (p.fan.official ? 'ציפציפ' : p.fan.nick) : name(p.by);
    let img = (p.link && p.link.img) || null;
    if (!img && p.article) { const a = await db().collection('tzArticles').doc(p.article).get(); img = a.exists ? a.data().img : null; }
    return { title: `${who} בציפציפ`, desc: p.text, img: img || (p.by && face(p.by)) || `${SITE}/tziftzif/img/og.png` };
  }
  if (kind === 'u') return { title: `${name(id)} (@${id === NEWS ? id : (AL[id] && AL[id].handle) || id}) · ציפציפ`, desc: id === NEWS ? 'ערוץ החדשות של השלומיוורס. הישארו איתנו.' : (W[id] && (W[id].tagline || W[id].role)) || 'מה מצייצים בשלומיוורס', img: face(id) };
  if (kind === 'a') {
    const d = await db().collection('tzArticles').doc(clip(id, 20)).get(), a = d.exists && d.data();
    if (!a || a.status !== 'live') return null;
    return { title: `${a.headline} · ח24`, desc: a.sub, img: a.img || `${SITE}/charadot/img/og.jpg` };
  }
  return null;
}
exports.verseTzPage = onRequest({ region: 'europe-west1', memory: '256MiB', timeoutSeconds: 15, concurrency: 80, maxInstances: 5 }, async (req, res) => {
  const [, site = '', kind = '', raw = ''] = req.path.split('/');
  const template = `${SITE}/${site === 'charadot' ? 'charadot' : 'tziftzif'}/index.html`;
  let html;
  try { html = await pageOf(template); } catch (e) { res.redirect(302, `/${site}/`); return; }
  try { const p = await previewOf(site, kind, decodeURIComponent(raw)); if (p) html = injectHead(html, p, SITE + req.path); } catch (e) { console.error('verseTzPage', req.path, e.message); }
  res.set('Cache-Control', 'public, max-age=120, s-maxage=300');
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
});

// ---------- Backstage → ציפציפ (through verseOwner) ----------
async function owner(op, b) {
  if (op === 'tzList') {
    const cfg = await config();
    const runs = (await db().collection('tzRuns').orderBy('at', 'desc').limit(+b.runs || 8).get()).docs.map((d) => ({ id: d.id, ...d.data(), at: ms(d.data().at) }));
    const ids = runs.map((r) => r.id);
    const posts = ids.length ? (await db().collection('tzPosts').where('run', 'in', ids.slice(0, 10)).get()).docs.map((d) => ({ ...d.data(), t: ms(d.data().t), made: ms(d.data().made) })) : [];
    const arts = ids.length ? (await db().collection('tzArticles').where('run', 'in', ids.slice(0, 10)).get()).docs.map((d) => ({ ...d.data(), t: ms(d.data().t), made: ms(d.data().made) })) : [];
    return { cfg, today: day(), runs, posts, articles: arts };
  }
  if (op === 'tzPublish') return publish(b.posts || [], b.articles || []);
  if (op === 'tzSkip') {
    const batch = db().batch();
    for (const id of b.posts || []) batch.update(db().collection('tzPosts').doc(clip(id, 20)), { status: 'skipped' });
    for (const id of b.articles || []) batch.update(db().collection('tzArticles').doc(clip(id, 20)), { status: 'skipped' });
    await batch.commit();
    return { ok: true };
  }
  if (op === 'tzHide') {   // takes a live post (or a visitor's reply) off the site
    await db().collection('tzPosts').doc(clip(b.id, 20)).update({ status: 'hidden' });
    return { ok: true };
  }
  if (op === 'tzEdit') {
    if (b.post) await db().collection('tzPosts').doc(clip(b.post, 20)).update({ text: clip(b.text, 280) });
    if (b.article) {
      const up = {};
      if (b.headline != null) up.headline = clip(b.headline, 160);
      if (b.sub != null) up.sub = clip(b.sub, 260);
      if (Array.isArray(b.body)) up.body = b.body.map((p) => clip(p, 900)).filter(Boolean);
      await db().collection('tzArticles').doc(clip(b.article, 20)).update(up);
    }
    return { ok: true };
  }
  if (op === 'tzConfig') {
    const up = {};
    for (const k of ['open', 'auto', 'img']) if (typeof b[k] === 'boolean') up[k] = b[k];
    for (const k of ['stars', 'off']) if (Array.isArray(b[k])) up[k] = b[k].map((x) => clip(x, 30)).filter(Boolean);
    if (b.arc === null) up.arc = null;
    if (typeof b.silent === 'boolean') up.silent = b.silent ? day() : null;
    await meta().set(up, { merge: true });
    return { ok: true, cfg: await config() };
  }
  if (op === 'tzRun') return run('manual');
  if (op === 'tzCast') {   // every resident: star / regular / out, for the cast list
    const b2 = await brainNow(), cfg = await config(), stars = new Set(cfg.stars || STARS), off = new Set(cfg.off || []);
    return { all: b2.characters.map((c) => ({ id: c.id, name: c.name, world: c.world, role: short(c.role, 80), star: stars.has(c.id), off: off.has(c.id), kid: KIDS.includes(c.id) })) };
  }
  if (op === 'tzReports') {   // the open reports, with their post
    const rs = (await db().collection('tzReports').where('open', '==', true).limit(100).get()).docs.map((d) => ({ id: d.id, ...d.data(), t: ms(d.data().t) }));
    const ids = [...new Set(rs.map((r) => r.post))];
    const posts = ids.length ? (await db().getAll(...ids.map((id) => db().collection('tzPosts').doc(id)))).filter((d) => d.exists).map((d) => ({ ...d.data(), t: ms(d.data().t), made: ms(d.data().made) })) : [];
    return { reports: rs.sort((a, b) => b.t - a.t), posts };
  }
  if (op === 'tzResolve') {   // he looked: keep (back on the site) or remove; the post's reports close
    const P = db().collection('tzPosts').doc(clip(b.id, 20));
    await P.update({ status: b.keep ? 'live' : 'hidden', reviewed: true });
    const rs = await db().collection('tzReports').where('post', '==', clip(b.id, 20)).get();
    const batch = db().batch(); rs.docs.forEach((d) => batch.update(d.ref, { open: false })); await batch.commit();
    return { ok: true };
  }
  return { error: 'op' };
}

module.exports = { _ogImage: ogImage, verseTzPage: exports.verseTzPage, verseTz: exports.verseTz, verseTzRun: exports.verseTzRun, verseTzOnPost: exports.verseTzOnPost, owner, SECRETS, _run: run, _headlines: headlines, _publish: publish, _candidates: candidates };
