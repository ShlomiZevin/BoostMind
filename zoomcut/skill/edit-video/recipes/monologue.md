# Recipe: monologue - one person talking to camera (rabbi, guru podcast, news anchor, keynote) - engine `lesson.py`

One speaker, takes in order (`IMG_*.MP4`), usually no script file: transcribe, captions per take (`== <take>` blocks,
corrected by hand - the recogniser garbles Aramaic / wordplay), let `lesson.py` cut, place and subtitle. If he keeps a
script in the Reader (episode.json `"script"`), subtitles remake from it (only the on-camera lines, ad-libs as said).

## The base he signed off on ("demokratovich-elections", the rabbi lesson)
- **Rhythm:** cut every pause > 0.25 s; each join starts 0.18 s on top of the last word; a take ends where the voice
  after its last word stops (keeps a held last word, drops a phone thud after a gap).
- **Sounds under his speech, never pauses:** a ring from ~2 s before he reacts until he answers; the other side of a
  call mumbling (pitch 1.2, phone EQ) - only when he is mostly quiet; when he talks non-stop see `offscreen-voice.md`.
- Title = gold Stam on a ~45% black box; subtitles yellow Stam with black outline (letter-spacing - the outline fuses
  "זו"). Speed 1.2× is his choice. Cut-out "quality" engine only when hands go up against a white wall.
- A re-take of a passage in a new file: episode.json `"sequence"` (take segments in edit order) - cut the old take at a
  sentence boundary before it and resume after it. Two takes that overlap: `end_at` on take 1 before the repeated words.

## Series "tadar" - spiritual-guru podcast parody (white bob wig, podcast mic), from 2026-10-17
- `lesson.py new episodes/tadar-N --from tadar-2 --input "<folder>" --takes IMG_xxxx.MP4 --script <reader id>`.
- Set `_assets/tadar/studio.jpg` (warm podcast studio), music `_assets/tadar/music.mp3` at 0.3, voice "podcast", eye
  contact on, grade warm 0.07 / sat 1.1, clean white Assistant subtitles, person y 200.
- The mic in front of him: `"keep": {"<take>": {"boxes": [[x0,y0,x1,y1]]}}` (fractions) keeps it from the real footage.
  On tadar-4 (black top + mic) RVM dropped the torso and the mic - MediaPipe "fast" kept everything: matte 4 s with
  both engines and look at the body before choosing.
- Follower question card: overlay `style: "question"` {text, label, y, w, size, accent}, timed by `from_words` (a list
  of alternatives: the question read aloud, else the answer's first words), stays until the next question.

## Series "news" - anchor parody (curly red wig), news-1 2026-10-18, "almost perfect"
- Set `_assets/news/studio.jpg` (world-map wall); anchor `person` scale 1.12, x 230, y 200; `cut.silence: false`.
- Opening = a layer: `"intro_video"` (Seedance clip, interpolated 24→30 fps or it stutters, ~1 s, dissolving over the
  live anchor - never a frozen frame) + `"intro_sound"` (his N12 music from its first hit, 7.46 s in). Hook within 1 s.
- Story pictures: overlay `style: image, behind: true` on the screen (x105 y352 870x490), timed to his words;
  `tag: "תמונת AI"` on realistic AI people. Lower third `style: band` "region | headline" at y 1500; ticker 1775;
  hook in the strip above the screen (y 262) for ~4.5 s.
- Voice "news" + `"denoise": {"rnn": "models/rnnoise/cb.rnnn"}` (took his AC hum away - he loved it); grade `smooth` 0.6.
- Never realistic images of real politicians at invented events; his own images stay out of git
  (`_assets/news/.gitignore`).

## Series "yuval" - conference keynote in ENGLISH (Harari parody, "Homo Useless"), yuval-1 2026-10-20
- `"language": "en"` (the Hebrew model TRANSLATES English speech); English subtitles run left to right by themselves.
- Voice preset **stage** (close mic + the hall's PA: big tail + `pa` slap echo slider) + bed `_assets/yuval/room.mp3`
  at 0.35. **Voice Pitch** slider (rubberband, formants kept): he mimics high voices; +1.5 st was the start.
- Audience ADMIRES him - amazed, never laughter, never a falling "ohh". Build crowd reactions as a stack (3-4 generated
  gasps, each pitch-shifted 0.94-1.04 and offset 0-60 ms, short echo, -14 LUFS - `crowd-gasp-stack.mp3`, "great").
  Applause during his last words; the video ends exactly on his last word (`cut.after_last_word` 0.1).
- Set: on-stage view with NO audience seats; the slide BAKED into the set photo (an image overlay doesn't follow the
  bg zoom); content where his head is not. Final `set5.jpg`: the photo's own screen edges, bg zoom 1.15 y 144, one big
  book on the right, BOOK LAUNCH tag + WORLD PREMIERE title + a made-up QR on the left. `bg_blur` 0.8.

## Eye contact (he called it perfect, 2026-10-17)
Default for a talking-to-camera video: `"eye_contact": {"on": true}` = NVIDIA Maxine + our blink handling
(`tools/eyes_nvidia.py`, key NVIDIA_API_KEY in zoomcut/.env, ~2 min per 90 s take); falls back to v6 by itself if NVIDIA
fails. A CapCut export next to the take (`<take>*eye*.mp4` or `"file"`) still wins. Off when he looks at a screen /
someone else (`offscreen-voice.md`).
