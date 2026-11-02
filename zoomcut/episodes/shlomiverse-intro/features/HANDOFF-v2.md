# Trailer 2, version B ("the joke ending") - handoff

Version A is done: editor project `shlomiverse-features` ("שלומיוורס - מה אפשר לעשות"), 6 layers (picture, music, Hani
voice, Gilad voice, Star sound S5, Whooshes T4). Built by `comp_sd.py` with `features/hook-float.json`; the command is in
the last commits ("v20"). Read `memory/feedback_trailer_lessons.md` first - every rule there cost a round.

## Shlomi's idea for B (2026-11-02)
Same trailer, on a COPY (new project, e.g. `shlomiverse-features-b`; never touch A):
- Gilad's pane in the hook says a "you always run ahead" line instead of "אותי מעניין מה הביזנס" - from gilad-joins:
  - "חכה רגע, חכה רגע, לפני שאתה רץ" 5.58-7.92 s, or the full "...אני מכיר אותך, אתה כבר רץ" to 10.32 s
  - (`public/wiki/v/gilad-joins.mp4`; word times in `episodes/gilad-joins/work/transcripts/gilad_*.json` are in the take's
    own time - measure the published video's audio, the transcripts' times drift ~0.2 s)
  - the Zoom view switches speakers - check frame changes before choosing in/vout (it switched at 17.01)
- At the very end, after the logo lands and the music dies (~17.5 s on), a beat of silence, then Gilad alone, dry:
  "אותי מעניין מה הביזנס." (15.62 soft "או" - 17.055; Amir's "טוב" starts 17.06). Maybe his small pane again, or voice only.

## How A is wired (so B can reuse it)
- `python comp_sd.py --name <n> --prefix shlomiverse-features --story-only --slow 0.6667 --hook features/hook-float.json
  --features media/cards4 --card-in 0.5 --card-out 0.4 --slots 5.15,6.4,7.65,8.9,10.15,11.4,12.65,13.9
  --tag 'יש פה יותר מסרטונים' --space --bio --approach --smooth-end --sheen --sfx music/sfx-shimmer.mp3 --sfx-vol 0.55`
- hook-float.json: each clip has `in/out/vout/at/lead` (voice at `at`, picture from `at - lead`), `keys` (hover path,
  absolute seconds: cx cy sc ry rx rz a g z), `echo`, `pan`, `presence`. Title: `title_at/title_out`, `star_at`.
- Editor layers are split files in `Downloads\shlomiverse-features` (picture.mp4 without sound, music.wav ducked under the
  voices, voice-*.wav = out/hook-*.wav, sfx-*.wav). A new picture = upload `picture.mp4` again (same asset id).
- The 4:5 post and the star sound effect were rejected; he exports himself (Send).

## Version B - editor project `shlomiverse-features-b` (v2 after his notes, 2026-11-02)
- `features/hook-float-b.json`: Gilad's pane = gilad-joins 6.00-8.95 "חכה רגע, חכה רגע, לפני שאתה רץ להציג לי דברים"
  (measured on the published video: "אמיר, אמיר" 4.9-5.85, חכה from 6.06, a clean dip 8.95-9.15 before "אני, אני
  מכיר אותך"; the Zoom view stays on Gilad from 4.9 to past 12.5). `at` 0.69 so his voice starts at 0.75 s as in A;
  A's arrive / come-to-front keys, then ONE slow continuous spin into the planet 1.4 -> 3.95 (v1 held him still to
  2.5 and then pulled him in fast - "slower, floating in space, like A").
- The punchline: a third clip 15.56-17.055 "אותי מעניין מה הביזנס." at 15.27 (speech 15.33, on the logo's landing),
  with the trailer's space echo, voice only (his note: "שומעים את זה בחלל"). v1's dry line after the silence with a
  pane out of the planet was replaced. Length back to A's (19.42 s, beats-A3.json).
- Music = A's own music.wav with a -5 dB dip 2.0-3.85 (under Gilad's longer line) and -6 dB 15.05-17.2 (under the
  punchline). Ducking it by the voices (comp_sd's sidechain, ratio 9) buried the music until 3.8 s - his note "the
  music should start from the beginning like A".
- Picture = the new hook frames 0-95 (comp_sd `--name b2 --hook features/hook-float-b.json --preview 0..95`) joined
  onto A's media/picture.mp4 from frame 96 (4.0 s on, A and B are the same picture) - no full render needed.
- Layer files: `Downloads\shlomiverse-features-b` - voice-gilad.wav = out/hook-1.wav from 0.6667 s (item at frame 20),
  voice-gilad-end.wav = out/hook-2.wav from 15.2667 (frame 458).
- v3 (his notes): the punchline item gain 0.8 and its echo about half (aecho 0.19|0.13|0.08|0.04, made straight with
  ffmpeg from gilad-joins - same chain as comp_sd otherwise); the words on a `lyric` text layer "Gilad words (end)"
  (Assistant 800, warm white + "הביזנס" in the logo's orange, y 330 above the logo - nothing else there), words at
  15.33 / 15.57 / 16.28 / 16.47. Music: no fade-in - out/mix-b2.wav (slowed + shimmer) with the track's own swell
  lifted to the body level from its first note (0.45 s; before it the track is silent) and an even -6 dB dip under
  the voices to 3.85 s and under the punchline, instead of comp_sd's hard ducking.
- The phone test (15 fps) ends a `lyric` line at half its length - styles.tsx uses `it.dur / 30`; the editor and the
  Full export (30 fps) are right. A tool fix for later.
