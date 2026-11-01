// ElevenLabs account check: plan, credits used / limit (key: zoomcut/.env).
import fs from 'node:fs';
const KEY = fs.readFileSync(new URL('../../zoomcut/.env', import.meta.url), 'utf8').split(/\r?\n/).find((l) => l.startsWith('ELEVENLABS_API_KEY='))?.slice(19).trim().replace(/^["']|["']$/g, '');
const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': KEY } });
const j = await r.json();
console.log('HTTP', r.status);
const { tier, character_count, character_limit, next_character_count_reset_unix, currency, status, billing_period } = j;
console.log({ tier, character_count, character_limit, reset: next_character_count_reset_unix && new Date(next_character_count_reset_unix * 1000).toISOString(), currency, status, billing_period, error: j.detail });
