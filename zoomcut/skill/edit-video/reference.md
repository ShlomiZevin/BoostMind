# Reference - settings, tools, gotchas

## episode.json (lesson.py) - the settings that matter
- **Footage:** `input_dir`, `takes` (glob), `sequence` [{take, from, to}] (edit order of take segments), `language`
  ("en" for English speech).
- **Cut** (`cut`): `merge`, `pad_in`, `pad_out`, `join`, `above_floor`, `voice_above_floor`, `silence: false` (only
  start / end), `whole` (the whole take - a stare), `keep_pauses` {take: [[a,b]]}, `lead_in`, `end_at`,
  `after_last_word`, `edges` (his drags), `removes`, `splits`, `video_start` / `video_end` {take, t} (his start / end
  marks), `slow` {take: [[from, to, speed]]} (ranges may touch; eased over `slow_ramp`), `slow_mode` mci | blend | dup.
- **Person:** `cutout` (false = original place), `matte_engine` fast | quality | hybrid | body, `matte_cut`, `keep`
  (desk below / boxes / bright_in / stable), `person` {scale, x, y}, `look` (live colour), `grade` (baked colour; set
  neutral for a raw person), `eye_contact`.
- **Set:** `background`, `bg_blur` (2.2 default), `bg_dim` (false = the photo's own light), `plaque` / `plaque_quad`.
- **Voice:** `voice` {preset, boost, pitch, pa, room…}, `denoise` {rnn} / {nr, nf}, `speed` (1-1.3, export burns it in).
- **Sounds** (`sounds` [...]): `sound`, `from` / `to` (file seconds), placement `at` (take seconds) | `after_prev`
  (seconds after the previous placed sound, may be negative) | `start_word` / `end_word`; `filter` phone | speaker |
  speakerphone | thought | echo | muffled; `denoise`, `pitch` (slower and lower too), `tempo`, `echo` (0-2), `skip`
  [[a,b]] (pauses out), `gain`, `fade_in` / `fade_out`, `duck` (dB on his voice under it), `chime` {sound, gain, at},
  `captions` [[a, b, text]] (the other side's subtitles), `until` {sound, offset} (ends where another starts), `room`,
  `trim_in` / `len`, `reverse`.
- `voice_bed` {gain} - a voice-over's own room noise between its lines. `music` {sound, start, end, off, duck}.
- **Overlays:** `style` pov (hook) | question | thought | band | ticker | image (`behind`, `tag`, `plain`); timing
  `start` / `end` | `from_words` / `to_words` | `sound` (index - written back at each build). Thought: `motion`
  "horror", `x`, `w`, `y`, `size`, `hold`, `grow`, `overlap`.
- **Film look** (`fx`): `grade_amount` + `grade`, `dark`, `vignette`, `grain`, `zoom`, `drift`, `flicker`, `ghost` +
  `ghost_lag`, `times` {id: [start, end]}, `fade`, `center`, `hits` [{at | sound, kick, shake, flash}], `blackouts`
  [{sound, offset}], `black`.
- **Captions:** `captions_style`, `captions_y`, `captions_other` {color, y}, `captions_from: "file"` (freeze),
  `script` (Reader id), `intro_video` / `intro_sound`, `media`, `_todo` (notes for the next session - ignored).

## Tools
- Images: Leonardo GPT Image 2.5 (flare / sunburst - he prefers them): `node c:\workspace\noam\team-photos\gen.mjs
  image prompt.txt out.jpg flare HIGH 1024x1536` (~$0.11); `portrait <ref> <prompt> <out> flare HIGH 0.6 1024x1536`
  re-lights / re-does a photo from a reference (the lit store from the dark one).
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
