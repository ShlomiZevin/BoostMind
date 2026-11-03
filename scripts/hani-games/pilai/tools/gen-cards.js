// card illustrations from art/cards.json (direct OpenAI flare; refs = Hani's painted pose + Avraham Moshe)
//   . ~/.plaxzy/openai-env.sh; node pilai/tools/gen-cards.js [names...]   (from C:/workspace/hani-games)
const fs = require('fs'), { execFile } = require('child_process');
const D = 'pilai/art/', J = JSON.parse(fs.readFileSync(D + 'cards.json', 'utf8'));
const want = process.argv.slice(2), names = Object.keys(J).filter((k) => !k.startsWith('_') && (!want.length || want.includes(k)));
const run = (n) => new Promise((res) => {
  const pf = D + 'cards/p-' + n + '.txt'; fs.writeFileSync(pf, J._base + '\n\nTHIS CARD: ' + J[n]);
  execFile('node', ['yosef/tools/oai-image.js', '--model', 'flare', '--prompt-file', pf, '--out', D + 'cards/' + n + '.png', '--size', '1024x1024',
    '--ref', 'shekel-tov/assets/pose-calm.png', ...(n.startsWith('code') ? [] : ['--ref', 'yosef/promo/hani-real/avraham-moshe.png'])],
    { maxBuffer: 1e7 }, (e, so, se) => { console.log(n, e ? 'FAILED ' + se.trim().slice(0, 200) : 'ok'); fs.unlinkSync(pf); res(); });
});
(async () => { const q = [...names]; await Promise.all(Array.from({ length: 6 }, async () => { while (q.length) await run(q.shift()); })); console.log('CARDS-DONE'); })();
