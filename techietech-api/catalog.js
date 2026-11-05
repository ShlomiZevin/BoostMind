// The Shlomiverse's video catalog (his rule, 2026-11-05): the list of videos lives in the database, the files in the
// storage - never again a list rebuilt from whatever one computer has (on Nov 3 a rebuild on a computer missing 20
// exports took those 20 videos off the live site).
//   catalogVideos/<id>       one record per video: title, teaser, series, cast, date, t (sort key), src, poster, url
//                            (a TikTok-only clip), archive + ig (old Instagram reels), card (the chat's one-line map),
//                            hidden, source, created, updated. Only `hidden` takes a video off; nothing deletes.
//   catalogTranscripts/<id>  { text, onScreen } - what is said in it and the words burned into it (an "אף אחד:" meme
//                            says it all on screen), for the chat (never served)
//   wiki/data/base.json      (media bucket) everything else the site reads - characters, series, sites, games -
//                            written by scripts/wiki/push.cjs from the characters' canon (until they move here too)
//   wiki-base-brain.json     (private bucket) the same for the chat: the characters' full profiles, worlds, sites, games
// compose() = base + the catalog -> wiki/data/wiki.json (the site, the links page, stats) and wiki-brain.json (the chat),
// in exactly the shape scripts/wiki/build.py wrote them, so nothing that reads them changes. It runs after every
// change: versePublish (the studio, insta-to-verse, a session), /backstage/, and scripts/wiki/push.cjs.
const MEDIA = 'shlomiverse-media', PRIVATE = 'shlomiverse-private';
const BASE_URL = `https://storage.googleapis.com/${MEDIA}/wiki/`;

const order = (a, b) => (a.t < b.t ? 1 : a.t > b.t ? -1 : (a.seq || 0) - (b.seq || 0));   // newest first, then as imported

// the site's entry for one video: the keys build.py wrote, the optional ones only when there
function siteVideo(v) {
  const o = { id: v.id, title: v.title || '', teaser: v.teaser || '', series: v.series || null, cast: v.cast || [] };
  if (v.url) o.url = v.url;
  if (v.src) o.src = v.src;
  o.poster = v.poster ?? null;
  o.date = v.date || '';
  if (v.archive) o.archive = true;
  if (v.ig) o.ig = v.ig;
  return o;
}

async function readJson(file) { const [buf] = await file.download(); return JSON.parse(buf.toString('utf8')); }

// base + the catalog -> the site's wiki.json and the chat's brain. dry = only return them.
async function compose(admin, { dry = false, base = null, baseBrain = null } = {}) {
  const db = admin.firestore(), media = admin.storage().bucket(MEDIA), priv = admin.storage().bucket(PRIVATE);
  [base, baseBrain] = await Promise.all([base || readJson(media.file('wiki/data/base.json')), baseBrain || readJson(priv.file('wiki-base-brain.json'))]);
  const [vs, ts] = await Promise.all([db.collection('catalogVideos').get(), db.collection('catalogTranscripts').get()]);
  const text = Object.fromEntries(ts.docs.map((d) => { const x = d.data(); return [d.id, (x.onScreen ? `טקסט על המסך: ${x.onScreen}
` : '') + (x.text || '')]; }));
  const videos = vs.docs.map((d) => ({ id: d.id, ...d.data() })).filter((v) => !v.hidden).sort(order);
  const byChar = {};
  for (const v of videos) for (const c of v.cast || []) (byChar[c] ||= []).push(v.id);
  const series = base.series.map((s) => ({ ...s, videos: videos.filter((v) => v.series === s.id).map((v) => v.id) }))
    .sort((a, b) => b.videos.length - a.videos.length);
  const wiki = { series, characters: base.characters.map((c) => ({ ...c, videos: byChar[c.id] || [] })), videos: videos.map(siteVideo),
    sites: base.sites, site_list: base.site_list, games: base.games };
  const brain = { worlds: baseBrain.worlds, characters: baseBrain.characters.map((c) => ({ ...c, videos: byChar[c.id] || [] })),
    videos: videos.map((v) => ({ id: v.id, title: v.title || '', teaser: v.teaser || '', cast: v.cast || [], date: v.date || '', card: v.card || v.teaser || '', transcript: text[v.id] || '' })),
    sites: baseBrain.sites, games: baseBrain.games };
  if (!dry) {
    await media.file('wiki/data/wiki.json').save(Buffer.from(JSON.stringify(wiki)), { resumable: false,
      metadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-cache, max-age=0' } });
    await priv.file('wiki-brain.json').save(Buffer.from(JSON.stringify(brain)), { resumable: false, metadata: { contentType: 'application/json; charset=utf-8' } });
  }
  return { wiki, brain, videos: videos.length };
}

// the media address of a file in the bucket, with ?v=<md5> so a replaced file is never served stale (as push.cjs did)
async function mediaUrl(admin, path) {
  const f = admin.storage().bucket(MEDIA).file('wiki/' + path);
  const [ok] = await f.exists();
  if (!ok) return null;
  const [meta] = await f.getMetadata();
  return BASE_URL + path + '?v=' + Buffer.from(meta.md5Hash, 'base64').toString('hex').slice(0, 8);
}

module.exports = { compose, mediaUrl, siteVideo, order, MEDIA, PRIVATE, BASE_URL };
