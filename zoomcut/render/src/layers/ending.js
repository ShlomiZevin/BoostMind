// The socials' ending - "signal lost" (his concept, 2026-11-17, Backstage plan oaf-ending: "the Shlomiverse is a parallel
// universe of real people ... suddenly a reception problem, the connection with the Shlomiverse universe was cut - for the
// full ending you're welcome to fly over for a visit ... not too long: two glitches, a sound of ~100 ms, then a slide as if
// the reception was lost").
//
// signalLostOps(project) -> the ops that build it at project.split.at (the Timeline's "+ Ending" button sends them; a
// session can send the same ops through POST /api/p/<id>/ops). Every part is a layer he changes, all `only: 'social'`
// in the group "Socials ending":
//   ending.glitch  effect / glitch    two short glitches on the last moments BEFORE the cut (the export joins the socials'
//                                     file there - export_layers.social_cut)
//   ending.pixel   effect / pixel     after the cut the picture (frozen on its last frame - split.freeze) breaks into
//   ending.dark    effect / dark      big blocks and goes dark, like a call whose connection dropped
//   ending.logo    image              the Shlomiverse planet, flickering like a weak signal
//   ending.words   text               "● בעיית קליטה" / "הקשר עם יקום שלומיוורס נותק" / "לסיום המלא - מוזמנים לטוס לביקור"
//   ending.link    text / pill        shlomiverse.com
//   ending.sound   audio              a glitch sound on each glitch (~100 ms; the voices drop out under it) - the cut is dead
//   ending.static  audio              a faint hiss of static under the card
// Times are written in REAL seconds and laid on the timeline at the project's speed, so a sped-up video keeps them.
// The files are shared by every project: episodes/_assets/socials-ending/ (the studio's shared pool - both computers).

const DIR = '../_assets/socials-ending/';
export const ENDING_ASSETS = {
  'm.verse-logo.png': { kind: 'image', src: DIR + 'verse-logo.png', w: 508, h: 431, label: 'Shlomiverse logo' },
  's.signal-glitch-1.mp3': { kind: 'audio', src: DIR + 'signal-glitch-1.mp3', duration: 0.6, label: 'signal glitch 1' },
  's.signal-glitch-2.mp3': { kind: 'audio', src: DIR + 'signal-glitch-2.mp3', duration: 0.48, label: 'signal glitch 2' },
  's.signal-static.mp3': { kind: 'audio', src: DIR + 'signal-static.mp3', duration: 4, label: 'static after the signal is lost' },
};
const FONT = { id: 'font.assistant', asset: { kind: 'font', src: '../../fonts/Assistant.ttf', family: 'zc-assistant' } };

export const ENDING = { card: 2.6, glitch1: [0.36, 0.1], glitch2: [0.16, 0.16] };  // card length; [s before the cut, length]

export function signalLostOps(project) {
  const at = Math.round(+project?.split?.at);
  if (!(at > 0)) return [];
  const fps = project.canvas.fps, W = project.canvas.w, H = project.canvas.h, k = W / 1080, sp = +project.speed || 1;
  const fr = (s) => Math.max(1, Math.round(s * fps * sp));  // real seconds -> timeline frames
  const ts = (s) => +(s * sp).toFixed(3);                  // real seconds -> timeline seconds (fades, anim keys)
  const card = fr(ENDING.card), on = at + fr(0.12);          // the words come a beat after the picture froze
  const g1 = at - fr(ENDING.glitch1[0]), g2 = at - fr(ENDING.glitch2[0]);
  const voices = (project.layers || []).filter((l) => l.kind === 'audio' && l.only !== 'social').map((l) => l.id);
  const flick = (keys) => keys.map(([t, v]) => [ts(t), v]);
  const G = { group: 'Socials ending', only: 'social' };
  // where the layers go: the effects right above the picture's own top effect (or above everything shown, so the words
  // and the call's frame break up with it), the card above them, the sounds at the end
  const L = project.layers || [];
  let fxAt = -1;
  L.forEach((l, i) => { if (l.kind === 'effect' && !l.hidden) fxAt = i + 1; });
  if (fxAt < 0) fxAt = L.length - L.slice().reverse().findIndex((l) => l.kind !== 'audio');
  if (fxAt > L.length) fxAt = L.length;
  const ops = [];
  for (const [id, asset] of Object.entries(ENDING_ASSETS)) if (!project.assets?.[id]) ops.push({ op: 'asset.add', id, asset });
  if (!project.assets?.[FONT.id]) ops.push({ op: 'asset.add', id: FONT.id, asset: FONT.asset });
  ops.push({ op: 'project', set: { split: { ...project.split, at, freeze: true } } });
  const add = (layer, index) => ops.push({ op: 'layer.add', index, layer: { ...G, ...layer } });
  let i = fxAt;
  add({ id: 'ending.glitch', kind: 'effect', name: 'Ending - glitches', props: { filter: 'glitch', amount: 1 },
    items: [{ id: 'g1', from: g1, dur: fr(ENDING.glitch1[1]), amount: 0.85, fade_in: 0, fade_out: 0 },
      { id: 'g2', from: g2, dur: at - g2, amount: 1, fade_in: 0, fade_out: 0 }] }, i++);
  add({ id: 'ending.pixel', kind: 'effect', name: 'Ending - pixels', props: { filter: 'pixel', amount: 0.6 },
    items: [{ id: 'p1', from: at, dur: card, fade_in: ts(0.22), fade_out: 0 }] }, i++);
  add({ id: 'ending.dark', kind: 'effect', name: 'Ending - dark', props: { filter: 'dark', amount: 1 },
    items: [{ id: 'd1', from: at, dur: card, fade_in: ts(0.3), fade_out: 0 }] }, i++);
  const rest = card - (on - at);
  add({ id: 'ending.logo', kind: 'image', name: 'Ending - planet', props: {},
    items: [{ id: 'l1', from: on, dur: rest, asset: 'm.verse-logo.png', box: { x: W / 2, y: H * 0.33, w: Math.round(400 * k), anchor: 'c' },
      anim: { opacity: flick([[0, 0], [0.04, 1], [0.08, 0.15], [0.12, 1], [1.1, 1], [1.13, 0.35], [1.17, 1], [1.95, 1], [1.98, 0.5], [2.02, 1]]) } }] }, i++);
  const txt = { style: 'plain', font: 'font.assistant', color: '#ffffff', weight: 800, align: 'center', dir: 'rtl', lineHeight: 1.12 };
  add({ id: 'ending.words', kind: 'text', name: 'Ending - words', props: txt,
    items: [
      { id: 'w1', from: on, dur: rest, text: '● בעיית קליטה', size: Math.round(48 * k), color: '#ff6a1f', letterSpacing: '0.04em',
        box: { x: W / 2, y: H * 0.455, w: W - 160 * k, anchor: 'c' },
        anim: { opacity: flick([[0, 0], [0.05, 1], [0.6, 1], [0.62, 0.25], [0.95, 0.25], [0.97, 1], [1.5, 1], [1.52, 0.25], [1.85, 0.25], [1.87, 1]]) } },
      { id: 'w2', from: on, dur: rest, text: 'הקשר עם יקום\nשלומיוורס נותק', size: Math.round(96 * k), weight: 900, glow: 'rgba(255,106,31,0.55)',
        box: { x: W / 2, y: H * 0.545, w: W - 120 * k, anchor: 'c' },
        anim: { opacity: flick([[0, 0], [0.08, 0], [0.11, 1], [0.15, 0.3], [0.19, 1]]) } },
      { id: 'w3', from: on, dur: rest, text: 'לסיום המלא – מוזמנים לטוס לביקור', size: Math.round(54 * k), weight: 700, color: 'rgba(255,255,255,0.92)',
        box: { x: W / 2, y: H * 0.655, w: W - 140 * k, anchor: 'c' },
        anim: { opacity: flick([[0, 0], [0.3, 0], [0.42, 1]]) } },
    ] }, i++);
  add({ id: 'ending.link', kind: 'text', name: 'Ending - address', props: { style: 'pill', bg: '#ff6a1f', color: '#ffffff', size: Math.round(50 * k), radius: 999 },
    items: [{ id: 'k1', from: on, dur: rest, text: 'shlomiverse.com', box: { x: W / 2, y: H * 0.735, anchor: 'c' },
      anim: { opacity: flick([[0, 0], [0.45, 0], [0.55, 1]]), scale: flick([[0.45, 0.85], [0.6, 1.04], [0.7, 1]]) } }] }, i++);
  ops.push({ op: 'layer.add', index: L.length + (i - fxAt), layer: { ...G, id: 'ending.sound', kind: 'audio', name: 'Ending - glitch sounds', props: { volume: 1 },
    items: [{ id: 's1', from: g1, dur: fr(ENDING.glitch1[1]), asset: 's.signal-glitch-1.mp3', in: 0, gain: 0.9, fade_out: 0.01, duck: -40, duck_layers: voices },
      { id: 's2', from: g2, dur: at - g2, asset: 's.signal-glitch-2.mp3', in: 0.16, gain: 1, fade_out: 0.004, duck: -40, duck_layers: voices }] } });
  ops.push({ op: 'layer.add', index: L.length + (i - fxAt) + 1, layer: { ...G, id: 'ending.static', kind: 'audio', name: 'Ending - static', props: { volume: 0.1 },
    items: [{ id: 'h1', from: at + fr(0.05), dur: card - fr(0.05), asset: 's.signal-static.mp3', in: 0.8, fade_in: 0.08, fade_out: 0.35 }] } });
  return ops;
}
