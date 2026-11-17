// Two versions of one video - the socials' and the Shlomiverse's (his ask, 2026-11-17: "videos like in OnlyFans - the
// highlight, the ending, the cliffhanger only on the Shlomiverse ... mark in the studio where it finishes for the social,
// and it continues only on the verse ... a very hard cut").
//
//   project.split = { at: <frame> }   the socials' version stops at `at` - a hard cut, nothing fades - and plays its own
//                                     ending from there: the layers marked only: 'social' (a card: picture, words, sound,
//                                     placed from `at` on the timeline like any layer, so he changes every part himself)
//   layer.only = 'social'             only in the socials' version (the ending card)
//   layer.only = 'verse'              only in the Shlomiverse's version
// The Shlomiverse's version = the whole video, without the 'social' layers - also what every project without a split is.
// ONE function for the editor (LayersEditor: the Verse / Socials switch) and the export (pipeline/export_layers.py reads
// it through tools/version.mjs), so what he sees is what each file gets.

export const splitAt = (p) => {
  const at = Math.round(+p?.split?.at);
  return Number.isFinite(at) && at > 0 && at < (p?.duration || 0) ? at : null;
};

const hardEnd = (it, end) => ({ ...it, dur: Math.max(1, end - it.from), fade_out: 0, pin: undefined });

/** The project as one version plays it: 'verse' (the whole video) or 'social' (up to the split + its own ending). */
export function versionOf(p, v = 'verse') {
  if (!p) return p;
  const at = splitAt(p);
  if (v !== 'social' || at == null) {
    if (!(p.layers || []).some((l) => l.only === 'social')) return p;
    return { ...p, layers: p.layers.filter((l) => l.only !== 'social') };
  }
  let end = at;
  for (const l of p.layers || []) if (l.only === 'social' && !l.hidden) for (const it of l.items || []) if (!it.hidden) end = Math.max(end, it.from + it.dur);
  // split.freeze (the "signal lost" ending, his concept 2026-11-17): the picture freezes on its last frame under the
  // ending, like a call whose connection dropped - every picture / word on screen at the cut holds until the ending ends
  // (a clip = a held frame: rate 0 at the frame it was on); the sound still stops dead at the cut
  const freeze = !!p.split?.freeze && end > at, fps = p.canvas?.fps || 30;
  const layers = [];
  for (const l of p.layers || []) {
    if (l.only === 'verse') continue;
    if (l.only === 'social') { layers.push(l); continue; }
    const items = [];
    for (const it of l.items || []) {
      if (it.from >= at) continue;
      if (it.from + it.dur <= at) { items.push(it); continue; }
      if (!freeze || l.kind === 'audio') { items.push(hardEnd(it, at)); continue; }
      if (l.kind === 'video' || l.kind === 'backdrop') {
        items.push(hardEnd(it, at));
        const r = it.rate ?? 1;
        items.push({ ...it, id: `${it.id}~freeze`, from: at, dur: end - at, rate: 0, in: (+it.in || 0) + ((at - 1 - it.from) / fps) * r, fade_in: 0, fade_out: 0, pin: undefined, freeze: true });
      } else items.push(hardEnd(it, end));
    }
    layers.push({ ...l, items });
  }
  return { ...p, layers, duration: end };
}

/** Frames [a, b) of a project as a project of their own (the export renders the socials' ending alone this way, then
 * joins it to the first part of the full video - not the whole video twice). A clip cut at its start begins later in its
 * source (`in` moves by its own rate). */
export function windowOf(p, a, b) {
  const fps = p.canvas.fps, layers = [];
  for (const l of p.layers || []) {
    const items = [];
    for (const it of l.items || []) {
      const s = it.from, e = it.from + it.dur;
      if (e <= a || s >= b) continue;
      const x = { ...it, from: Math.max(0, s - a), dur: Math.min(e, b) - Math.max(s, a) };
      if (s < a) {
        if (x.in != null || ['video', 'audio', 'backdrop'].includes(l.kind)) x.in = (+it.in || 0) + ((a - s) / fps) * (+it.rate || 1);
        x.fade_in = 0;
      }
      if (e > b) x.fade_out = 0;
      delete x.pin;
      items.push(x);
    }
    layers.push({ ...l, items });
  }
  return { ...p, layers, duration: Math.max(1, b - a), split: undefined };
}

/** Where the socials' version drops, in seconds of the full video - for the Shlomiverse's locked version (BETA, 2026-11-17:
 * v2/site/verse/signal-lost.js stops the full video there for a signed-out viewer and plays the same signal-lost moment
 * over it): {at, glitches: [[start, end, amount], ...]} from the split and the socials-only glitch layers; null = no split. */
export function dropOf(p) {
  const at = splitAt(p);
  if (at == null) return null;
  const fps = p.canvas?.fps || 30, sp = +p.speed || 1, s = (f) => +(f / fps / sp).toFixed(3), glitches = [];
  for (const l of p.layers || []) if (l.only === 'social' && !l.hidden && l.kind === 'effect' && l.props?.filter === 'glitch')
    for (const it of l.items || []) if (!it.hidden && it.from < at) glitches.push([s(it.from), s(Math.min(at, it.from + it.dur)), +(it.amount ?? l.props?.amount ?? 1)]);
  return { at: s(at), glitches: glitches.sort((a, b) => a[0] - b[0]) };
}
