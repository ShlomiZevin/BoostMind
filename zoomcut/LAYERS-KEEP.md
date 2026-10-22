# What the layered tool must keep - and show

Inventory of every feature of the CURRENT Sketch Studio (lesson.py one-camera engine, zoomcut.py + pipeline/ Zoom
engine, render/ui/editor.tsx + sound.ts + liveplayer.ts, render/server.mjs, the skill) checked against the layered
model as it stands on 2026-10-22 (LAYERS-PLAN.md, skill/edit-video/layers.md, pipeline/to_layers.py,
layers_audio.py, export_layers.py, render/src/Layers.tsx, render/src/layers/*).

Reading the tables:
- **Shown today** = is there an editor control for it now (yes: which / no: config-only = episode.json,
  corrections.json or code only).
- **Layered model** = does project.json + Layers.tsx + export_layers/layers_audio already carry it (yes / partial / no).
  NOTE: the LayersEditor itself (`render/ui/layers/*`) does not exist yet, so nothing is *shown* in the layered tool
  today; the last column says which layer / prop should hold it and which control must show it.
- The solo (one-camera) builder is "stage 2" and not written: every lesson.py feature is "no" unless the generic
  model already has the building block.

---

## Not covered yet / not visible yet (most important first)

1. **Eye contact** - nothing in the layered model. Today: `eye_contact` {on, mode nvidia | neural | iris | center |
   offset, strength, dy, nudge, file} (lesson.py:105-149, 2042-2049), NVIDIA Maxine + our blink blend
   (tools/eyes_nvidia.py), automatic v6 fallback with retry marker (`.fallback`), a CapCut export by name or
   `<take>*eye*.*` (length-checked +/-0.15 s), and the **live On / Off switch** (a `raw` copy of every take played
   under the corrected one, editor.tsx:1884-1886, 2159-2171). Needs: an asset variant `gaze` (+ `gaze_raw`) per video
   asset, a video-layer prop `eyes: on|off` (live, switches variant), a builder action "Make eye contact" with
   mode / strength / dy / nudge / CapCut file, shown in the Picture inspector. Mode/strength/dy/nudge/file are
   config-only even today - must become controls.
2. **The one-camera voice chain** (render/ui/sound.ts, used live AND by the export through tools/mixdown.mjs) - not in
   the model. Presets raw / natural / podcast / radio / warm / bright / news / hall / stage; sliders Boost, Low cut,
   Warmth (140 Hz), Boxiness (320 Hz), Presence (3.2 kHz), Soft s's, Compression, Room + Room size (seeded IR), PA
   echo (110 ms slap + repeats); **Noise Off / Standard (afftdn) / Strong (RNNoise `models/rnnoise/cb.rnnn`)**
   incl. the RNNoise-cleaned pause detection for the cut (lesson.py:349-354); **Pitch** (rubberband, formants kept,
   lesson.py:1318-1334); raw preset bypasses master + limiter; music "carve" (-3.5 dB at 2.5 kHz). layers_audio.py
   only has the Zoom chain (`clean` off/mild/strong/nn, `presence` at 2.8 kHz, `level`, `volume`). Needs: audio-layer
   props `voice {preset, boost, lowcut, warmth, box, presence, deess, comp, room, roomSize, pa, pitch, denoise:
   off|fft|rnn}` rendered by the SAME sound.ts code live and in export (mixdown.mjs), shown as the Voice inspector of
   any audio layer (Zoom characters get it too).
3. **Per-sound processing and sound behaviours** - not in the model: `filter` phone / speaker / speakerphone / thought
   / echo / muffled, `echo` amount, `tempo`, `pitch` (tape), `denoise`, `room: true` (his room), `reverse`, `skip`
   ranges, `duck` (his voice dips under a thought), `chime`, `until`, `captions` on a sound, `voice_bed`; music
   `duck` under voice, `lift` at the end, seamless **loop** of a short bed, fade in/out defaults, "All sounds +/-2 dB".
   Layered audio items have only gain / fades / soften / in / dur.
4. **Items that follow the cut** - today sounds are pinned to a take moment (`take` + `at`, word anchors
   `start_word`/`end_word`, `after_prev`), overlays to words (`from_words`/`to_words`/`until`/`sound`), film hits /
   blackouts to sounds - so a re-cut moves them. Layered items are absolute frames; `pin` only knows end / span.
   Needs an item `anchor {take, t}` / `{sound: id}` / `{words}` kept by the builder merge, and a visible "pinned to"
   chip in the item inspector. Same for Zoom: a line's picture + voice + subtitle are three layers' items - dragging
   one must move / trim all (a link group or a builder action), or the line falls apart.
5. **The solo builder and its live cut** (stage 2) - spans / silence detection, cut presets Tight / Light / Keep
   pauses / Whole take, `join` overlap (picture cuts 0.18 s early, the sound crossfades under), slow motion ranges with
   eased ramps and motion-interpolated export (`slow_mode` mci; export_layers only does setpts = duplicated frames),
   `sequence`, `inserts` (holds / hide / footage-of-him-listening), Start here / End here / Reset, Split (S), Delete
   piece, edge drag with the real take behind it (LiveClock, `peek`), the background warm render. None exists in
   the layered pipeline yet.
6. **Film effects** - `effect` layer kind is a placeholder (Layers.tsx and export_layers skip it). Today: 8 filters
   (Movie colour, Darken, Vignette, Film grain, Slow zoom in, Handheld, Ghost trail + lag, Light flicker), each with
   strength + its own time block on the timeline, shared Fade in, `center`, Hits (kick / shake / flash), Black from
   here, `push`, `black` ranges. It is an ADJUSTMENT layer: it transforms / grades everything under it (set + person),
   text stays on top. Needs that semantics in Layers.tsx (camera transform on the runs below) and in export_layers
   (fx_pass on the composite below the effect layer).
7. **Cut-out quality controls** - model has `cutout` + asset `matte` / `fg` only. Missing: `matte_engine` fast /
   quality / hybrid / body, `matte_cut` threshold (175, TV-range mask curve), **Keep desk** (`keep`: below /
   below_frac / objects / bright_in / boxes / stable / feather - OR-ed into the mask; editor slider exists today),
   side ramp when the person does not reach the frame edges. "Keep original place" = cutout false (covered).
8. **Look / grade** - model `look` = saturate / contrast / brightness (CSS + ffmpeg eq). Missing: **Warmth**,
   **Smooth** (skin soft focus), the baked `grade` (incl. bilateral smoothing). Editor today has Smooth / Warmth /
   Brightness / Saturation sliders (lesson) and Color / Brightness / Contrast (Zoom) - both must be one Look control.
9. **The set (solo background)** - backdrop exists but only inside a video item's box. Missing: full-frame set with
   `bg_blur` (2.2) / `bg_dim`, `bg` zoom / x / y in pixels + drag on preview, the set library picker (`/api/library`),
   `sign` (logo painted into the photo in perspective: light / warm / shadow), `plaque` text on `plaque_quad`,
   pictures `behind` him on the studio screen (blur 1.2, framed) with their `tag` ("תמונת AI").
10. **Text styles not in the registry** (styles.tsx has pov / plain / tag / toast / pill only): **ticker** (referenced
    by export_layers `ANIMATED_STYLES` and settable from the Zoom Text panel today, but not implemented - it would
    render as plain text), question card (+ TikTok variant), thought (animated, `motion: horror`, grow / hold /
    overlap), band (lower third "tag | text"), market panel (animated chart), sticker pop / rain, green-screen clip
    (chromakey + despill), framed picture vs plain logo, **Pops in** (spring) and **Blinks** entrances.
11. **Solo subtitles** - `outline` style is close, but missing: the Yellow-Stam look (stroke 14, letter-spacing, shadow)
    vs White-Assistant switch, font / size / colour pickers, `captions_y` drag, the other side's subtitles
    (`captions_other` colour / y, stacked above), no subtitle over the intro clip or during a hold, in-place word edit
    (✎) with live re-timing, Read / Lines views, script (Reader) as the source, `captions_from: file` freeze.
12. **Zoom line inspector** - take picker with scored alternatives, In / Out / Cut numbers, Pause before, Layout
    Auto / Gallery / Speaker / Duo, Drop / Restore / Reset line, status badges + "heard", search, prev / next line;
    middle-drag = `shift`. to_layers keeps `script` and a `line` builder action, but nothing shows them yet. Config-only
    today and must become controls: `aside` (+ at / gain / show), `tail`, `attempts`, per-episode `timing` overrides,
    file assignment order.
13. **Opening clip** `intro_video` (full frame, from / seconds / fade, subtitles held back) and `intro_sound` -
    expressible as a video item + audio item, but no builder writes them and the "no subtitles over it" rule is lost.
14. **Export / share parity** - export_layers has quick, checks, gentle limits, speed. Missing: the background warm
    render (solo), `tidy`, stills (`--still`), LUFS/stills `validate` report, the export-stale prompt is file-based
    (`exportStale` watches episode.json / captions.txt / edit.json - must also watch project.json).
15. **Undo in the solo editor** (none today) - ops `inverse()` gives it; make sure the toolbar Undo / Redo + Ctrl+Z
    cover every op, as the Zoom editor does today.

---

## 1. Picture (video, eyes, cut-out, look)

| Feature | What it does | Where now | Shown today | Layered model | Suggested layered mapping · control |
|---|---|---|---|---|---|
| Takes as video | each take's footage on the timeline | lesson.py plan() 511; Zoom tiles plan.py 220-237 | yes: Speaker lane (solo), character lanes (Zoom) | yes: `video` layer items {asset, in, from, dur, box} | video layer per person · lane |
| Light preview copies | 540p copies, keyframe every 0.5 s, editor plays them | lesson.py take_proxy 2068; media.preview_copy | implicit | yes: asset `preview` | asset `preview` |
| Whole-take players (live cut) | two persistent copies per take, next part pre-seeked, no empty frame at a cut | liveplayer.ts LiveClock; VideoTrack.tsx | implicit (his #1 rule) | yes for editor (VideoTrack + clock.js) | keep; parity with LiveClock for solo |
| Preload into memory | every clip downloaded once, PreloadBar shows progress | ui/preload.ts; editor.tsx 12, 1566 | yes: PreloadBar | yes (usePreloaded in VideoTrack) | keep PreloadBar in LayersEditor |
| Eye contact - NVIDIA | Maxine eye contact + blink blend by eye openness | tools/eyes_nvidia.py; lesson.py 113-128 | yes: "Make eye contact (NVIDIA)" button (2156) | no | builder action `eyes` → asset variant `gaze`; button in Picture inspector |
| Eye contact - v6 fallback | our iris warp (`gaze_video.py --mode neural`), auto when NVIDIA fails, retried next build | lesson.py 129-145 | no (help text names it) | no | same action, `mode` select: NVIDIA / ours (iris, neural, center, offset) |
| Eye contact - CapCut file | an external export by name or `<take>*eye*.*`, length-checked | lesson.py 103-112 | no (help text shows file) | no | asset variant `gaze` from a picked file · "Use a file…" |
| Eye strength / dy / nudge | how much offset removed, vertical share, hand nudge | eye_contact cfg → gaze_video args | no | no | sliders Strength / Vertical / Nudge x,y (rebuild) |
| Eye live On/Off | switch corrected vs original eyes without rebuild | editor.tsx 1884-1886, 2159-2171; options `eye_on` | yes: On / Off | no | video-layer prop `eyes: on|off` (live variant swap) |
| Eye: never a stale copy | gaze_sig cache key ignores `on`, NVIDIA retry after fallback | lesson.py 1151-1156, 2198-2200 | no | no | asset variant versioning |
| Cut-out on/off | person on a new set vs original place | `cutout`; editor 2131-2136 | yes: Cut out / Keep original place | yes: `cutout` prop | keep · Picture inspector toggle |
| Matte engine | fast (MediaPipe) / quality (RVM) / hybrid (head kept) / body (quality head, fast below chin) | lesson.py 150-158, 269-333; Zoom `background_engine` | no | no (asset `matte` only) | builder action `matte {engine}` · select in Picture inspector |
| Matte cut threshold | drop the half-sure halo, TV-range mask curve | `matte_cut` 175; mask_curve 1084 | no | no | video prop `matte_cut` · slider "Edge" |
| Matte softening | gblur on the mask scaled to size | matte_filter 1090 | no | partial (export uses matte as is) | fixed, or slider "Feather" |
| Keep desk | real desk / keyboard / props stay in front of the set (bottom %, bright objects) | keep_png 201-266; editor 2137-2142 (slider `below_frac` + objects) | yes: Keep desk % | no | video prop `keep {below, objects, boxes, bright_in, stable, feather}` · slider + "Add box" on preview |
| Keep fixed boxes / stable mic | a box or "things the matte keeps in most frames" kept in all | keep.boxes / stable / stable_from | no | no | same `keep` prop · box tool |
| Side ramp | fades the person's sides when he doesn't reach the frame edge | ramp_png 1101; compose 2274 | no (automatic) | no | automatic in fit when box < canvas |
| Person size / position | scale, x, y anchored to the bottom | `person`; layout 783; editor 2121-2130; drag 1680 | yes: Size / Left-right / Up-down + drag + Reset | partial (item `box`, fit) | video layer prop `box` (or `place {scale,x,y}`) · sliders + drag on preview |
| Zoom framing | head-near-top crop per character, zoom, x/y nudge | media.face_framing; participants `frame`; CharacterCard 913-915 | yes: Zoom / Up-down / Left-right | yes: fit `face`, `zoom`, `x`, `y`, asset `framing`, `head` | keep · Picture inspector |
| Look (solo, live) | warmth, brightness, saturation, smooth (soft focus), colour matrix shared editor/export | look_matrix 1121, look_soft 1131, person_chain 1137; editor 2144-2153, LookFilter 873 | yes: Smooth / Warmth / Brightness / Saturation | partial: `look {saturate, contrast, brightness}` | extend `look` with `warm`, `smooth` (same matrix in VideoTrack + export) · one Look card |
| Look (Zoom) | saturate / brightness / contrast per character | participants `look`; CharacterCard 916-918 | yes | yes | keep |
| Baked grade | brightness / contrast / saturation / warm / bilateral smooth, when no live look | grade() 1110 | no | no | fold into `look` (migrate) |
| Rounded tiles | radius 14 on Zoom tiles | to_layers 144 | n/a | yes: `radius` | keep |
| Small floating tile | `z` lift, head 0.06 | to_layers 132-133 | n/a | yes: `z`, `head` | keep |
| Dissolve inside a tile | 6-frame fade when a listening tile jumps | plan.py XFADE 21, 351-360 | no | yes: item `fade_in` (overlapping items) | keep |
| Take head/tail never shown | never a take's first 3 s / last 2.5 s in a tile | plan.py TAKE_HEAD/TAIL 310 | no | builder only | builder rule (keep) |
| Tiny tile pieces absorbed | 2-15 frame switches given to the neighbour (ffmpeg hang) | compose._absorb_tiny 121 | no | partial: export_layers own chunking | port `_absorb_tiny` into export_layers |
| Slow motion picture | speed ranges, eased ramp, mci interpolation (export), repeated frames (editor) | speed_steps 459; slow_vf 1159; editor 2381-2388 | yes: 0.5x / 0.35x from here / Normal | partial: item `rate` (setpts only, no ramp, no interpolation) | item `rate` + `rate_ramp`; export `interp: mci` · Slow motion buttons |
| Frozen hold | the frame held while a sound plays (insert) | piece() hold 1195-1199 | no | partial (item with rate 0?) | video item `hold: true` (rate 0) |
| Hide him (insert) | cutaway: he is not in the picture | piece() hide 1183-1186 | no | yes (gap in the video layer) | builder |
| Listening footage under the other side | live footage of him listening, no freeze | piece() footage 1187-1194 | no | yes (an item from another take) | builder |

## 2. Background

| Feature | What it does | Where now | Shown today | Layered model | Suggested layered mapping · control |
|---|---|---|---|---|---|
| Zoom office photo per character | photo behind the cut-out person, pan x/y, zoom (0.4-2.5) | background.bg_layer 162, bg_box 181; BgLayer 968 | yes: grid + "+" add + None + Pan / Zoom sliders | yes: `backdrop` {target, asset, x, y, zoom} | keep · Background inspector, assets in Media |
| Wider photo for small tiles | outpaint so thumbnails keep proportion | scripts/outpaint-image.mjs (skill) | no | n/a (asset) | keep as asset tool |
| Solo set photo | cover the frame, zoom / x / y in pixels | `background`, `bg`; bg_place 882; editor 2198-2207 + drag | yes: Zoom / Left-right / Up-down / Reset / drag | partial (backdrop only inside a video box) | `image` layer full canvas (fit cover, zoom, x, y) or backdrop with target box = canvas · same sliders + drag |
| Set blur / dim | out of focus, a touch darker | `bg_blur` 2.2, `bg_dim`; text_layers 1074-1080; preview 1864 | no | no | backdrop / image prop `blur`, `dim` · sliders |
| Set library | every set made for earlier videos | /api/library (server 491); editor 2208-2216 | yes: Set grid (rebuilds) | no | Media → Library; pick = asset swap (live) |
| Sign in the set | a logo painted into the photo in perspective, room light / warmth / shadow | `sign`; paint_sign 899 | no | no | image item with `quad` + `light`, `warm`, `shadow` (drawn into the backdrop) · corner handles |
| Plaque | text on a plate in perspective | `plaque`, `plaque_quad`, `plaque_inset`, `plaque_bg`; scene_png 941; editor 2217-2221 | yes: Plaque textarea (rebuild) | no | text item with `quad` (perspective) · text field |
| Pictures behind him | story picture on the studio screen, blurred, framed, under the person | overlay `image` + `behind`; compose 2295-2298; editor 1867-1871 | partial (as a text layer; behind config-only) | partial (layer order can put it under) | image layer below the person layer + `blur` prop |
| AI tag on picture | "תמונת AI" label on realistic AI people | overlay `tag`; editor 1872-1874 | no | no | text item style `pill` grouped with the image |
| No background (Zoom) | the take as filmed | BgLayer None | yes | yes (no backdrop / hidden) | Background "None" |
| Old baked background | `background_layer: false` | zoomcut.py 155-163 | no | no | drop |

## 3. Sound

### 3a. Voice chain and cleaning
| Feature | What it does | Where now | Shown today | Layered model | Suggested layered mapping · control |
|---|---|---|---|---|---|
| Voice presets (solo) | raw / natural / podcast / radio / warm / bright / news / hall / stage | sound.ts VOICE_PRESETS 10-23; editor 2172-2177 | yes: preset buttons | no | audio prop `voice.preset` · Voice inspector |
| EQ / dynamics sliders | Boost, Low cut, Warmth, Boxiness, Presence (3.2 kHz), Soft s's, Compression | sound.ts buildMix/applyMix 61-116; editor 2185-2191 | yes | no (only Zoom `presence` 2.8 kHz) | `voice.{boost, lowcut, warmth, box, presence, deess, comp}` · sliders |
| Room reverb | Room amount + Room size (seeded IR, same in python) | sound.ts roomIR 27; lesson.py room_ir 1561; editor 2192-2193 | yes | no | `voice.room`, `voice.roomSize` · sliders |
| PA echo | stage PA slap echo | sound.ts 75-79; editor 2194 | yes | no | `voice.pa` · slider |
| Noise Off / Standard | afftdn, both versions prepared, switch live | DENOISE 1292; take_audio 1305; editor 2178-2181 | yes | partial (`clean: mild` is a different chain) | `voice.denoise: off|fft` · Noise buttons |
| **Noise Strong = RNNoise** | arnndn cb.rnnn (AC / fan hum) | denoise_filter 1295-1302; setNoise 1457-1462 | yes: Strong (rebuild) | partial: `clean: nn` (= highpass + RNNoise + compressor) | `voice.denoise: rnn` plain arnndn into the chain · Noise "Strong" |
| denoise nr / nf | stronger FFT denoise | `denoise {nr, nf}` | no | no | `voice.denoise_amount` · slider |
| Pauses found on cleaned voice | silence detection on RNNoise audio | spans 349-354 | no (automatic with Strong) | no | builder rule |
| Pitch | semitones, rubberband, formants kept, lips in sync | voice_pitch 1318, pitched 1324; editor 2184; /voice-pitch | yes: Pitch slider | no | `voice.pitch` (stem remade) · slider |
| Raw bypass | raw preset: no lift, no master, no limiter | applyMix 102-115; finalMix 171 | yes (Raw preset) | no | `voice.preset: raw` honoured by the mixer |
| Zoom cleaning | off / mild / strong / nn per character | audio.py CLEAN_AF 66, CLEAN_STRONG_AF 73, CLEAN_NN_AF 80; VoiceLayer 956-960 | yes | yes: `clean` | keep, as one option set of the Voice inspector |
| Zoom clarity | dB at 2.8 kHz | _voice_chain 96; VoiceLayer 961 | yes | yes: `presence` | keep (unify with solo Presence) |
| Speech-level evening | each take measured on the pieces used | audio.speech_gain 13, mix 136-153 | no (automatic) | yes: `level: speech` | keep · show the measured gain read-only |
| Volume per voice | live volume | VoiceLayer 955; LineSound 661 | yes | yes: layer `volume`, item `gain` | keep |
| Soften | shouted line made easier (EQ + 2:1 + level back) | audio.soften 49; LineSound 667 | yes: Soften switch | yes: item `soften` | keep · item inspector |
| Voice stems live | voice raw + denoised + fx + music played live through Web Audio | lesson stems 1407; editor 1556-1641 | implicit | partial (stems per layer; AudioTrack live gains) | per-layer stems + sound.ts chain live |
| One loudness gain | -14 LUFS, limiter for rare peaks, never rides | audio.mix 170-180; sound.ts masterFor 148 | no | yes (loudnorm measure + alimiter) | keep; reconcile with sound.ts master/limiter math |
| Speed keeps pitch | atempo / browser preservesPitch | compose 2370; export_layers 358 | implicit | yes | keep |

### 3b. Music, effects, lanes
| Feature | What it does | Where now | Shown today | Layered model | Suggested layered mapping · control |
|---|---|---|---|---|---|
| Music bed | a looped track under the video | `music.sound`; fx_and_music 1698-1710 | yes: Music lane + Track list | partial (audio item; no loop) | audio layer "Music" item with `loop: true` |
| Track picker + listen | series music folder, switch live, ▶ listen | /api/ep/:id/music; editor 1312-1337, 2280-2291 | yes | no | Media / SoundPicker on the music layer |
| Music volume | default 0.3 | musicVolume (sound.ts 55); editor 2294 | yes | yes: layer `volume` | keep |
| Music start / end / off | drag on its lane, Delete takes it off | `music.start/end/off`; grabMusic 2871-2886 | yes | yes (item from / dur / remove) | keep |
| Music fade in / out | 1.5 s / 2.5 s | fx_and_music 1707; editor 2303 | yes: Fade out (in: config) | yes: item fades | Fade in + Fade out sliders |
| Duck under voice | music down while he talks, up in pauses (attack .12, release .6, hold .35) | duck_curve 1370; stems 1425-1427; editor 2296 | yes: slider | no | audio prop `duck {under: <layer>, db}` · slider |
| Lift at the end | music rises once he stops for good | lift_curve 1390; editor 2299-2302 | yes: Lift + Lift over | no | audio prop `lift {db, fade}` · sliders |
| Music carve | -3.5 dB at 2.5 kHz so the voice sits on top | sound.ts 82 | no | no | automatic on music layers |
| Sound lanes | each sound on a lane; empty lanes stay; Delete layer; + Sound layer; drag between lanes | `lane`, `sound_lanes`; editor 1363-1393, 3047-3055 | yes | yes (a lane = an audio layer) | keep |
| Add sound at playhead | SoundPicker: this project / all sounds, search, listen | SoundPicker 2768; editor 2333-2336 | yes | partial (asset upload + item.add) | SoundPicker window → item.add |
| Swap a sound | keeps its place and settings | editor 2269-2272 | yes | partial (item asset change) | "Swap…" in item inspector |
| Move / trim a sound | drag body / ends (`trim_in`, `len`) | moveSound 1394, trimSound 1412 | yes | yes (from, in, dur) | keep |
| Sound pinned to the take | dragged sound stores take + take time, follows re-cuts | moveSound 1399-1402; sound_place 1468 | implicit | no | item `anchor {take, t}` (see gap 4) |
| Placement by words | `start_word` / `end_word` / `_edge` / `_after` / `_offset`, `after_prev`, `at` | sound_place 1468-1490 | no | no | builder anchors; show "pinned to: word X" |
| `until` | a bed ends where another sound starts | placed_sounds 1461-1464 | no | no | anchor end to item id |
| Per-sound filter | phone / speaker (laptop) / speakerphone / thought / echo / muffled | SOUND_FILTERS 1231-1256; editor 2246-2248 | yes: Voice buttons | no | item `fx.filter` · Voice buttons |
| Echo amount | the dark inner voice's echo 0-2 | echo_filter 1262; editor 2266 | yes | no | item `fx.echo` · slider |
| Tempo | faster / slower at same pitch | load_sound tempo; editor 2265 | yes: Speed | no | item `fx.tempo` (not `rate`) · slider |
| Pitch (tape) | slower and lower | `pitch` on sounds; sound_parts 1496 | no | no | item `fx.pitch` · slider |
| Clean (sound) | RNNoise on a voice note | load_sound denoise 1284; editor 2249-2253 | yes: As recorded / Clean | no | item `fx.denoise` · toggle |
| His room | the sound in the same room as his voice | with_room 1587; editor 2254-2258 | yes: Dry / His room | no | item `fx.room` · toggle |
| Reverse | a muffled voice nobody can make out | fx_and_music 1650 | no | no | item `fx.reverse` · toggle |
| Skip ranges | pauses inside a recording taken out, crossfaded | sound_parts 1493-1507; 1654-1661 | no | partial (split into items) | split into items (builder) |
| Volume / fades per sound | gain 0-3, fade in / out | editor 2262-2264 | yes | yes | keep |
| Duck his voice under a thought | `duck` dB on the voice while this sound plays | stems 1412-1423 | no | no | item `duck_voice: db` · slider |
| Chime with a sound | a whoosh / pop as a bubble appears | `chime`; fx_and_music 1641-1645 | no | partial (separate audio item) | separate item, grouped |
| Voice bed | the voice-over's own room noise between lines | voice_bed 1510-1555 | no | no | audio prop `bed: true` on the voice-over layer · toggle |
| Captions on a sound | the other side's subtitles | sound `captions`; captions 750-756 | no | partial (subtitles items) | subtitles layer "Other side" items (builder) |
| Looping a short sound | `from_word`/`to_word` sounds tile to fill | fx_and_music 1686-1687 | no | no | item `loop` |
| Inserts' sounds | ring / phone in an opened pause; lead, tail, gain (.55 phone / .8), fade_out, chime | fx_and_music 1608-1624 | no | no | builder → audio items |
| Intro sound | opening theme from frame 0 | `intro_sound`; 1627-1634 | no | yes (audio item) | builder writes it |
| Zoom leave chime | synthesized two-note bloop on a removal | audio.removal_sound 197; to_layers 109, 299 | no | yes (`sfx` layer) | keep |
| All sounds +/-2 dB | every sound and the music by the same dB | allLevel 1358; editor 2313-2316 | yes | no | group action on the Sound group |
| Listen / Go there | ▶ a sound alone, jump to it | editor 2238-2241 | yes | no | item inspector buttons |
| Rejected sounds folder | `_assets/<series>/rejected/` kept out of pickers | skill editor.md | no | no | SoundPicker filter |

## 4. Text (subtitles, titles, cards, thoughts, plaque, POV hook)

| Feature | What it does | Where now | Shown today | Layered model | Suggested layered mapping · control |
|---|---|---|---|---|---|
| Zoom subtitles | dark box "name: text" inside the big tile, above its tag; chunks of 7 words; switch with the speaker | plan.py 248-268; to_layers 198-224 | yes: Subtitles lane | yes: `subtitles` style `zoom`, `who`, box | keep |
| Zoom aside subtitle | amber, stacked on top | `side`; styles.tsx 224-227 | no (aside config-only) | yes: `side` | keep; aside toggle in line inspector |
| Zoom narrow tile subs | compact, size 32 | to_layers 220-221 | no | yes: `compact`, `size` | keep |
| Subtitles on/off | Zoom project switch | `subtitles`; Inspector 548-549 | yes: switch | yes: layer `hidden` | eye toggle on the lane |
| Edit a subtitle's words | Zoom: per line `caption` (Back to script); solo: ✎ per line, Edit per take | SubtitleEdit 927; editCaption 1478; saveTake 1504 | yes | partial: builder action `caption` (Zoom) | item text edit (marks `user`) + "Back to script" |
| Solo subtitle timing | script tokens aligned to the recogniser, chunks 4 words / 22 letters / punctuation, end hints, give way to holds and the other side | captions 696-776 | no (automatic) | no | solo builder |
| Script as source | captions.txt remade from the Reader script when it changes; only on-camera lines, ad-libs kept | sync_captions 675; script_blocks 651 | partial (Reader) | no | builder; Script tab |
| Freeze subtitles | `captions_from: file` | sync_captions 680 | no | n/a (user items survive) | lock toggle on the layer |
| Solo subtitle style | Yellow Stam (stroke 14, letter-spacing, shadow, size 84) / White Assistant (800, 70, stroke 10) | CAP_STYLES 1302; editor 2062-2068, 1995-2008 | yes | partial: `outline` (no letter-spacing / shadow) | add style `stam` or `outline` knobs `letterSpacing`, `shadow` · Style buttons |
| Subtitle font / size / colour | assistant / arimo / abraham / stam-ashkenaz / stam-sefarad; 40-100; 4 colours | editor 2069-2080 | yes | yes (`font`, `size`, `color`) | keep |
| Subtitle height | `captions_y` 900-1700, drag on preview | editor 1698-1706, 2082-2085 | yes | yes (layer box) | layer `box` · slider + drag |
| Other side's subtitles | `captions_other {color, y}`, stacked above his (over) | cap_y_of 959; editor 1995-2001 | no | partial (a second subtitles layer) | "Other side" subtitles layer · its own style |
| No subtitles over intro clip | held back while the opening clip plays | compose 2364 | no | no | builder trims the items |
| Read / Lines views | whole text per take; line list with times, follow playback | editor 1746-1796 | yes | no | Script tab in LayersEditor |
| Hook / POV text | box text: light / dark / gold, Box opacity, Size 30-90, Font tiles, padX/padY | TextProps 704-778; ovBoxStyle; addOverlay hook 1466 | yes | yes: text style `pov` (theme, opacity, size, font, padX/Y, maxw) | keep · Text inspector |
| Top (POV) / Middle (label) | preset places | TextProps 759-760; ZoomCall ovY | yes | yes (box y) | place presets |
| Title fallback | no overlays + title → gold Stam hook y 270 | overlays() 872-873 | no | no | builder writes a pov item |
| Text drag | drag on preview (y) | dragText 1707; TextHandle 859 | yes | yes (box) | drag handles |
| Text timing | From / Until, lane drag + ends, negative start = from the end | TextProps 770-773; grabOv 2919; plan._overlay 45 | yes | yes: from / dur, `pin: end/span` | keep |
| Tied to words / sound | `from_words`, `to_words`, `take`, `hold`, `until`, `sound`, "placed by the build" | time_overlays 807-866 | partial ("placed by the build" label) | no | item `anchor` (gap 4) |
| Question card | Instagram question sticker (label, label_size, accent, opacity, asker, w, x, y) + TikTok reply variant (user, avatar_color) | editor 1947-1974; lesson_text.mjs; addOverlay 1467 | yes: "+ Question card" (fields config-only) | no | text style `question` · fields in inspector |
| Thought | animated words (slam in, grow, hold, dissolve into atoms `motion: horror`), x / w / y / size / hold / grow / overlap | thought_anim.js; ThoughtText 2630; text_layers 980-990 | yes: "+ Thought" (motion etc. config-only) | no | text style `thought` (animated: true) · Motion / Grow / Hold sliders |
| Lower third (band) | red tag + blue band "tag \| text", opacity | editor 1934-1945; lesson_text.mjs | yes: "+ Lower third" | no | text style `band` |
| Ticker | band across the frame, strip scrolls (speed, band opacity) | compose 2332-2341; TickerStrip 2656; TextProps 761-768 | yes: "+ Ticker", Speed slider | **no** (export_layers lists `ticker` as animated but styles.tsx lacks it) | text style `ticker` (animated: true) · Speed slider |
| Market panel | finance card + chart drawing in (symbol, name, price, change, tag, updated, call, fine, w, draw, dump) | market_anim.js; MarketProps 815; MarketCanvas 2613 | yes | no | text style `market` (animated) · same fields |
| Name tags (Zoom) | name + mic icon, big / small | to_layers 190-191 | n/a | yes: style `tag` | keep |
| Removal notice / stamp | toast "המארח הסיר..." and red pill "הוסר מהפגישה" | to_layers 181-196, 226-241 | n/a | yes: `toast`, `pill` | keep |
| Meeting title / timer / count | chrome texts, `{clock}` from `timer_start` | to_layers 243-256 | no (title, timer_start config-only) | yes | keep · editable text items |
| Plaque | see Background | | | | |
| Fonts | Assistant, Arimo, Abraham, Stam Ashkenaz / Sefarad | fonts/fonts.json | yes | yes: font assets | keep |

## 5. Graphics / FX

| Feature | What it does | Where now | Shown today | Layered model | Suggested layered mapping · control |
|---|---|---|---|---|---|
| Image / logo (plain) | corner logo, Size, Opacity, 4 corner presets, drag, swap picture | editor 1520-1529, 2033-2058 | yes | yes: `image` item (box, opacity) | keep · Picture inspector with corner presets |
| Framed picture | white 6 px border, radius 14, shadow, cover | editor 1927-1933 | partial | no | image prop `frame: true` |
| Full-frame poster / end card | image overlay, negative start, fade_in 0.08, on black | zoom-call.md; to_layers 263-272 | partial (as text layer) | yes (image item, `pin: end`) | keep |
| Pops in | spring past size and settle 0.35 s, shrink in last 0.2 s | popScale 676; pop_expr 2229 | yes: Entrance Appears / Pops in | partial (anim keyframes, linear only) | item `entrance: pop` (named curve) · Entrance buttons |
| Blinks | on 72% of each second (CTA) | blinkOn 691; compose 2325-2326 | yes: Steady / Blinks | no | item `blink: true` · toggle |
| Fade in / out | alpha ramps | fadeOp 683; compose 2327-2329 | partial (config) | yes: `fade_in` / `fade_out` | sliders in item inspector |
| Sticker pop | picture pops in beside his face (x, y, w, rot) | sticker_anim.js; StickerProps 781 | yes | no | image style `sticker` (animated) · Pop / Rain, Size, Tilt |
| Sticker rain | bills rain down (w, count) | sticker_anim.js rainBills | yes | no | same, motion `rain` · How many |
| Green-screen clip | money rain video keyed (key, similarity, despill, cover, fade end) | text_layers 991-1007; KeyedClip 2536 | no (config `motion: video`) | no | video item prop `key {color, similarity}` · Key colour |
| Film filters (8) | Movie colour, Darken, Vignette, Grain, Slow zoom, Handheld, Ghost trail, Light flicker; each On/Off + strength | FILTERS 2414-2424; fx.js; FxFrame 1751 | yes: Filters inspector | no (`effect` placeholder) | `effect` layer, one item per filter {kind, amount, from, dur} (adjustment of layers below) · Filters inspector |
| Filter timing | each filter's block on its own lane, drag / ends, All start / end here | fx.times; grabF 2818; editor 2444-2450 | yes | no | effect items from / dur |
| Filter fade in | shared fade | fx.fade; editor 2447 | yes | no | effect item `fade_in` |
| Ghost lag | ghost trail delay | fx.ghost_lag | no | no | effect item prop `lag` |
| Camera centre | transform origin | fx.center | no | no | effect layer prop `center` |
| Hits | kick / shake / flash at a moment, tied to a sound | fx.hits; time_fx 1715; editor 2455-2461 | yes: "+ Hit here" (amounts config-only) | no | effect items `hit {kick, shake, flash}` · sliders |
| Black from here / blackouts | cut to black (from a sound) | fx.blackouts / black; editor 2462-2464 | yes | no | effect item `black` (or shape item fill #000) |
| Push zoom | zoom keyframes | fx.push | no | no | effect item `zoom` keyframes |
| Zoom chrome | bars, icons, accent, ui strings | ZoomChrome.tsx; to_layers 34-49 | no | yes (image `zoom.chrome`) | keep; accent / ui text editable |
| Speaker highlight | green border, 0.15 s lag, off while flashing red | plan.py 240-246; to_layers 159-168 | no | yes: shape layer | keep |
| Removed flash | red tile + border + scale stamp | to_layers 169-184 | no | yes: shape + anim | keep |
| Tile edges | 1 px borders | to_layers 158 | no | yes | keep |

## 6. Timing / edit

| Feature | What it does | Where now | Shown today | Layered model | Suggested layered mapping · control |
|---|---|---|---|---|---|
| Cut presets | Tight / Light / Keep pauses / Whole take | CUTS 1442-1448; editor 2372-2377 | yes (rebuild) | no | solo builder action `cut {preset}` · Video card |
| Cut params | merge, pad_in, pad_out, join, above_floor, voice_above_floor, after_last_word, whole, silence | CUT 30; spans 346-451 | no | no | builder settings panel (advanced) |
| Join overlap | picture cuts `join` early, previous sound runs on crossfaded | plan 569-576; voice_stem 1363 | no | partial (overlapping audio items) | builder writes overlapping voice items |
| Keep pauses / lead in / end at | listening ranges never cut; silent lead before first word; hard cut mid-word | `keep_pauses`, `lead_in`, `end_at` | no | n/a (items) | builder settings, or just items |
| Edge drag with real footage | drag a piece's edge, the take is behind, peek the frame | grabEdge 2974; trimPiece 1644; `cut.edges`; /trim | yes | yes for video items (layers.md says so) | keep; for solo, a drag also re-plans subtitles / sounds (builder action) |
| Split | S at the playhead | split 2894; /cutop split; `cut.splits` | yes | yes (item ops) | Split button + S |
| Delete piece | the rest closes up | del 2897-2905; `cut.removes` | yes | partial (item.remove leaves a gap; ripple?) | ripple delete across linked layers |
| Start here / End here / Reset | video start / end in every layer | /cutop start/end/clear-ends; plan 555-568; editor 3021-3023 | yes | no | project `in` / `out` marks (all layers) · buttons |
| Sequence | take segments in edit order | segments 502 | no | n/a (items order) | builder; Media order |
| Inserts (holds) | a pause opened inside a take: at_start / at / before / after word, search_from, with_prev, seconds, hide, footage | plan 524-554 | no | no | builder; or a "Hold here" item |
| Slow motion | ranges [from, to, speed], `slow_ramp`, `slow_mode` mci / blend / dup, sound stretched | speed_steps 459; slow_vf 1159; voice_stem 1360 | yes: 0.5x / 0.35x / Normal | partial (`rate`) | see Picture |
| Video speed | the whole video 0.5-2 (presets 1-1.3 + Custom) live, burnt in on export | SpeedPick 1188; /speed; compose 2370 | yes | yes: project `speed` (0.25-4) | SpeedPick in project card |
| Zoom line timing | gaps: first_line, victim_answer, handover_overlap, quick_overlap/quick_line, same_speaker_gap, interrupt_overlap, interrupted_tail, attempt_*, tail, tail_after_removal, eager_extra ("חד משמעית") | plan.py default_gap 28-42; presets/zoom-he.json; episode `timing` | no | builder only | builder settings panel |
| Line take / In / Out / Cut | pick a take (scored alternatives), set times | LineProps 586-635 | yes | partial (builder action `line`) | Script tab + line inspector |
| Pause before | override the gap | LineProps 634 | yes | partial | same |
| Shift (move a line) | drag the block's middle | Timeline startTrim 'm' 1071; trim 258 | yes | partial | same, linked items |
| Layout | Auto / Gallery / Speaker / Duo per line | LAYOUTS 51; LineProps 639-643; compose.layout 28 | yes | partial (boxes baked per item) | builder action `line {layout}` |
| Drop / Restore / Reset line | skip a line | LineProps 645-648 | yes | partial | same |
| Aside | said on the side, quieter, own subtitle, 0.9 s look, takes no time | corrections `aside/at/gain/show`; plan 132-142 | no | partial | line inspector toggle + At / Gain / Show |
| Tail | how long an interrupted voice runs on | corrections `tail` | no | partial | line inspector slider |
| Attempts | the victim's last try picked from a take | corrections `attempts` | no | partial | line inspector |
| Script directives | [pause] [overlap] [attempt] [remove], "—" = interrupted | script_parse.py | partial (script file) | builder | Script tab |
| Listening tiles | idle pools from listen files, stretch ending where the next line starts | plan.py _listening 313 | no | yes (items) | keep |
| Zoom removal beat | attempt 85% in, view to victim, red flash, leave sound, notice, gallery after | plan.py 85-110, 216-219 | no | yes (layers) | keep |
| Undo / Redo | Zoom: line / settings / overlays; Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y | editor 241-272, 1090-1091 | yes (Zoom only) | yes: ops `inverse()` + history log | toolbar + keys for every op, solo too |
| Prev / next line or take | ↑ / ↓, transport buttons | editor 234-238, 1269-1272 | yes | no | transport |
| Keys | Space, Home / End, ← → frame (Shift = 1 s), S, Delete, Esc | editor 274-290, 1273-1288, 2906-2916 | yes | no | keep all |
| Timeline zoom | Ctrl+wheel anchored, slider, Fit; resizable height; collapsible groups | editor 1020-1042, 2935-2954, 2395 | yes | no | keep |

## 7. Export / share / jobs

| Feature | What it does | Where now | Shown today | Layered model | Suggested layered mapping · control |
|---|---|---|---|---|---|
| Export menu | Full quality / Quick check (Zoom only today); then Telegram / Email / both / nowhere | editor 389-402; /export 865 | yes | yes (export_layers `--quick`, all projects) | keep; Quick for solo too |
| Quick check | half size, ultrafast, out/<id>.draft.mp4, never replaces the real file, sent marked DRAFT | compose scale; zoomcut.py 210; share 635 | yes | yes | keep |
| Auto send after export | sends where asked once the export succeeds (survives restart) | finishSends; attach | yes | yes (runJob generic) | keep |
| Size-capped copies | Telegram 2-pass <=50 MB, email <=25 MB | share.mjs sizedCopy 40 | no (automatic) | yes | keep |
| Stale export prompt | "Export again, then send" / "Send the old file" | exportStale 44; editor 378-388 | yes | partial (does not watch project.json) | add project.json to exportStale |
| Open MP4 / Email / Telegram buttons | after an export | editor 375-377 | yes | yes | keep |
| Progress | stage + Rendering n% + "then → dest"; Stop | editor 358-372; ff_progress 68 | yes | yes (log lines) | keep "Rendered n/m" lines in export_layers |
| Jobs detached | jobwrap, job.log/json, re-attach after restart | server 41-155 | implicit | yes | keep |
| Jobs panel + history | builds, exports, sends, Drop pulls; _jobs.json last 300 | /api/jobs 871-880 | yes (studio rail) | yes | keep |
| Gentle export | 3 pieces, x264 4 threads, below-normal priority (blue screens) | compose LOW/PIECES 17-18 | no | yes (reuses compose limits) | keep, never raise |
| Export checks | length at speed, 1080x1920, 30 fps, sound, LUFS, stills | check_export 1971; validate.py | no (log) | yes (`check`) | show result line in the export bar |
| Background warm render | after each edit, low priority: person chunks, thoughts; export waits for it | spawn_warm 1932; warm 1955 | partial ("Updating" note) | no | pre-render video runs / animated styles after edits |
| Chunk cache | 2 s take-grid person chunks, only touched chunks re-render | chunks 2174; person_layer 2191 | no | partial (graphics frameMap; video chunks per run) | keep cache keys stable |
| Tidy | delete unused anims, caption pngs, filtered copies, old pieces | tidy 1994 | no | no | port |
| Stills | one frame through the export path | `--still`; tools/layers_stills.mjs | no | partial (tool exists) | "Still at playhead" button |
| Cancel | stop a running job | /cancel 883; editor 372 | yes | yes | keep |
| Re-analyze | the builder's analyze | /analyze 863; editor 373 | yes | yes (builder action) | keep |
| Done ✓ | mark project done (cleans the Drop's cloud copy) | /done 166 | yes (project menu) | yes | keep |

## 8. Inputs (Drop, Reader, takes, media)

| Feature | What it does | Where now | Shown today | Layered model | Suggested layered mapping · control |
|---|---|---|---|---|---|
| The Drop | iPhone uploads → Downloads\drop\<folder> every minute; QR, Open the Drop, Check now, per-folder status | DropCard 2682; render/drop.mjs | yes | n/a (unchanged) | keep in "+ New video" |
| New video | Solo / Zoom call, footage folder, settings from an earlier project, name | NewVideo 2711; /api/new; lesson.py new_from 2388 | yes | n/a | keep; builder kind |
| Settings from an earlier project | set, music, voice, subtitle style, eye contact (reset to default), grade, layout, speed | new_from 2388-2398 | yes (select) | no | copy a project's layer props (not items) |
| Footage list (solo) | each take: used length, pieces, click = jump | editor 1799-1805 | yes | partial (Media = assets) | Media tab rows with "used" |
| File assignment (Zoom) | who is this + Dialogue / Listening; `files` order / skip | Media 488-519; media.scan 15 | yes (order config-only) | builder | Media tab, + Order |
| Logos & pictures | + Add file, Use / Swap in, Remove, big view | editor 1820-1844; /media | yes | yes: asset upload | Media tab |
| Library | sets and effects of earlier videos | /api/library; editor 1845-1846 | yes | no | Media → Library |
| Backgrounds upload (Zoom) | + in the grid | BgLayer 991; /backgrounds | yes | yes (asset) | Media + Background inspector |
| Reader | teleprompter: paces per character, ⏱ measure (Save / again / Cancel), Checkpoint ⚑ / M, Home, cues, # notes hidden | render/reader/index.html 159-370 | yes (separate tool) | n/a | unchanged; same project (zc-ep) |
| Script ↔ subtitles | episode `script` → scripts/<id>.txt; subtitles from it | script_path 616 | partial | builder | Script tab shows the Reader script |
| One project in every tool | zc-ep in session/local storage, shared menu | tabProject 63; studio/bar.js | yes | n/a | keep |
| Test copies | `_name` hidden from menus | server /episodes | no | n/a | keep |
| Language | `language: en` for English speech | prepare 99 | no | no | builder setting · select |
| Media host / CORS | heavy media on the other host name (6-connection limit) | server mediaHost | no | yes (reused) | keep |
| Audit (Zoom) | self-review: starts mid-word, too long, check / missing, silence before | zoomcut.py cmd_audit 356 | no | builder | "Check lines" in Script tab |
