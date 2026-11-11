// The Shlomiverse's video catalog (his rule, 2026-11-05): the list of videos lives in the database, the files in the
// storage - never again a list rebuilt from whatever one computer has (on Nov 3 a rebuild on a computer missing 20
// exports took those 20 videos off the live site).
//   catalogVideos/<id>       one record per video: title, teaser, series, cast, date, t (sort key), src, poster, url
//                            (a TikTok-only clip), archive + ig (old Instagram reels), card (the chat's one-line map),
//                            hidden, source, created, updated. Only `hidden` takes a video off; nothing deletes.
//   catalogTranscripts/<id>  { text, onScreen } - what is said in it and the words burned into it (an "אף אחד:" meme
//                            says it all on screen), for the chat (never served)
//   catalogCharacters / catalogSeries / catalogGames / catalogSites  everything else the site shows, one record per
//                            thing (content.js, since 2026-11-05 evening); portraits = files in wiki/img/c/
// compose() = the records -> wiki/data/wiki.json (the site, the links page, stats) and wiki-brain.json (the chat), in
// exactly the shape scripts/wiki/build.py wrote them, so nothing that reads them changes. It runs after every change
// (versePublish: the studio, insta-to-verse, push.cjs, a session; /backstage/) and every 15 minutes (verseHeal) - so
// a file written by anything else is put right again within minutes.
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

const ascii = (a) => /^[\x00-\x7f]*$/.test(a);
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
const BRAIN = ['id', 'name', 'name_en', 'aka', 'world', 'role', 'brief', 'personality', 'catchphrases', 'speech', 'behavior', 'comedy', 'themes', 'dont', 'look', 'writing_rules', 'relations', 'sheet', 'love', 'life'];

// one from each series in turn, so no single series fills the top of the page (build.py's interleave)
function interleave(chars) {
  const groups = new Map();
  for (const c of chars) { if (!groups.has(c.series)) groups.set(c.series, []); groups.get(c.series).push(c); }
  for (const g of groups.values()) g.sort((a, b) => (!a.img - !b.img) || (b.videos.length - a.videos.length));
  const order = [...groups.values()].sort((a, b) => b.reduce((n, c) => n + c.videos.length, 0) - a.reduce((n, c) => n + c.videos.length, 0));
  const mixed = [];
  for (let i = 0; i < Math.max(0, ...order.map((g) => g.length)); i++) for (const g of order) if (g[i]) mixed.push(g[i]);
  return [...mixed.filter((c) => c.img), ...mixed.filter((c) => !c.img)];
}

// the records -> the site's wiki.json and the chat's brain. dry = only return them.
async function compose(admin, { dry = false } = {}) {
  const db = admin.firestore(), media = admin.storage().bucket(MEDIA), priv = admin.storage().bucket(PRIVATE);
  const all = async (col) => (await db.collection(col).get()).docs.map((d) => ({ id: d.id, ...d.data() })).filter((x) => !x.hidden);
  const [vs, ts, chars, worlds, games, sites, [faces]] = await Promise.all([all('catalogVideos'), db.collection('catalogTranscripts').get(),
    all('catalogCharacters'), all('catalogSeries'), all('catalogGames'), all('catalogSites'), media.getFiles({ prefix: 'wiki/img/c/' })]);
  const text = Object.fromEntries(ts.docs.map((d) => { const x = d.data(); return [d.id, (x.onScreen ? `טקסט על המסך: ${x.onScreen}
` : '') + (x.text || '')]; }));
  const face = Object.fromEntries(faces.map((f) => [f.name.slice('wiki/img/c/'.length).replace(/\.jpg$/, ''), BASE_URL + f.name.slice(5) + '?v=' + Buffer.from(f.metadata.md5Hash, 'base64').toString('hex').slice(0, 8)]));
  const videos = vs.sort(order);
  const byChar = {};
  for (const v of videos) for (const c of v.cast || []) (byChar[c] ||= []).push(v.id);
  const byOrder = (a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || (a.id < b.id ? -1 : 1);
  chars.sort(byOrder); worlds.sort(byOrder);
  const characters = interleave(chars.map((c) => ({
    id: c.id, name: c.name, aka: (c.aka || []).filter((a) => !ascii(a) || a.includes(' ')).slice(0, 4), series: c.series || null, role: c.role || '',
    tagline: c.tagline || '', bio: c.bio || '', ask: c.ask || [], quotes: (c.catchphrases || []).slice(0, 4), color: c.color || '#ff7a45',
    img: face[c.id] || null, site: c.site || null, videos: byChar[c.id] || [], relations: (c.relations || []).filter((r) => r?.id).map((r) => ({ id: r.id })),
  })));
  const series = worlds.map((s) => ({ id: s.id, title: s.title || '', blurb: s.blurb || '', site: s.site || null,
    characters: characters.filter((c) => c.series === s.id).map((c) => c.id), videos: videos.filter((v) => v.series === s.id).map((v) => v.id) }))
    .sort((a, b) => b.videos.length - a.videos.length);
  const siteList = sites.sort(byOrder), cards = {};
  for (const s of siteList) { const card = { url: s.url, title: s.title || '', img: s.img || null, host: s.host || '' }; cards[s.id] = card; for (const o of s.mainOf || []) cards[o] = card; }
  const gameList = games.map((g) => ({ id: g.id, url: g.url, title: g.title || '', tagline: g.tagline || '', img: g.img || null, chars: g.chars || [], site: g.site || '', date: g.date || '', ...(g.record ? { record: g.record } : {}) }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const wiki = { series, characters, videos: videos.map(siteVideo), sites: cards,
    site_list: siteList.map((s) => ({ id: s.id, url: s.url, title: s.title || '', about: s.about || '', whose: s.whose || [], in: s.in || null, img: s.img || null, ...(s.topic ? { topic: s.topic, tagline: s.tagline || '' } : {}) })),
    games: gameList };
  const raw = Object.fromEntries(chars.map((c) => [c.id, c]));
  const brain = {
    worlds: series.map((s) => ({ id: s.id, title: s.title, blurb: s.blurb, site: s.site, brief: worlds.find((w) => w.id === s.id)?.brief || '' })),
    characters: characters.map((c) => ({ ...pick(raw[c.id], BRAIN), site: c.site, videos: c.videos, tagline: c.tagline, bio: c.bio })),
    videos: videos.map((v) => ({ id: v.id, title: v.title || '', teaser: v.teaser || '', cast: v.cast || [], date: v.date || '', card: v.card || v.teaser || '', transcript: text[v.id] || '' })),
    sites: siteList.map((s) => ({ id: s.id, url: s.url, title: s.title || '', about: s.about || '', whose: s.whose || [], in: s.in || null })),
    games: gameList.map((g) => pick(g, ['id', 'url', 'title', 'tagline', 'chars', 'record'])),
  };
  if (!dry) {
    const body = Buffer.from(JSON.stringify(wiki));
    // never put a broken site live: characters leave only one by one (hide) - a compose with half of them gone (a read
    // that failed, an empty database) stops here and the live file stays
    const [now] = await media.file('wiki/data/wiki.json').download().catch(() => [null]);
    const had = now ? (JSON.parse(now.toString('utf8')).characters || []).length : 0;
    if (!characters.length || characters.length < had / 2) throw new Error(`compose: ${characters.length} characters (the site has ${had}) - not written`);
    await media.file('wiki/data/wiki.json').save(body, { resumable: false, metadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-cache, max-age=0' } });
    await priv.file('wiki-brain.json').save(Buffer.from(JSON.stringify(brain)), { resumable: false, metadata: { contentType: 'application/json; charset=utf-8' } });
  }
  return { wiki, brain, videos: videos.length, characters: characters.length };
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
