# Layers - the project format every video uses (`project.json`)

A video is **one file of layers**: `episodes/<id>/project.json`. The editor (http://localhost:4747) shows every layer
as a lane with its own controls; the export draws exactly the same layers. To make or change a video you **fill
layers** - you never change the tool (render/, pipeline/) to get a look. If a look is missing, that's tool work:
add it once, generically (a new style in `render/src/layers/styles.tsx`, documented here), on its own, tested.

Checked by `render/src/layers/ops.js validate()` on every write; the studio refuses a project that breaks it.
`GET /api/schema` returns this file.

## The file

```jsonc
{
  "format": "sketch-studio/1",
  "title": "סנכרון אסטרטגי | עדכון לגלעד",
  "canvas": { "w": 1080, "h": 1920, "fps": 30, "color": "#0b0b0b" },
  "duration": 5647,            // frames at 1x
  "speed": 1.25,               // the whole video, every layer together (0.25-4; voices keep their pitch)
  "assets": { "<id>": { ... } },   // every file the layers use - the Media tab
  "layers": [ ... ],           // BOTTOM to TOP
  "script": [ ... ],           // optional: the lines (the Script tab), written by a builder
  "builder": { ... },          // optional: who builds the items (zoom / solo) and its actions
  "characters": ["amir", ...], // who is in it - ids of zoomcut/characters/<id> (the Characters page; SKILL.md)
  "rev": 12                    // bumped on every write
}
```

**Units.** `from` and `dur` are **frames at 1x** (audio items may use fractions). Everything else in time is
**seconds**: `in` (where in the source the item starts), fades, keyframe times. Positions are **canvas pixels**.

## Assets

```jsonc
"amir_7daad2": { "kind": "video", "src": "work/public/clips/amir_7daad2.mp4", "w": 720, "h": 1280, "duration": 110.7,
                 "preview": "work/public/clips/amir_7daad2.preview.mp4",   // light copy the editor plays
                 "fg": "work/public/clips/amir_7daad2_fg.webm",            // the person on transparency (cut-out, editor)
                 "matte": "work/matte/amir_7daad2.mkv",                    // the cut-out mask (export)
                 "audio": "work/audio/amir_7daad2.wav",                    // its sound, 48 kHz mono
                 "framing": { "cx": 0.506, "top": 0.311 } },               // head position (fit "face")
"bg.gilad-office.jpg": { "kind": "image", "src": "backgrounds/gilad-office.jpg", "w": 1536, "h": 1024 },
"s.whoosh.mp3": { "kind": "audio", "src": "media/whoosh.mp3", "duration": 1.2 },
"font.assistant": { "kind": "font", "src": "../../fonts/Assistant.ttf", "family": "zc-assistant" }
```
`src` is relative to the project folder. Add a file: `POST /api/p/<id>/assets?name=<file>` (raw body) - it lands in
`media/`, is measured and gets an id (`m.` picture, `s.` sound, `v.` video, `font.`).
**His marks on a file** (2026-10-23): Media opens any file big (a video / sound plays whole with its sound - served by
`GET /api/p/<id>/asset?a=<asset id>`, wherever the file lives); there he marks it `"mark": "use" | "skip"` and writes
a `"note"` ("the first part from this take, the ending from the other") - on the asset, undoable (`asset.add` with the
same id), kept through rebuilds (project.py merge). **Read them before choosing or changing takes**: a `skip` take is
not used, a `use` take wins over its twin, and the note says which part - follow it, and tell him if it can't be done.

## Layers

```jsonc
{ "id": "gilad.picture", "kind": "video", "name": "Picture", "group": "גלעד",
  "hidden": false, "muted": false, "locked": false,
  "owner": "builder",          // its items come from the builder (see Builders); absent = yours alone
  "props": { ... },            // the layer's settings; every item inherits them and can override any
  "items": [ { "id": "p0", "from": 0, "dur": 78, ... } ] }
```
`group` gathers lanes in the editor (one per character: Picture, Background, Name tag, Voice). Layer order is the
drawing order. Items of a layer are drawn in order; `z` (an integer) lifts an item above the others **of the
neighbouring video layers** (a floating small tile).

Every item: `id`, `from`, `dur`, optional `hidden`, `opacity` (0-1), `fade_in` / `fade_out` (s),
`anim` (keyframes, below), `pin` (below), `ref` / `user` (builders).

### video - footage in a window
- item: `asset`, `in` (s), `box {x, y, w, h}` (the window), `rate` (clip speed, default 1), `z`.
- props (item can override): `fit` - `cover` (fill, centred) | `face` (fill, head near the top - uses the
  asset's `framing`; `head` = where the head top lands, fraction of the box height, default 0.09) | `contain`;
  `zoom` (>= 1 for cover/face), `x` / `y` (nudge, fraction of the box), `look {saturate, contrast, brightness}`,
  `radius` (rounded corners), `cutout` (true: the person on the backdrop - needs the asset's `matte` / `fg`).
- Cut-out, live: `matte_cut` 0..254 (edge cleanup), `keep {below}` (the real desk below that fraction of the take's
  height stays in front; asset `keep_static` = the desk objects), `side_ramp` (the sides fade when the picture is
  narrower than the frame - a one-camera person, never grid tiles). The asset's `matte` is the raw matte.
- `mirror` (true; layer or item - Inspector "Mirror (flip left ↔ right)", 2026-10-25): the take's picture flips left
  <-> right (with its matte and kept desk) and so does its framing, so he stays in the same place; the set behind him
  and every text never flip. For a book / sign he holds up to the front camera that reads backwards. Live + export.
- `eyes` (true / false; default true when the take has it): **eye contact** - the corrected copy of the same frames,
  switched live. The asset's `eyes_src` / `eyes` / `eyes_fg` / `eyes_engine` (nvidia | v6 | capcut) are made by the
  builder action `{action: "eyes", mode: "nvidia" | "neural", strength, dy, nudge, assets: [...], files: {asset:
  "asset:<id>"}}` (a job, minutes; "files" = his own CapCut export of that take). The export reads `eyes_src`.
- Consecutive items continuing the same take play as one clip (no reload at a cut); only the window moves.
- Dragging an item's edge in the editor pulls back the original footage - so an item ALWAYS points at the whole
  take (`asset` = the take, `in` = where the piece starts), never at a file cut down to the piece. A builder's items:
  the drag goes to the builder (Zoom: a line fix; one camera: a re-cut of the take) so voice and subtitles follow.

### backdrop - the photo behind a cut-out person
- no items; props `target` (a video layer id), `asset` (an image), `x`, `y` (pan, -0.5..0.5), `zoom` (0.3..).
- Drawn inside every item of the target, behind the person; never an empty edge (zoom < 1 stops at "covers").

### image - a picture
- item: `asset`, `box {x, y, w, h?, anchor?}` (h from the picture's proportions when missing; `anchor: "c"` =
  x / y are its centre), `radius`, fades, `anim`. Live looks (item or layer): `blur` (px), `brightness`, `saturate` - a set
  behind a person: blur 2.2, brightness 0.96, saturate 0.95; drag it on the video to pan.

### text - words on the video
- item: `text` (`\n` = new line; `{clock}` = a running mm:ss from `clock_start` s), `box {x, y, w?, anchor}`.
  anchor: `tl` (default) `t` `c` `b` `tr` `br` `bl` - `t` / `c` / `b` centre on x, `w` = the wrapping width.
- props / item: `style` and its knobs:
  - `pov` - a box with the text (the TikTok hook / a label): `theme` light | dark | gold, `opacity`, `size`, `font`.
  - `plain` - just the letters: `size`, `color`, `weight`, `font`, `align`, `dir`, `stroke`, `strokeColor`, `lineHeight`.
  - `tag` - a call name tag with a microphone: `size` (32 big, 26 small).
  - `toast` - a notice box with an icon: `size`, `icon` ("none" to drop it).
  - `pill` - a solid pill (the red "removed" stamp, a button): `bg`, `color`, `size`, `radius`.
- `font` is a font asset id (`font.assistant`); none = the UI font.

### subtitles
- item: `text`, `who` (shown first: "אמיר: ..."), `box` (anchor `b` = y is the bottom edge), `side: true` (said on
  the side: amber, sits above the main one), `compact` + `size` (a narrow tile).
- props: `style` - `zoom` (dark box, name first) | `outline` (big outlined words), `size`, `color`, `label` (false =
  no name). Items on screen at once with the same box stack in one column.

### shape - rectangles (borders, highlights, flashes)
- item: `box`; props / item: `fill`, `stroke`, `width`, `radius`.

### audio - a sound track
- item: `asset` (a sound, or a video whose sound to use), `in` (s), `from`, `dur`, `gain`, `fade_in` (default
  0.012 s), `fade_out` (s), `soften` (a shouted line made easier on the ear).
- props: `volume` (0-2, live), `clean` - `off` | `mild` | `strong` | `nn` (RNNoise, the neural noise filter),
  `presence` (dB at 2.8 kHz - clarity), `level: "speech"` (even out each source by its speech level, measured on the
  pieces used). Layer `muted` / `hidden` silence it.
- `voice` - the voice chain he knows from the one-camera editor: `{preset: natural | podcast | news | radio | warm |
  bright | hall | stage | raw, boost, lowcut, warmth, box, presence, deess, comp, room, roomSize, pa}`
  (render/ui/sound.ts) - live in the editor, the same code renders it in the export (pipeline/voice_chain.py). An
  anchor with AC / fan hum: `voice.preset "news"` + `clean "nn"` (he called it perfect).
- `fx` (item or layer) - live sound effects: `{filter: phone | speakerphone | speaker | thought | echo | muffled,
  echo 0..2, pitch (semitones, timing kept), room 0..1, roomSize (s), level (dB)}`; item `rate` = tape speed (pitch follows); item `duck: dB` dips the voice while
  it plays (`duck_layers` [ids] to dip others); layer `lift {db, fade, of (default "subs"), after}` rises after the last
  item of `of` ends (the music up at the end card).
- **Builders write raw content + these fields; they never bake a setting into a file.**
- **All of it is live** in the editor and rendered by the same graph in the export (render/ui/layergraph.ts,
  tools/audio_layers.mjs). Only a NEW sound file is prepared (cleaning variants, levels) - in the background.
- One loudness gain for the whole video to -14 LUFS, a limiter for the rare peak - the level never rides.

### effect - film effects on everything below
- One effect layer = one filter: props `filter` = `grade` (movie colour) | `dark` | `vignette` | `grain` | `zoom`
  (slow zoom in) | `drift` (handheld) | `ghost` (trail; `ghost_lag` s) | `flicker` | `hits` | `black`, `amount`
  (0-1), optional `center [x, y]`.
- Items = when it plays; it fades in / out at the item's ends (`fade_in` default 1.5 s, `fade_out` 0.6 s). A `hits`
  item is an impact at its start (`kick`, `shake`, `flash`); a `black` item is black.
- **All effect layers act together, as one, on every layer BELOW the top-most effect layer**; layers above it (texts,
  subtitles) stay clean. Put effects right above the pictures. He likes them moderate ("cinematic, not overdone").
- Editor and export use the same curve (render/src/layers/effect_curve.js; pipeline/film_fx.py).

### Animation
`anim: {"opacity": [[t, v], ...], "scale": [...], "x": [...], "y": [...]}` - t = seconds from the item's start,
linear between keys, held at the ends. Text / image / shape items.

### link and ripple - editing like one piece
- `link` (item): items with the same link change together when one is dragged - a line's voice, its subtitles and the
  speaker's picture; a cut piece's picture, voice and subtitles.
- `edit` (project): `{"ripple": true}` = a continuous timeline - dragging an edge closes up / makes room after it;
  `"ripple_move": true` = moving a piece moves everything after it too (lines that follow each other).
- An item a builder made (`ref` on a builder layer): the drag shows at once; the builder hears about it in the
  background (`POST /api/p/<id>/build {action: "edit", layer, item, side, frames}` - render/actions/edit.mjs) and its
  next version replaces the live guess when it lands. Items it has nothing to say about are saved as his.

### pin - when the video's length changes
`"pin": "end"` - keeps its distance to the end (an end card). `"pin": "span"` - its end stays at the video's end
(a hook shown the whole video).

## Changing a project: ops

`POST /api/p/<id>/ops  {"rev": 12, "ops": [ ... ]}` - all or nothing; `rev` = the one you read (409 if it moved).
Answer: `{ok, rev, stems}`. Every write is logged with its undo in `work/history/log.jsonl`.

```jsonc
{"op": "project", "set": {"title": "...", "speed": 1.2}}
{"op": "layer.add", "layer": {"id": "text.2", "kind": "text", "name": "Hook", "props": {"style": "pov"}, "items": []}, "index": 30}
{"op": "layer.update", "id": "gilad.bg", "props": {"asset": "bg.office-wide.jpg", "zoom": 1.25}, "set": {"hidden": false}}
{"op": "layer.move", "id": "text.2", "index": 5}      {"op": "layer.remove", "id": "text.2"}
{"op": "item.add", "layer": "text.2", "item": {"id": "h1", "from": 0, "dur": 90, "text": "פוב: ...", "box": {"x": 540, "y": 276, "w": 960, "anchor": "t"}}}
{"op": "item.update", "layer": "subs", "id": "s12", "set": {"text": "...", "box": {"y": 1200}}}   // null deletes a key
{"op": "item.remove", "layer": "sfx", "id": "x0"}
{"op": "asset.add", "id": "m.logo.png", "asset": {"kind": "image", "src": "media/logo.png", "w": 800, "h": 800}}
```
`GET /api/p/<id>` - the project, `urls` (where the editor loads each asset), `stems`, the last export.

## Builders - who makes the items

A builder turns footage + a script into layers: the **Zoom builder** (`zoomcut.py` analyzes, `pipeline/to_layers.py`
writes the layers), the solo builder (one camera; coming). A builder writes a whole fresh project and it is
**merged** (`pipeline/project.py merge`):
- layers it owns (`owner: "builder"`) get its new items, EXCEPT items changed by hand (`user: true`, set
  automatically by an item op) and items deleted by hand (their `ref` is kept in the layer's `removed`);
- the layer's name, group, order, hidden / muted and **props are never overwritten** - the settings are his;
- layers it doesn't make (his texts, pictures, sounds) are untouched; `pin`s follow the new length.
Builder actions: `POST /api/p/<id>/build {action: "analyze"}` | `{action: "line", n, fix}` (a Zoom line's take /
start / end / timing - see recipes/zoom-call.md) | `{action: "caption", n, text}` (a line's subtitle words).

## Export
`POST /api/ep/<id>/export {send: ["email"], quick: false}` - `pipeline/export_layers.py`: graphics runs drawn by
the editor's own composition (only the frames that change), videos composited by ffmpeg, the sound mixed by
`pipeline/layers_audio.py`, the speed burnt in, checked (length, size, fps, sound, -14 LUFS). Quick: half size, a draft.
