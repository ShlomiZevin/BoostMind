---
name: make-songs
description: Make a song or a music clip in Sketch Studio (c:\workspace\BoostMind\zoomcut) from an existing song plus Shlomi's own words - the backing without its singers, the words on screen in the Karaoke tool for recording, his (and his family's / friends') sung takes as editor layers with effects, a lyric-video look over a poster, an optional techno beat, credits. Use whenever he says new words for a song, parody, chorus with my words, karaoke, record a song, make it a song, music clip, lyric video, "זוט חני", or wants to sing over a track. Read together with the edit-video skill (the editor, its rules).
---

# make-songs - his words on a song, as a clip in the editor

Born on "זוט חני" (2026-10-29, project `zot-hani-karaoke`): the chorus of a real song, his new words, 8 phone takes
(girls and boys), Hani's purple poster, a Techy-Tech credit. He called the editor "a powerful tool" - this skill is
how to use it for songs. **Reply in English; Hebrew only inside the video.** Everything goes into the editor as
LAYERS (his words: "put all as layers on the editor tool, don't create one file") - read the edit-video skill's
rules first (one editor, ops through the studio with the rev, never export on your own, check `GET /api/jobs` busy
before any heavy job, commit only your files).

## What he means (each one cost a round)
- **"The chorus of the song with my words" = the ORIGINAL song**, its backing and tune. Never a new song from Eleven
  Music (I made four; he: "are you stupid? ... not you go and create new songs"). Eleven Music only when he asks for a
  new song.
- **Never make the original (real) singer sing new words** - no cloning / imitating her voice. The new words are
  sung by him and his people (or a stock library voice if he asks).
- **The words on screen = a lyric video, not karaoke**: "a word here, a word there, fade in, fade out... a cool video
  clip" (the `lyric` text style). The `karaoke` style (fill as sung) exists, but he found "karaoke" confusing.
- **His takes are already on the beat**: one WHOLE take per layer, never cut into lines ("each track is exactly on
  the pitch, no need to cut").
- **Don't change his voice**: no pitch correction / resynthesis (my WORLD tuning = "terrible", twice). Effects only:
  echo, room, light compression / de-ess, his speakerphone filter; quieter than you'd think; he wanted the boys
  louder than the girls.
- **He trims the clip himself** (a timeline note "שיתחיל מכאן", End here) - follow his marks, never undo them.

## The workflow
1. **The song.** His file (Downloads). Stems: `vocal-split\.venv\Scripts\python.exe -m demucs --two-stems=vocals -n
   htdemucs -o <out> <song.mp3>` (local, ~1 min) -> `vocals.wav` + `no_vocals.wav`. The backing = `no_vocals` cut to
   the part he wants with a few seconds of lead-in (`ffmpeg -ss <start> -t <len>`, fade out). Measure the tempo from
   the kick: `tools/song_beat.py` prints it (librosa's beat times were 2% off on "זוט חני" - 135 vs the real 138).
2. **Record.** The Karaoke tool (studio rail -> Karaoke, `public/karaoke`): choose the song (the part with the
   lead-in), **Add the words** (one line per row; Time the lines = tap Space as each line starts, or `[m:ss.cc]`
   before a line), they show big on screen while he records, pinned when there are many tracks. **Every take is
   copied to `Downloads\karaoke\<song>\<track>.wav`** (song-aligned, sample 0 = the song's start) - that's how you get
   them. His phone (the Drop, `Downloads\drop\<folder>`) sounded far better than his Yeti on the PC: the Yeti clipped
   (Windows input at 100) - the meter must stay out of the red; first check `peak` / clipped samples on any take.
   Clean = RNNoise in the Karaoke tool (in sync, measured).
3. **Takes -> layers.** `python tools/song_takes.py <project> <ref vocal> <ref at> <takes...>` (`--dry` first): each
   take's offset against what they sang along to (5 ms), girl / boy by pitch, its words (Whisper) - then one audio
   layer per WHOLE take with the live chain (natural voice, low cut, comp 0.4, de-ess, room 0.38, echo 0.6, clean
   mild). Tell him which lines nobody sang (the "זוט חני" takes stopped 8 s early - the clip ended there by his cut).
4. **Words on screen.** `python tools/song_words.py <project> <lead take> <its clip time> <lyrics.txt>` - Whisper's
   word times on the clearest vocal -> one `lyric` item per line (`" / "` = a row break, `*word*` = big pink accent),
   boxes alternating right / centre / left with flipped tilts. Then place each line where the picture is free (a
   face never covered) and vary sizes - stills to check (`render` -> the stills script in step 7).
5. **The look.** A poster / picture of the character as the background, gently alive: `anim` scale 1.04 -> 1.10
   over the clip, a slow sway (x +-14 px / 9 s, y +-8 px / 13 s), a 1.6% pulse on each beat. The font from the
   poster's own lettering: a brush-graffiti title = **Rubik Spray Paint** (`fonts/`, the studio's font list; free
   Google fonts with Hebrew in that family: Rubik Dirt, Wet Paint, Marker Hatch). Never gradients.
6. **Beat (optional, he liked it):** `python tools/song_beat.py <backing> <out.wav> --at <clip time of its second 0>
   --project <id>` - kick / hat / clap on the song's grid, a "ביט טכנו" layer at ~6 dB under the music.
7. **Credits / notes as designed pictures** (HTML + headless Chrome -> transparent PNG at 2x, one image layer each):
   for a Haredi character - deep navy, a gold double frame, diamond corners, Frank Ruhl Libre; "בס״ד" small in the top
   corner; the credit opens big over the picture (~1.5 s) and glides into a corner (image `anim` x / y / scale /
   opacity); a women's-voices note when women sing ("קולות הנשים בשיר – קול ממוחשב (AI) · בהיתר ובהסכמת הרבנים" - his
   wording, 2026-10-29). A plain pink pill was "terrible" - design it.
8. **Check before he hears it:** stills of the opening, a busy line and the end through the export's own composition
   (bundle `render/src/index.ts`, `renderStill` the `Layers` composition with `{project, urls, mode: 'full'}`);
   the stems' loudness (`work/public/layers/stems/*.wav`, ebur128: lead vocal ~4-5 dB under the music, the beat ~6).
   He listens in the editor - never export unless he says "send".
9. **Send** = his word only: `POST /api/ep/<id>/export {send: ["telegram"]}` when `busy` is empty (and after any
   change you made - a sound swapped during an export is NOT in it; export again).

## What failed (don't repeat)
- New songs from Eleven Music when he meant his chorus; TTS + WORLD "singing" on the original melody (robotic, he:
  "terrible"); the ElevenLabs voice changer on a synthetic sung guide (garbled words, lost the tune - it works only on
  a REAL sung take); WORLD pitch-tuning his real takes; cutting takes into line pieces; a karaoke wipe when he
  wanted a lyric video; Assistant font (not "cool enough"); a pink pill credit; librosa's tempo.

## Tools (all in zoomcut/tools, numpy + ffmpeg + the studio's API)
- `song_takes.py` - takes -> whole-take layers (offset, girl / boy, words).
- `song_words.py` - lyrics -> timed `lyric` items.
- `song_beat.py` - the song's tempo / first beat -> a techno beat (+ layer).
- `elevenlabs.mjs` (choir, voice changer on HIS takes), `elevenlabs_music.mjs` (new instrumental beds only).
- Text styles `lyric` / `karaoke` - `skill/edit-video/layers.md`.
