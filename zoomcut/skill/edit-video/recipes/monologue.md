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
- **His rule for re-takes that overlap** (tadar-5): every take plays from its own start; when its last sentence(s)
  open the next take too, cut it in the gap before them and use the NEXT take's version. Find the overlaps in the
  transcripts first, then `"sequence": [{"take", "to"}, ..., {"take"}]`.

## Series "tadar" - spiritual-guru podcast parody (white bob wig, podcast mic), from 2026-10-17
- `lesson.py new episodes/tadar-N --from tadar-2 --input "<folder>" --takes IMG_xxxx.MP4 --script <reader id>`.
- Set `_assets/tadar/studio.jpg` (warm podcast studio), music `_assets/tadar/music.mp3` at 0.3, voice "podcast", eye
  contact on, grade warm 0.07 / sat 1.1, clean white Assistant subtitles, person y 200.
- The mic in front of him: `"keep": {"<take>": {"boxes": [[x0,y0,x1,y1]]}}` (fractions) keeps it from the real footage.
  On tadar-4 (black top + mic) RVM dropped the torso and the mic - MediaPipe "fast" kept everything: matte 4 s with
  both engines and look at the body before choosing.
- Follower question card: overlay `style: "question"` {text, label, y, w, size, accent}, timed by `from_words` (a list
  of alternatives: the question read aloud, else the answer's first words), stays until the next question.
- **She "explains" with stickers** (tadar-5 / spiritual-3, 2026-10-21 - his idea: it should look like she put effort
  into her video): Leonardo die-cut stickers in `_assets/tadar/spiritual-3/` (pills, a mosaic with a red X, a peak at
  sunrise, a glitter handwritten פ with an inward spiral, soil with a rising light, a head made of particles), each an
  image overlay with `"pop": true` (springs in, shrinks away - Entrance in its panel) around her head at y ~230-650,
  timed by her words. A quoted verse = an empty scroll sticker + her exact words as text on it (Stam, black, no box)
  with the source under them ("(בראשית ב׳, ז׳)") - her (wrong) version, the real source: that gap is the joke; the
  card sits over the mic, below her chin.
- **Her logo** (logo_2_morningstar, round, transparent PNG) hangs on the woven wall circle via `"sign"` (quad
  [[443,62],[631,67],[631,303],[443,308]] in studio.jpg = the hoop squashed for the wall's angle, right side a touch
  shorter). Centred behind her the wig hid the name, so the room is framed with the hoop beside her head:
  `bg` zoom 1.45, x 315, y 432 (crystals + salt lamps fill the left). Stickers on the right pop over it - fine.
- Footage 3 (2026-10-21): light-blue top against a white wall - MediaPipe "fast" held fine; the real mic stays.
- **Her site: https://boostmind-b052c.web.app/ayelet/** (`public/ayelet/`, on the bio hub). Deliberately 2009: a
  real `<marquee>`, WordArt glow, beveled buttons, guestbook, angel visitor counter, harp music button, the stickers
  floating. Sections from the scripts: videos, workshop "מעבר לתדר", treatments + prices, Q&A, מילון התודעה, her
  misquoted verses on the scroll sticker. A new tadar video: put its export in `public/ayelet/v/` and replace the
  "בקרוב" tile; new etymologies / questions go in the dictionary / Q&A. In the video: ticker "האתר החדש שלי
  באוויר!! הלינק בביו" + a blinking gold box over the mic (y 1170) for the last ~15 s.
- **End card** (he loved it, 2026-10-21): her Leonardo studio portrait (flare, from his profile photo) as a polaroid
  on a 1080x1920 card in the site's look + logo + "האתר שלי באוויר!! / הלינק בביו" - made as HTML, shot with headless
  Chrome at 1080x1920, saved to the project's `media/poster.jpg`. In the video: `"inserts": [{take: <last>, at: <just
  before the last piece ends>, seconds: 4.5}]` holds her last frame, a full-frame image overlay (`poster: true`) starts
  at the hold's timeline second (edit.json: the hold item's frame / 30), ticker and CTA end just before it, and
  `music.lift` {db 8, fade 1.2} swells the harp once she stops.

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
  Now `set6.jpg`: the same, saved at 2x with a REAL QR to the book page (segno, error L) - it decodes from a still
  frame even at half size. Make sets with small detail at 2x (bg_place covers the frame the same way).
- **Never the real person's name** (he does not want to be sued): the character is **Yuval Know All Harari** (Hebrew
  hook: his own "יובל (כסא) נוח הררי" - keep his wording). No real book titles (Sapiens / Homo Deus), and no
  "parody" anywhere - it plays as a real author with a similar name.
- **Something outside the video (a site, a product) needs a loud CTA** - viewers don't leave TikTok, and a QR can't
  be scanned on the phone they watch on. The hook hands its top slot to a gold CTA box for the last ~5 s ("הספר
  באמת קיים 😳 / הלינק בביו ⬆️"); the bio hub (/links/) gets a button; caption + pinned comment carry the URL.
  Overlay start/end are timeline seconds (before speed); `--still` takes output seconds.
- The book site: `public/homo-useless/` (boostmind-b052c.web.app/homo-useless) - publisher-style page, pre-order
  opens a joke (nothing collected).

## Series "crypto" - crypto-guru parody ("the coin that will go up yesterday"), crypto-1 2026-10-21
- Set `_assets/crypto/set.jpg` (night penthouse, trading monitors, gold bull, cash) at bg zoom 1.12 y -60; trap bed
  `music.mp3` (he REJECTED it - he brings an energetic TikTok track). Effects he wants: ka-ching on every "95.4", a bill
  counter under counting lines, money raining on the last big number. Rejected (`rejected/`): the Leonardo riser, coins,
  scratch. Each hit's ATTACK (not the file start) on the recogniser's start of the word - `start_offset` = -attack;
  hits ~5 dB under his voice, beds ~10 dB under. Mixkit (mixkit.co, free license) for real library sounds.
- A soft last word under the voice threshold gets cut ("שלשום"): measure the tail and add a `cut.edges` drag.
- His wall had a black hexagon panel touching his hair: no matte engine drops it (hair is as flat and dark) - left.
- The coin line = a **Market panel** (`style: market`) timed by `from_words` "קחו למשל את" .. "ביום אחד"; `draw` 3.4
  holds the chart so the peak + the "ההמלצה יצאה" pin land on his "95.4" (with the ka-ching) - the pin after the rise is
  the joke. His footage is a close handheld selfie: the panel goes on TOP (y 150 w 780, over the hook), never over his
  face; person y 160. Hook (his words): "אף אחד: / נאור (ציון) ברוך:" the whole video.
- Anchor sounds to the recogniser's words (`start_word` / `end_word`), not `at`; its times run ~0.15 s early - check
  the energy. A first word timed before the clip start is not "heard" for overlays: anchor on the next words.
- Ticker of coins "up yesterday"; lower third "VIP | הקהילה הסגורה". His real name only as he writes it in the hook.

## Eye contact (he called it perfect, 2026-10-17)
Default for a talking-to-camera video: `"eye_contact": {"on": true}` = NVIDIA Maxine + our blink handling
(`tools/eyes_nvidia.py`, key NVIDIA_API_KEY in zoomcut/.env, ~2 min per 90 s take); falls back to v6 by itself if NVIDIA
fails. A CapCut export next to the take (`<take>*eye*.mp4` or `"file"`) still wins. Off when he looks at a screen /
someone else (`offscreen-voice.md`).
