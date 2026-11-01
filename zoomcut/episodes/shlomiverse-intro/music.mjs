// Three epic studio-logo stings for the Shlomiverse intro (ElevenLabs music), run in parallel.
// node music.mjs [a|b|c ...]   -> music/option-<x>.mp3 ; prints credits used (subscription character_count delta)
import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync(new URL('../../.env', import.meta.url), 'utf8').split(/\r?\n/)
  .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]));
const KEY = env.ELEVENLABS_API_KEY;
const OUT = new URL('./music/', import.meta.url);
fs.mkdirSync(OUT, { recursive: true });

const COMMON = 'Instrumental only, no vocals with words. A 16-second epic film production-company logo sting for a cinema opening, ' +
  'like the big logo before a blockbuster. Structure: 0-3s quiet tension builds from silence; 3-11s huge build; ' +
  'at about 11 seconds ONE massive final hit lands as the logo appears; 11-16s a long, shimmering, majestic tail that rings out to silence. ' +
  'Wide cinematic stereo, huge hall reverb, polished Hollywood mix.';
const OPTIONS = {
  a: 'Classic orchestral studio fanfare: rolling timpani and taiko drum rolls that grow and grow, a heroic brass fanfare melody ' +
     '(french horns and trumpets), a full choir swell singing "ah", cymbal crashes, building to a triumphant major-key final chord with ' +
     'the whole orchestra and a giant drum hit, then sustained strings and choir shimmering. ' + COMMON,
  b: 'Dark modern movie trailer: deep sub booms, heavy distorted braams, metallic impacts, a rising synth and orchestral riser, ' +
     'pulsing low strings and taiko hits that accelerate, a sucking reverse-swell, then one enormous braam-and-boom final hit, ' +
     'followed by a low rumbling tail with a high glassy shimmer. ' + COMMON,
  c: 'Cosmic wonder, space and awe: twinkling celesta and bells, soaring legato strings, a wordless choir rising, soft timpani rolls ' +
     'growing into a powerful swell, a sense of flying through the stars toward a glowing planet, then a triumphant radiant final hit ' +
     'with full orchestra, choir, bells and gong, and a long sparkling, reverberating tail. ' + COMMON,
};

const bal = async () => (await (await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': KEY } })).json());
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(OPTIONS);
const s0 = await bal();
console.log('credits used before:', s0.character_count, '/', s0.character_limit, s0.tier || '');
await Promise.all(want.map(async (k) => {
  const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192', {
    method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: OPTIONS[k], music_length_ms: 16000, model_id: 'music_v1', force_instrumental: true }),
  });
  if (!res.ok) { console.log(k, 'FAILED', res.status, (await res.text()).slice(0, 300)); return; }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(new URL(`option-${k}.mp3`, OUT), buf);
  console.log(k, 'ok', buf.length, 'bytes');
}));
await new Promise((r) => setTimeout(r, 8000));
const s1 = await bal();
console.log('credits used after:', s1.character_count, 'delta', s1.character_count - s0.character_count);
