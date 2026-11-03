// Sound setups (his ask, 2026-11-03: "the perfect setup for a podcast, a synagogue hall, an office..."): one click
// that sets EVERYTHING about how a sound sounds - its cleaning, its voice chain (render/ui/sound.ts), its effects
// (render/ui/soundfx.ts) - on what is picked: a whole row, or one clip (the clip wins over its row,
// ui/layergraph.ts soundOf). Then he adjusts; a changed setup can be saved as a new one or update this one. His saved
// setups live in episodes/_setups.json, the same on every computer (render/cloud/shared.mjs -> studio/setups.json); a
// saved one with a built-in's id replaces it. Sessions apply them by name: node tools/setup_apply.mjs.
// Starting values come from his own videos (plans/sound-setups.md): the rabbi, Yuval's keynote, Dorit's studio, Hani's
// calls, the gym's announcer, Gen Z's thoughts, Tzvika's colleague behind the cubicle, the karaoke takes.
//   clean: undefined = leave the cleaning as it is. voice: null = no voice chain. fx: null = no effects.
const V = {  // (the voice chain's presets - render/ui/sound.ts VOICE_PRESETS)
  raw: { raw: true, boost: 0, denoise: false, lowcut: 0, warmth: 0, box: 0, presence: 0, deess: 0, comp: 0 },
  natural: { denoise: false, lowcut: 60, warmth: 0, box: 0, presence: 0, deess: 0, comp: 0 },
  podcast: { denoise: true, lowcut: 85, warmth: 1.5, box: -2.5, presence: 2.5, deess: 0.4, comp: 0.6 },
  radio: { denoise: true, lowcut: 120, warmth: 3, box: -3, presence: 4, deess: 0.5, comp: 0.9 },
  warm: { denoise: true, lowcut: 70, warmth: 3, box: -1.5, presence: 1, deess: 0.3, comp: 0.4 },
  bright: { denoise: true, lowcut: 100, warmth: 0, box: -2, presence: 5, deess: 0.6, comp: 0.5 },
  news: { denoise: true, lowcut: 95, warmth: 2, box: -3, presence: 3.5, deess: 0.45, comp: 0.75 },
  hall: { denoise: true, lowcut: 130, warmth: -1.5, box: -1, presence: 1.5, deess: 0.35, comp: 0.5, room: 0.45, roomSize: 1.8 },
  stage: { denoise: true, lowcut: 110, warmth: 1, box: -2.5, presence: 3, deess: 0.4, comp: 0.7, room: 0.32, roomSize: 2.4, pa: 0.5 },
};
const voice = (preset, more = {}) => ({ preset, ...V[preset], ...more });

export const SETUPS = [
  { id: 'natural', label: 'Natural', about: 'The voice as it was recorded - no style, no effects.', voice: null, fx: null },
  { id: 'podcast', label: 'Podcast', about: 'Close, clear and even - a good mic in a quiet room. Cleans with NN.', clean: 'nn', voice: voice('podcast'), fx: null },
  { id: 'news', label: 'News studio', about: 'A TV anchor: clear, full, steady (Dorit). Cleans with NN.', clean: 'nn', voice: voice('news'), fx: null },
  { id: 'radio', label: 'Radio', about: 'A radio host: thick and close, very even.', voice: voice('radio'), fx: null },
  { id: 'warm', label: 'Warm', about: 'Softer and fuller, less sharp.', voice: voice('warm'), fx: null },
  { id: 'bright', label: 'Bright', about: 'Sharper and clearer, more air.', voice: voice('bright'), fx: null },
  { id: 'synagogue', label: 'Synagogue hall', about: 'Talking in a big hall with hard walls - the voice a few metres away, the room answering. Cleans with NN.',
    clean: 'nn', voice: voice('hall', { room: 0.35, roomSize: 1.6 }), fx: null },
  { id: 'stage', label: 'Stage / keynote', about: 'A speaker on a conference stage: his mic close, the hall\'s speakers throwing it back (Yuval). Cleans with NN.',
    clean: 'nn', voice: voice('stage', { room: 0.3, roomSize: 1.2, pa: 0.3, comp: 0.4 }), fx: null },
  { id: 'office', label: 'Office', about: 'Talking at a desk in an office - a little of the room around him. Cleans with NN.',
    clean: 'nn', voice: voice('natural', { room: 0.12, roomSize: 0.6 }), fx: null },
  { id: 'background', label: 'Someone in the background', about: 'A person talking further away - behind a cubicle, across the room (Tzvika\'s colleague): duller, roomier.',
    voice: { preset: 'custom', denoise: false, lowcut: 140, warmth: -1.5, box: 0, presence: -3, deess: 0, comp: 0.3, room: 0.4, roomSize: 0.7 }, fx: null },
  { id: 'singer', label: 'Singer', about: 'A sung take: evened out, in a big warm room (the karaoke takes). Light cleaning.',
    clean: 'mild', voice: voice('natural', { comp: 0.4, room: 0.38, roomSize: 2.2 }), fx: null },
  { id: 'phone', label: 'Phone call', about: 'The other side of a phone call (Hani\'s calls).', voice: null, fx: { filter: 'phone' } },
  { id: 'speakerphone', label: 'Speakerphone / PA', about: 'A loudspeaker announcement - a speakerphone, a gym\'s PA.', voice: null, fx: { filter: 'speakerphone', room: 0.25, roomSize: 0.9 } },
  { id: 'laptop', label: 'Laptop speaker', about: 'Coming out of a laptop or a phone\'s speaker - a live, a video call.', voice: null, fx: { filter: 'speaker' } },
  { id: 'thought', label: 'Inner thought', about: 'A thought in his head - close, a short soft echo.', voice: null, fx: { filter: 'thought' } },
  { id: 'echo', label: 'Dark echo', about: 'A big dramatic echo (Gen Z\'s dramatic moments).', voice: null, fx: { filter: 'echo', echo: 1.35 } },
  { id: 'muffled', label: 'Muffled', about: 'Through a wall or a closed door.', voice: null, fx: { filter: 'muffled' } },
  { id: 'trailer', label: 'Trailer voice', about: 'A big ending line - the voice in a huge space (the Shlomiverse trailer).', voice: voice('raw'), fx: { room: 0.5, roomSize: 3 } },
];

/** Built-ins with his saved ones (a saved one with a built-in's id replaces it; his new ones after). */
export function allSetups(saved = []) {
  const by = new Map(SETUPS.map((s) => [s.id, s]));
  for (const s of saved || []) if (s && s.id && !s.deleted) by.set(s.id, { ...s, saved: true });
  return [...by.values()];
}

// a clip's fx must say everything (its own keys replace the row's - an empty one = "none" for this clip)
const fullFx = (fx) => ({ filter: '', pitch: 0, room: 0, roomSize: 1.6, level: 0, ...(fx || {}) });

/** The ops that put a setup on a row (item: null) or on one clip. by: 'session' when a session applied it. */
export function setupOps(layer, itemId, s, by = null) {
  const tag = { id: s.id, ...(by ? { by } : {}) };
  if (!itemId) return [{ op: 'layer.update', id: layer.id, props: {
    ...(s.clean !== undefined ? { clean: s.clean === 'off' ? null : s.clean } : {}),
    voice: s.voice ? { ...s.voice } : null, fx: s.fx ? { ...s.fx } : null, presence: null, setup: tag } }];
  return [{ op: 'item.update', layer: layer.id, id: itemId, set: {
    ...(s.clean !== undefined ? { clean: s.clean } : {}),
    voice: s.voice ? { ...s.voice } : false, fx: fullFx(s.fx), presence: 0, setup: tag } }];
}

/** What a setup sets, read back from a row's props or a clip (for "changed" and for saving one). */
export function soundNow(layer, item) {
  const p = layer.props || {};
  if (!item) return { clean: p.clean || 'off', voice: p.voice || null, fx: p.fx || null };
  return { clean: item.clean ?? p.clean ?? 'off', voice: item.voice === undefined ? p.voice || null : item.voice || null, fx: { ...(p.fx || {}), ...(item.fx || {}) } };
}

const near = (a, b) => Math.abs((+a || 0) - (+b || 0)) < 1e-6;
/** Does the row / clip still sound exactly as the setup made it? */
export function sameAsSetup(now, s) {
  if (s.clean !== undefined && (now.clean || 'off') !== s.clean) return false;
  const v = now.voice, sv = s.voice;
  if (!!v !== !!sv) return false;
  if (v && sv) for (const k of new Set([...Object.keys(v), ...Object.keys(sv)])) {
    if (k === 'preset' || k === 'bypass') continue;
    if (typeof (v[k] ?? sv[k]) === 'boolean' ? !!v[k] !== !!sv[k] : !near(v[k], sv[k])) return false;
  }
  const f = fullFx(now.fx), sf = fullFx(s.fx);
  return (f.filter || '') === (sf.filter || '') && near(f.pitch, sf.pitch) && near(f.room, sf.room) && (!(+f.room) || near(f.roomSize, sf.roomSize))
    && near(f.level, sf.level) && near(f.echo ?? 1, sf.echo ?? 1);
}

/** A new saved setup from what the row / clip sounds like now. */
export function setupFrom(now, label, id) {
  return { id, label, about: 'Saved by you.', clean: now.clean || 'off', voice: now.voice ? { ...now.voice, bypass: undefined } : null,
    fx: now.fx && Object.values(now.fx).some((x) => x) ? { ...now.fx } : null, updated: Date.now() };
}
