// ElevenLabs Music (instrumental bed): node tools/elevenlabs_music.mjs <out.mp3> <seconds> "<prompt>"
//                                  or: node tools/elevenlabs_music.mjs <out.mp3> - <plan.json>
// A plan (composition_plan) fixes the tempo and style per section - use it for a bed with a clear character (a fast
// comedy bed): {positive_global_styles, negative_global_styles, sections: [{section_name, positive_local_styles,
// negative_local_styles, duration_ms, lines: []}]}. A loose prompt drifts to a soft underscore.
// The plan runs 2 requests at once - make options two at a time. Key: ELEVENLABS_API_KEY in zoomcut/.env.
import fs from 'node:fs';
const KEY = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/).find((l) => l.startsWith('ELEVENLABS_API_KEY=')).slice(19).trim();
const [out, secs, prompt] = process.argv.slice(2);
const body = /\.json$/i.test(prompt || '')
  ? { composition_plan: JSON.parse(fs.readFileSync(prompt, 'utf8')), model_id: 'music_v1' }
  : { prompt, music_length_ms: Math.round(+secs * 1000), model_id: 'music_v1', force_instrumental: true };
const r = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
  method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
if (!r.ok) { console.error('HTTP', r.status, (await r.text()).slice(0, 600)); process.exit(1); }
fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
console.log('OK', out, fs.statSync(out).size, r.headers.get('character-cost') ? `cost ${r.headers.get('character-cost')}` : '');
