// Checks render/src/layers/view.js (the "What we see" strip over the characters' rows): node tools/view_test.mjs
import assert from 'node:assert/strict';
import { flatten, shownSpans, stripOf } from '../render/src/layers/view.js';
import { validate } from '../render/src/layers/ops.js';

const FULL = { x: 0, y: 0, w: 1080, h: 1920 };
const P = {
  format: 'sketch-studio/1', canvas: { w: 1080, h: 1920, fps: 30 }, duration: 300,
  assets: { a: { kind: 'video', src: 'a.mp4', w: 720, h: 1280 }, b: { kind: 'video', src: 'b.mp4', w: 720, h: 1280 },
    s1: { kind: 'image', src: 's1.jpg', w: 1000, h: 1000 }, s2: { kind: 'image', src: 's2.jpg', w: 1000, h: 1000 }, v: { kind: 'audio', src: 'v.wav' } },
  layers: [
    // (bottom first: each character's background row under its clips, its voice above)
    { id: 'hani.bg', kind: 'image', group: 'Hani', props: { blur: 6 }, items: [{ id: 'hb1', from: 0, dur: 150, asset: 's1', box: FULL, link: 'h' }] },
    { id: 'hani.video', kind: 'video', group: 'Hani', props: { box: FULL, cutout: true },
      items: [{ id: 'h1', from: 0, dur: 150, asset: 'a', in: 2, fade_in: 0.2, link: 'h' }] },
    { id: 'hani.voice', kind: 'audio', group: 'Hani', items: [{ id: 'hv1', from: 0, dur: 140, asset: 'v', link: 'h' }] },
    { id: 'osnat.bg', kind: 'image', group: 'Osnat', props: {}, items: [{ id: 'ob1', from: 100, dur: 200, asset: 's2', box: FULL, link: 'o' }] },
    { id: 'osnat.video', kind: 'video', group: 'Osnat', props: { box: FULL }, items: [{ id: 'o1', from: 100, dur: 200, asset: 'b', in: 1, link: 'o' }] },
    { id: 'osnat.hat', kind: 'image', group: 'Osnat', props: {}, items: [{ id: 'oh', from: 200, dur: 30, asset: 's1', box: FULL }] },
    { id: 'osnat.voice', kind: 'audio', group: 'Osnat', items: [{ id: 'ov1', from: 130, dur: 170, asset: 'v', link: 'o' }] },
    { id: 'view', kind: 'view', items: [{ id: 'w1', from: 0, dur: 120, show: 'hani.video' }, { id: 'w2', from: 120, dur: 180, show: 'osnat.video' }] },
    { id: 'subs', kind: 'subtitles', items: [{ id: 's', from: 0, dur: 30, text: 'x' }] },
  ],
};
const at = (id) => P.layers.find((l) => l.id === id);
assert.deepEqual(validate(P), []);
assert.deepEqual(validate({ ...P, layers: [...P.layers.slice(0, 7), { id: 'view', kind: 'view', items: [{ id: 'w', from: 0, dur: 9, show: 'hani.voice' }] }] }),
  ['layer view item w: show must name a video layer']);
assert.deepEqual(shownSpans(stripOf(P), 'hani.video'), [[0, 120], [300, Infinity]]);

const F = flatten(P);
assert.equal(F.layers.some((l) => l.kind === 'view'), false, 'the strip is gone');
// the characters sit together (only voices between): everyone's rows under the clips, the clips, everyone's rows above
assert.deepEqual(F.layers.map((l) => l.id), ['hani.bg', 'osnat.bg', 'hani.video', 'osnat.video', 'osnat.hat', 'hani.voice', 'osnat.voice', 'subs']);
const L = (id) => F.layers.find((l) => l.id === id);
assert.deepEqual(L('hani.video').items.map((i) => [i.id, i.from, i.dur, i.in]), [['h1~0', 0, 120, 2]]);
assert.equal(L('hani.video').items[0].fade_in, 0.2);
// osnat's clip starts at 100 but is seen only from 120: its piece starts 20 frames (0.667 s) into it
assert.deepEqual(L('osnat.video').items.map((i) => [i.id, i.from, i.dur, i.in]), [['o1~0', 120, 180, 1.6667]]);
// each background row is cut like its character's clips; it stays a real layer (its props, its own picks)
assert.deepEqual(L('hani.bg').items.map((i) => [i.id, i.from, i.dur, i.asset]), [['hb1~0', 0, 120, 's1']]);
assert.equal(L('hani.bg').props.blur, 6);
assert.deepEqual(L('osnat.bg').items.map((i) => [i.id, i.from, i.dur]), [['ob1~0', 120, 180]]);
assert.deepEqual(L('osnat.hat').items.map((i) => [i.id, i.from, i.dur]), [['oh', 200, 30]], 'a picture of her own: shown while she is');
assert.equal(L('hani.voice'), at('hani.voice'), 'sound untouched');
// no strip: the very same object
const plain = { ...P, layers: P.layers.filter((l) => l.kind !== 'view') };
assert.equal(flatten(plain), plain);
// flattening twice changes nothing
assert.deepEqual(flatten(F), F);
// characters apart (a picture between them): every row where it was
const apart = { ...P, layers: [...P.layers.slice(0, 3), { id: 'pic', kind: 'image', items: [] }, ...P.layers.slice(3)] };
assert.deepEqual(flatten(apart).layers.map((l) => l.id), ['hani.bg', 'hani.video', 'hani.voice', 'pic', 'osnat.bg', 'osnat.video', 'osnat.hat', 'osnat.voice', 'subs']);
// the strip shows a row past its clips: that row's nearest frame is held (rate 0), never nothing - and its background
const past = { ...P, layers: P.layers.map((l) => (l.id === 'view' ? { ...l, items: [{ id: 'w1', from: 0, dur: 200, show: 'hani.video' }, { id: 'w2', from: 200, dur: 100, show: 'osnat.video' }] } : l)) };
const FP = flatten(past);
const H = FP.layers.find((l) => l.id === 'hani.video').items;
assert.deepEqual(H.map((i) => [i.id, i.from, i.dur, i.in, i.rate]), [['h1', 0, 150, 2, undefined], ['h1~h0', 150, 50, 6.9667, 0]]);
assert.equal(H[1].fade_in, undefined, 'a held frame has no fade');
assert.deepEqual(FP.layers.find((l) => l.id === 'hani.bg').items.map((i) => [i.id, i.from, i.dur, i.asset]), [['hb1', 0, 150, 's1'], ['hb1~h0', 150, 50, 's1']], 'its background too');
// a video background: cut and held like the clips (its own footage frozen)
const vbg = { ...past, layers: past.layers.map((l) => (l.id === 'hani.bg' ? { ...l, kind: 'video', items: [{ id: 'hb1', from: 0, dur: 150, asset: 'b', in: 0, link: 'h', box: FULL }] } : l)) };
assert.deepEqual(flatten(vbg).layers.find((l) => l.id === 'hani.bg').items.map((i) => [i.id, i.from, i.dur, i.in, i.rate]), [['hb1', 0, 150, 0, undefined], ['hb1~h0', 150, 50, 4.9667, 0]]);
console.log('view.js ok');
