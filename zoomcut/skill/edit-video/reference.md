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
  neutral for a raw person), `eye_contact`.
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
- Images: Leonardo GPT Image 2.5 (flare / sunburst - he prefers them): `node c:\workspace\noam\team-photos\gen.mjs
  image prompt.txt out.jpg flare MEDIUM 1024x1024`; `portrait <ref> <prompt> <out> flare MEDIUM 0.6 1024x1024`
  re-lights / re-does a photo from a reference (the lit store from the dark one). **Work cheap (his rule):** MEDIUM
  and the smallest size that does the job - HIGH / HD / 2x only when he asks (HIGH was $0.076 square, $0.11 wide).
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
