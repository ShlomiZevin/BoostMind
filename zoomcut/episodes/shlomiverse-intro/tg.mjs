// Send a file to Shlomi's Telegram (same bot/credentials as zoomcut/render/share.mjs).
// node tg.mjs audio|photo|video|doc|text <file|text> "<caption>" [title]
import fs from 'node:fs';
import path from 'node:path';
import { sizedCopy } from '../../render/share.mjs';

const env = Object.fromEntries(fs.readFileSync('C:/workspace/xplace-auto-bidder/.env', 'utf8').split(/\r?\n/)
  .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]));
const [kind, target, caption = '', title] = process.argv.slice(2);
const api = (m) => `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/${m}`;

let r;
if (kind === 'text') {
  r = await fetch(api('sendMessage'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: target }) });
} else {
  let file = target;
  if (kind === 'video') file = await sizedCopy(target, 'telegram', () => {});
  const field = { audio: 'audio', photo: 'photo', video: 'video', doc: 'document' }[kind];
  const method = { audio: 'sendAudio', photo: 'sendPhoto', video: 'sendVideo', doc: 'sendDocument' }[kind];
  const mime = { audio: 'audio/mpeg', photo: 'image/jpeg', video: 'video/mp4', doc: 'application/octet-stream' }[kind];
  const form = new FormData();
  form.append('chat_id', env.TELEGRAM_CHAT_ID);
  form.append('caption', caption);
  if (kind === 'audio') { form.append('title', title || path.basename(file, '.mp3')); form.append('performer', 'Shlomiverse intro'); }
  if (kind === 'video') {
    form.append('supports_streaming', 'true');
    const m = (title || '').match(/^(\d+)x(\d+)$/);
    if (m) { form.append('width', m[1]); form.append('height', m[2]); }
  }
  form.append(field, new Blob([fs.readFileSync(file)], { type: mime }), path.basename(file).replace(/\.telegram\.mp4$/, '.mp4'));
  r = await fetch(api(method), { method: 'POST', body: form, signal: AbortSignal.timeout(180000) });
}
const j = await r.json();
console.log(j.ok ? 'sent ' + kind + ' ' + target : 'FAILED ' + (j.description || r.status));
if (!j.ok) process.exit(1);
