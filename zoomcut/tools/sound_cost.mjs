// What the editor's sound costs the audio thread: the project's graph built exactly as AudioTrack wires it
// (render/ui/layergraph.ts - a layer graph per audio layer, a clip graph per copy) and rendered offline in headless
// Chrome. Chrome's real-time audio thread does this work every second the sound plays; much over ~25% of a core and
// the sound (and other tabs' - his Meet) breaks up. Run it after adding an effect or a node to the graph.
//   node tools/sound_cost.mjs <project id> [seconds=30]        (the studio must be running)
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const R = path.join(HERE, '..', 'render');
const { default: puppeteer } = await import(pathToFileURL(path.join(R, 'node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js')).href);
const chrome = path.join(R, 'node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe');
const [id, secs = '30'] = process.argv.slice(2);
if (!id) { console.log('node tools/sound_cost.mjs <project id> [seconds]'); process.exit(1); }

const b = await puppeteer.launch({ executablePath: chrome, args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
await p.goto(`http://localhost:4747/vt-test.html?id=${encodeURIComponent(id)}`, { waitUntil: 'networkidle2' });
const r = await p.evaluate(async (id, secs, clock) => {
  const LG = await import('/layergraph.ts');  // (vite's root is render/ui)
  const C = await import(clock);
  const v = await (await fetch(`/api/p/${id}`)).json();
  const fps = v.project.canvas.fps;
  const ctx = new OfflineAudioContext(2, 48000 * secs, 48000);
  await LG.loadFx(ctx);
  const AW = window.AudioWorkletNode;
  let worklets = 0, clips = 0;
  window.AudioWorkletNode = function (...a) { worklets++; return new AW(...a); };
  for (const l of v.project.layers.filter((x) => x.kind === 'audio')) {
    const lay = LG.buildLayer(ctx, ctx.destination);
    LG.applyLayer(lay, l.props || {}, false);
    const parts = C.partsOf(l.items, fps, () => 'audio');
    for (const copy of Object.keys(C.copiesOf(parts))) {
      LG.applyClip(LG.buildClip(ctx, lay), parts.find((x) => x.copy === copy), false);
      clips++;
    }
  }
  window.AudioWorkletNode = AW;
  const t = performance.now();
  await ctx.startRendering();
  return { clips, worklets, ms: performance.now() - t };
}, id, +secs, '/@fs/' + path.join(R, 'src/layers/clock.js').replace(/\\/g, '/'));
console.log(`${id}: ${r.clips} clip graphs, ${r.worklets} worklet nodes - ${secs} s of sound cost ${Math.round(r.ms)} ms = ${(r.ms / secs / 10).toFixed(1)}% of one core`);
await b.close();
