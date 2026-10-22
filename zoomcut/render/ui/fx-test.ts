// A bench for the sound graph (layergraph.ts / soundfx.ts): window.__fx(url, fx, seconds) plays the file live through a
// clip + layer graph and records it, then renders the same graph offline - tools/fx_live_test.mjs compares the two.
import { buildLayer, applyLayer, buildClip, applyClip, loadFx } from './layergraph';

const record = async (url: string, it: any, props: any, secs: number) => {
  const ctx = new AudioContext();
  await loadFx(ctx);
  const el = new Audio(); el.crossOrigin = 'anonymous'; el.src = url; el.preload = 'auto';
  await new Promise((r) => el.addEventListener('canplaythrough', r, { once: true }));
  const sp = ctx.createScriptProcessor(4096, 1, 1), z = ctx.createGain(); z.gain.value = 0;
  const L = buildLayer(ctx, sp); applyLayer(L, props, false);
  const c = buildClip(ctx, L); ctx.createMediaElementSource(el).connect(c.gain); applyClip(c, it, false); c.gain.gain.value = 1;
  sp.connect(z); z.connect(ctx.destination);
  const chunks: Float32Array[] = [];
  sp.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  el.currentTime = it.in || 0; el.playbackRate = it.rate || 1; (el as any).preservesPitch = (it.rate || 1) === 1;
  await el.play();
  await new Promise((r) => setTimeout(r, secs * 1000));
  el.pause(); sp.disconnect();
  const n = chunks.reduce((a, b) => a + b.length, 0), live = new Float32Array(n); let o = 0; for (const ch of chunks) { live.set(ch, o); o += ch.length; }
  // offline: the same graph, a buffer source
  const ab = await (await fetch(url)).arrayBuffer();
  const off = new OfflineAudioContext(1, Math.round(secs * ctx.sampleRate), ctx.sampleRate);
  await loadFx(off);
  const buf = await off.decodeAudioData(ab);
  const L2 = buildLayer(off, off.destination); applyLayer(L2, props, false);
  const src = off.createBufferSource(); src.buffer = buf; src.playbackRate.value = it.rate || 1;
  const c2 = buildClip(off, L2, src); applyClip(c2, it, false); c2.gain.gain.value = 1;
  src.start(0, it.in || 0);
  const exp = (await off.startRendering()).getChannelData(0);
  return { live: Array.from(live), exp: Array.from(exp), sr: ctx.sampleRate };
};
(window as any).__fx = record;
