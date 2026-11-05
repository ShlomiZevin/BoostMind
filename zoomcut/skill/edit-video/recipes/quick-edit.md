# Quick edit - one person talking in short phone takes, joined tight (asaf-1, 2026-11-03)

**His words that mean this recipe:** "quick edit", "עריכה מהירה", "a simple one", or footage like Asaf's: one character,
selfie / phone app (TikTok, a face filter), many short recording segments, talking to someone off-screen. "These are
the most simple videos - almost nothing to edit other than putting the scenes together, background music and a POV
text." It must take minutes, in ONE round. Do not use another recipe's rules here (no "keep his pauses", no cut-out,
no set, no eye contact).

## What he wants (all of it, every time)
- **Tight and snappy**: every pause between sentences cut; the next sentence starts on top of the end of the previous
  one ("I rather one sentence start on top of the other ... than having these silences"). The video opens on his first
  word. Speed 1.15.
- **Only the last take** of a line he said several times (he restarts the opening until it's right).
- **None of the moments where he presses record / stop** (a reach to the phone, a frozen face, a click).
- **His gestures and acting stay** - only dead air goes.
- **Subtitles = his script** (he pastes it), corrected to what he really said; a line in the script he didn't film =
  tell him; an ad-lib not in the script = list it for him (he cut "וואלה, תיזהר עכשיו עם הרכב... אם לא").
- **A POV text** in his words, "פוב: ..." (asaf-1: "פוב: החבר המאוס הזה / שבכל דבר מוצא לך רק את הרע").
- **The character's own music bed** from the library (Asaf: `asaf, החבר המאוס` tags, A = paranoid caper), the
  other beds of that character as MUTED layers so he can swap.
- **No background**: the footage fills the frame. Never a studio / set picture.
- **Never export** - he looks in the editor (or on a phone page) and presses Send himself.

## Steps (in this order, no round trips)
1. Footage: the Drop folder (`gcloud storage cp "gs://boostmind-drop/<folder>/*.mp4"` if it hasn't landed). Count
   the files; TikTok-app names (`v1c044g...`) sort by name in recording order.
2. Transcribe each file (faster-whisper word times) and find the recording restarts:
   `ffmpeg -i <f> -vf "scale=144:-1,scdet=threshold=10" -an -f null -` -> `lavfi.scd.time` = each restart.
3. Project: `POST /api/new {name, folder}` (no `from`), then episode.json:
   `cutout: false`, `background` (the engine still needs one - it is hidden; tool bug), no `eye_contact`,
   `speed: 1.15`, `cut: {merge 0.2, pad_in 0.05, pad_out 0.1, join 0.3, after_last_word 0.15}` (silence cutting ON),
   `sequence` = one entry per recording segment, `from` just after the restart, `to` before the next, skipping the
   repeated openings; `overlays` = the POV (y 260, size 56, 0-5 s); `music` = the character's bed.
   captions.txt = his script per take (the repeated opening written as many times as he said it, so the aligner
   finds the right one).
4. Analyze through the studio, then in ONE pass before he sees anything:
   - the voice row: `node tools/setup_apply.mjs <id> voice podcast`; `node tools/mark_used.mjs <id>`;
   - the set layer hidden (`layer.update set {hidden: true}`);
   - the project speed 1.15 by op (episode.json speed does not carry over);
   - **pause audit**: for every piece, 10 ms voice levels; every quiet run >= 0.12 s between two words ->
     `cut.removes` (keep the next consonant: stop just before the level rises). Every piece that ends > 0.1 s after
     its last word -> `cut.edges` [[span end, word end + 0.05]] (span end = the VOICE item's end, which is the picture's
     end + `join`). Check a word is not clipped: transcribe the piece's last second before / after.
   - **flash audit**: no picture piece shorter than 6 frames (a click at a restart) - move its sequence `from`.
   - **subtitle TEXT fixes go into captions.txt** (the source) - never hand ops on subtitles to split / merge / reword
     (asaf-1, 2026-11-03: 28 hand-fixed subtitles + one drag = 113 subtitles, doubles everywhere). Hand ops on a
     subtitle only for its timing or place. The build now FAILS (red job, "! SUBTITLES:" lines) on two subtitles at
     once or a flash under 12 frames - fix the cause, don't patch around it.
   - **subtitle audit**: no two on top of each other, none shorter than 12 frames (merge with its neighbour), none
     that runs across a sentence end ("הטמבל? הוא יודע שיש" - move the one word back to the previous subtitle at its
     word time), every script word present, the first words of the video present.
   - muted music layers for the character's other beds (`/api/p/<id>/assets` + `layer.add` with `muted: true`).
   - the post caption saved (`/api/ep/<id>/publish {save: true}`), always #שלומיוורס.
5. Hand over in one message: length, which take of the opening, lines not filmed, off-script ad-libs (keep?), the
   music in use and the muted options. Optionally a phone page with the beds (claude.ai artifact) when he is away.

## ONE continuous take (sagi-1, 2026-11-05 - his words: "very sharp, good pace... it's one shot, but cut the
sentences I said twice, transcribe it so it's what I actually shot... nothing special, quite simple... 1.2, 1.3 speed,
it's very slow")
- **Speed 1.25** for a single-take selfie monologue (he finds 1x "very slow"; 1.15 is for many short takes).
- No restarts to find (`scdet` gives nothing) - the work is the **repeats**: transcribe with word times, find every
  sentence said twice (sagi-1: "לא ברכבת, לא באוטובוס, לא ברכב... בדיוק בזמן" at 55.9 s and again at 62.0 s), keep the
  LAST one, cut the first with `cut.removes` {take: [[before the first try, just before the retake]]}.
- **Subtitles = what he SAID, not the script he pasted** (he ad-libs a lot - "בשביל קופסת פח", "לא נוגע בעוגיות"):
  write the corrected transcript into captions.txt (both tries of a repeated line, so the aligner finds the kept one)
  and `captions_from: "file"` in episode.json - otherwise the Reader script overwrites it. Re-transcribe an unclear
  word on its span alone before writing it (ivrit-ai heard "לדוד" for "לזוז").
- **Pause audit in numbers** (the recogniser's word times are too rough for gaps): 10 ms RMS of the take, a quiet run
  under -34 dB of >= 0.14 s inside a piece = a pause -> removes with 0.04 s margins (sagi-1: six of 0.15-0.45 s; the
  engine's merge 0.2 left them because the room noise sat above its threshold). The video opens on his first word:
  `cut.edges` [[piece start, first word - 0.08]].
- **A project made before filming (stand-in) is reused**, not remade - but its layer props stay (rule: props are never
  overwritten): `person` -> `cutout: false` + full-frame box, `set` hidden, the end card moved to the new end
  (`pin: end` does not follow a rebuild that shortens the cut), every bed's `dur` = the new `duration`.
- **Music with `own_pace: true`** on every bed: the 1.25x would otherwise speed the music up too. A 1-minute track
  covers 75 s of timeline at 1.25 - one item, no loop needed. The character's beds + any game music of his = muted
  layers, one per option, levels matched by LUFS (gain = known bed's gain x 10^((its LUFS - this LUFS)/20)).
- Measured: 87.6 s take -> 13 pieces, 55 s at 1.25 + a 4 s end card.

## Measured on asaf-1
Two files (95 s + 30 s, 14 recording segments) -> 74.5 s at 1.15. His notes after the first tight cut were ALL
pause-audit items (four 0.16-0.19 s pauses, three 0.3-0.5 s tails) plus one off-script line - the audit above
finds them before he does.
