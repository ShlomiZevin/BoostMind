// Credits one ElevenLabs music call takes: balance before, one 30 s track, balance until it stops moving.
import fs from 'node:fs';
const KEY = fs.readFileSync(new URL('../../zoomcut/.env', import.meta.url), 'utf8').split(/\r?\n/).find((l) => l.startsWith('ELEVENLABS_API_KEY='))?.slice(19).trim().replace(/^["']|["']$/g, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bal = async () => (await (await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': KEY } })).json()).character_count;
const b0 = await bal(); await sleep(5000); const b1 = await bal();
console.log('balance before', b0, b1, b0 === b1 ? '(still)' : '(MOVING - something else is using the key)');
const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', { method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ prompt: 'Calm lo-fi piano loop for a puzzle game menu, soft drums. Instrumental.', music_length_ms: 30000, model_id: 'music_v1', force_instrumental: true }) });
const buf = Buffer.from(await res.arrayBuffer());
console.log('music', res.status, buf.length, 'bytes; headers:', [...res.headers].filter(([k]) => /cost|char|credit/i.test(k)));
let last = b1;
for (let i = 0; i < 12; i++) { await sleep(5000); const b = await bal(); console.log('t+' + (i + 1) * 5 + 's', b, b - b1); if (b === last && b !== b1) break; last = b; }
