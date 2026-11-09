// Checks render/src/layers/view.js (the "What we see" strip + a background per clip): node tools/view_test.mjs
import assert from 'node:assert/strict';
import { flatten, shownSpans, stripOf } from '../render/src/layers/view.js';
import { validate } from '../render/src/layers/ops.js';

const P = {
  format: 'sketch-studio/1', canvas: { w: 1080, h: 1920, fps: 30 }, duration: 300,
  assets: { a: { kind: 'video', src: 'a.mp4', w: 720, h: 1280 }, b: { kind: 'video', src: 'b.mp4', w: 720, h: 1280 },
    s1: { kind: 'image', src: 's1.jpg', w: 1000, h: 1000 }, s2: { kind: 'image', src: 's2.jpg', w: 1000, h: 1000 }, v: { kind: 'audio', src: 'v.wav' } },
  layers: [
    { id: 'hani.video', kind: 'video', props: { box: { x: 0, y: 0, w: 1080, h: 1920 }, cutout: true, bg: { blur: 6 } },
      items: [{ id: 'h1', from: 0, dur: 150, asset: 'a', in: 2, fade_in: 0.2, bg: { asset: 's1', box: { x: -10, y: 0, w: 1200 } } }] },
    { id: 'hani.voice', kind: 'audio', items: [{ id: 'hv1', from: 0, dur: 140, asset: 'v' }] },
    { id: 'osnat.video', kind: 'video', props: { box: { x: 0, y: 0, w: 1080, h: 1920 } },
      items: [{ id: 'o1', from: 100, dur: 200, asset: 'b', in: 1, bg: { asset: 's2' } }] },
    { id: 'osnat.voice', kind: 'audio', items: [{ id: 'ov1', from: 130, dur: 170, asset: 'v' }] },
    { id: 'view', kind: 'view', items: [{ id: 'w1', from: 0, dur: 120, show: 'hani.video' }, { id: 'w2', from: 120, dur: 180, show: 'osnat.video' }] },
    { id: 'subs', kind: 'subtitles', items: [{ id: 's', from: 0, dur: 30, text: 'x' }] },
  ],
};
assert.deepEqual(validate(P), []);
assert.deepEqual(validate({ ...P, layers: [...P.layers.slice(0, 4), { id: 'view', kind: 'view', items: [{ id: 'w', from: 0, dur: 9, show: 'hani.voice' }] }] }),
  ['layer view item w: show must name a video layer']);
assert.deepEqual(shownSpans(stripOf(P), 'hani.video'), [[0, 120], [300, Infinity]]);

const F = flatten(P);
assert.equal(F.layers.some((l) => l.kind === 'view'), false, 'the strip is gone');
const ids = F.layers.map((l) => l.id);
// the rows sit together (only a voice row between): one background layer under both, the rows right above it
assert.deepEqual(ids, ['hani.video~bg', 'hani.video', 'osnat.video', 'hani.voice', 'osnat.voice', 'subs']);
const L = (id) => F.layers.find((l) => l.id === id);
assert.deepEqual(L('hani.video').items.map((i) => [i.id, i.from, i.dur, i.in]), [['h1~0', 0, 120, 2]]);
assert.equal(L('hani.video').items[0].fade_in, 0.2);
assert.equal(L('hani.video').items[0].bg, undefined);
assert.equal(L('hani.video').props.bg, undefined);
// osnat's clip starts at 100 but is seen only from 120: its piece starts 20 frames (0.667 s) into it
assert.deepEqual(L('osnat.video').items.map((i) => [i.id, i.from, i.dur, i.in]), [['o1~0', 120, 180, 1.6667]]);
const bg = L('hani.video~bg').items;
assert.deepEqual(bg.map((i) => [i.id, i.from, i.dur, i.asset]), [['h1~0', 0, 120, 's1'], ['o1~0', 120, 180, 's2']]);
assert.equal(bg[0].blur, 6, 'the row default under the clip');
assert.deepEqual(bg[1].box, { x: -420, y: 0, w: 1920, h: 1920 }, 'no box = covers the frame');
assert.equal(L('hani.voice'), P.layers[1], 'sound untouched');
// no strip, no clip background: the very same object
const plain = { ...P, layers: [P.layers[1], P.layers[5]] };
assert.equal(flatten(plain), plain);
// flattening twice changes nothing
assert.deepEqual(flatten(F), F);
// rows apart (a picture between them): each its own background layer
const apart = { ...P, layers: [P.layers[0], { id: 'pic', kind: 'image', items: [] }, ...P.layers.slice(2)] };
assert.deepEqual(flatten(apart).layers.map((l) => l.id), ['hani.video~bg', 'hani.video', 'pic', 'osnat.video~bg', 'osnat.video', 'osnat.voice', 'subs']);
console.log('view.js ok');
