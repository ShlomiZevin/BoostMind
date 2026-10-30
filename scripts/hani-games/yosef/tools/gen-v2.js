// v2 pictures from art/v2/pages.json straight from OpenAI (tools/oai-image.js), 3 at once; skips existing art/v2/<id>.png
//   . ~/.plaxzy/openai-env.sh; node tools/gen-v2.js [id ...]
const fs = require('fs'), path = require('path'), { execFile } = require('child_process');
const root = path.resolve(__dirname, '..'), J = JSON.parse(fs.readFileSync(path.join(root, 'art/v2/pages.json'), 'utf8'));
const only = process.argv.slice(2), ids = Object.keys(J).filter((k) => k[0] !== '_' && (!only.length || only.includes(k)));
const REFS = ['art/style/p1b-flare.jpg', 'art/pages-v1/p01.jpg', 'art/v2/zvi-2.png'];
const one = (id) => new Promise((ok) => {
  const out = `art/v2/${id}.png`; if (fs.existsSync(path.join(root, out)) && !only.length) return ok();
  const pf = path.join(root, `art/v2/${id}.txt`); fs.writeFileSync(pf, J._common + '\n\n' + J[id].prompt);
  execFile('node', ['tools/oai-image.js', '--model', J[id].model || 'flare', '--prompt-file', pf, '--out', out, '--size', '1536x1024', ...REFS.flatMap((r) => ['--ref', r])], { cwd: root, timeout: 400000 }, (e, so, se) => { console.log(id, e ? 'FAILED ' + se.slice(0, 300) : so.trim().split(' ').slice(0, 2).join(' ')); ok(); });
});
(async () => { const q = [...ids]; await Promise.all([0, 1, 2].map(async () => { while (q.length) await one(q.shift()); })); })();
