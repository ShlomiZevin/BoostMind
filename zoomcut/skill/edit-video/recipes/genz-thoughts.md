# Recipe: Gen Z thoughts - a stare + her inner voice, cinematic (genz-1, 2026-10-20, 12 rounds, "almost perfect")

He films the Gen Z girl (black wig) silently staring while someone talks to her; then records her thoughts as voice
notes, and the person talking as separate recordings. Start the next one from genz-1:
`lesson.py new episodes/genz-N --from genz-1 --input "<folder>"`, copy the voice notes into the project's `media/`,
transcribe them, and lay everything as layers. Know the take second by second first (0.5 s contact sheet: where she
types, lifts her eyes, opens her mouth, drops the phone, snaps up).

## The scene
- A real-looking scene, not a Saw movie: her raw video (no person look, `"grade"` neutral) cut out onto a normally lit
  public set (`_assets/genz/store_lit.jpg` - she is the cashier; `"bg_dim": false`, `"bg_blur": 1.2`). Never a
  pre-darkened background - darkness comes from the filters.
- Filters as layers that fade in **when someone speaks to her** (`fx.times` start = his first word, `fade` 2 s):
  Movie colour 50, Darken 35, Vignette 35, Grain 12, Slow zoom 35, Handheld 20, Ghost trail 35. No shake / flashes /
  zoom kicks.
- Cut-out: matte engine `"body"` (quality for head and hair, fast below the chin - keeps the phone and hands).

## Timing (what he tuned over 12 rounds)
- Start on her typing (his marker - remove every frame of him starting the recording); typing sound (iPhone "tock")
  under it; his question right away; she looks up right after his last word: the braam and her first thought
  together on the look.
- Slow motion only after he speaks (cut `slow` from the look, 0.48x; 1x before so the typing matches her thumbs).
  Anchor the climax on the footage: "וואט" placed `at` the take time of her eye snap.
- Her thoughts 0.09-0.15 s apart; the last ones connected (after_prev ~0, each recording's breath / tail trimmed);
  the boom ON her last word (`end_boom` after_prev −0.6), black at the word's end, ~1.5 s of black.
- Her phone falling: a superhero-landing `impact` (boom 0.30 s into the file) on the frame it lands.

## Her thoughts (his voice notes)
- Cut on the audio envelope - whisper's word times drift ~0.4 s inside long notes: transcribe each voiced region on
  its own. Each thought: `filter: "echo"`, `echo` 1.35, `denoise`, `tempo` 1.1, pauses inside a line out with
  `skip`, `duck` −12, a soft `pulse` chime; `voice_bed` fills the gaps with the recording's own room noise.
- Text: overlay `style: "thought"`, `motion: "horror"` (slams in as said, grows to `grow` 1.45 once said, stays
  `hold` 1.4, dissolves word by word into atoms), black outline, size by length (84 / 74 / 64), box `w` 640 at x 540,
  alternating two bands (y 960 / 1330) with `overlap` - the next never lands on the one still dissolving; the thought
  right before the other person's line sits in the upper band so his subtitle (y 1450) is clear.

## The person talking to her
- His own recording, clear (no RNNoise - it ate his last word), `tempo` ~1.2 if it must end before her look, yellow
  subtitles (`captions` on the sound, `captions_other` y 1450).
- Later lines very slow and low (`pitch` 0.6-0.65 + `tempo` 0.5-0.8, echo 1.6), split into phrases placed between her
  thoughts - "את שומעת?" before "she physically spoke to me", "הכל טוב?" mid-way, the slowest "יודעת איפה החלב?" ending
  as she snaps ("אומייגאד, וואט?").

## Sound kit (synthesized - `tools/horror_sfx.py <dir> [names]`)
`_assets/genz/horror/`: hum (store tubes, from 0 until the black), riser (into the braam), braam (on her look), drone
(from the look, `until` the boom), heartbeat_climax (70→155 bpm from "אומייגאד", `until` the boom), stinger (on the
snap), whine (after it), end_boom, pulse. `_assets/genz/`: typing (iPhone), impact (no crackle - it read as TV
static), phone_drop, whoosh, pop. He liked the background sounds and effects as placed.
