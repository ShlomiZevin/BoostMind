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
  const layers = [];
  for (const l of p.layers || []) {
    if (l.only === 'verse') continue;
    if (l.only === 'social') {
      layers.push(l);
      if (!l.hidden) for (const it of l.items || []) if (!it.hidden) end = Math.max(end, it.from + it.dur);
      continue;
    }
    const items = [];
    for (const it of l.items || []) {
      if (it.from >= at) continue;
      items.push(it.from + it.dur > at ? hardEnd(it, at) : it);
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
