// Ask Shlomi on Telegram who the character in a reel is: the reel with its new subtitles + what we know + the question.
// He answers when he comes back to the session (his way, 2026-10-31); the question waits in scripts/insta/state.json.
//   node scripts/insta/ask.mjs <media-id>
// Bot: the studio's (TELEGRAM_TOKEN / TELEGRAM_CHAT_ID in xplace-auto-bidder/.env, like render/share.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const readEnv = (p) => Object.fromEntries(fs.readFileSync(p, 'utf8').split(/\r?\n/)
  .map((l) => l.match(/^([A-Z_0-9]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const TG = readEnv('C:/workspace/xplace-auto-bidder/.env');
const id = process.argv[2];
const d = path.join(HERE, 'work', id);
const j = (f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'));
const m = JSON.parse(fs.readFileSync(path.join(HERE, 'work/media.json'), 'utf8')).find((x) => x.id === id);
const who = j('who.json');
const words = j('words.json').filter((g) => !g.doubt).map((g) => g.text).join(' ');
const guess = who.new?.[0];

const caption = [
  `Shlomiverse from Instagram: who is this?`,
  `${m.like_count.toLocaleString('en')} likes · ${m.timestamp.slice(0, 10)}`,
  m.permalink,
  '',
  who.on_screen_text ? `On screen: ${who.on_screen_text.replace(/\n/g, ' ')}` : '',
  words ? `Says: ${words}` : 'No speech',
  guess ? `My guess: ${guess.name_guess} - ${guess.who}` : '',
  '',
  'Tell me in the session: his/her name, age, which world, a little background - or "one-off" if it isn\'t a character.',
  'The subtitles in this video are the new ones - say if anything is off.',
].filter((l, i, a) => l || a[i - 1]).join('\n').slice(0, 1024);

const form = new FormData();
form.append('chat_id', TG.TELEGRAM_CHAT_ID);
form.append('caption', caption);
form.append('supports_streaming', 'true');
form.append('video', new Blob([fs.readFileSync(path.join(d, 'web.mp4'))], { type: 'video/mp4' }), `${id}.mp4`);
const r = await (await fetch(`https://api.telegram.org/bot${TG.TELEGRAM_TOKEN}/sendVideo`, { method: 'POST', body: form })).json();
if (!r.ok) throw new Error('Telegram: ' + JSON.stringify(r).slice(0, 200));

const SP = path.join(HERE, 'state.json');
const state = fs.existsSync(SP) ? JSON.parse(fs.readFileSync(SP, 'utf8')) : {};
state[id] = { ...state[id], status: 'asked', asked: new Date().toISOString(), permalink: m.permalink, likes: m.like_count, guess: guess?.name_guess };
fs.writeFileSync(SP, JSON.stringify(state, null, 1) + '\n');
console.log('asked on Telegram, message', r.result.message_id);
