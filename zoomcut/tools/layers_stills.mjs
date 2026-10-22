// Same frames from the old Zoom composition (work/edit.json) and the layered one (project.json), side by side + SSIM.
//   node tools/layers_stills.mjs <episode> <outdir> [frame,frame,...]      (the studio must be running: media by URL)
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [ep, out, list] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const base = 'http://127.0.0.1:4747';
const edit = JSON.parse(fs.readFileSync(path.join(ROOT, 'episodes', ep, 'work', 'edit.json'), 'utf8'));
const view = await (await fetch(`${base}/api/p/${ep}`)).json();
const frames = list ? list.split(',').map(Number) : [0, 120, 600, 1500, 2500, 3500, 4500, 5300, 5480, 5495, 5520, 5600];
const serve = path.join(ROOT, 'render', 'src', 'index.ts');
const bundled = await bundle({ entryPoint: serve, webpackOverride: (c) => c });
const oldProps = { ...edit, mediaBase: `${base}/media/${ep}/` };
delete oldProps.voices; delete oldProps.audioSrc;
const newProps = { project: view.project, urls: view.urls, mode: 'full' };
const oldC = await selectComposition({ serveUrl: bundled, id: 'ZoomCall', inputProps: oldProps });
const newC = await selectComposition({ serveUrl: bundled, id: 'Layers', inputProps: newProps });
const ffmpeg = 'ffmpeg';
for (const f of frames) {
  const a = path.join(out, `old-${f}.png`), b = path.join(out, `new-${f}.png`);
  await renderStill({ composition: oldC, serveUrl: bundled, output: a, inputProps: oldProps, frame: f });
  await renderStill({ composition: newC, serveUrl: bundled, output: b, inputProps: newProps, frame: f });
  const p = spawnSync(ffmpeg, ['-hide_banner', '-i', a, '-i', b, '-lavfi', 'ssim', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /All:([\d.]+)/.exec(p.stderr || '');
  execFileSync(ffmpeg, ['-y', '-v', 'error', '-i', a, '-i', b, '-filter_complex', '[0][1]hstack,scale=1080:-1', path.join(out, `pair-${f}.jpg`)]);
  console.log(`frame ${f}: SSIM ${m ? m[1] : '?'}`);
}
