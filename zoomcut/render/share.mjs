// Send a finished episode to Shlomi: email (Gmail, from shlomi@boostart.io) and Telegram (his bot).
// Credentials stay where they already live and are read only when sending:
//   GMAIL_USER / GMAIL_APP_PASSWORD   → aspect/aspect-agent-server/.env
//   TELEGRAM_TOKEN / TELEGRAM_CHAT_ID → xplace-auto-bidder/.env
// Gmail caps attachments at 25 MB and bots can upload 50 MB, so each channel gets its own
// size-capped copy; the full-quality master stays in out/.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import nodemailer from 'nodemailer';

const ENV_MAIL = 'C:/workspace/aspect/aspect-agent-server/.env';
const ENV_TG = 'C:/workspace/xplace-auto-bidder/.env';
export const LIMIT_MB = { email: 23, telegram: 48 };

function readEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

function ff(name) {
  const base = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  for (const d of fs.existsSync(base) ? fs.readdirSync(base) : []) {
    if (!d.startsWith('Gyan.FFmpeg')) continue;
    for (const v of fs.readdirSync(path.join(base, d))) {
      const p = path.join(base, d, v, 'bin', name + '.exe');
      if (fs.existsSync(p)) return p;
    }
  }
  return name;
}

const mb = (f) => fs.statSync(f).size / 1024 / 1024;

// a copy that fits the channel; the master itself if it already does
export async function sizedCopy(master, channel, log) {
  const limit = LIMIT_MB[channel];
  if (mb(master) <= limit) return master;
  const dur = parseFloat(execFileSync(ff('ffprobe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', master]).toString());
  const out = master.replace(/\.mp4$/, `.${channel}.mp4`);
  if (fs.existsSync(out) && fs.statSync(out).mtimeMs > fs.statSync(master).mtimeMs && mb(out) <= limit) return out;  // already made for this export
  let factor = channel === 'telegram' ? 0.96 : 0.92;  // two-pass hits its target closely
  for (let attempt = 0; attempt < 3; attempt++) {
    const kbps = Math.floor((limit * 8 * 1024 * factor) / dur - 128);
    const label = channel === 'email' ? 'email' : 'Telegram';
    log(`Compressing for ${label} · 0%`, true);
    // Telegram: two passes at the slow preset - the best picture that fits the bot's 50 MB (Telegram's limit)
    const passes = channel === 'telegram' ? [1, 2] : [0];
    const plog = out.replace(/\.mp4$/, '.2pass');
    for (const pass of passes) {
      await new Promise((res, rej) => {
        const args = ['-y', '-v', 'error', '-nostats', '-progress', 'pipe:1', '-i', master, '-c:v', 'libx264', '-preset', pass ? 'slow' : 'medium',
          '-b:v', `${kbps}k`, '-maxrate', `${Math.floor(kbps * 1.5)}k`, '-bufsize', `${kbps * 2}k`, '-pix_fmt', 'yuv420p'];
        if (pass) args.push('-pass', String(pass), '-passlogfile', plog);
        if (pass === 1) args.push('-an', '-f', 'mp4', process.platform === 'win32' ? 'NUL' : '/dev/null');
        else args.push('-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out);
        const p = spawn(ff('ffmpeg'), args);
        p.stdout.on('data', (buf) => {
          const m = [...buf.toString().matchAll(/out_time_us=(\d+)/g)].pop();
          const pct = Math.min(99, Math.round((+(m?.[1] || 0) / 1e6 / dur) * 100));
          if (m) log(`Compressing for ${label}${pass ? ` · pass ${pass}/2` : ''} · ${pct}%`, true);
        });
        p.on('close', (c) => (c ? rej(new Error('ffmpeg failed')) : res()));
      });
    }
    for (const f of [`${plog}-0.log`, `${plog}-0.log.mbtree`]) fs.rmSync(f, { force: true });  // keep the export folder to the videos
    if (mb(out) <= limit) return out;
    factor *= 0.85;
  }
  throw new Error(`could not get the video under ${limit} MB`);
}

export async function sendEmail({ file, to, subject, text }) {
  const env = readEnv(ENV_MAIL);
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD missing in ' + ENV_MAIL);
  const t = nodemailer.createTransport({ service: 'gmail', auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD } });
  await t.sendMail({ from: `Sketch Studio <${env.GMAIL_USER}>`, to: to || env.GMAIL_USER, subject, text,
    attachments: [{ filename: path.basename(file).replace(/\.(email|telegram)\.mp4$/, '.mp4'), path: file }] });
  return to || env.GMAIL_USER;
}

// a text message to his Telegram (e.g. a caption to paste into TikTok - long-press copies it)
// (html: Telegram's HTML - a <pre> block is copied with one tap / its Copy button)
export async function sendTelegramText(text, { html = false } = {}) {
  const env = readEnv(ENV_TG);
  if (!env.TELEGRAM_TOKEN || !env.TELEGRAM_CHAT_ID) throw new Error('TELEGRAM_TOKEN / TELEGRAM_CHAT_ID missing in ' + ENV_TG);
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, ...(html ? { parse_mode: 'HTML' } : {}) }) });
  if (!r.ok) throw new Error('Telegram: ' + r.status + ' ' + (await r.text()).slice(0, 120));
}
export const tgEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function sendTelegram({ file, caption, log = () => {} }) {
  const env = readEnv(ENV_TG);
  if (!env.TELEGRAM_TOKEN || !env.TELEGRAM_CHAT_ID) throw new Error('TELEGRAM_TOKEN / TELEGRAM_CHAT_ID missing in ' + ENV_TG);
  const form = new FormData();
  form.append('chat_id', env.TELEGRAM_CHAT_ID);
  form.append('caption', caption);
  form.append('supports_streaming', 'true');
  form.append('width', '1080');
  form.append('height', '1920');
  form.append('video', new Blob([fs.readFileSync(file)], { type: 'video/mp4' }), path.basename(file).replace(/\.(email|telegram)\.mp4$/, '.mp4'));
  let last = 'unknown';
  for (let attempt = 1; attempt <= 3; attempt++) {  // the Bot API drops connections now and then
    try {
      const t0 = Date.now(), size = Math.round(mb(file));
      const tick = setInterval(() => log(`Uploading ${size} MB to Telegram · ${Math.round((Date.now() - t0) / 1000)}s`, true), 1000);
      log(`Uploading ${size} MB to Telegram · 0s`, true);
      const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendVideo`, { method: 'POST', body: form, signal: AbortSignal.timeout(180000) })
        .finally(() => clearInterval(tick));
      const j = await r.json();
      if (j.ok) return true;
      last = j.description || `http ${r.status}`;
      if (r.status >= 400 && r.status < 500 && r.status !== 429) break;
    } catch (e) { last = e.message; }
    await new Promise((res) => setTimeout(res, attempt * 2000));
  }
  throw new Error('Telegram: ' + last);
}
