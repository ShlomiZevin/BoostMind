#!/usr/bin/env node
/**
 * Leonardo AI image generation — standalone, no project dependencies.
 *
 * Distilled from aspect-agent-server/hq/services/leonardo.service.js, which
 * carries the same behaviour in production. Every comment below marks a trap
 * that returned a plausible-looking failure rather than an error.
 *
 * Usage:
 *   node leo.js --balance
 *   node leo.js --prompt-file brief.txt --out hero.png --model gpt-image-2 --size poster
 *   node leo.js --batch slides.json --out-dir ./public/img
 *   node leo.js --batch slides.json --out-dir ./public/img --only hero,foundations
 *
 * slides.json:  [ { "key": "hero", "prompt": "...", "model": "...", "size": "..." }, ... ]
 * A batch entry may also carry "width" and "height" instead of "size".
 */

const fs = require('fs');
const path = require('path');

const API = 'https://cloud.leonardo.ai/api/rest';

/**
 * Only models actually enabled on this account. Ideogram / Recraft / Phoenix
 * are NOT available — do not add them back without checking against --balance.
 */
const MODELS = {
  'nano-banana-2':   { id: 'nano-banana-2',  label: 'Nano Banana 2',   cost: 0.039, about: 'Fast and cheap. Good photos, good headlines. The workhorse.' },
  'nano-banana-pro': { id: 'gemini-image-2', label: 'Nano Banana Pro', cost: 0.209, about: 'Best quality, most reliable Hebrew. 20-40s, sometimes 90.' },
  'gpt-image-2':     { id: 'gpt-image-2',    label: 'GPT Image 2',     cost: 0.097, about: 'Very clean and graphic. Crisp Hebrew. Portrait only 1024x1536.' },
  'lucid-origin':    { id: 'lucid-origin',   label: 'Lucid Origin',    cost: 0.030, about: 'Cheapest. Good at flat vector and simple marks.' },
  'flux-pro-2.0':    { id: 'flux-pro-2.0',   label: 'Flux Pro 2.0',    cost: 0.042, about: 'Strong geometry and composition.' },
  // GPT Image 2.5 (flare / sunburst) is NOT on Leonardo as of 2026-09-23 —
  // v2 rejects both ids ("model must be in oneOf"). Call it on OpenAI directly.
};

/**
 * Every dimension must come from this list. Anything else — 864 for a "16:9"
 * frame, say — is rejected with a VALIDATION_ERROR that names the list but is
 * truncated in most error surfaces, so it is kept here in full.
 */
const ALLOWED = [672, 768, 848, 896, 928, 1024, 1152, 1200, 1264, 1344, 1376,
                 1536, 1696, 1792, 1856, 2048, 2304, 2400, 2528, 2688, 2752, 3072, 3392];

/** Named pairs, all drawn from ALLOWED. */
const SIZES = {
  square:   { width: 1024, height: 1024 },
  portrait: { width: 1024, height: 1536 },  // the only portrait gpt-image-2 takes
  story:    { width: 768,  height: 1376 },  // 9:16, 1K
  story_hd: { width: 1536, height: 2752 },  // 9:16, 2K
  poster:   { width: 1696, height: 2528 },  // 2:3, high res
  wide:     { width: 2048, height: 1152 },  // exactly 16:9 — the slide size
  wide_sm:  { width: 1344, height: 768 },   // 7:4, cheaper draft of the same frame
  banner:   { width: 2048, height: 768 },   // 8:3, wide strip
};

// Each project its own Leonardo key, never another's (his ask, 2026-10-27): inside BoostMind only the editor's key
// (zoomcut/.env, his official account); anywhere else that project's own .env, then aspect's.
const IN_BOOSTMIND = process.cwd().toLowerCase().replace(/\//g, '\\').startsWith('c:\\workspace\\boostmind');
const ENV_CANDIDATES = IN_BOOSTMIND
  ? ['C:\\workspace\\BoostMind\\zoomcut\\.env']
  : [path.join(process.cwd(), '.env'), path.join(process.cwd(), '..', '.env'), 'C:\\workspace\\aspect\\aspect-agent-server\\.env'];

function readKey(explicitEnv) {
  if (process.env.LEONARDO_API_KEY) return process.env.LEONARDO_API_KEY;
  const files = explicitEnv ? [explicitEnv, ...ENV_CANDIDATES] : ENV_CANDIDATES;
  for (const file of files) {
    try {
      for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        if (line.startsWith('LEONARDO_API_KEY=')) return line.slice(17).trim();
      }
    } catch { /* try the next candidate */ }
  }
  throw new Error(`No LEONARDO_API_KEY found. Looked in: ${files.join(', ')}`);
}

let KEY = null;
const headers = () => ({
  authorization: `Bearer ${KEY}`,
  accept: 'application/json',
  'content-type': 'application/json',
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

function arg(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const has = flag => process.argv.includes(flag);

async function generate({ prompt, model = 'gpt-image-2', size = 'square', width, height, quantity = 1, referenceImageId = null, referenceStrength = 'LOW' }) {
  if (!prompt || !prompt.trim()) throw new Error('An image needs a prompt');

  // Never fall back silently: an unknown name used to generate with
  // gpt-image-2 and report success, so the wrong model went unnoticed.
  const chosen = MODELS[model];
  if (!chosen) throw new Error(`Unknown model "${model}". Known: ${Object.keys(MODELS).join(', ')}`);
  const dims = (width && height) ? { width: +width, height: +height } : (SIZES[size] || SIZES.square);

  // Fail here rather than after a round trip: the API's own message names the
  // legal values but arrives truncated, so a bad size looks like a mystery.
  for (const axis of ['width', 'height']) {
    if (!ALLOWED.includes(dims[axis])) {
      const near = ALLOWED.reduce((a, b) => Math.abs(b - dims[axis]) < Math.abs(a - dims[axis]) ? b : a);
      throw new Error(`${axis} ${dims[axis]} is not allowed. Nearest legal value: ${near}. Allowed: ${ALLOWED.join(', ')}`);
    }
  }

  const body = {
    // Omitting `public` returns a bare VALIDATION_ERROR on several models.
    public: false,
    model: chosen.id,
    parameters: { prompt: prompt.trim(), quantity, ...dims, prompt_enhance: 'OFF' },
  };

  if (referenceImageId) {
    // The documented flat `image_id` fails validation; this nested shape works.
    // LOW keeps it a colour/brand hint — MID and above make the model redraw it.
    body.parameters.guidances = {
      image_reference: [{ image: { id: referenceImageId, type: 'UPLOADED' }, strength: referenceStrength }],
    };
  }

  const res = await fetch(`${API}/v2/generations`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const queued = await res.json();
  if (!queued.generate) throw new Error(`Leonardo refused: ${JSON.stringify(queued).slice(0, 300)}`);

  const generationId = queued.generate.generationId;
  const cost = Number(queued.generate.cost?.amount || 0);

  // Poll v1 — v2 only queues. 70 x 2.5s ~= 3 min; Pro needs the headroom.
  for (let attempt = 0; attempt < 70; attempt++) {
    await sleep(2500);
    const poll = await fetch(`${API}/v1/generations/${generationId}`, { headers: headers() });
    const gen = (await poll.json()).generations_by_pk;

    if (gen?.status === 'COMPLETE') {
      return { images: (gen.generated_images || []).map(i => i.url), cost, generationId, modelLabel: chosen.label, ...dims };
    }
    if (gen?.status === 'FAILED') {
      const why = gen.status_reason || gen.statusReason || gen.error || null;
      throw new Error(
        `Leonardo failed${why ? `: ${why}` : ''}` +
        `${cost ? ` (it had quoted $${cost.toFixed(4)}; that may still be charged)` : ''}`
      );
    }
  }
  throw new Error(`Leonardo timed out (generation ${generationId} may still have completed)`);
}

/**
 * Two traps here, both of which return a plausible-looking failure rather than
 * an error: the CDN 403s Node's default user-agent, and Leonardo builds
 * filenames from the prompt, so an em-dash in the path yields an 87-byte error
 * page. Hence the browser UA, the re-encoded path, and the size check.
 */
async function download(url) {
  const parsed = new URL(url);
  parsed.pathname = encodeURI(decodeURI(parsed.pathname));
  const res = await fetch(parsed.toString(), { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Image download failed (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 5000) throw new Error('Download returned an error page, not an image');
  return buffer;
}

/** Upload a reference image (a logo, a palette swatch) for generations to cue from. */
async function uploadReference(file) {
  const extension = path.extname(file).slice(1) || 'png';
  const init = await fetch(`${API}/v1/init-image`, { method: 'POST', headers: headers(), body: JSON.stringify({ extension }) });
  const { uploadInitImage } = await init.json();
  if (!uploadInitImage) throw new Error('Leonardo would not accept the reference upload');

  const fields = JSON.parse(uploadInitImage.fields);
  const form = new FormData();
  // The presigned POST requires every field BEFORE the file.
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append('file', new Blob([fs.readFileSync(file)]), `reference.${extension}`);

  const put = await fetch(uploadInitImage.url, { method: 'POST', body: form });
  if (!put.ok) throw new Error(`Reference upload failed (${put.status})`);
  return uploadInitImage.id;
}

async function balance() {
  const res = await fetch(`${API}/v1/me`, { headers: headers() });
  const me = (await res.json()).user_details?.[0] || {};
  console.log(`paid tokens: ${me.apiPaidTokens ?? '?'}   subscription tokens: ${me.apiSubscriptionTokens ?? '?'}`);
  console.log('\nmodels available here:');
  for (const [k, m] of Object.entries(MODELS)) {
    const price = m.cost == null ? '   ?  ' : `~$${m.cost.toFixed(3)}`;
    console.log(`  ${k.padEnd(22)} ${price}  ${m.about}`);
  }
  console.log(`\nsizes: ${Object.entries(SIZES).map(([k, v]) => `${k} (${v.width}x${v.height})`).join(', ')}`);
}

/**
 * Real dimensions and format of the bytes we were handed.
 *
 * Necessary because the API echoes back the dimensions we ASKED for, not the
 * ones it produced, and the Gemini-backed models quietly ignore the request
 * (see ASPECT RATIO in SKILL.md). Nothing else surfaces the discrepancy.
 */
function inspect(buffer) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    const i = buffer.indexOf('IHDR');
    return { format: 'png', width: buffer.readUInt32BE(i + 4), height: buffer.readUInt32BE(i + 8) };
  }
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    let i = 2;
    while (i < buffer.length) {
      if (buffer[i] !== 0xFF) { i++; continue; }
      const m = buffer[i + 1];
      if (m >= 0xC0 && m <= 0xC3) {
        return { format: 'jpeg', height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) };
      }
      if (m === 0xD8 || m === 0xD9 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
      i += 2 + buffer.readUInt16BE(i + 2);
    }
  }
  return { format: 'unknown', width: null, height: null };
}

async function one(spec, outPath, referenceImageId) {
  const result = await generate({ ...spec, referenceImageId });
  const url = result.images[0];
  if (!url) throw new Error('completed with no image');
  const buffer = await download(url);

  const real = inspect(buffer);

  // Leonardo serves JPEG regardless of what the destination is called. Writing
  // JPEG bytes into a .png silently produces a file some tools refuse to open.
  let finalPath = outPath;
  if (real.format === 'jpeg' && /\.png$/i.test(outPath)) finalPath = outPath.replace(/\.png$/i, '.jpg');

  fs.mkdirSync(path.dirname(path.resolve(finalPath)), { recursive: true });
  fs.writeFileSync(finalPath, buffer);

  const mismatch = real.width && (real.width !== result.width || real.height !== result.height);
  return { ...result, bytes: buffer.length, outPath: finalPath, real, mismatch };
}

async function main() {
  KEY = readKey(arg('--env'));
  if (has('--balance')) return balance();

  const referenceFile = arg('--reference');
  const referenceImageId = referenceFile ? await uploadReference(referenceFile) : null;
  if (referenceImageId) console.log(`reference uploaded: ${referenceImageId}`);

  const batchFile = arg('--batch');

  if (batchFile) {
    const outDir = arg('--out-dir', '.');
    const only = (arg('--only', '') || '').split(',').map(s => s.trim()).filter(Boolean);
    const defModel = arg('--model');
    const defSize = arg('--size');

    let entries = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
    if (only.length) entries = entries.filter(e => only.includes(e.key));
    if (!entries.length) throw new Error(`No entries matched --only "${only.join(',')}"`);

    console.log(`\nGenerating ${entries.length} image(s) into ${outDir}\n`);
    let spent = 0, made = 0;

    // Sequential on purpose: Pro takes 20-40s and the account is shared, so a
    // parallel burst just queues behind itself while making failures harder to
    // attribute to a specific prompt.
    for (const e of entries) {
      process.stdout.write(`  ${e.key} ... `);
      try {
        const r = await one(
          { ...e, model: e.model || defModel || 'gpt-image-2', size: e.size || defSize || 'square' },
          path.join(outDir, `${e.key}.png`),
          referenceImageId
        );
        spent += Number(r.cost || 0); made++;
        console.log(`ok - ${(r.bytes / 1024).toFixed(0)}kb ${r.real.width}x${r.real.height} (${r.modelLabel})`
          + (r.mismatch ? `  <-- IGNORED the requested ${r.width}x${r.height}` : ''));
      } catch (err) {
        console.log(`FAILED - ${err.message}`);
      }
    }
    console.log(`\n${made}/${entries.length} written. Quoted cost: ${spent.toFixed(2)} credits\n`);
    return;
  }

  const promptFile = arg('--prompt-file');
  const prompt = promptFile ? fs.readFileSync(promptFile, 'utf8') : arg('--prompt');
  if (!prompt) throw new Error('Give --prompt-file <file> (preferred for Hebrew), --prompt "<text>", or --batch <json>');

  const outPath = arg('--out', 'output.png');
  const r = await one(
    { prompt, model: arg('--model', 'gpt-image-2'), size: arg('--size', 'square'), width: arg('--width'), height: arg('--height') },
    outPath,
    referenceImageId
  );
  console.log(`OK -> ${r.outPath}  ${(r.bytes / 1024).toFixed(0)}kb  ${r.real.width}x${r.real.height} ${r.real.format}  ${r.modelLabel}  ~${r.cost} credits`);
  if (r.mismatch) console.log(`WARNING: ${r.modelLabel} ignored the requested ${r.width}x${r.height}. Use gpt-image-2 or flux-pro-2.0 when the aspect ratio matters.`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
