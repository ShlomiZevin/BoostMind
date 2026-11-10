// new music bed for the Instagram cut (ElevenLabs music API): node music.js <name> "<prompt>" [ms]
const fs = require('fs');
const [name, prompt, ms] = process.argv.slice(2);
(async () => {
  const r = await fetch('https://api.elevenlabs.io/v1/music', { method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, music_length_ms: +(ms || 14000), force_instrumental: true }) });
  if (!r.ok) { console.log(name, r.status, (await r.text()).slice(0, 300)); return; }
  fs.writeFileSync(`out/music/${name}.mp3`, Buffer.from(await r.arrayBuffer())); console.log(name, 'ok');
})();
