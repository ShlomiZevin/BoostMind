// A sound layer's gain over time from the OTHER layers - live, recomputed from the project as it is (nothing baked):
//   duck   an item with `duck: dB` (a thought, a phone ring) dips the layers it names (`duck_layers`, default the
//          'voice' layer) while it plays, 80 ms in and out - films lower the room while we hear a thought
//   lift   a layer with props.lift {db, fade, of} rises by db over `fade` s once the last item of layer `of`
//          (default the subtitles: his last word) has ended + 0.15 s - the music up for the end card
// The editor (AudioTrack) and the export (tools/audio_layers.mjs) both call layerGainAt - the same curve.

/** [[t0, t1, dB], ...] (seconds) of the items that duck layer `id`. */
export function ducksFor(project, id) {
  const fps = project.canvas.fps, out = [];
  for (const l of project.layers || []) {
    if (l.kind !== 'audio' || l.hidden || l.muted) continue;
    for (const it of l.items || []) {
      if (it.hidden || !it.duck) continue;
      const targets = it.duck_layers || ['voice'];
      if (targets.includes(id)) out.push([it.from / fps, (it.from + it.dur) / fps, +it.duck]);
    }
  }
  return out;
}

/** The moment layer `id`'s lift starts (s), or null. */
export function liftAt(project, layer) {
  const lift = layer.props?.lift;
  if (!lift || !+lift.db) return null;
  const fps = project.canvas.fps;
  const of = (project.layers || []).find((l) => l.id === (lift.of || 'subs')) || (project.layers || []).find((l) => l.id === 'voice');
  const items = (of?.items || []).filter((i) => !i.hidden);
  if (!items.length) return null;
  return Math.max(...items.map((i) => (i.from + i.dur) / fps)) + (lift.after ?? 0.15);
}

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** The layer's automatic gain at t seconds (ducks x lift); `pre` = {ducks, lift: {db, fade, at}} from prepare(). */
export function layerGainAt(pre, t) {
  let g = 1;
  const r = 0.08;
  for (const [a, b, db] of pre.ducks) {
    const low = Math.pow(10, db / 20);
    let e = 1;
    if (t >= a - r && t < a) e = 1 + (low - 1) * ((t - (a - r)) / r);
    else if (t >= a && t <= b) e = low;
    else if (t > b && t <= b + r) e = low + (1 - low) * ((t - b) / r);
    g = Math.min(g, e);
  }
  if (pre.lift && pre.lift.at != null) g *= 1 + (Math.pow(10, pre.lift.db / 20) - 1) * smooth((t - pre.lift.at) / Math.max(0.01, pre.lift.fade));
  return g;
}

/** What layerGainAt needs for layer `layer`, from the project as it is now. */
export function prepare(project, layer) {
  const at = liftAt(project, layer);
  return { ducks: ducksFor(project, layer.id), lift: at == null ? null : { db: +layer.props.lift.db, fade: +(layer.props.lift.fade ?? 1), at } };
}
