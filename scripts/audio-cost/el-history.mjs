// The last ElevenLabs generations on this key, with the credits each one took (key: zoomcut/.env).
import fs from 'node:fs';
const KEY = fs.readFileSync(new URL('../../zoomcut/.env', import.meta.url), 'utf8').split(/\r?\n/).find((l) => l.startsWith('ELEVENLABS_API_KEY='))?.slice(19).trim().replace(/^["']|["']$/g, '');
for (const src of ['TTS', 'STS', '']) {
  const r = await fetch('https://api.elevenlabs.io/v1/history?page_size=15' + (src ? '&source=' + src : ''), { headers: { 'xi-api-key': KEY } });
  const j = await r.json();
  console.log('== source', src || 'all', r.status, j.detail?.message || '');
  for (const h of j.history || []) console.log(new Date(h.date_unix * 1000).toISOString().slice(11, 19), h.source, h.model_id, (h.character_count_change_to - h.character_count_change_from), JSON.stringify(h.text || '').slice(0, 50));
}
