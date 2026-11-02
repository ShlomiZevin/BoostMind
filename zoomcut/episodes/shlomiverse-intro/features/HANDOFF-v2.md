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
