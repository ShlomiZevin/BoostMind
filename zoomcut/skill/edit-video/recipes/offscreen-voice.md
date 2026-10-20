# Recipe: one person + a voice we don't see (a Zoom at his desk, a phone call on speaker) - engine `lesson.py`

He acts to the other voice in one continuous take; the other voice is a sound layer laid over him.

## Series "security" - broken security guy at his desk, an off-screen Zoom voice (security-1, 2026-10-19)
- The camera stays on HIM the whole time - "WE ARE NOT SEEING THE ZOOM". No call screens / tiles / toasts.
- The props are the joke: `"keep": {"<take>": {"below": desk-edge y, "bright_in": [x0,y0,x1,y1]}}` (take pixels) keeps
  the real desk, mini keyboard and lamp-"mouse" in front of the new set (`_assets/security/office.jpg`).
- The other voice: `sounds` + `end_word` (its line ends where he reacts) / `start_word`; `"filter": "speaker"` =
  laptop speakers; overlap is wanted. Its subtitles: `captions` on the sound, blue, stacked above his
  (`captions_other: {color, y}`). Never open holds or reuse footage.
- Cut: pauses detected on the RNNoise-cleaned voice when AC hum sits near a quiet voice (`above_floor` 28,
  `voice_above_floor` 38); light trims (`pad_out` 0.35) - his faces live in the pauses; `keep_pauses` where the other
  side talks; `lead_in` 1-2 s before his first word; `end_at` = a hard cut mid-word on the punchline. Eye contact OFF.

## Series "gym" - a phone rant in a busy gym, Sigal on speaker (gym-1, 2026-10-20, "perfect")
- Set `_assets/gym/` + bed `bed_crowd.mp3` (chatter, weights, grunts; NO treadmill - he is not on one; music soft as
  from ceiling speakers) at 0.45 + one-shots every ~5 s (sfx_rack / sfx_drop / sfx_plates / sfx_grunt) under his
  speech. No beep (he hated it). Voice preset **hall** (sound.ts room reverb; Room / Room size sliders).
- Cut for a phone rant: continuous - merge 0.15, pad_out 0.15 (the word's tail rings under the next), join 0.18.
  Cut-out RVM "quality" (fast kept the black wall hexagon and dropped the phone). 3 takes in a `sequence`; subtitles as
  SAID ("רגע רגע רגע רגע", "סיגל נשמה"), frozen with `"captions_from": "file"`.
- **The other side of a phone call on speaker (Sigal - perfect after 6 rounds):**
  - NOT a continuous mumble under him, NOT a clean voice, NOT too quiet. A FEW placed lines (5 in 31 s), each
    0.8-1.1 s, at the END of his sentences where he drops or pauses, running a little into his next words (he cuts her
    off): as the video opens (mid-sentence), before each "רגע רגע", in his listening pause, between takes.
  - Source `_assets/gym/sigal-mumble.mp3` (= the demokratovich wife-call mumble he likes); each line a different phrase
    (`from`/`to` = seconds of the PROCESSED sound - after pitch / tempo - voiced runs only).
  - `"filter": "speakerphone"` (8 kHz line, small-speaker honk, codec crunch, short bounce), `"pitch": 1.25`,
    `"tempo": 1.15` ("cartoon but real"), `"room": true` (the same room as his voice), gain 1.9 (2.4 in his pause) →
    5-8 dB under his voice. A phone voice needs 150-250%: the Volume slider goes to 300%.
  - Measure, don't guess: fx.wav vs voice_dn.wav dB over each line's window (`work/public/`).
