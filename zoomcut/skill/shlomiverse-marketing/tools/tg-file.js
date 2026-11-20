// Send ONE file to his Telegram as a document (full quality, never twice). Token + chat id from C:/workspace/BoostMind/.env
// (never print them).  node tg-file.js <file> "<caption>"
const fs = require('fs'), path = require('path');
const env = Object.fromEntries(fs.readFileSync('C:/workspace/BoostMind/.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
  .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
(async () => {
  const fd = new FormData(); fd.append('chat_id', env.TELEGRAM_CHAT_ID); fd.append('caption', process.argv[3] || '');
  fd.append('document', new Blob([fs.readFileSync(process.argv[2])]), path.basename(process.argv[2]));
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendDocument`, { method: 'POST', body: fd });
  console.log(r.status);
})();
