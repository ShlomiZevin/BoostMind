// ElevenLabs for Sketch Studio: other people's voices made from his own take (same words, same timing, same tune).
//   node tools/elevenlabs.mjs balance                       credits used / left this month
//   node tools/elevenlabs.mjs voices                        the male / female voices on the account
//   node tools/elevenlabs.mjs sts <in.wav|mp3|mp4> <voice> <out.mp3>     his take in another voice (voice changer)
//   node tools/elevenlabs.mjs choir <in> <out.wav> [voice,voice,...]     a crowd singing / saying it with him: each
//        voice is the take in another voice, a few ms late, slightly detuned, in a hall - mix it UNDER his voice
// Key: ELEVENLABS_API_KEY in zoomcut/.env (git-ignored). Cost: the voice changer is ~1000 credits per minute of audio
// per voice (Creator plan: 300k credits a month) - a 10 s line x 4 voices is ~700 credits.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const KEY = process.env.ELEVENLABS_API_KEY || (fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)
  .find((l) => l.startsWith('ELEVENLABS_API_KEY=')) || '').slice(19).trim();
const API = 'https://api.elevenlabs.io/v1';
const MODEL = 'eleven_multilingual_sts_v2';
// Israeli men from the voice library, added to the account as "HE <name>" (2026-10-23): Hebrew words come out clear -
// the American voices sang "גוש אשים ריפאי". Nimrod, Itamar, Tomer, Amit by default; also Viktor 8sZ9Z3Jy28CGLLCmKEHn,
// Dorian PBHwEnXdzx0yfhIO2UCH, Itai JIxTgeeS5w0UQyBxEnrl, Omer k77ZRVqAFg9Hd0ltAuON
const CHOIR = ['ZiofZHcEBTn5sRySe5h8', 'l7Q9rbdCC6j3J5dNlOOg', 'yGpVFXFoImvRvaURKypy', 'uwHajH4FhtzVp6X17pr7'];
const ff = (...a) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...a]);

async function sts(input, voice, out) {
  const wav = path.join(os.tmpdir(), `el-${process.pid}-${Math.random().toString(36).slice(2)}.mp3`);
  ff('-i', input, '-vn', '-ac', '1', '-ar', '44100', '-b:a', '192k', wav);  // just the sound
  const form = new FormData();
  form.append('audio', new Blob([fs.readFileSync(wav)]), 'take.mp3');
  form.append('model_id', MODEL);
  form.append('remove_background_noise', 'false');
  form.append('voice_settings', JSON.stringify({ stability: 0.5, similarity_boost: 0.8, style: 0, use_speaker_boost: true }));
  let r;
  for (let i = 0; ; i++) {  // the plan allows 5 requests at once: wait and try again when it says too many
    r = await fetch(`${API}/speech-to-speech/${voice}?output_format=mp3_44100_192`, { method: 'POST', headers: { 'xi-api-key': KEY }, body: form });
    if (r.status !== 429 || i >= 8) break;
    await new Promise((ok) => setTimeout(ok, 3000 * (i + 1)));
  }
  fs.rmSync(wav, { force: true });
  if (!r.ok) throw new Error(`voice changer ${voice}: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  return out;
}

const [cmd, ...a] = process.argv.slice(2);
if (cmd === 'balance') {
  const s = await (await fetch(`${API}/user/subscription`, { headers: { 'xi-api-key': KEY } })).json();
  console.log(`${s.tier}: ${s.character_count} of ${s.character_limit} credits used this month`);
} else if (cmd === 'voices') {
  const d = await (await fetch(`${API}/voices`, { headers: { 'xi-api-key': KEY } })).json();
  for (const v of d.voices || []) console.log(v.voice_id, v.labels?.gender || '-', v.name);
} else if (cmd === 'sts') {
  const [input, voice, out] = a;
  console.log('OK ->', await sts(input, voice, out));
} else if (cmd === 'choir') {
  const [input, out, list] = a;
  const voices = list ? list.split(',') : CHOIR;
  // each voice is kept beside the result (<out>.voices/), so a new mix never pays for the voice changer again
  const dir = `${out}.voices`;
  fs.mkdirSync(dir, { recursive: true });
  const parts = [];
  for (const [i, v] of voices.entries()) {  // (the plan allows 5 requests at once)
    const p = path.join(dir, `${v}.mp3`);
    if (!fs.existsSync(p)) await sts(input, v, p);
    parts.push(p);
  }
  // in sync with HIM: each voice is lined up to his take by its loudness envelope (the voice changer can shift a
  // little), never re-timed (no asetrate detune - it drifted 0.2 s over a song), then a few ms apart + one hall
  const env = (f) => {
    const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-ac', '1', '-ar', '1000', '-f', 's16le', '-']);
    const s = new Int16Array(raw.buffer, raw.byteOffset, raw.length >> 1), e = [];
    for (let i = 0; i + 10 <= s.length; i += 10) { let m = 0; for (let k = i; k < i + 10; k++) m += Math.abs(s[k]); e.push(m / 10); }
    return e;  // 10 ms frames
  };
  const ref = env(input);
  const lag = (e) => {  // best shift in 10 ms steps, within +-300 ms
    let best = 0, bv = -Infinity;
    for (let d = -30; d <= 30; d++) { let v = 0; for (let i = 0; i < ref.length; i++) { const j = i + d; if (j >= 0 && j < e.length) v += ref[i] * e[j]; } if (v > bv) { bv = v; best = d; } }
    return best * 10;  // ms: the voice is this much LATE (positive) or early (negative)
  };
  const spread = [0, 15, 30, 45];
  const chains = parts.map((p, i) => {
    const late = lag(env(p)), shift = spread[i % 4] - late;
    console.log(`  voice ${i}: ${late} ms off, placed ${spread[i % 4]} ms behind him`);
    return `[${i}:a]aresample=48000,${shift >= 0 ? `adelay=${shift}` : `atrim=start=${-shift / 1000},asetpts=PTS-STARTPTS`},volume=0.8[s${i}]`;
  });
  const mix = `${parts.map((_, i) => `[s${i}]`).join('')}amix=inputs=${parts.length}:normalize=0,highpass=f=120,lowpass=f=7000,aecho=0.8:0.6:60|110:0.25|0.18[out]`;
  ff(...parts.flatMap((p) => ['-i', p]), '-filter_complex', [...chains, mix].join(';'), '-map', '[out]', '-ac', '1', '-ar', '48000', out);
  console.log(`OK -> ${out} (${voices.length} voices)`);
} else {
  console.log('balance | voices | sts <in> <voice> <out> | choir <in> <out> [voices]');
}
