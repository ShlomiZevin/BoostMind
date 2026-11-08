// Piko (פיקו, shlomiverse.com/piko/) - Shlomi's own picture + video maker (2026-11-06, his ask: "something like
// Leonardo, but my own - Leonardo costs x2-x4 what the models cost"):
//   pictures  OpenAI GPT Image 2.5 flare / sunburst, with up to 16 reference images (he usually works from references)
//   videos    Seedance 2.0 Mini through EvoLink - a start frame, sometimes an end frame. EvoLink takes real faces (ByteDance's
//             own API refuses them) at ~$0.11 per 6 s at 480p with sound; Leonardo charged $0.54 for the same clip (tested
//             2026-11-06, memory reference_video_direct_prices)
//   a spoken prompt  gpt-4o-transcribe, then a short rewrite into a clear prompt (he talks, it makes sense of it)
// Everything his app makes goes into the studio's asset library (gs://shlomiverse-studio/library/ + index.json - the
// editor's Assets page on both computers, render/library.mjs merges it by id).
//
// One API for every client (piko-api.md):
//   his app      shlomiverse.com/piko/ - his Google account (a Firebase ID token: Authorization: Bearer <token>)
//   other tools  startdoing.co.il ... - their own key (Authorization: Key pk_...), made with scripts/piko/client.mjs;
//                every job keeps who made it, so Backstage splits the spend per client
// Costs (Backstage -> הוצאות, costs.js): OpenAI on its own key "shlomiverse-piko", read from OpenAI by key; EvoLink from
// EvoLink's own answer per task (usage.cost) and its balance (/v1/credits) - nothing estimated by us is shown as spend.
//
// A job is a Firestore doc (pikoJobs). The API writes it, pikoWork (a Firestore trigger, up to 9 min) does it - a request
// through hosting is cut at 60 s and a picture with many references takes longer. A video's EvoLink task is finished by
// EvoLink's callback (/hook), by whoever asks about the job, or by pikoSweep (every 5 min) - whichever comes first.
const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('crypto');

if (!admin.apps.length) admin.initializeApp();
const OPENAI = defineSecret('VERSE_PIKO_OPENAI_KEY');
const EVOLINK = defineSecret('EVOLINK_API_KEY');
const SECRETS = [OPENAI, EVOLINK];
const REGION = 'europe-west1';
const OWNER = 'shlomi@boostart.io';
const BUCKET = 'shlomiverse-studio';
const SELF = `https://${REGION}-boostmind-b052c.cloudfunctions.net/piko`;
const CORS = [/^https:\/\/boostmind-b052c(--[\w-]+)?\.web\.app$/, /^https:\/\/(www\.)?shlomiverse\.com$/, /^https:\/\/(www\.)?startdoing\.co\.il$/, /^http:\/\/localhost(:\d+)?$/];
const JOBS = 'pikoJobs', CLIENTS = 'pikoClients', META = 'pikoMeta';
const EVO = 'https://api.evolink.ai';
const TEXT_MODEL = 'gpt-5.4-mini';   // the prompt rewrite and the translation for the video model - small and cheap

const IMAGE = {
  models: ['flare', 'sunburst'],
  sizes: { story: '864x1536', portrait: '1024x1536', square: '1024x1024', landscape: '1536x1024' },   // story = 9:16 exactly (tested)
  qualities: ['low', 'medium', 'high'],
  maxRefs: 16,                                   // what /v1/images/edits takes
  maxCount: 4,                                   // pictures per request, made side by side (one job each)
  price: { text: 5, image: 8, out: 30 },        // GPT Image 2.5 list price, $ per 1M tokens (the job's own cost line)
};
// two Seedance 2.0 models (his call, 2026-11-08, after a face test: same photo + prompt on both, ArcFace similarity to the
// photo 0.63 Mini vs 0.80 Fast): mini = the cheap draft (faces may drift a little), fast = keeps faces as in the photo, ~3x the price
const VIDEO = {
  models: {
    mini: { image: 'seedance-2.0-mini-image-to-video', text: 'seedance-2.0-mini-text-to-video', name: 'Mini', note: 'draft - cheap and quick, faces may drift a little' },
    fast: { image: 'seedance-2.0-fast-image-to-video', text: 'seedance-2.0-fast-text-to-video', name: 'Fast', note: 'keeps faces as in the photo - about 3x the price' },
  },
  qualities: ['480p', '720p'],
  ratios: ['adaptive', '9:16', '16:9', '1:1', '4:3', '3:4', '21:9'],
  min: 4, max: 15,
};
// his defaults (2026-11-07: "every time I do more or less the same thing"): story format (9:16), low quality, sound on;
// 2 pictures at once, 1 video. The API's own default count stays 1 (another tool asks for what it wants).
const DEFAULT = { image: { model: 'flare', size: 'story', quality: 'low' }, video: { model: 'mini', duration: 6, quality: '480p', ratio: '9:16' } };
// saved setups - one tap on the make screen (his ask, 2026-11-07); he edits them in the app, each caller has its own
const PRESETS = [
  { id: 'video-simple', name: 'טיוטה', mode: 'video', params: { model: 'mini', duration: 6, quality: '480p', ratio: '9:16' } },
  { id: 'video-more', name: 'פנים נאמנות', mode: 'video', params: { model: 'fast', duration: 6, quality: '480p', ratio: '9:16' } },
  { id: 'image-simple', name: 'פשוט', mode: 'image', params: { model: 'flare', size: 'story', quality: 'low', count: 2 } },
  { id: 'image-more', name: 'מתקדם', mode: 'image', params: { model: 'flare', size: 'story', quality: 'high', count: 2 } },
];
const imageParams = (b = {}) => ({ model: IMAGE.models.includes(b.model) ? b.model : DEFAULT.image.model, size: IMAGE.sizes[b.size] ? b.size : DEFAULT.image.size,
  quality: IMAGE.qualities.includes(b.quality) ? b.quality : DEFAULT.image.quality });
const videoParams = (b = {}) => ({ model: VIDEO.models[b.model] ? b.model : DEFAULT.video.model, duration: Math.min(VIDEO.max, Math.max(VIDEO.min, Math.round(+b.duration || DEFAULT.video.duration))),
  quality: VIDEO.qualities.includes(b.quality) ? b.quality : DEFAULT.video.quality, ratio: VIDEO.ratios.includes(b.ratio) ? b.ratio : DEFAULT.video.ratio });
const countOf = (b = {}, dflt = 1) => Math.min(IMAGE.maxCount, Math.max(1, Math.round(+b.count || dflt)));
const R480 = 1.2555 / 2.7;   // EvoLink bills 480p at this share of 720p (credits per second, its own price page + a real charge, 2026-11-06)

const db = () => admin.firestore();
const bucket = () => admin.storage().bucket(BUCKET);
const clip = (s, n) => String(s ?? '').trim().slice(0, n);
const ms = (t) => (t && t.toMillis ? t.toMillis() : t || null);
const fail = (status, error) => Object.assign(new Error(error), { status });

// ---------------------------------------------------------------- who is asking ----------------------------------------------------------------
const wrongKey = new Map();
const keyHash = (k) => crypto.createHash('sha256').update(String(k)).digest('hex');
async function who(req) {
  const h = req.get('authorization') || '';
  if (h.startsWith('Key ')) {
    const now = Date.now(), fails = (wrongKey.get(req.ip) || []).filter((t) => now - t < 3600e3);
    if (fails.length >= 10) throw fail(429, 'too_many');
    const d = await db().collection(CLIENTS).doc(keyHash(h.slice(4).trim())).get();
    if (!d.exists || !d.data().active) { fails.push(now); wrongKey.set(req.ip, fails); return null; }
    const c = d.data();
    return { by: 'client:' + d.id.slice(0, 12), name: c.name, owner: false, library: !!c.library };
  }
  if (h.startsWith('Bearer ')) {
    try {
      const t = await admin.auth().verifyIdToken(h.slice(7));
      if (t.email === OWNER && t.email_verified) return { by: 'owner', name: 'שלומי', owner: true, library: true };
    } catch { /* fall through */ }
  }
  return null;
}

// ---------------------------------------------------------------- prices + balance ----------------------------------------------------------------
// EvoLink's own price list (public, no key), asked once a day: $ per second at 720p per model, and $ per credit
const FALLBACK720 = { mini: 0.0397, fast: 0.1206 };
async function prices() {
  const ref = db().collection(META).doc('price'), was = (await ref.get()).data();
  const ok = (p) => p && typeof p.usd720 === 'object' && Object.keys(VIDEO.models).every((k) => p.usd720[k] > 0);
  if (ok(was) && Date.now() - was.at < 864e5) return was;
  try {
    const out = { at: Date.now(), usd720: {}, usdPerCredit: 0 };
    for (const [k, m] of Object.entries(VIDEO.models)) {
      const d = (await (await fetch(`${EVO}/web/api/models/pricing/${m.image}`)).json()).data || {};
      if (!(d.usd_price > 0 && d.credits > 0)) throw new Error('no price for ' + k);
      out.usd720[k] = d.usd_price; out.usdPerCredit = d.usd_price / d.credits;
    }
    await ref.set(out);
    return out;
  } catch (e) {
    console.warn('piko prices:', e.message);
    return ok(was) ? was : { at: 0, usd720: FALLBACK720, usdPerCredit: was?.usdPerCredit || 0.0147 };
  }
}
const usdPerSec = (p, model, quality) => (p.usd720[model] || p.usd720.mini) * (quality === '480p' ? R480 : 1);
const videoUsd = (p, v) => +(usdPerSec(p, v.model, v.quality) * v.duration).toFixed(3);

let balanceCache = null;
async function balance(fresh) {
  if (!fresh && balanceCache && Date.now() - balanceCache.at < 30e3) return balanceCache;
  const r = await fetch(`${EVO}/v1/credits`, { headers: { authorization: `Bearer ${EVOLINK.value()}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.data?.user) throw fail(502, 'evolink_balance');
  const p = await prices();
  balanceCache = { at: Date.now(), credits: +j.data.user.remaining_credits, usedCredits: +j.data.user.used_credits,
    usd: +(j.data.user.remaining_credits * p.usdPerCredit).toFixed(2), usdPerCredit: p.usdPerCredit };
  return balanceCache;
}

// ---------------------------------------------------------------- OpenAI ----------------------------------------------------------------
async function gpt(instructions, input) {
  const r = await fetch('https://api.openai.com/v1/responses', { method: 'POST',
    headers: { authorization: `Bearer ${OPENAI.value()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: TEXT_MODEL, instructions, input, reasoning: { effort: 'low' }, max_output_tokens: 1200 }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('openai text ' + r.status + ' ' + (j.error?.message || ''));
  return (j.output || []).flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('\n').trim();
}

// a recording -> the words -> a prompt that makes sense. A video prompt comes back in English (Seedance reads English
// best); a picture prompt stays in the language he spoke (GPT Image reads Hebrew fine - his note, 2026-11-07)
async function transcribe(b) {
  const buf = Buffer.from(String(b.audio || '').replace(/^data:[^,]*,/, ''), 'base64');
  if (!buf.length || buf.length > 9e6) throw fail(400, 'audio');
  const mime = clip(b.mime, 60) || 'audio/webm';
  const ext = /mp4|m4a|aac/.test(mime) ? 'mp4' : /mpeg|mp3/.test(mime) ? 'mp3' : /ogg/.test(mime) ? 'ogg' : /wav/.test(mime) ? 'wav' : 'webm';
  const form = new FormData();
  form.append('file', new Blob([buf], { type: mime.split(';')[0] }), 'voice.' + ext);
  form.append('model', 'gpt-4o-transcribe');
  if (b.language !== 'auto') form.append('language', clip(b.language, 5) || 'he');
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${OPENAI.value()}` }, body: form });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw fail(502, 'transcribe: ' + (j.error?.message || r.status));
  const text = String(j.text || '').trim();
  if (!text) return { text: '', prompt: '' };
  const video = b.mode === 'video';
  const what = video
    ? `a short video made from ${b.hasStart ? 'a photo the user gave as the first frame' : 'text only'}${b.hasEnd ? ', ending on a second photo (the last frame)' : ''}: say what happens, the motion, and the sounds / what is said (the camera only if they mentioned it)`
    : `a picture${b.refs ? `, made from ${b.refs} reference image(s) the user gave` : ''}: say what is in it, the style, the framing`;
  const prompt = await gpt(
    `You turn a spoken, transcribed request (usually Hebrew) into a clear prompt for ${what}. ${video ? "Write the prompt in English." : "Write the prompt in the same language they spoke (Hebrew stays Hebrew)."} ` +
    'Keep every detail they asked for and their intent; drop filler, false starts and repetitions; fix what the transcription garbled when the meaning is obvious. ' +
    'Do not invent new content. Refer to people in the user\'s photo as "the people in the photo" / by what they said. One short paragraph, no quotes, no preface.', text);
  return { text, prompt: prompt || text };
}

// a video prompt typed in Hebrew is translated before it goes to Seedance; an English one goes as it is
async function toEnglish(prompt, what) {
  if (!/[\u0590-\u05FF]/.test(prompt)) return prompt;
  return await gpt(`Translate this ${what}-generation prompt into natural English for the model. Keep every detail, add nothing, no preface.`, prompt) || prompt;
}
async function forVideo(prompt, hasStart) {
  const en = await toEnglish(prompt, 'video');
  return hasStart && !/faces?/i.test(en) ? `${en}\nKeep everyone's faces exactly as in the first frame.` : en;
}

async function image(job, refs) {
  const p = job.params;
  const fields = { model: 'gpt-image-2.5-' + p.model, prompt: job.promptEn || job.prompt, size: IMAGE.sizes[p.size], quality: p.quality, n: 1, output_format: 'jpeg', output_compression: 92 };
  const auth = { authorization: `Bearer ${OPENAI.value()}` };
  let r;
  if (refs.length) {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
    refs.forEach((x, i) => form.append('image[]', new Blob([x.buf], { type: x.type }), `ref-${i + 1}.${x.type === 'image/png' ? 'png' : 'jpg'}`));
    r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: auth, body: form });
  } else {
    r = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify(fields) });
  }
  const j = await r.json().catch(() => ({}));
  const b64 = j.data?.[0]?.b64_json;
  if (!r.ok || !b64) throw new Error(j.error?.message || `openai image ${r.status}`);
  const u = j.usage || {}, d = u.input_tokens_details || {};
  const usd = ((d.text_tokens || 0) * IMAGE.price.text + (d.image_tokens || 0) * IMAGE.price.image + (u.output_tokens || 0) * IMAGE.price.out) / 1e6;
  const [w, h] = IMAGE.sizes[p.size].split('x').map(Number);
  return { buf: Buffer.from(b64, 'base64'), usd: +usd.toFixed(4), w, h };
}

// ---------------------------------------------------------------- EvoLink (videos) ----------------------------------------------------------------
async function evo(path, body) {
  const r = await fetch(EVO + path, { method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${EVOLINK.value()}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`evolink ${path.split('?')[0]} ${r.status}: ${j.error?.message || j.message || JSON.stringify(j).slice(0, 200)}`);
  return j;
}
async function evoUpload(x) {
  const r = await fetch('https://files-api.evolink.ai/api/v1/files/upload/base64', { method: 'POST',
    headers: { authorization: `Bearer ${EVOLINK.value()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ base64_data: `data:${x.type};base64,${x.buf.toString('base64')}` }) });
  const j = await r.json().catch(() => ({}));
  const url = JSON.stringify(j.data || {}).match(/https?:\/\/[^"\\]+/)?.[0];
  if (!r.ok || !url) throw new Error('evolink upload: ' + (j.msg || r.status));
  return url;
}

async function startVideo(ref, job, inputs) {
  const p = job.params;
  const promptEn = await forVideo(job.prompt, !!inputs.start);
  const image_urls = [];
  if (inputs.start) image_urls.push(await evoUpload(inputs.start));
  if (inputs.end) image_urls.push(await evoUpload(inputs.end));
  const token = crypto.randomBytes(16).toString('hex');
  const t = await evo('/v1/videos/generations', {
    model: (VIDEO.models[p.model] || VIDEO.models.mini)[inputs.start ? 'image' : 'text'], prompt: promptEn,
    ...(image_urls.length ? { image_urls } : {}), duration: p.duration, quality: p.quality,
    aspect_ratio: inputs.start ? p.ratio : (p.ratio === 'adaptive' ? '9:16' : p.ratio), generate_audio: true,
    callback_url: `${SELF}/hook/${ref.id}?t=${token}`,
  });
  if (!t.id) throw new Error('evolink: no task id');
  await ref.update({ status: 'running', task: t.id, hookToken: token, promptEn, checked: Date.now(), progress: t.progress || 0 });
}

// the task is over (from the callback, a poll, or the sweep): save the video once, whoever gets here first
async function finishVideo(ref, task) {
  const claimed = await db().runTransaction(async (tx) => {
    const d = await tx.get(ref);
    if (d.data()?.status !== 'running') return null;
    tx.update(ref, { status: 'saving' });
    return d.data();
  });
  if (!claimed) return;
  try {
    if (task.status !== 'completed') throw new Error(task.error?.message || (task.error ? JSON.stringify(task.error).slice(0, 300) : `the video failed (${task.status})`));
    const url = task.results?.[0] || JSON.stringify(task.result_data || '').match(/https?:\/\/[^"\\]+/)?.[0];
    if (!url) throw new Error('evolink: no video in the answer');
    const r = await fetch(url);
    if (!r.ok) throw new Error('video download ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    const cost = task.usage?.cost || {};
    const m = mp4Info(buf);
    const out = await save(claimed, buf, 'video', { ...m, dur: m.dur || claimed.params.duration });
    await ref.update({ status: 'done', ...out, usd: +cost.usd || null, credits: +cost.credits || +task.usage?.credits_used || null, done: Date.now(), progress: 100 });
  } catch (e) {
    await ref.update({ status: 'failed', error: clip(e.message, 500), done: Date.now() });
  }
}
async function checkVideo(ref, job) {
  if (job.status !== 'running' || !job.task) return;
  const task = await evo(`/v1/tasks/${encodeURIComponent(job.task)}`);
  if (/completed|failed|cancel/i.test(task.status || '')) return finishVideo(ref, task);
  await ref.update({ checked: Date.now(), progress: task.progress || job.progress || 0 });
}

// ---------------------------------------------------------------- files: inputs, outputs, the library ----------------------------------------------------------------
// an input picture: a data URL / base64, {url}, or {job} (something made before - "make a video from this picture")
async function readInput(x, by) {
  if (!x) return null;
  if (typeof x === 'string') {
    const m = x.match(/^data:(image\/[\w+.-]+);base64,(.*)$/s);
    const buf = Buffer.from(m ? m[2] : x, 'base64');
    if (buf.length < 100) throw fail(400, 'image');
    return { buf, type: m ? m[1] : sniff(buf) };
  }
  if (x.url) {
    if (!/^https:\/\//.test(x.url)) throw fail(400, 'image_url');
    const r = await fetch(x.url);
    if (!r.ok) throw fail(400, 'image_url');
    const buf = Buffer.from(await r.arrayBuffer());
    return { buf, type: sniff(buf) };
  }
  if (x.job) {
    const d = await db().collection(JOBS).doc(String(x.job)).get();
    const j = d.data();
    if (!j || (j.by !== by && by !== 'owner') || j.kind !== 'image' || !j.path) throw fail(400, 'job');
    const [buf] = await bucket().file(j.path).download();
    return { buf, type: 'image/jpeg' };
  }
  throw fail(400, 'image');
}
const sniff = (b) => (b[0] === 0x89 ? 'image/png' : b[0] === 0x52 && b[8] === 0x57 ? 'image/webp' : 'image/jpeg');
const MAX_IN = 12e6;
async function keepInput(id, name, x) {
  if (x.buf.length > MAX_IN) throw fail(413, 'image_too_big');
  const ext = x.type === 'image/png' ? 'png' : x.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `piko/jobs/${id}/${name}.${ext}`;
  await bucket().file(path).save(x.buf, { contentType: x.type, resumable: false });
  return path;
}
async function loadInput(path) {
  const [buf] = await bucket().file(path).download();
  return { buf, type: /\.png$/.test(path) ? 'image/png' : /\.webp$/.test(path) ? 'image/webp' : 'image/jpeg' };
}

// the result: into the library (his) or the client's own folder (a client without the library)
async function save(job, buf, kind, m) {
  const md5 = crypto.createHash('md5').update(buf).digest('hex');
  const ext = kind === 'video' ? 'mp4' : 'jpg', type = kind === 'video' ? 'video/mp4' : 'image/jpeg';
  const day = new Date().toISOString().slice(0, 10);
  const name = `piko-${day}-${md5.slice(0, 8)}`;
  if (!job.library) {
    const path = `piko/out/${job.by.replace(':', '-')}/${name}.${ext}`;
    await bucket().file(path).save(buf, { contentType: type, resumable: false });
    return { path, w: m.w || null, h: m.h || null, dur: m.dur || null, size: buf.length };
  }
  const dir = kind === 'video' ? 'videos' : 'pictures';
  const file = `${dir}/${name}.${ext}`;
  await bucket().file(`library/${file}`).save(buf, { contentType: type, resumable: false });
  const item = { id: md5.slice(0, 12), md5, kind: kind === 'video' ? 'video' : 'picture', file, name, size: buf.length,
    ...(m.w ? { w: m.w, h: m.h } : {}), ...(m.dur ? { dur: m.dur } : {}),
    from: [], series: ['piko'], types: [], labels: [], tags: ['piko', kind === 'video' ? 'video' : 'picture', 'ai'],
    added: Date.now(), about: clip(job.prompt, 300), prompt: clip(job.promptEn || job.prompt, 600), made: 'piko', unlabelled: false };
  // the index: read, add, write only if nobody wrote in between (the studio does the same - store.mjs putJson)
  const f = bucket().file('library/index.json');
  for (let k = 0; k < 6; k++) {
    let ix = { items: [] }, gen = 0;
    try { const [meta] = await f.getMetadata(); gen = meta.generation; ix = JSON.parse((await f.download())[0].toString('utf8')); } catch (e) { if (e.code !== 404) throw e; }
    const items = (ix.items || []).filter((x) => x.id !== item.id);
    items.push(item);
    try {
      await f.save(JSON.stringify({ items, at: Date.now() }), { contentType: 'application/json', resumable: false, preconditionOpts: { ifGenerationMatch: gen } });
      break;
    } catch (e) {
      if (e.code !== 412 || k === 5) throw e;
      await new Promise((ok) => setTimeout(ok, 300 + Math.random() * 700));
    }
  }
  return { path: `library/${file}`, libraryId: item.id, w: m.w || null, h: m.h || null, dur: m.dur || null, size: buf.length };
}

// width, height and length straight from the mp4's boxes (mvhd + the video track's tkhd) - no ffmpeg in a function
function mp4Info(buf) {
  const out = {};
  const walk = (s, e, depth) => {
    for (let i = s; i + 8 <= e && depth < 6;) {
      let size = buf.readUInt32BE(i), hdr = 8;
      const type = buf.toString('latin1', i + 4, i + 8);
      if (size === 1) { size = Number(buf.readBigUInt64BE(i + 8)); hdr = 16; } else if (size === 0) size = e - i;
      if (size < hdr || i + size > e) break;
      if (['moov', 'trak'].includes(type)) walk(i + hdr, i + size, depth + 1);
      if (type === 'mvhd') {
        const v = buf[i + hdr];
        const scale = buf.readUInt32BE(i + hdr + (v ? 20 : 12)), dur = v ? Number(buf.readBigUInt64BE(i + hdr + 24)) : buf.readUInt32BE(i + hdr + 16);
        if (scale) out.dur = +(dur / scale).toFixed(2);
      }
      if (type === 'tkhd') {
        const w = buf.readUInt32BE(i + size - 8) >>> 16, h = buf.readUInt32BE(i + size - 4) >>> 16;
        if (w && h && !out.w) { out.w = w; out.h = h; }
      }
      i += size;
    }
  };
  try { walk(0, buf.length, 0); } catch { /* a file we can't read: no sizes */ }
  return out;
}

const signed = async (path) => (path ? (await bucket().file(path).getSignedUrl({ action: 'read', expires: Date.now() + 6 * 3600e3 }))[0] : null);
// a job as the API shows it: what was asked, where it stands, the file, what it cost
async function view(id, j, full) {
  return {
    id, kind: j.kind, status: j.status, prompt: j.prompt, params: j.params, by: j.by, client: j.client,
    progress: j.progress ?? null, error: j.error || null, created: ms(j.t), done: j.done || null, batch: j.batch || null,
    usd: j.usd ?? null, estimate: j.estimate ?? null, w: j.w || null, h: j.h || null, dur: j.dur || null,
    url: await signed(j.path), library: j.libraryId || null,
    poster: j.kind === 'video' && j.inputs?.start ? await signed(j.inputs.start) : null,
    ...(full ? { inputs: Object.fromEntries(await Promise.all(Object.entries(j.inputs || {}).map(async ([k, v]) => [k, Array.isArray(v) ? await Promise.all(v.map(signed)) : await signed(v)]))) } : {}),
  };
}

// ---------------------------------------------------------------- the API ----------------------------------------------------------------
async function createJob(u, kind, b) {
  const prompt = clip(b.prompt, 4000);
  if (!prompt) throw fail(400, 'prompt');
  const ref = db().collection(JOBS).doc();
  const base = { kind, prompt, by: u.by, client: u.name, library: u.library && b.library !== false, status: 'queued', t: admin.firestore.FieldValue.serverTimestamp() };
  if (kind === 'image') {
    const refs = Array.isArray(b.refs) ? b.refs : [];
    if (refs.length > IMAGE.maxRefs) throw fail(400, 'too_many_refs');
    const params = imageParams(b), count = countOf(b);
    const paths = [];
    for (const [i, x] of refs.entries()) paths.push(await keepInput(ref.id, `ref-${i + 1}`, await readInput(x, u.by)));
    // several pictures = several jobs made side by side, one batch (the references are stored once)
    const refsOut = [ref, ...Array.from({ length: count - 1 }, () => db().collection(JOBS).doc())];
    await Promise.all(refsOut.map((r) => r.set({ ...base, params, inputs: { refs: paths }, ...(count > 1 ? { batch: ref.id } : {}) })));
    const jobs = await Promise.all(refsOut.map(async (r) => ({ id: r.id, ...(await view(r.id, (await r.get()).data())) })));
    return { ...jobs[0], jobs };
  } else {
    const start = await readInput(b.start, u.by), end = await readInput(b.end, u.by);
    if (end && !start) throw fail(400, 'end_needs_start');
    const params = videoParams(b);
    const estimate = videoUsd(await prices(), params);
    const bal = await balance(true);
    if (bal.usd < estimate) throw fail(402, 'balance');
    const inputs = {};
    if (start) inputs.start = await keepInput(ref.id, 'start', start);
    if (end) inputs.end = await keepInput(ref.id, 'end', end);
    await ref.set({ ...base, params, inputs, estimate });
  }
  const job = { id: ref.id, ...(await view(ref.id, (await ref.get()).data())) };
  return { ...job, jobs: [job] };
}

// saved setups: [{ id, name, mode: 'image' | 'video', params }] - the caller's own, else the starting ones
async function presets(u, put) {
  const ref = db().collection(META).doc('presets-' + u.by.replace(':', '-'));
  if (!put) { const d = (await ref.get()).data(); return { presets: d?.presets || PRESETS }; }
  if (!Array.isArray(put)) throw fail(400, 'presets');
  const list = put.slice(0, 24).map((p, i) => {
    const mode = p.mode === 'image' ? 'image' : 'video';
    return { id: clip(p.id, 40) || `${mode}-${Date.now().toString(36)}-${i}`, name: clip(p.name, 24) || 'הגדרה', mode,
      params: mode === 'image' ? { ...imageParams(p.params), count: countOf(p.params, 2) } : videoParams(p.params) };
  });
  await ref.set({ presets: list, at: Date.now() });
  return { presets: list };
}

async function route(req, res) {
  // through hosting the path is /piko/api/<route>; straight to the function it is /<route>
  const parts = req.path.replace(/^\/piko\/api/, '').split('/').filter(Boolean);
  const [r0, r1] = parts;
  // EvoLink's callback: no login, the job's own random token in the URL
  if (r0 === 'hook') {
    const ref = db().collection(JOBS).doc(String(r1 || '')), d = await ref.get(), j = d.data();
    if (!j || !j.hookToken || req.query.t !== j.hookToken) return res.status(404).json({ error: 'job' });
    await checkVideo(ref, j);
    return res.json({ ok: true });
  }
  // the docs, open to anyone (no keys in them): any session on any computer reads what is deployed
  if (r0 === 'docs') return res.type('text/markdown; charset=utf-8').send(require('fs').readFileSync(require('path').join(__dirname, 'piko-api.md'), 'utf8'));
  const u = await who(req);
  if (!u) return res.status(401).json({ error: 'auth' });
  const body = req.body || {};
  if (req.method === 'GET' && r0 === 'config') {
    const p = await prices();
    return res.json({ image: { models: IMAGE.models, sizes: Object.keys(IMAGE.sizes), qualities: IMAGE.qualities, maxRefs: IMAGE.maxRefs, maxCount: IMAGE.maxCount, default: DEFAULT.image },
      video: { qualities: VIDEO.qualities, ratios: VIDEO.ratios, min: VIDEO.min, max: VIDEO.max, default: DEFAULT.video, usdPerSecond: { '480p': +usdPerSec(p, 'mini', '480p').toFixed(4), '720p': +usdPerSec(p, 'mini', '720p').toFixed(4) },
        models: Object.entries(VIDEO.models).map(([id, m]) => ({ id, name: m.name, note: m.note, default: id === DEFAULT.video.model,
          usdPerSecond: { '480p': +usdPerSec(p, id, '480p').toFixed(4), '720p': +usdPerSec(p, id, '720p').toFixed(4) } })) },
      you: { name: u.name, owner: u.owner, library: u.library } });
  }
  if (r0 === 'presets' && (req.method === 'GET' || req.method === 'PUT')) return res.json(await presets(u, req.method === 'PUT' ? body.presets : null));
  if (req.method === 'GET' && r0 === 'balance') return res.json(await balance(req.query.fresh === '1'));
  if (req.method === 'POST' && r0 === 'transcribe') return res.json(await transcribe(body));
  if (req.method === 'POST' && (r0 === 'images' || r0 === 'videos')) return res.status(201).json(await createJob(u, r0 === 'images' ? 'image' : 'video', body));
  if (r0 === 'jobs' && r1) {
    const ref = db().collection(JOBS).doc(r1), d = await ref.get(), j = d.data();
    if (!j || j.hidden || (j.by !== u.by && !u.owner)) return res.status(404).json({ error: 'job' });
    if (req.method === 'DELETE') { await ref.update({ hidden: true }); return res.json({ ok: true }); }
    // the finished file itself, from this same address - a page can only share / save a file it can read, and the bucket's
    // signed links are another site to the browser (his phone: "I can't save or share it", 2026-11-08)
    if (parts[2] === 'file') {
      if (!j.path) return res.status(404).json({ error: 'file' });
      const f = bucket().file(j.path), [m] = await f.getMetadata();
      res.set({ 'content-type': m.contentType || (j.kind === 'video' ? 'video/mp4' : 'image/jpeg'), 'content-length': m.size, 'cache-control': 'private, max-age=3600',
        'content-disposition': `attachment; filename="piko-${r1.slice(0, 6)}.${j.kind === 'video' ? 'mp4' : 'jpg'}"` });
      return await new Promise((ok, no) => f.createReadStream().on('error', no).pipe(res).on('finish', ok));
    }   // off the list; the library keeps the file
    if (j.status === 'running' && Date.now() - (j.checked || 0) > 8000) {
      await checkVideo(ref, j).catch((e) => console.warn('piko check', r1, e.message));
      return res.json(await view(r1, (await ref.get()).data(), true));
    }
    return res.json(await view(r1, j, true));
  }
  if (req.method === 'GET' && r0 === 'jobs') {
    const n = Math.min(Math.max(parseInt(req.query.limit, 10) || 40, 1), 100);
    let q = db().collection(JOBS);
    if (!u.owner) q = q.where('by', '==', u.by);
    q = q.orderBy('t', 'desc');
    if (req.query.before) q = q.startAfter(admin.firestore.Timestamp.fromMillis(+req.query.before));
    const snap = await q.limit(n + 20).get();
    const docs = snap.docs.filter((d) => !d.data().hidden).slice(0, n);
    return res.json({ jobs: await Promise.all(docs.map((d) => view(d.id, d.data()))), more: snap.docs.length > n });
  }
  return res.status(404).json({ error: 'route' });
}

exports.piko = onRequest({ region: REGION, secrets: SECRETS, cors: CORS, maxInstances: 5, memory: '512MiB', timeoutSeconds: 120 }, async (req, res) => {
  res.set('cache-control', 'no-store');
  try { await route(req, res); }
  catch (e) {
    if (!e.status) console.error('piko', req.method, req.path, e);
    res.status(e.status || 500).json({ error: e.status ? e.message : 'server', detail: e.status ? undefined : clip(e.message, 300) });
  }
});

// the work: a picture is made here and saved; a video is handed to EvoLink (finished by the hook / a poll / the sweep)
exports.pikoWork = onDocumentCreated({ document: `${JOBS}/{id}`, region: REGION, secrets: SECRETS, memory: '1GiB', timeoutSeconds: 540, maxInstances: 5, retry: false }, async (ev) => {
  const ref = ev.data.ref, job = ev.data.data();
  if (job.status !== 'queued') return;
  try {
    await ref.update({ status: 'working', started: Date.now() });
    if (job.kind === 'image') {
      const refs = await Promise.all((job.inputs?.refs || []).map(loadInput));
      const out = await image(job, refs);
      const saved = await save(job, out.buf, 'image', { w: out.w, h: out.h });
      await ref.update({ status: 'done', ...saved, usd: out.usd, done: Date.now(), progress: 100 });
    } else {
      const inputs = {};
      if (job.inputs?.start) inputs.start = await loadInput(job.inputs.start);
      if (job.inputs?.end) inputs.end = await loadInput(job.inputs.end);
      await startVideo(ref, job, inputs);
    }
  } catch (e) {
    console.error('piko work', ref.id, e.message);
    await ref.update({ status: 'failed', error: clip(e.message, 500), done: Date.now() });
  }
});

// a video nobody asked about (the phone closed, the callback lost): checked every 5 minutes; stuck "working" jobs fail
exports.pikoSweep = onSchedule({ schedule: 'every 5 minutes', region: REGION, secrets: SECRETS, timeoutSeconds: 300, memory: '512MiB' }, async () => {
  const snap = await db().collection(JOBS).where('status', 'in', ['running', 'working', 'saving']).limit(50).get();
  for (const d of snap.docs) {
    const j = d.data();
    try {
      if (j.status === 'running' && Date.now() - (j.checked || 0) > 60e3) await checkVideo(d.ref, j);
      else if (j.status !== 'running' && Date.now() - (j.started || ms(j.t) || 0) > 15 * 60e3) await d.ref.update({ status: 'failed', error: 'stopped in the middle - try again', done: Date.now() });
    } catch (e) { console.warn('piko sweep', d.id, e.message); }
  }
});

// Backstage -> הוצאות (costs.js): EvoLink's spend per day / client / kind from each finished job's own cost, + the balance
async function costRows(days) {
  const since = admin.firestore.Timestamp.fromMillis(Date.now() - days * 864e5);
  const snap = await db().collection(JOBS).where('t', '>=', since).get();
  const rows = [];
  for (const d of snap.docs) {
    const j = d.data();
    if (j.kind !== 'video' || !j.usd) continue;
    rows.push({ d: new Date(ms(j.t)).toISOString().slice(0, 10), src: 'evolink', group: 'shlomiverse', area: 'piko', kind: 'video', client: j.client || j.by, usd: j.usd });
  }
  let bal = null;
  try { bal = await balance(true); } catch (e) { bal = { error: e.message }; }
  return { rows, balance: bal };
}

exports.costRows = costRows;
exports.SECRETS = SECRETS;
