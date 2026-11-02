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

## Version B - built 2026-11-02 (editor project `shlomiverse-features-b`)
- `features/hook-float-b.json`: Gilad's pane = gilad-joins 6.00-8.95 "חכה רגע, חכה רגע, לפני שאתה רץ להציג לי דברים"
  (measured on the published video: "אמיר, אמיר" 4.9-5.85, חכה from 6.06, a clean dip 8.95-9.15 before "אני, אני
  מכיר אותך"; the Zoom view stays on Gilad from 4.9 to past 12.5). `at` 0.69 so his voice starts at 0.75 s as in A;
  the arrive / come-to-front keys are A's; he recedes into the planet 2.5 -> 3.95 (the line is 1.2 s longer).
  The pane's burnt-in subtitle reads "אמיר, אמיר, חכה רגע." for its first second (it's the published video's).
- The punchline is a third clip: 15.56-17.055 "אותי מעניין מה הביזנס." at 19.34 (speech 19.41), `echo: ""` = dry,
  centre; its pane comes out of the final logo's planet (540, 866) at 18.85, hovers, goes back in by 21.8.
  `beats-A3-b.json` = A3 with duration 17.03 -> 21.95 s (the music file's length; the music is silent from ~19.0).
- `hook-float-b-nopane.json` = the same without the punchline -> the base picture; the with-pane render is a
  second picture layer "Gilad pane (end)" from 18.833 s (hide it = voice only).
- Command: as A's, with `--name b1 --beats beats-A3-b.json --hook features/hook-float-b.json` (and `--name b1np
  --hook features/hook-float-b-nopane.json`). Layer files: `Downloads\shlomiverse-features-b` - voice-gilad.wav =
  out/hook-1.wav from 0.6667 s (item at frame 20), voice-gilad-end.wav = out/hook-2.wav from 19.3333 (frame 580),
  music.wav = out/mix-b1.wav ducked by the three voices (comp_sd's sidechain settings).
