// game objects (transparent) and game backgrounds from art/v2/sprites.json, straight from OpenAI; skips existing art/v2/spr/<id>.png
//   . ~/.plaxzy/openai-env.sh; node tools/gen-v2-sprites.js [id ...]
const fs = require('fs'), path = require('path'), { execFile } = require('child_process');
const root = path.resolve(__dirname, '..'), J = JSON.parse(fs.readFileSync(path.join(root, 'art/v2/sprites.json'), 'utf8'));
const only = process.argv.slice(2), ids = Object.keys(J).filter((k) => k[0] !== '_' && (!only.length || only.includes(k)));
const one = (id) => new Promise((ok) => {
  const o = J[id], out = `art/v2/spr/${id}.png`, sp = o.kind === 'sprite';
  if (fs.existsSync(path.join(root, out)) && !only.length) return ok();
  const pf = path.join(root, `art/v2/spr/${id}.txt`); fs.writeFileSync(pf, (sp ? J._sprite : J._scene) + '\n\n' + o.prompt);
  const refs = ['art/style/p1b-flare.jpg', ...(o.ref ? [o.ref] : [])];
  execFile('node', ['tools/oai-image.js', '--model', 'flare', '--prompt-file', pf, '--out', out, '--size', sp ? '1024x1024' : '1536x1024', ...(sp ? ['--transparent'] : []), ...refs.flatMap((r) => ['--ref', r])], { cwd: root, timeout: 400000 },
    (e, so, se) => { console.log(id, e ? 'FAILED ' + se.slice(0, 300) : 'ok'); ok(); });
});
(async () => { const q = [...ids]; await Promise.all([0, 1, 2, 3].map(async () => { while (q.length) await one(q.shift()); })); })();
