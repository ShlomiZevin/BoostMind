// one picture -> a textured 3D model (Tripo v3 API, direct). . ~/.plaxzy/tripo-env.sh; node tripo-image.js <in.png> <out.glb> [--tex detailed]
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const [inp, out] = args, KEY = process.env.TRIPO_API_KEY, API = 'https://openapi.tripo3d.ai/v3', H = { authorization: 'Bearer ' + KEY };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const f = new FormData(); f.append('file', new Blob([fs.readFileSync(inp)], { type: 'image/png' }), path.basename(inp));
  const up = await (await fetch(API + '/files', { method: 'POST', headers: H, body: f })).json();
  if (up.code !== 0) throw new Error('upload ' + JSON.stringify(up).slice(0, 300));
  const tok = up.data.file_token;
  const base = { model: arg('model', 'v3.1-20260211'), texture: true, pbr: true, texture_quality: arg('tex', 'detailed'), geometry_quality: arg('geo', 'detailed'), orientation: 'default', texture_alignment: 'original_image' };
  if (arg('faces')) base.face_limit = +arg('faces');
  let r;
  for (const body of [{ ...base, input: tok }, { ...base, image: tok }, { ...base, inputs: [{ front: tok }] }]) {
    r = await (await fetch(API + '/generation/image-to-model', { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
    if (r.code === 0) break; console.log('try failed:', JSON.stringify(r).slice(0, 300));
  }
  if (r.code !== 0) { r = await (await fetch(API + '/generation/multiview-to-model', { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ ...base, inputs: [{ front: tok }] }) })).json(); if (r.code !== 0) throw new Error('refused ' + JSON.stringify(r).slice(0, 400)); }
  const tid = r.data.task_id; console.log('task', tid);
  for (let i = 0; i < 400; i++) {
    await sleep(3000);
    const t = (await (await fetch(API + '/tasks/' + tid, { headers: H })).json()).data;
    if (!t) continue;
    if (['failed', 'cancelled', 'banned', 'expired'].includes(t.status)) throw new Error(t.status + ' ' + JSON.stringify(t).slice(0, 400));
    if (t.status !== 'success') { if (i % 10 === 0) console.log('...', t.status, t.progress); continue; }
    const o = t.output || {}, url = o.pbr_model_url || o.model_url || o.pbr_model || o.model;
    fs.writeFileSync(out, Buffer.from(await (await fetch(url)).arrayBuffer()));
    const img = o.rendered_image_url || o.rendered_image; if (img) fs.writeFileSync(out.replace(/\.glb$/, '-render.png'), Buffer.from(await (await fetch(img)).arrayBuffer()));
    console.log('saved', out, (fs.statSync(out).size / 1048576).toFixed(1) + ' MB', 'credits', t.consumed_credit ?? '?');
    return;
  }
})().catch((e) => { console.error('FAILED: ' + e.message); process.exit(1); });
