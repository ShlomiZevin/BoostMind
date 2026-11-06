// versePublish - the one way a video gets onto the Shlomiverse (his rule, 2026-11-05): the studio (render/publish.mjs),
// insta-to-verse (old Instagram reels) and any session sending a missed video all call this. The list of videos lives
// in the database (catalog.js), the files in gs://shlomiverse-media/wiki/v/ - nothing depends on what one computer has.
//   POST https://europe-west1-boostmind-b052c.cloudfunctions.net/versePublish   authorization: Key <VERSE_PUBLISH_KEY>
//   (not "Bearer": Google's front door takes a Bearer for a Google identity token and refuses it before it gets here)
//   {op: 'uploadUrl', id, kind: 'video' | 'poster', contentType}   -> {uri}: PUT the whole file there (same content type)
//                                                                     - wiki/v/<id>.mp4 / wiki/v/<id>.jpg
//   {op: 'video', id, title?, teaser?, cast?, series?, date?, t?, transcript?, onScreen?, archive?, ig?, url?, card?, dryRun?}
//        (onScreen: the words burned into the video - feeds the title / card and the chat, kept like the transcript)
//        the record, by id, again and again: a field not sent keeps its value, nothing is ever blanked. Its files must be
//        in the bucket (or `url` for a video that lives elsewhere). No title / teaser = Terra writes them from the words;
//        no card (the chat's map line) = written too. No cast (nobody said who is in it) = the AI picks the characters
//        from the words (castBy: 'ai' in the answer - check it). Then the site and the chat are rebuilt. -> {ok, url, video, castBy}
//   {op: 'hide', id, hidden, kind?}   the only way a video (or a character / series / game / site) leaves the site, and comes back
//   {op: 'get', id, kind?}     the record as it is (+ live: is it on the site)
//   {op: 'list', kind?}        every id, its title, hidden
//   {op: 'rebuild'}            compose the site and the chat again
// Everything else the site shows (content.js, since 2026-11-05 evening) - kind = character | series | game | site:
//   {op: 'put', kind, id, ...fields, clear?: [field]}   a direct edit: sets what it sends (a new one needs its name/title)
//   {op: 'sync', kind, items: [{id, ...fields}], by}    from a computer's files (scripts/wiki/push.cjs): three-way per
//        field - only what that computer's files really changed; never removes, never blanks, never undoes a newer value
//   {op: 'uploadUrl', id, kind: 'portrait', contentType: 'image/jpeg'}   a character's face, wiki/img/c/<id>.jpg (480x600)
//   {op: 'log', kind?, id?, limit?}   who changed what, when, and the value before
// `by` (any op): who is writing - the computer / session, kept in the log.
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');
const { compose, mediaUrl, siteVideo, MEDIA } = require('./catalog');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const LOCAL = process.env.FUNCTIONS_EMULATOR === 'true';
const PUBLISH_KEY = defineSecret('VERSE_PUBLISH_KEY');
const OPENAI = defineSecret('VERSE_SITE_OPENAI_KEY');   // titles / teasers / cast: the site's key (one per area, 2026-11-06)
const SITE = 'https://shlomiverse.com';
const ID = /^[a-z0-9][a-z0-9_-]{1,80}$/i;
const TYPES = { video: ['v', 'mp4', ['video/mp4']], poster: ['v', 'jpg', ['image/jpeg']], portrait: ['img/c', 'jpg', ['image/jpeg']] };
const content = require('./content');
const dayIL = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(d);
const nowIL = () => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date()).map((x) => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`; };

function keyOk(req) {
  const got = String(req.get('x-publish-key') || req.get('authorization') || '').replace(/^(Key|Bearer) /, '');
  const want = LOCAL ? process.env.VERSE_PUBLISH_KEY || 'local-publish' : PUBLISH_KEY.value();
  const a = Buffer.from(got), b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// title, teaser and the chat's card from the words (Terra) - only for what wasn't sent
async function writeCopy(v, words, names, onScreen = '') {
  const key = LOCAL ? process.env.WIKI_OPENAI_KEY || process.env.VERSE_OPENAI_KEY : OPENAI.value();
  const prompt = `אתה כותב את הכותרות של השלומיוורס (shlomiverse.com) - עולם קומי של דמויות קבועות של שלומי זוין, שהקהל עוקב אחריהן כמו סדרה.
הדמויות הן אנשים אמיתיים בתוך העולם: כותבים מבפנים, בעובדות שלהם. אסור: להסביר את הבדיחה, "פרודיה", "סאטירה", "דמות", "מערכון", "שלומי מגלם", "מעריצים". בלי אימוג'ים, בלי מקף ארוך.
סרטון: ${names.join(', ') || 'לא ידוע'}${v.title ? ` · הכותרת שלו: ${v.title}` : ''}
${onScreen ? `טקסט על המסך: ${String(onScreen).slice(0, 1500)}
` : ''}מה נאמר בו:
${String(words || '').slice(0, 6000) || '(אין תמליל)'}

החזר JSON בלבד: {"title": "כותרת קצרה ומושכת", "teaser": "משפט אחד שגורם ללחוץ, בלי לספיילר את הפאנץ'", "card": "משפט אחד על מה שקורה, ואז 'נושאים:' ורשימה של כל נושא, מקום, חפץ, אירוע ורעיון שמוזכרים, גם בדרך אגב, עד 18"}`;
  const r = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-5.6-terra', input: prompt, reasoning: { effort: 'low' }, text: { format: { type: 'json_object' } } }) });
  const j = await r.json();
  if (!r.ok) throw new Error('terra ' + r.status + ' ' + JSON.stringify(j).slice(0, 200));
  const txt = (j.output || []).flatMap((o) => o.content || []).find((c) => c.type === 'output_text')?.text || '{}';
  return JSON.parse(txt);
}

// who is in the video, when nobody said (his find, 2026-11-05: 12 videos - yesterday's Hani + Yotam among them - had no
// characters, so no character's page showed them): the AI reads the words / the on-screen text / the title and picks from
// the verse's own characters. It decides (his rule: judgement = the AI, never a list in code); an id it invents is dropped.
async function pickCast(v, words, onScreen, chars) {
  const key = LOCAL ? process.env.WIKI_OPENAI_KEY || process.env.VERSE_OPENAI_KEY : OPENAI.value();
  const list = chars.map((c) => `${c.id} | ${c.name} | ${c.role || ''}`).join('\n');
  const prompt = `סרטון מהשלומיוורס (עולם של דמויות קבועות שכולן מגלם שלומי זוין). מי הדמויות שמופיעות בו?
כותרת: ${v.title || '-'}
${onScreen ? `טקסט על המסך: ${String(onScreen).slice(0, 1200)}\n` : ''}מה נאמר:
${String(words || '').slice(0, 6000) || '(אין תמליל)'}

הדמויות (id | שם | תפקיד):
${list}

החזר JSON בלבד: {"cast": ["<id>", ...]} - רק ids מהרשימה, הדמות הראשית ראשונה, רק מי שבאמת מופיע או מדבר בסרטון (לא מי שרק מוזכר). אם אין אף דמות מהרשימה - רשימה ריקה.`;
  const r = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-5.6-terra', input: prompt, reasoning: { effort: 'low' }, text: { format: { type: 'json_object' } } }) });
  const j = await r.json();
  if (!r.ok) throw new Error('terra ' + r.status);
  const ids = new Set(chars.map((c) => c.id));
  const out = JSON.parse((j.output || []).flatMap((o) => o.content || []).find((c) => c.type === 'output_text')?.text || '{}');
  return [...new Set((out.cast || []).filter((c) => ids.has(c)))];
}

// the characters (for a video's series, names and the AI's cast pick) - from the records
async function base() { return { characters: (await db.collection('catalogCharacters').get()).docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => !c.hidden) }; }

async function video(b) {
  const ref = db.collection('catalogVideos').doc(b.id), was = (await ref.get()).data() || null;
  const src = b.url ? null : await mediaUrl(admin, `v/${b.id}.mp4`), poster = await mediaUrl(admin, `v/${b.id}.jpg`);
  if (!b.url && !src && !was?.url) return { error: 'no_file', detail: `upload wiki/v/${b.id}.mp4 first (op uploadUrl)` };
  const w = await base();
  // an empty list counts as not sent - it never blanks the cast that is there (Sketch Studio's catch)
  const sent = Array.isArray(b.cast) ? b.cast.filter((c) => ID.test(c)) : [];
  const cast = sent.length ? sent : was?.cast || [];
  const seriesOf = Object.fromEntries(w.characters.map((c) => [c.id, c.series]));
  const v = {
    title: b.title || was?.title || '', teaser: b.teaser || was?.teaser || '', cast,
    series: b.series || was?.series || cast.map((c) => seriesOf[c]).find(Boolean) || null,
    date: b.date || was?.date || dayIL(), t: b.t || was?.t || (b.date ? `${b.date}T12:00:00` : nowIL()),
    src: src || was?.src || null, poster: poster || was?.poster || b.poster || null,
    ...(b.url || was?.url ? { url: b.url || was.url } : {}), ...(b.archive || was?.archive ? { archive: true } : {}), ...(b.ig || was?.ig ? { ig: b.ig || was.ig } : {}),
    card: b.card || was?.card || '', hidden: was?.hidden || false, source: b.source || was?.source || 'publish', seq: was?.seq || 0,
  };
  const tw = (await db.collection('catalogTranscripts').doc(b.id).get()).data() || {};
  const words = b.transcript != null ? String(b.transcript) : tw.text || '', onScreen = b.onScreen != null ? String(b.onScreen) : tw.onScreen || '';
  let castBy = Array.isArray(b.cast) && b.cast.length ? 'sent' : was?.cast?.length ? 'kept' : null;
  if (!v.cast.length && !v.url) {
    v.cast = await pickCast(v, words, onScreen, w.characters).catch((e) => { console.error('pickCast', b.id, e.message); return []; });
    castBy = v.cast.length ? 'ai' : 'none';
    v.series = b.series || was?.series || v.cast.map((c) => seriesOf[c]).find(Boolean) || null;
  }
  let wrote = null;
  if (!v.title || !v.teaser || !v.card) {
    const names = cast.map((c) => w.characters.find((x) => x.id === c)?.name || c);
    wrote = await writeCopy(v, words, names, onScreen).catch((e) => ({ error: e.message }));
    if (!wrote.error) { v.title ||= wrote.title || ''; v.teaser ||= wrote.teaser || ''; v.card ||= wrote.card || v.teaser; }
  }
  if (!v.title) return { error: 'no_title', detail: wrote?.error || 'send a title (Terra could not write one)' };
  if (b.dryRun) return { ok: true, dryRun: true, video: siteVideo({ id: b.id, ...v }), card: v.card, wrote: !!wrote, castBy };
  await ref.set({ ...v, updated: FieldValue.serverTimestamp(), ...(was ? {} : { created: FieldValue.serverTimestamp() }) }, { merge: true });
  if (b.transcript != null || b.onScreen != null) await db.collection('catalogTranscripts').doc(b.id).set({ ...(b.transcript != null ? { text: String(b.transcript) } : {}), ...(b.onScreen != null ? { onScreen: String(b.onScreen).slice(0, 3000) } : {}) }, { merge: true });
  const out = await compose(admin);
  // castBy: who decided the characters - 'sent' (the caller), 'kept' (already there), 'ai' (picked now), 'none' (nobody found)
  return { ok: true, id: b.id, url: `${SITE}/v/${b.id}`, video: siteVideo({ id: b.id, ...v }), live: !v.hidden, videos: out.videos, wrote: !!wrote, castBy };
}

async function handle(b) {
  const by = b.by || '';
  if (b.op === 'sync') { const r = await content.sync(b.kind, Array.isArray(b.items) ? b.items : [], by, !!b.dryRun); if (!r.error && !b.dryRun && !b.noCompose && (r.added.length || r.changed.length)) r.composed = (await compose(admin)).characters; return r; }
  if (b.op === 'log') return content.history(b);
  if (b.op === 'list') return b.kind && b.kind !== 'video' ? content.list(b.kind, !!b.full) : { videos: (await db.collection('catalogVideos').select('title', 'hidden', 'date').get()).docs.map((d) => ({ id: d.id, ...d.data() })) };
  if (b.op === 'rebuild') { const c = await compose(admin); return { ok: true, videos: c.videos, characters: c.characters }; }
  if (!ID.test(b.id || '')) return { error: 'id', detail: 'letters, digits, - and _ only' };
  if (b.op === 'uploadUrl') {
    const t = TYPES[b.kind];
    if (!t || !t[2].includes(b.contentType)) return { error: 'kind', detail: 'video (video/mp4), poster (image/jpeg) or portrait (image/jpeg)' };
    const path = `wiki/${t[0]}/${b.id}.${t[1]}`;
    const [uri] = await admin.storage().bucket(MEDIA).file(path).createResumableUpload({ metadata: { contentType: b.contentType, cacheControl: 'public, max-age=31536000', metadata: { by: String(by).slice(0, 120), mtime: String(Date.now()) } } });
    return { uri, path };
  }
  if (b.kind && b.kind !== 'video') {
    // (the studio's own fields - a pace from the Reader, a voice preset - aren't on the site: no compose for those)
    if (b.op === 'put') { const r = await content.put(b, by); if (r.ok && r.changed.some((f) => !content.STUDIO.includes(f))) await compose(admin); return r; }
    if (b.op === 'get') return content.get(b.kind, b.id);
    if (b.op === 'hide') { const r = await content.hide(b.kind, b.id, b.hidden, by); if (r.ok) await compose(admin); return r; }
    return { error: 'op' };
  }
  if (b.op === 'video') return video(b);
  const ref = db.collection('catalogVideos').doc(b.id), was = await ref.get();
  if (!was.exists) return { error: 'not_found' };
  if (b.op === 'get') return { id: b.id, ...was.data(), live: !was.data().hidden, url: `${SITE}/v/${b.id}` };
  if (b.op === 'hide') { await ref.update({ hidden: b.hidden !== false, updated: FieldValue.serverTimestamp() }); return { ok: true, hidden: b.hidden !== false, videos: (await compose(admin)).videos }; }
  return { error: 'op' };
}

exports.versePublish = onRequest({ region: 'europe-west1', secrets: LOCAL ? [] : [PUBLISH_KEY, OPENAI], maxInstances: 2, memory: '512MiB', timeoutSeconds: 300 }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!keyOk(req)) return res.status(401).json({ error: 'key' });
  try {
    const r = await handle(req.body || {});
    if (r.error) console.warn('versePublish', req.body?.op, req.body?.id, r.error);
    else console.log('versePublish', req.body?.op, req.body?.id || '');
    res.status(r.error ? (r.error === 'not_found' ? 404 : 400) : 200).json(r);
  } catch (e) {
    console.error('versePublish failed', req.body?.op, e);
    res.status(500).json({ error: 'server', detail: e.message });
  }
});
exports._publish = { handle };
// the site and the chat composed again every 15 minutes (his ask, 2026-11-05: nothing may break the site) - whatever wrote
// wiki.json behind the records' back (an old push.cjs on a computer that didn't pull) is put right within minutes
exports.verseHeal = require('firebase-functions/v2/scheduler').onSchedule({ schedule: 'every 15 minutes', region: 'europe-west1', memory: '512MiB', timeoutSeconds: 120 }, async () => {
  const media = admin.storage().bucket(MEDIA), { wiki } = await compose(admin, { dry: true });
  const [buf] = await media.file('wiki/data/wiki.json').download().catch(() => [Buffer.from('')]);
  if (buf.toString('utf8') === JSON.stringify(wiki)) return;
  const c = await compose(admin);
  console.warn('verseHeal: wiki.json differed from the records - composed again', c.characters, 'characters', c.videos, 'videos');
});   // the owner page (verse.js) hides / shows a video through the same code
