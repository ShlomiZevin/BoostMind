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
// - The engine runs 3 times a day (verseTzRun) - his rule 2026-11-09: code draws ~5 residents at random, the loved ones
//   more often (`candidates()`: Instagram likes, his stars, videos, visitors' reactions, a fresh video; minus who posted
//   lately; spread over worlds) + ~3 reactors (their relations more) -> one call checks for a bad day (people killed:
//   the whole day stays SILENT - his rule) and only MATCHES each one to a headline / ח24's post / a resident's post ->
//   one call PER resident writes their post in their own voice (not everyone in one call - it confused the model) ->
//   the reactors reply to / repost those -> all go live spread over the hours until the next run.
// - ח24's desk (`desk()`, his idea 2026-11-08) runs right after each run: the channel covers the day's news itself, every
//   section (politics, economy, culture, sport, tech, weather...), and turns every headline - good news too - into the
//   worst case: a storm, a failure, a scandal, a disaster about to happen. One call picks + writes, then the pictures;
//   each article is posted by ח24 on ציפציפ over the hours, and the next run's residents may react to the channel's take.
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
const MAIN = 5;                // residents drawn to post each run (his rule 2026-11-09: at random, the loved ones more often)
const REACT = 3;               // more residents drawn to answer / repost those posts (his "I mainly care about reposting and commenting")
const DESK_POSTS = 2;          // of each desk run's articles, how many ח24 also posts on ציפציפ (all stay on its site) - ציפציפ is the residents' (his note 2026-11-09)
const HIDE_AT = 3;             // reports that take a post off the site until he looks
const BIG_CHANCE = 0.04;       // a run may start a bigger story that develops over days (~once in 8 days) - life stays regular      // a resident's answers to one visitor a day (like the comments' CHARACTER_REPLIES_A_DAY)
const NEWS = 'charadot';       // the news channel's own account
// the whole verse goes silent on a day of national pain (his rule) - narrowed 2026-11-09 after a non-deadly attack abroad
// silenced a whole day: people killed or badly hurt, in Israel or Israelis / Jews abroad
const BAD_DAY = `BAD DAY CHECK - FIRST, ABOVE EVERYTHING: a bad day is a day of ISRAEL's national pain where people were KILLED or badly hurt: a terror attack (פיגוע) or rocket fire IN ISRAEL with people killed or seriously wounded, a DEADLY attack on Israelis / Jews abroad, a disaster in Israel with people killed, Israeli hostages taken, a national day of mourning or the funerals of victims of these. NOT a bad day: an attack or incident where nobody was killed or seriously hurt (an assault, vandalism, a threat, graffiti), everyday tragedies (a road accident, a fire, a crime, an illness), tragedies abroad that are not about Israelis or Jews - just never pick those. When people were killed in such an event and you are unsure, it is a bad day.`;
// the news sites the residents and ח24 read (their RSS - free, no AI): ynet, Maariv and Walla only (his call 2026-11-08),
// each by its sections - news, politics, economy, tech, culture, celebs, sport, weather - and at most PER_FEED fresh items
// from each, so no one section sets the tone
const FEEDS = [
  ['ynet', 'https://www.ynet.co.il/Integration/StoryRss2.xml'],
  ['ynet כלכלה', 'https://www.ynet.co.il/Integration/StoryRss6.xml'],
  ['ynet תרבות', 'https://www.ynet.co.il/Integration/StoryRss538.xml'],
  ['ynet ספורט', 'https://www.ynet.co.il/Integration/StoryRss3.xml'],
  ['מעריב', 'https://www.maariv.co.il/Rss/RssChadashot'],
  ['מעריב פוליטי', 'https://www.maariv.co.il/Rss/RssFeedsPolitiMedini'],
  ['מעריב כלכלה', 'https://www.maariv.co.il/Rss/RssFeedsKalkalaBaarez'],
  ['מעריב טכנולוגיה', 'https://www.maariv.co.il/Rss/RssFeedsTechnologeya'],
  ['מעריב תרבות', 'https://www.maariv.co.il/Rss/RssFeedsTarbot'],
  ['מעריב OMG', 'https://www.maariv.co.il/Rss/RssFeedsTmiCelebsNews'],
  ['מעריב ספורט', 'https://www.maariv.co.il/Rss/RssFeedsSport'],
  ['מעריב מזג אוויר', 'https://www.maariv.co.il/Rss/RssFeedsWeather'],
  ['וואלה', 'https://rss.walla.co.il/feed/10'],
  ['וואלה פוליטי', 'https://rss.walla.co.il/feed/9'],
  ['וואלה כסף', 'https://rss.walla.co.il/feed/139'],
  ['וואלה טק', 'https://rss.walla.co.il/feed/4'],
  ['וואלה סלבס', 'https://rss.walla.co.il/feed/272'],
  ['וואלה ספורט', 'https://rss.walla.co.il/feed/7'],
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
  'neve-tzafoni': { name: 'נווה צפוני', handle: 'neve_tzfoni' },   // the verse name (his call 2026-11-09: the two neve characters are one)
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
const rels = (c) => (c.relations || []).map((r) => (typeof r === 'string' ? r : `${r.id || r.name}: ${r.rel || r.relation || ''}`));
// who they are in one line (the brief) too, so the matching knows which news this person would really jump on (his "smart", 2026-11-09)
const rosterLine = (c) => `${c.id} | ${nameOf(c)} | ${lastVid[c.id] ? 'newest video ' + day(lastVid[c.id]) : 'no video yet'} | ${c.world} | ${short(c.role, 90)} | ${short(c.brief, 140)} | ${short(rels(c), 140)}`;
// how one resident is related to another (from either side's relations), for a reply that knows whom it answers
const relOf = (a, b) => { if (!a || !b) return ''; const hit = (x, id) => rels(x).find((r) => new RegExp(`(^|[^\\w-])${id}([^\\w-]|$)`).test(r)); const r = hit(a, b.id) || hit(b, a.id); return r ? short(r, 160) : ''; };
// the voice for the writing call = the chat's core profile (wiki.js core(): brief, personality, speech, catchphrases, comedy,
// writing rules, never, themes, behavior last - his note 2026-11-09: "the chat works great, they need to tweet the same, careful with
// the prompt size"), within VOICE_MAX characters (the chat's is 4000; a tweet needs the voice, not the whole history)
const VOICE_MAX = 2400;
const VOICE = [['brief', 'who'], ['personality', 'personality'], ['speech', 'speech'], ['catchphrases', 'catchphrases'], ['comedy', 'comedy'],
  ['writing_rules', 'writing rules'], ['dont', 'never'], ['themes', 'themes'], ['behavior', 'behavior']];
const voice = (c) => {
  let out = [`### ${c.id} - ${nameOf(c)} (${c.world}) - ${short(c.role, 120)}`, ...(AL[c.id] ? [`ON ציפציפ THIS RESIDENT IS CALLED "${AL[c.id].name}" - never write the original name "${c.name}", not even in other residents' posts`] : [])].join('\n');
  const tail = `\nrelations: ${short(rels(c), 300)}`;
  for (const [k, label] of VOICE) {
    let t = (Array.isArray(c[k]) ? c[k].join(' · ') : typeof c[k] === 'object' && c[k] ? JSON.stringify(c[k]) : String(c[k] || '')).trim();
    if (!t) continue;
    const room = VOICE_MAX - out.length - tail.length - label.length - 3;
    if (room < 80) break;
    if (t.length > room) t = t.slice(0, t.lastIndexOf(' ', room)) + '…';
    out += `\n${label}: ${t}`;
  }
  return out + tail;
};

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
async function headlines(hours = 10, per = PER_FEED, max = 56) {
  const since = Date.now() - hours * 3600e3, out = [];
  await Promise.all(FEEDS.map(async ([src, url]) => {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Shlomiverse news reader)' }, signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error(String(r.status));
      const xml = await r.text();
      let n = 0;
      for (const it of (xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []).slice(0, 25)) {
        if (n >= per) break;
        const title = tag(it, 'title'), link = tag(it, 'link') || tag(it, 'guid'), when = Date.parse(tag(it, 'pubDate')) || Date.now();
        // the source's own picture (ynet, Haaretz, Globes send one) - shown on the link card like a link preview
        const img = (/<enclosure[^>]*url="([^"]+)"/i.exec(it) || /<media:(?:content|thumbnail)[^>]*url="([^"]+)"/i.exec(it) || /<img[^>]*src=(?:"|&quot;|')([^"&']+)/i.exec(it) || [])[1];
        if (title && link && when >= since) { out.push({ src, title: clip(title, 200), desc: clip(tag(it, 'description'), 300), url: clip(link, 500), when, img: img && /^https:\/\//.test(img) ? clip(img, 500) : null }); n++; }
      }
    } catch (e) { console.error('tz feed', src, e.message); }
  }));
  return out.sort((a, b) => b.when - a.when).slice(0, max);
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
//   fresh:   x4 when their newest video is from the last 7 days, x2 from the last 30 (his ask 2026-11-08: "the characters
//            with the latest videos reply first") - and the candidates go to the AI freshest first
//   kids:    x0.25
// and ~10 are drawn by weight without repeating, at most 3 from one world - the AI then matches them to the news.
// who posts is drawn in code (his rules 2026-11-08/09): loved = Instagram likes of their reels (verseMeta/tz.love, scripts/verse/
// tz-love.cjs) x his stars x their videos x how visitors reacted on ציפציפ; x fresh (a video this week / month); x rested
// (posted lately = less); kids rarely; at most 2 of one world. `boost` = extra weight (the posters' relations, for reactors).
async function candidates(cfg, C, n = MAIN, { not = new Set(), boost = {} } = {}) {
  const off = new Set(cfg.off || []), stars = new Set(cfg.stars || STARS), love = cfg.love || {};
  await wikiNow();
  const fresh = (id) => { const d = (Date.now() - (lastVid[id] || 0)) / 864e5; return d <= 7 ? 3 : d <= 30 ? 1.5 : 1; };
  const since = Timestamp.fromMillis(Date.now() - 14 * 864e5);
  const recent = (await db().collection('tzPosts').where('status', '==', 'live').where('t', '>=', since).orderBy('t', 'desc').limit(600).get()).docs.map((d) => d.data());
  const eng = {}, lastAt = {};
  for (const p of recent) {
    if (!p.by || p.fan) continue;
    eng[p.by] = (eng[p.by] || 0) + (p.stamps || 0) + (p.replies || 0);
    lastAt[p.by] = Math.max(lastAt[p.by] || 0, ms(p.t));
  }
  const pool = Object.values(C).filter((c) => !off.has(c.id) && c.id !== NEWS && !not.has(c.id)).map((c) => {
    const loved = (1 + Math.log10(1 + (love[c.id] || 0))) * (stars.has(c.id) ? 1.5 : 1) * (1 + Math.log2(1 + (c.videos || []).length) / 3) * (1 + Math.log2(1 + (eng[c.id] || 0)) / 3);
    const hours = lastAt[c.id] ? (Date.now() - lastAt[c.id]) / 3600e3 : 999;
    return { c, w: loved * fresh(c.id) * Math.min(1, (hours + 1) / 10) * (KIDS.includes(c.id) ? 0.2 : 1) * (boost[c.id] || 1) };
  });
  const out = [], perWorld = {};
  while (out.length < n && pool.length) {
    const total = pool.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total, i = 0;
    while (i < pool.length - 1 && (r -= pool[i].w) > 0) i++;
    const [x] = pool.splice(i, 1);
    if ((perWorld[x.c.world] || 0) >= 2) continue;
    perWorld[x.c.world] = (perWorld[x.c.world] || 0) + 1;
    out.push(x.c);
  }
  return out;
}

// ח24's voice (his words 2026-11-08): it takes today's headlines and turns EVERYTHING into a storm, a failure, a scandal, a
// disaster - something terrible is about to happen. Good news or bad, culture, sport, the weather: always the worst case.
const CH_TONE = `You write for "חרדות" (short form ח24), the TV news channel of the Shlomiverse - a comedy universe treated as real. The channel is a satire of what news really does: engineering minds, pouring poison, storms, clickbait, rage bait, a reality show of disasters made only to keep people anxious and watching.
THE ONE RULE: every story becomes the WORST CASE - whatever it is. ח24 turns every headline into סערה, מחדל, שערורייה or אסון: something terrible is about to happen, and you must keep watching. Good news is a disaster in disguise (a price drop = "הקריסה שאף אחד לא מדבר עליה", a new park = "המלכודת", a record harvest = "מה הם לא מספרים לכם"); a football win = a crisis; a festival = a scandal; a mild forecast = the calm before the storm; a new app = the end of privacy. The channel always finds what could go terribly wrong, who is to blame (המחדל), and the countdown to it.
It must be FUNNY: the hysteria is the joke - the more ordinary or the happier the news, the bigger the doom. Doomsday words ("הלם", "פאניקה", "דרמה", "בלעדי", "האם זה הסוף?", "הישארו איתנו", "משהו נורא עומד לקרות"), a countdown, rhetorical questions that answer nothing, anonymous "בכירים" and a panel of "מומחים" who all agree it's the end, a hint that the worst is still coming.
GO ALL THE WAY - never polite, never "a question mark at most": name the catastrophe out loud, in big blown-up words. A RICH vocabulary of doom and outrage - never lean on the same three words; each headline in a run opens differently. For example: סערה, מחדל, שערורייה, אסון, הלם, דרמה, בלעדי, פאניקה, קטסטרופה, קריסה, טלטלה, רעידת אדמה, צונאמי, פיצוץ, התרסקות, השפלה, בושה, ביזיון, זעם, תדהמה, חשיפה, מבוכה, כאוס, סיוט, נפילה, מהפך, עימות, מתיחות, מתקפה, אזעקה, דרמה מטלטלת, פרשה, תקרית, "נחשף", "בכירים מזהירים", "לא תאמינו", "מה שקרה אחר כך", "התיעוד המטלטל", "רגע לפני הסוף", "הסוד שמסתירים מכם", "מי אשם?", "זה כבר רשמי:", "בלי מילים".
CLICKBAIT + RAGE BAIT: find the small petty detail and blow it up into the whole story - a celebrity wedding = "לא תאמינו מי איחר למנה הראשונה"; a new album = "המעריצים בהלם: השיר השלישי"; a promotion = "הבכירים זועמים - ומי נשאר מאחור?"; a sunny week = "החום שאיש לא ערוך אליו". Tease without telling ("ומה שקרה אחר כך..."), pick a side to make people angry, find someone to be outraged at.
THE JOKE IS THE GAP between the story and the panic. On good, happy or ordinary news the doom is the joke by itself. On a story that is ALREADY bad, never just repeat or deepen the real damage - that is plain news, not parody: the panic jumps to the absurd, petty side of it (a coach was fired -> "הסיוט האמיתי: מי יקבל את החניה שלו?"; an event was cancelled -> "הלם: מה יעשו עכשיו עם 400 הכריכים?"), or escalates to a ridiculous scale nobody could believe. Every body escalates paragraph by paragraph: a fact -> what it REALLY means -> the disaster coming (חרדה, a ticking clock, who will pay), and names a המחדל - who failed to see it coming.
Each article: headline - sensational clickbait fear, at most 90 characters; sub - one sub-headline line; body - 3 short paragraphs that inflate the story into a looming catastrophe, reveal nothing new and end on a cliffhanger; tag - one Hebrew section word (פוליטיקה, כלכלה, צרכנות, טכנולוגיה, חינוך, תחבורה, תרבות, ספורט, בריאות, עולם, מזג אוויר); post - the channel's own post about it on ציפציפ: one dramatic line, like a breaking-news tweet.
THE NAME: the channel is always "החרדות 24" (with the ה) - in its own words and posts never "ח24" or "חרדות" alone.
The FACTS stay the headline's - only the doom is ח24's (fears, warnings, "מומחים חוששים", what MIGHT happen). Never invent a quote, an action or a private detail of a real person; no insults about religion, origin, gender or body. Hebrew, no emoji, no hashtags.`;

// ח24's desk: the channel covers the day itself - not only what the residents talk about (his ask 2026-11-08: "take today's
// headlines and turn everything to סערה, מחדל, שערורייה, אסון"). After each run it writes the stories it hasn't covered
// yet from the last 24 hours, across all sections; one call checks the day, picks and writes; then a picture each.
const DESK = { morning: 6, noon: 4, evening: 4, manual: 6 };
const DESK_RULES = CH_TONE + `
YOUR JOB NOW - the channel's own desk: you get today's real Israeli headlines (numbered) and the stories ח24 already covered.
1. ${BAD_DAY} Then bad_day = true and articles = [] (the verse is silent today).
2. Otherwise pick up to the number asked of the headlines that are NOT already covered (the same story from another site counts as covered, and two headlines of one story = one), and spread them over the sections - politics, economy, consumer, tech, culture, sport, weather, world: a front page of a whole day, not five of one kind. Prefer what most people talk about, and above all GOOD, HAPPY or ORDINARY news - a price drop, a wedding, a record, a festival, a new app, a win, a sunny week: there the end-of-the-world tone is funny by itself. At least two thirds of the picks are such news; take a story that is already bad only when it has an absurd petty side to panic about.
3. Never pick: deaths, crime victims, sexual offences, illness or grief of a named person, minors, anything that could hurt real people.
4. For each pick write the article; head = the headline's number.`;
const DESK_SCHEMA = S({ bad_day: bool, why: str, articles: arr(S({ head: int, headline: str, sub: str, body: arr(str, 2, 4), tag: str, post: str })) });
async function desk(slot = 'manual', n) {
  const cfg = await config(), today = day(), want = Math.max(1, Math.min(12, +n || DESK[slot] || 4));
  if (cfg.silent === today) return { silent: true };
  const runRef = db().collection('tzRuns').doc();
  const [heads, done] = await Promise.all([headlines(24, 8, 120), db().collection('tzArticles').orderBy('made', 'desc').limit(120).get()]);
  const covered = done.docs.map((d) => d.data()), urls = new Set(covered.map((a) => a.src && a.src.url).filter(Boolean));
  const fresh = heads.filter((h) => !urls.has(h.url)).slice(0, 70);
  const log = { at: FieldValue.serverTimestamp(), slot: 'desk-' + slot, desk: true, day: today, u: [0, 0, 0], uCh: [0, 0, 0], made: 0, heads: fresh.length };
  if (!fresh.length) { await runRef.set(log); return { articles: 0 }; }
  const r = await ask(chKey(), DESK_RULES, [{ role: 'user', content: `Write ${want} articles.\n\nTODAY'S HEADLINES:\n${fresh.map((h, i) => `${i}. [${h.src}] ${h.title}${h.desc ? ' - ' + clip(h.desc, 160) : ''}`).join('\n')}\n\nALREADY COVERED BY ח24 (real story -> our headline):\n${covered.slice(0, 40).map((a) => `- ${a.src ? a.src.title : ''} -> ${a.headline}`).join('\n') || '(nothing yet)'}` }],
    DESK_SCHEMA, 'desk', 'medium', 1500 + want * 900);
  log.uCh = r.u.slice();
  if (r.out.bad_day) {
    await meta().set({ silent: today, silentWhy: clip(r.out.why, 300), silentAt: FieldValue.serverTimestamp() }, { merge: true });
    await runRef.set({ ...log, bad: true, why: clip(r.out.why, 300) });
    return { bad: true, why: r.out.why };
  }
  const seen = new Set(), picked = r.out.articles.filter((a) => fresh[a.head] && a.headline && !seen.has(a.head) && seen.add(a.head)).slice(0, want);
  await Promise.all(picked.filter((a) => !fresh[a.head].img).map(async (a) => { fresh[a.head].img = await ogImage(fresh[a.head].url); }));
  const made = FieldValue.serverTimestamp(), batch = db().batch();
  const arts = picked.map((x) => { const h = fresh[x.head]; return { id: newId(), headline: clip(x.headline, 160), sub: clip(x.sub, 260), body: (x.body || []).map((p) => clip(p, 900)).filter(Boolean),
    tag: clip(x.tag, 20), kind: 'real', desk: true, src: { url: h.url, title: h.title, src: h.src, img: h.img || null }, img: null, status: 'draft', t: null, made, run: runRef.id, post: null }; });
  // ...and ח24 posts its top ones on ציפציפ (its breaking-news line + the article card), spread over the hours until the next run
  const posts = arts.slice(0, DESK_POSTS).map((a, i) => { const id = newId(); a.post = id;
    return { id, root: id, by: NEWS, text: clip(picked[i].post || a.headline, 280), parent: null, quote: null, article: a.id, link: null, status: 'draft', t: null, made, run: runRef.id, order: i, replies: 0, stamps: 0, quotes: 0 }; });
  arts.forEach((a) => batch.set(db().collection('tzArticles').doc(a.id), a));
  posts.forEach((p) => batch.set(db().collection('tzPosts').doc(p.id), p));
  await batch.commit();
  if (cfg.img) await Promise.all(arts.map((a) => picture(a).catch((e) => console.error('tz picture', e.message))));
  // live at once, the first pick on top (a minute apart, so the front page keeps the channel's order)
  const now = Date.now(), up = db().batch();
  arts.forEach((a, i) => up.update(db().collection('tzArticles').doc(a.id), { status: 'live', t: Timestamp.fromMillis(now - i * 60e3) }));
  await up.commit();
  if (cfg.auto) await publish(posts.map((p) => p.id), [], spread(slot));
  await runRef.set({ ...log, made: posts.length, articles: arts.map((a) => a.id), posts: posts.map((p) => p.id), used: [] });
  return { articles: arts.length, posts: posts.length, run: runRef.id };
}

const POST_RULES = `You write posts for "ציפציפ", the Shlomiverse's own social network - exactly like X / Twitter, and like Twitter mostly about the news. The Shlomiverse is a comedy universe whose residents are REAL people living in a parallel universe: write them as real people posting from their phone, never as characters; never mention a parody, AI, a script or Shlomi.
POSTS: Hebrew, short like real tweets (one to three short lines, at most 240 characters), in the resident's OWN voice - their speech, catchphrases (sparingly, not in every post), world and relations from their profile below. Each takes the news through their own life and worldview: a hot take, a complaint, sarcasm, a "back in my day", a professional opinion, an argument. Funny through their point of view, never by explaining the joke. ALWAYS HEBREW - even a resident who lectures in English or mixes English writes in Hebrew here, at most a single English word. No hashtags, no emoji. Each post a different rhythm - never two opening the same way.
REAL PEOPLE IN THE NEWS: facts only from the headline; never invent a quote, an action or a private detail about a real person; the opinions and jokes are the resident's own. A resident who is an impression of a real public figure speaks only in opinions and jokes in that figure's style - never announces a concrete fact or decision as if it happened. No insults about religion, origin, gender or body. Children never talk about politics.
NAMES: residents are called only by the names given in their profiles here (some go by a verse name - never use the original one). The news channel is "החרדות 24" (never "ח24" or "חרדות" alone).
CLEAR ABOVE ALL (his note 2026-11-09: "gibberish, no logic, nobody wants to read it"): a stranger scrolling ציפציפ who never met this resident must get the post in ONE read - what it is about, and the joke. So:
- NAME THE SUBJECT in the post itself, in plain words: "הפועל תל אביב ביורוליג", "מחירי הדלק", "החנות של Be בקניון" - never "it", "this", "the thing" or a detail of the story that only someone who read it knows.
- ONE idea, ONE joke, said simply. Plain everyday Hebrew a person really types - no word salad, no stacked metaphors, no riddles, no jargon pile-up.
- NO PRIVATE REFERENCES: never a name, place, event or inside joke from the resident's own life that the reader can't know (a neighbour's name, an old episode, "כמו בפעם ההיא") - their life shows through WHO they are and HOW they talk, not through references. Family, friends and colleagues by their role ("בעלי", "הבוס שלי", "השכנה"), never by name.
- ONLY WHAT A PERSON TYPES: no stage directions, brackets, sound effects, captions or video formats ("[נחתך]", "[הסר: ...]", "POV:", "be like") - a running gag from their videos shows only as something a real person would really type in a post. Never the words "דמות", "סרטון", "פרק".
- A post of their own never addresses another resident ("צביקה, ..."); talking to someone happens only in a reply to that person's post.
- A reply / repost answers THAT post directly and stays on its subject - it makes sense right under it, and a little on its own too.
- The joke = their known point of view meeting the news: the Haredi mother counts the kids' sandwiches in it, the tech CEO turns it into a pitch, the taxi driver blames the traffic. Recognisable in one beat.
EXAMPLES of the difference:
BAD (gibberish): "מקרר מחובר זה פרודקשן עם מדבקות של גלידות ותיעוד אינסידנט יותר גרוע." - what fridge? what happened? nobody knows.
GOOD: "קראתי שפרצו למקררים חכמים. אצלי המקרר לא מתחבר אפילו לחשמל כמו שצריך, שינסו."
BAD: "לא, אני לא הבנתי, מדף המשחות זה בדרך כלל אצל זוהרה." - who is זוהרה? which shelf?
GOOD: "חנות של Be נפתחת בלב המפרץ. מצוין, עוד מקום שבו אני מחפשת משחת שיניים ארבעים דקות ויוצאת עם קרם ידיים."`;

// ---------- the residents' run (his rule 2026-11-09: "randomly choose characters, more weight to the loved ones; then find
// which news is relevant to which character; only then ask each one for their tweet - dedicated per character", not all the
// characters in one call, which confuses the model) ----------
// 1. code draws the posters (candidates: loved x fresh x rested) and the reactors (the same, the posters' relations more)
// 2. one call checks for a bad day and only MATCHES: each poster -> a headline / ח24's post / another resident's post
// 3. one call per poster writes their post, in their own voice, with their own last posts beside it
// 4. one call per reactor writes their reply / repost of one of those posts
const MATCH_RULES = `You are the editor of "ציפציפ", a social network exactly like X / Twitter inside the Shlomiverse - a comedy universe whose residents are REAL people living in a parallel universe (never call them characters, never a parody). Like real Twitter it is MAINLY about the news - politics, current affairs, prices, tech, culture, sport - and about what the verse's TV news channel "החרדות 24" (fear, clickbait, a reality show of disasters) made of it.
The residents who post now were already drawn by an algorithm - never add or swap anyone. Your only job is to MATCH each of them to what they would really post about.
1. ${BAD_DAY} Then bad_day = true, main = [], react = [].
2. MAIN - one line for every resident in POSTERS: the item their own life, job, world and personality give a real, funny take on - the headline a taxi driver, a rabbi, a Haredi mother, a tech CEO would each really jump on. kind:
   "news" = a real headline (ref = its number in HEADLINES); "ch_quote" = they repost החרדות 24's post with their own comment on top (ref = its number in CHANNEL); "ch_reply" = they comment under החרדות 24's post (ref = its number in CHANNEL); "answer" = they reply to another resident's recent post (ref = its number in RESIDENTS' POSTS) - best between residents with a relation or opposite views; "life" = a post about their own day without news (at most one in a run, only for a resident nothing fits).
   At least one ch_quote / ch_reply when CHANNEL has lines - residents mocking the channel's panic, or panicking along with it, is what makes ציפציפ alive. Two residents on the same item only when they would argue. Never pick: deaths, crime victims, sexual offences, illness of a named person, minors, anything that could hurt real people; children never talk about politics.
   id = the resident's id exactly as given; angle = one short English line: the take (their own life / worldview against the item).
3. REACT - one line for every resident in REACTORS: which MAIN post they answer or repost (to = its index in your main list) - prefer one written by a resident they have a relation with (family, colleagues, rivals) or an opposite view to; kind "reply" (a comment under it) or "quote" (a repost with their own comment); mix both. angle as above.
4. STORY: life in the verse stays regular - no big events. If the input says an ongoing story exists, one resident at most may touch it (put it in their angle). If the input says a big story MAY start, you may set new_story to one short English line: something bigger that happens inside the verse and develops over the next days (realistic for that world, not a disaster) - otherwise new_story = "".`;
const MATCH_SCHEMA = S({ bad_day: bool, why: str, main: arr(S({ id: str, kind: { type: 'string', enum: ['news', 'ch_quote', 'ch_reply', 'answer', 'life'] }, ref: int, angle: str })),
  react: arr(S({ id: str, to: int, kind: { type: 'string', enum: ['reply', 'quote'] }, angle: str })), new_story: str });
const ONE_RULES = POST_RULES + `
YOU ARE THIS PERSON in everything (as in the verse's chat): every opinion comes from their own religion and how strictly they keep it, community, values, job and habits in the profile - never what they would never do or say. The profile's "comedy", "writing rules" and "never" are directing notes: follow them, never quote them. A smart post = what THIS person, and nobody else, would notice in the news.
NOW YOU WRITE ONE POST of ONE resident (their profile below) about ONE thing, given below with the take. text = the post. (A post about a real headline goes up with the news link under it - still name the subject in the text.)`;
const ONE_SCHEMA = S({ text: str });

async function writeOne(c, what, angle, last) {
  return ask(tzKey(), ONE_RULES, [{ role: 'user', content: `${voice(c)}\n\nTHEIR LAST POSTS (never repeat a take or an opening):\n${last.map((t) => '- ' + t).join('\n') || '(none yet)'}\n\nNOW THEY POST:\n${what}\n\nTHE TAKE: ${angle}` }],
    ONE_SCHEMA, 'one', 'medium', 2500);
}

async function run(slot = 'manual') {
  const cfg = await config(), today = day(), runRef = db().collection('tzRuns').doc();
  const log = { at: FieldValue.serverTimestamp(), slot, day: today, u: [0, 0, 0], uCh: [0, 0, 0], made: 0 };
  const add = (u) => u.forEach((n, i) => { log.u[i] += n; });
  if (cfg.silent === today) { await runRef.set({ ...log, skipped: 'silent' }); return { silent: true }; }
  const heads = await headlines();
  // a headline the residents already reacted to in the last runs is not news any more
  const recent = await db().collection('tzRuns').orderBy('at', 'desc').limit(10).get();   // (the desk's runs are in here too)
  const used = new Set(recent.docs.flatMap((d) => d.data().used || []));
  const fresh = heads.filter((h) => !used.has(h.url)).slice(0, 40);
  // ח24's posts of the last hours that are up on ציפציפ - the residents react to the channel itself
  const chPosts = (await liveNow(db().collection('tzPosts').where('by', '==', NEWS)).limit(15).get()).docs.map((d) => d.data()).filter((p) => p.article && ms(p.t) > Date.now() - 14 * 3600e3);
  const chArts = chPosts.length ? (await db().getAll(...chPosts.map((p) => db().collection('tzArticles').doc(p.article)))).map((d, i) => d.exists && { a: d.data(), p: chPosts[i] }) : [];
  const ch = chArts.filter((x) => x && x.a.src && !used.has(x.a.src.url)).slice(0, 6).map((x) => ({ post: x.p.id, text: x.p.text, headline: x.a.headline, real: x.a.src }));
  // the residents' own posts of the last hours - someone may answer one
  const res = (await liveNow(db().collection('tzPosts')).limit(40).get()).docs.map((d) => d.data())
    .filter((p) => !p.fan && p.by !== NEWS && ms(p.t) > Date.now() - 18 * 3600e3).slice(0, 12);
  const b = await brainNow(), C = byId(b);
  const posters = await candidates(cfg, C, MAIN);
  const rel = {};
  posters.forEach((c) => (c.relations || []).forEach((r) => { const id = typeof r === 'string' ? r : r.id; if (id) rel[id] = 3; }));
  const reactors = await candidates(cfg, C, REACT, { not: new Set(posters.map((c) => c.id)), boost: rel });
  const now = new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
  const arc = cfg.arc && cfg.arc.until > Date.now() ? cfg.arc : null, mayStart = !arc && Math.random() < BIG_CHANCE;
  const nm = (id) => (C[id] ? nameOf(C[id]) : id);
  // a reply knows whom it answers - their mother, a colleague, a rival (his "smart reactions", 2026-11-09)
  const rl = (a, b) => { const r = relOf(C[a], C[b]); return r ? `\nHOW THEY KNOW ${nm(b)}: ${r}` : ''; };

  const match = await ask(tzKey(), MATCH_RULES, [{ role: 'user', content: `Now (Israel): ${now}.
HEADLINES:
${fresh.map((h, i) => `${i}. [${h.src}] ${h.title}${h.desc ? ' - ' + clip(h.desc, 160) : ''}`).join('\n') || '(none)'}

CHANNEL (החרדות 24's posts on ציפציפ - its hysteria about a real story):
${ch.map((x, i) => `${i}. "${x.text}" (the real story [${x.real.src}]: ${x.real.title})`).join('\n') || '(none)'}

RESIDENTS' POSTS (the last hours):
${res.map((p, i) => `${i}. ${p.by} (${nm(p.by)}): ${clip(p.text, 160)}`).join('\n') || '(none)'}

POSTERS (id | name | newest video | world | role | relations):
${posters.map(rosterLine).join('\n')}

REACTORS:
${reactors.map(rosterLine).join('\n') || '(none)'}

STORY: ${arc ? `ongoing story in the verse (since ${day(arc.at)}): ${arc.text}` : mayStart ? 'a big story MAY start this run (optional).' : 'no ongoing story; keep life regular.'}` }],
    MATCH_SCHEMA, 'match', 'medium', 2500);
  add(match.u);
  if (match.out.bad_day) {
    await meta().set({ silent: today, silentWhy: clip(match.out.why, 300), silentAt: FieldValue.serverTimestamp() }, { merge: true });
    await runRef.set({ ...log, bad: true, why: clip(match.out.why, 300), heads: fresh.length });
    return { bad: true, why: match.out.why };
  }
  if (mayStart && clip(match.out.new_story, 1)) await meta().set({ arc: { text: clip(match.out.new_story, 300), at: Date.now(), until: Date.now() + 4 * 864e5 } }, { merge: true });

  // the plan, checked against who was drawn (the AI only matches; a name instead of the id is mapped back)
  const idIn = (list, by) => { by = String(by || '').replace(/^@/, '').trim(); const c = list.find((x) => x.id === by || nameOf(x) === by || x.name === by || (AL[x.id] && AL[x.id].handle === by)); return c && c.id; };
  const fits = (m) => (m.kind === 'news' ? !!fresh[m.ref] : m.kind === 'answer' ? !!res[m.ref] && res[m.ref].by !== m.id : m.kind === 'life' ? true : !!ch[m.ref]);
  const seen = new Set();
  const plan = match.out.main.map((m, i0) => ({ ...m, i0, id: idIn(posters, m.id) })).filter((m) => m.id && !seen.has(m.id) && seen.add(m.id) && fits(m));
  const last = async (id) => (await liveNow(db().collection('tzPosts').where('by', '==', id)).limit(6).get()).docs.map((d) => clip(d.data().text, 140));
  const what = (m) => {
    if (m.kind === 'news') { const h = fresh[m.ref]; return `A REAL HEADLINE [${h.src}]: ${h.title}${h.desc ? ' - ' + h.desc : ''}\nA post of their own about it.`; }
    if (m.kind === 'answer') { const p = res[m.ref]; return `${nm(p.by)} posted on ציפציפ: "${p.text}"${p.link ? ` (sharing the real headline [${p.link.src}]: ${p.link.title})` : ''}${rl(m.id, p.by)}\nThey REPLY to it (a comment under that post).`; }
    if (m.kind === 'life') return 'Their own day - no news: something small and real from their world, the way people post on Twitter.';
    const x = ch[m.ref];
    return `החרדות 24 (the verse's hysterical news channel) posted: "${x.text}" - its take on the real story [${x.real.src}]: ${x.real.title}\n${m.kind === 'ch_quote' ? 'They REPOST it with their own comment on top (a quote tweet).' : 'They COMMENT under it (a reply).'}`;
  };
  const wrote = await Promise.all(plan.map(async (m) => { try { const r = await writeOne(C[m.id], what(m), m.angle, await last(m.id)); add(r.u); return r.out; } catch (e) { console.error('tz one', m.id, e.message); return null; } }));

  const made = FieldValue.serverTimestamp(), docs = [];
  let order = 0;
  const doc = (by, text, x = {}) => { const d = { id: newId(), by, text: clip(text, 280), parent: null, quote: null, article: null, link: null, status: 'draft', t: null, made, run: runRef.id, order: order++, replies: 0, stamps: 0, quotes: 0, ...x }; d.root = x.root || d.id; docs.push(d); return d; };
  const mains = [];
  for (let i = 0; i < plan.length; i++) {
    const m = plan[i], w = wrote[i];
    if (!w || !clip(w.text, 1)) { mains.push(null); continue; }
    let x = {};
    if (m.kind === 'news') {   // always with its news link - a take without its story is gibberish (his note 2026-11-09)
      const h = fresh[m.ref]; if (!h.img) h.img = await ogImage(h.url); x = { link: { url: h.url, title: h.title, src: h.src, img: h.img || null } }; }
    if (m.kind === 'ch_quote') x = { quote: ch[m.ref].post };
    if (m.kind === 'ch_reply') x = { parent: ch[m.ref].post, root: ch[m.ref].post };
    if (m.kind === 'answer') x = { parent: res[m.ref].id, root: res[m.ref].root || res[m.ref].id };
    mains.push({ m, d: doc(m.id, w.text, x) });
  }
  // the reactors answer / repost this run's posts (after them - publish keeps the order); `to` = the index in the AI's main list
  const at = {};
  mains.forEach((x) => { if (x) at[x.m.i0] = x; });
  const rseen = new Set();
  const reacts = match.out.react.map((r) => ({ ...r, id: idIn(reactors, r.id) })).filter((r) => r.id && !rseen.has(r.id) && rseen.add(r.id) && at[r.to] && at[r.to].m.id !== r.id);
  const rwrote = await Promise.all(reacts.map(async (r) => {
    const t = at[r.to];
    const about = t.m.kind === 'news' ? ` (about the real headline: ${fresh[t.m.ref].title})` : t.m.kind.startsWith('ch') ? ` (about החרדות 24's post: "${ch[t.m.ref].text}")` : '';
    try { const o = await writeOne(C[r.id], `${nm(t.m.id)} posted on ציפציפ: "${t.d.text}"${about}${rl(r.id, t.m.id)}\n${r.kind === 'quote' ? 'They REPOST it with their own comment on top (a quote tweet).' : 'They REPLY to it (a comment under that post).'}`, r.angle, await last(r.id)); add(o.u); return o.out; }
    catch (e) { console.error('tz react', r.id, e.message); return null; }
  }));
  reacts.forEach((r, i) => { const w = rwrote[i], t = at[r.to].d; if (w && clip(w.text, 1)) doc(r.id, w.text, r.kind === 'quote' ? { quote: t.id } : { parent: t.id, root: t.root }); });

  if (docs.length) { const batch = db().batch(); docs.forEach((d) => batch.set(db().collection('tzPosts').doc(d.id), d)); await batch.commit(); }
  log.made = docs.length;
  await runRef.set({ ...log, heads: fresh.length, ch: ch.length, posters: posters.map((c) => c.id), reactors: reactors.map((c) => c.id),
    plan: plan.map((m) => `${m.id}:${m.kind}`), reacts: reacts.map((r) => `${r.id}:${r.kind}>${at[r.to].m.id}`), why: clip(match.out.why, 300),
    used: [...new Set(plan.map((m) => (m.kind === 'news' ? fresh[m.ref].url : m.kind.startsWith('ch') ? ch[m.ref].real.url : null)).filter(Boolean))], posts: docs.map((d) => d.id) });
  if (cfg.auto && docs.length) await publish(docs.map((d) => d.id), [], spread(slot));
  return { made: docs.length, run: runRef.id, posts: docs.map((d) => `${d.by}${d.parent ? ' (reply)' : d.quote ? ' (repost)' : ''}: ${d.text}`) };
}
// how long a run's posts take to go up: until the next run (morning -> noon, noon -> evening), the evening's until ~23:00
const spread = (slot) => (slot === 'morning' ? 4.5 : slot === 'noon' ? 5.5 : slot === 'evening' ? 3.5 : 0.5) * 3600e3;

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
async function home(cfg, uid) {
  const [arts, all] = await Promise.all([liveNow(db().collection('tzArticles')).limit(12).get(), liveNow(db().collection('tzPosts')).limit(150).get()]);
  // the residents' posts only (his note 2026-11-09: "mainly the characters, not החרדות") - ח24 is the banner above them
  const every = all.docs.map((d) => pub(d.data())), tops = every.filter((p) => !p.parent && !p.fan && p.by !== NEWS).slice(0, 5);
  const list = arts.docs.map((d) => pubArt(d.data())), lead = list[0] || null;
  // the citizen's card (his note 2026-11-09: "not clear what the characters are reacting to"): ח24's post on the newest story
  // the residents really answered (its comments and reposts, in the last day and a half), and only those answers under it -
  // never someone's comment on something else
  const said = (a) => (a.post ? every.filter((p) => !p.fan && p.by !== NEWS && (p.parent === a.post || p.quote === a.post)) : []);
  const topic = list.find((a) => a.t > Date.now() - 36 * 3600e3 && said(a).length) || null;
  const talk = topic ? said(topic).sort((a, b) => a.t - b.t).slice(0, 3) : [];
  const chPost = topic && every.find((p) => p.id === topic.post);
  const q = await quoted([...tops, ...talk]), qa = await articlesOf(Object.values(q)), startToday = Date.parse(day() + 'T00:00:00+02:00');
  // what a post is about, in one small row on the home: the news it shares, or the post it reposts (with ח24's headline)
  const lk = (l) => (l ? { title: l.title, src: l.src } : null);
  return { lead,
    topic: topic ? { ...topic, text: chPost ? chPost.text : topic.headline } : null,
    talk: talk.map((p) => ({ id: p.id, by: p.by, text: p.text, t: p.t, stamps: p.stamps, replies: p.replies, root: p.root, kind: p.quote === topic.post ? 'quote' : 'reply' })),
    posts: tops.map((p) => ({ id: p.id, by: p.by, text: p.text, t: p.t, stamps: p.stamps, replies: p.replies, article: p.article, link: lk(p.link),
      quote: p.quote && q[p.quote] ? { id: p.quote, by: q[p.quote].by, text: q[p.quote].text, link: lk(q[p.quote].link), headline: q[p.quote].article && qa[q[p.quote].article] ? qa[q[p.quote].article].headline : null } : null })),
    silent: cfg.silent === day(), quiet: cfg.silent === day() || !tops.length || tops[0].t < startToday,
    // the verse names of the impressions it shows (id -> {name, handle}, like op=me), so the home needs one call
    names: Object.fromEntries([...new Set([...tops, ...talk].flatMap((p) => [p.by, p.quote && q[p.quote] && q[p.quote].by]))].filter((id) => id && AL[id]).map((id) => [id, AL[id]])),
    // a signed-in visitor's own numbers, for the citizen's "זכות הדיבור שלך" card next to it (plan tz-home D1, his yes 2026-11-08)
    ...(uid ? { mine: await mineOf(uid) } : {}) };
}
async function mineOf(uid) {
  const list = (await db().collection('tzPosts').where('fan.uid', '==', uid).limit(300).get()).docs.map((d) => d.data()).filter((p) => p.status === 'live');
  return { posts: list.length, stamps: list.reduce((n, p) => n + (p.stamps || 0), 0), replies: list.reduce((n, p) => n + (p.replies || 0), 0) };
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
  let quote = null;
  if (b.quote) { const q = await db().collection('tzPosts').doc(clip(b.quote, 20)).get(); if (q.exists && q.data().status === 'live') quote = q.id; }
  const doc = { id: newId(), by: null, fan, text, parent: null, quote, article: null, link: null, status: 'live', t: Timestamp.now(), made: FieldValue.serverTimestamp(),
    order: 0, replies: 0, stamps: 0, quotes: 0, ...(m.unchecked ? { unchecked: true } : {}) };
  doc.root = doc.id;
  const w = db().batch().set(db().collection('tzPosts').doc(doc.id), doc);
  if (quote) w.update(db().collection('tzPosts').doc(quote), { quotes: FieldValue.increment(1) });
  await w.commit();
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
  if (op === 'home') return home(cfg, uid);
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
exports.verseTzRun = onSchedule({ schedule: '0 8,13,19 * * *', timeZone: 'Asia/Jerusalem', region: 'europe-west1', secrets: SECRETS, memory: '512MiB', timeoutSeconds: 540 }, async () => {
  const h = new Date(Date.now() + 2 * 3600e3).getUTCHours(), slot = h < 11 ? 'morning' : h < 16 ? 'noon' : 'evening';
  try { console.log('verseTzRun', JSON.stringify(await run(slot))); } catch (e) { console.error('verseTzRun', e.message); }
  // then ח24's own desk (it stays silent by itself on a bad day - run() set it)
  try { console.log('verseTzDesk', JSON.stringify(await desk(slot))); } catch (e) { console.error('verseTzDesk', e.message); }
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
let wikiData = null, wikiAt = 0, lastVid = {};
async function wikiNow() {
  if (wikiData && Date.now() - wikiAt < 120e3) return wikiData;
  try {
    const w = await (await fetch('https://storage.googleapis.com/shlomiverse-media/wiki/data/wiki.json')).json();
    wikiData = Object.fromEntries((w.characters || []).map((c) => [c.id, c])); wikiAt = Date.now();
    // each resident's newest video (its date) - who is fresh on the verse right now
    lastVid = {};
    for (const v of w.videos || []) { const t = Date.parse(v.date || ''); if (t) for (const id of v.cast || []) lastVid[id] = Math.max(lastVid[id] || 0, t); }
  } catch (e) {}
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
  const W = await wikiNow(), name = (by) => (by === NEWS ? 'החרדות 24' : (AL[by] && AL[by].name) || (W[by] && W[by].name) || by);
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
    return { title: `${a.headline} · החרדות 24`, desc: a.sub, img: a.img || `${SITE}/charadot/img/og.jpg` };
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
  if (op === 'tzDesk') return desk('manual', b.n);   // ח24 covers the day now
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

module.exports = { _ogImage: ogImage, verseTzPage: exports.verseTzPage, verseTz: exports.verseTz, verseTzRun: exports.verseTzRun, verseTzOnPost: exports.verseTzOnPost, owner, SECRETS, _run: run, _desk: desk, _headlines: headlines, _publish: publish, _candidates: candidates };
