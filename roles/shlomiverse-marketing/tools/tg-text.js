// Send a short text message to his Telegram (a marker before / after a batch of files). Token + chat id from
// C:/workspace/BoostMind/.env (never print them).  node tg-text.js "<message>"
const fs = require('fs');
const env = Object.fromEntries(fs.readFileSync('C:/workspace/BoostMind/.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
  .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
(async () => {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: process.argv[2] || '' }) });
  console.log(r.status);
})();
