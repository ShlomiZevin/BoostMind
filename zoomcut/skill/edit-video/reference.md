# Reference - settings, tools, gotchas

## episode.json (lesson.py) - the settings that matter
- **Footage:** `input_dir`, `takes` (glob), `sequence` [{take, from, to}] (edit order of take segments; `to` = take
  seconds, put it in the gap before the sentence the next take repeats), `language`
  ("en" for English speech).
- **Cut** (`cut`): `merge`, `pad_in`, `pad_out`, `join`, `above_floor`, `voice_above_floor`, `silence: false` (only
  start / end), `whole` (the whole take - a stare), `keep_pauses` {take: [[a,b]]}, `lead_in`, `end_at`,
  `after_last_word`, `edges` (his drags), `removes`, `splits`, `video_start` / `video_end` {take, t} (his start / end
  marks), `slow` {take: [[from, to, speed]]} (ranges may touch; eased over `slow_ramp`), `slow_mode` mci | blend | dup.
- **Person:** `cutout` (false = original place), `matte_engine` fast | quality | hybrid | body, `matte_cut`, `keep`
  (desk below / boxes / bright_in / stable), `person` {scale, x, y}, `look` (live colour), `grade` (baked colour; set
  neutral for a raw person), `eye_contact`, `prop_color` {take | "*": {hsv [[h,s,v],[h,s,v]] (OpenCV, H 0-180), from,
  to (take s), box [x0,y0,x1,y1] fractions}} - a held prop of one clear colour that every engine drops (haredit-1's
  lime bottle against a white wall: quality, fast and body all lost it): its colour, filled, only blobs touching the
  person, is added to the cut-out (`work/matte/<take>.<engine>.prop<hash>.mkv`, ~4 s a take; editor + export read it
  through `matte_path`). Lime green = [[30,110,110],[48,255,255]]. A part of another colour (the grey cap) stays out.
- **Set:** `background`, `bg_blur` (2.2 default), `bg_dim` (false = the photo's own light), `plaque` / `plaque_quad`,
  `sign` {image, quad [TL,TR,BR,BL] in the photo's pixels, light, warm, shadow} (or a list) - a picture (her logo)
  painted INTO the set photo in perspective, so it zooms, moves and blurs with the room (an image overlay does not).
- **Voice:** `voice` {preset, boost, pitch, pa, room…}, `denoise` {rnn} / {nr, nf}, `speed` (1-1.3, export burns it in).
- **Sounds** (`sounds` [...]): `sound`, `from` / `to` (file seconds), placement `at` (take seconds) | `after_prev`
  (seconds after the previous placed sound, may be negative) | `start_word` / `end_word`; `filter` phone | speaker |
  speakerphone | thought | echo | muffled; `denoise`, `pitch` (slower and lower too), `tempo`, `echo` (0-2), `skip`
  [[a,b]] (pauses out), `gain`, `fade_in` / `fade_out`, `duck` (dB on his voice under it), `chime` {sound, gain, at},
  `captions` [[a, b, text]] (the other side's subtitles), `until` {sound, offset} (ends where another starts), `room`,
  `trim_in` / `len`, `reverse`.
- `voice_bed` {gain} - a voice-over's own room noise between its lines. `music` {sound, start, end, off, duck}.
- **Overlays:** `style` pov (hook) | question | thought | band | ticker | image (`behind`, `tag`, `plain`) | market (a finance-news
  coin card + chart drawing in: `symbol` `name` `price` `change` `tag` `updated` `call` `fine` `dump` `w`; one canvas drawing,
  `render/ui/market_anim.js`, live in the editor and frame by frame in the export via `tools/market_frames.mjs`) | sticker (a picture that pops in on a hit or rains down:
  `image` `motion` pop|rain `x` `y` `w` `rot` `count`; tie it to its sound with `sound` (+ `hold`) and it follows the hit;
  `render/ui/sticker_anim.js` + `tools/sticker_frames.mjs`). Subtitles are drawn over every overlay (editor and export); timing
  `blink: true` (on 72% of each second - a call to action), `fade_in` / `fade_out` (seconds of alpha - image / text overlays; a full-frame
  `_assets/black.png` overlay with fade_in = a fade to black at the end), `start` / `end` | `from_words` / `to_words` (both take a list of alternatives - the recogniser's spelling first:
  it heard ריספרדל as "חיספרדל"; one word must match exactly) | `sound` (index - written back at each build). Thought: `motion`
  "horror", `x`, `w`, `y`, `size`, `hold`, `grow`, `overlap`.
- **Film look** (`fx`): `grade_amount` + `grade`, `dark`, `vignette`, `grain`, `zoom`, `drift`, `flicker`, `ghost` +
  `ghost_lag`, `times` {id: [start, end]}, `fade`, `center`, `hits` [{at | sound, kick, shake, flash}], `blackouts`
  [{sound, offset}], `black`.
- **Captions:** `captions_style`, `captions_y`, `captions_other` {color, y}, `captions_from: "file"` (freeze),
  `script` (Reader id), `intro_video` / `intro_sound`, `media`, `_todo` (notes for the next session - ignored).

## Tools
- Images: Leonardo GPT Image 2.5 flare / sunburst only (SKILL.md → "Leonardo" for which model when): `node
  zoomcut/tools/leonardo.mjs image prompt.txt out.jpg flare MEDIUM 1024x1024`; `portrait <ref> <prompt> <out> flare MEDIUM 0.6 1024x1024`
  re-lights / re-does a photo from a reference (the lit store from the dark one). **Work cheap (his rule):** MEDIUM
  and the smallest size that does the job - HIGH / HD / 2x only when he asks (HIGH was $0.076 square, $0.11 wide).
- AI talking footage (measured 2026-10-23 on Leonardo, two-person English dialogue, 8 s 720p 16:9, sound on, same
  start frame): every model said the lines exactly, in the right mouth and voice. Leonardo charged per clip: **Veo 3.1
  Lite $0.60** (cheapest, passed everything), Gemini Omni Flash $0.96, Wan 3.0 $1.14, Kling 3.0 $1.51, Seedance 2.0
  Mini / Kling 3.0 Turbo $1.55, Veo 3.1 Fast / Happy Horse $1.79, Grok 1.5 $1.91, Seedance 2.5 $2.62, 2.0 Fast $2.89,
  2.0 $3.62, Veo 3.1 $4.78. Leonardo marks up 1.5-3× over list price. **A FAILED clip is still charged** (Veo 3.1
  failed, no reason given, cost $4.78). Gemini Omni Flash takes no start frame → the set and faces drift. Comparison
  page: lybi.ai/lybi/marketing/social (aspect-react-client/public/lybi-site/marketing/social/) + scripts/video-lab.mjs (1 Leonardo token ≈ $0.0015).
- **A real public figure in a costume, when he asks for it by name** (2026-10-23, Bennett as the Kohen Gadol - his
  explicit override of "no realistic politicians"; satire, never a believable news scene): the reference is the
  person's official portrait from Wikipedia (`action=query&prop=pageimages&piprop=original`, download with a UA,
  check the Commons license), resized to 1024; `portrait ref.jpg prompt.txt out.jpg flare MEDIUM 0.6 1024x1024`
  ("the same face ... from the reference photo", the costume in detail, "no text"); make 0.6 and 0.8 together and
  let him pick. Saved to Downloads, never the public repo; in a video it gets the "תמונת AI" tag.
- Stickers (the guru's own "effort" look): ask for a die-cut sticker with a thick white border on a flat light-mint
  (#CDEBDD) background, then `tools/cutout_logo.py` cuts it to a transparent PNG (mint is removed, white border kept).
- Sound kit: `tools/horror_sfx.py <out dir> [names]` (synthesized: drone, braam, riser, stinger, heartbeat(_climax),
  whine, pulse, end_boom, hum, phone_drop, typing, impact) → mp3 (in git, in the editor's library).
- Eye contact: `tools/eyes_nvidia.py` (NVIDIA_API_KEY in zoomcut/.env) / `tools/gaze_video.py` (v6 fallback).
- Sending: Gmail (`GMAIL_USER` / `GMAIL_APP_PASSWORD` in aspect-agent-server/.env), Telegram (`TELEGRAM_TOKEN` /
  `TELEGRAM_CHAT_ID` in xplace-auto-bidder/.env) - read at send time, never print. Gmail caps 25 MB, Telegram bots
  50 MB → `share.mjs` makes size-capped copies.
- Background removal: MediaPipe (fast, ~45 fps) default; RVM "quality" ~7 fps; check the body on 4 s with both.

## Gotchas already paid for
- **Tool bugs found 2026-10-23 (open - fix each as its own task):** (1) the exporter caches pictures by asset id
  (`work/layers/public/m.ov<k>.png`, refreshed only when the source is newer) and overlay ids follow the overlay
  list's order - reorder the overlays and the export shows OLD pictures (the editor is right). Until fixed: delete
  `work/layers/public/m.ov*.*` before every export. (2) His last subtitle of a take before an off-camera sound stays
  up through the sound (`end_hint` is None when the last word ends past the picture's join) - end it with an op at
  the sound's start. (3) The editor: changing one subtitle's length once rippled the cut and set 24 subtitles to
  1 frame, all marked `user` - undo with the history log's `undo` ops (`work/history/log.jsonl`).
- **Suspected editor bug (2026-10-23, open):** 36 sound clips with a live `room` effect (`fx.room`) made the editor
  play "a strange sound and then silence" - his voice too (one AudioContext). The export was fine. Taking `room` off
  was the fix for demokratovich-songs; test the room effect on a `_` copy before using it on many clips.
- Overlays tied to words: `to_words` are looked up only in the SAME take (use `hold` to outlast it); a card with no
  end runs to the next card's start, so items that start together each need their own end.
- `os.kill(pid, 0)` on Windows TERMINATES the process - use `_alive()` (lesson.py / zoomcut.py).
- faster-whisper: feed numpy; transcribe per VAD chunk; word times drift ~0.4 s inside long voice notes - transcribe
  each voiced region alone when you cut on words. opencv must be < 5.
- Headless-Chrome screenshots mirror Hebrew; the real render is fine - don't "fix" it.
- Bash heredocs with apostrophes break here; `python -I` ignores PYTHON* env vars (use `sys.stdout.reconfigure`);
  write long patch scripts to a file and run them.
- The browser preview plays 540p copies; full-res stays for export (three full-res phone videos = fake drift reports).
- An `.ogg` voice note's filtered copies are written next to it (`<file>.<filters>.wav`) - keep notes in the project's
  media/, never in Downloads.
- Report to the fleet board when asked (alias `video-editing`).
- **episode.json overlays: write them in time order** (tadar-6, 2026-10-23) - words are matched in list order, each
  searching after the previous one's hit, so an overlay listed after a later one is "not heard".
- **Few lanes, and plan the timing for it** (2026-10-25, again: "if you have the emojis or stupid images, you can put
  them on the same layer because they are not on top of each other"). When you write the overlays, time them so they
  share lanes: one sticker ends before the next starts, a text that would overlap another for a few seconds starts after
  it (the lower third after the hook). A second lane only for things MEANT to be on screen together (a card + its stamp,
  two cards side by side). In reports say "N items on M layers" - never call items layers.
- **Few lanes, not a layer per overlay** (his ask, 2026-10-23: "use a small amount of layers"): the solo builder puts
  the overlays on shared lanes by what they are - Stickers (pictures), Texts (hook, cards, CTA), Ticker, End card
  (full-frame pictures, above the subtitles), Fade to black (`end_black`) - `pipeline/to_layers_solo.py` group_lanes.
  A lane opens a second one ("Stickers 2") only where two items overlap in time - end a sticker before the next
  starts (`hold` 0.05 on the first) and they share a lane. A builder lane that's no longer made disappears on the next
  Analyze unless he made something in it (pipeline/project.py merge).
- The one-camera project starts at speed 1 - set the series speed with `{"op": "project", "set": {"speed": 1.3}}`
  and check it before any export. Put the end card ABOVE the subtitles (`layer.move subs` below it).
- A picture you make for a video (poster, sticker, portrait) only shows in the editor's Media tab when its path is
  in episode.json `"media"` - add it there whenever you drop a file in `media/` or `_assets/`.
- Run lesson.py with `.venv/Scripts/python` (system python lacks rapidfuzz: `--still` fails silently in a loop and
  leaves the OLD still.png - every frame looked the same). A still costs ~60 s: batch few, pick timestamps well.
- Phone takes that open in digital silence (floor ~-80 dB): the first soft consonant ("כ" of "כי", "ה") is below
  `voice_above_floor` 38 and was clipped - 30 kept it (tadar-5). A short burst running into speech is no longer
  dropped as a click (lesson.py spans). Check each take's first piece against the voice onset (dB per 10 ms).
- A script line with no full stop runs into the next one in the subtitles ("Risperdal ואני") - fix it in
  captions.txt (the script stays his).
- The editor once saved ANOTHER project's text-on-video into this one (tadar-4's questions landed in tadar-5 after
  he moved between them). If he was in the editor on another project, re-check episode.json overlays and tell him
  to refresh (F5) before editing.
- **His PC blue-screens under heavy export load** (2026-10-22: DPC_WATCHDOG_VIOLATION - a Samsung 860 EVO on the
  generic SATA AHCI driver, the SSD ~94% full, 13 hard resets in 30 days). The Zoom export is gentle on purpose
  (compose.py: 3 pieces at a time, x264 4 threads, below-normal priority; Remotion concurrency 4) - don't raise it.
  An export cut by a crash leaves a corrupt `out/<id>.mp4`: ffmpeg `-f null` decode check before sending anything.
- **Zoom export hung forever on tiny tile pieces** (gilad-joins, 2026-10-22): a listening tile switching takes for
  2-15 frames froze ffmpeg in the chunk (old and layered paths alike; not the inputs, not threads). `compose._absorb_tiny`
  gives those frames to the neighbouring piece of the same person. If an export sits on one "Rendered N/M" for minutes,
  find the chunk (`work/chunks/cNNN.mp4` stuck at 48 bytes) and run `compose.render_chunk` on it with a timeout.
- **loudnorm "linear=true" silently falls back to dynamic** when one gain would push a peak over the limit - voices
  pumped around a loud aside. The mix is one fixed gain to -14 LUFS + a limiter for rare peaks (`audio.mix`).
- **A mostly silent take** (a listening take with one line) gets a huge automatic speech gain - set that line's `gain`.
- **Phone / filter-app voices:** measure before filtering (spectrum bands vs 300-1k, ring-out after words, codec gaps).
  RNNoise swallowed an "אה" even at 70% mix; afftdn barely moves codec damage; a compressor with makeup lifts the hiss.
- **Headless poster capture:** a 1080x1920 page captured with a clip / element screenshot came out white; a
  **full-page** screenshot works (puppeteer `fullPage: true`, viewport 1080 wide). But a TRANSPARENT PNG
  (`omitBackground: true`) with `fullPage: true` came out empty (2026-10-25) - viewport = the page size, `fullPage:
  false`; `_assets/dorit/tarot/shoot.mjs` (jobs json, one browser, in turn) does both kinds.
- **Windows line endings:** pipeline/*.py and some files are CRLF - a patch script that matches "\n" fails silently;
  normalise, patch, write back.
- **iPhone / filter-app files:** creation_time = recording time for camera files, export time for app exports (use the
  number in `export_<n>.mov`). Two characters' takes can be uploaded together - frames tell who.

- **Hebrew in an op = send it from Python (urllib, `json.dumps(..., ensure_ascii=False).encode('utf-8')`) or curl
  `--data-binary @file.json`** - never `curl -d '...'` with Hebrew typed in Git Bash: it arrives as U+FFFD and the
  editor shows diamonds (haredit-1, 2026-10-25: three subtitles and a layer name). After any op with Hebrew, read the
  project back and check for '�'.
- **A site's form: never name a field `item`, `length` or `namedItem`** - `form.elements.item` is the built-in method,
  so `f.item.value` is undefined and the order email said "פריט: undefined" (אופנת חני, 2026-10-26, a real order).
