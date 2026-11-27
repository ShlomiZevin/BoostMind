# A dialogue sketch from his takes - characters filmed apart, one at a time (selfie)

The method that worked. On savta-1 (2026-11-11, Savta & Lola + Avraham the son heard only) he called it "an amazing
session ... it went completely good", the day after a terrible one. Read the "Dialogue projects" rules in SKILL.md first
(overlap, real life not a play, never show the selfie start/stop, ≥1 s shots, the sound follows who is seen). This file
is HOW to get there. A worked builder: `dialogue-from-takes.example.py` (savta-1's - copy it, change the lists).

## 0. Before the footage (the script arrives)
- The Reader script first ("prepare first the reader so I can print"): `scripts/<id>.txt` + a printable A4 PDF in
  Downloads (each character in its own colour, directions grey, an unheard character's lines written in as directions
  so he knows where to pause; English runs in `<bdi dir="ltr">`). Then the project (new-from-script) so the Reader lists it.
- Lay on the timeline only what you MADE - sets (one per place, his camera's angle: close selfie, phone low), the music
  options, a room bed (TV), the hook. **No text-to-speech stand-in** (his rule). Groups come from his takes.
- Music: OUR OWN beds (the character's essence; his last brief for this pair: "suspicious, like a cartoon") - several
  options, each its own row, the same loudness (`volume = 0.3·10^((ref-dB)/20)`), one playing, the rest muted (the row's
  own mute - he toggles it). Every bed a ≤40 s loop through `tools/music_loop.py`; a quiet spot at the join is fine only
  if the body has the same rests (measure 20 ms RMS of the body vs the seam).

## 1. The footage
- The Drop folder is the name HE typed on the phone - often not the project id (`gs://boostmind-drop/<his name>/`);
  list the bucket when the project's folder is empty; copy down with gsutil. Voice memos come as `rec-*.m4a`.
- For every take: ffprobe (length, `creation_time` = his order), a contact sheet (who, where - fridge / salon), and
  **word timings** (faster-whisper `_get_model`, `word_timestamps=True`; Lola's English: run `language="en"` too) PLUS a
  **loudness map** (RMS per 0.05 s): whisper's word starts drift up to 0.5 s; the dB map is the truth for edges and silences.
- Map the script onto the takes: **a line said twice = the LATER take** ("if some words are in a later version, take it
  from the later clip"); keep his improvised lines (they are better); a scripted line in no take = tell him who / which
  / where in one line (savta-1: "תזכרו את השיחה הזאתי" never filmed - the scene ended on the take's last line).

## 2. Cut-outs without an Analyze layout
- Analyze a HIDDEN copy (`episodes/_<id>-takes`: episode.json with `input_dir` = his folder, an empty project.json) through
  the studio (`POST /api/p/_<id>-takes/build {action: "analyze"}`), never the real project. It makes each take's
  `preview` / `fg` / `matte` / `audio`; re-run it when more takes land (only the new ones are made).
- Hard-link those files into the real project's same paths and `asset.add` the take assets (keep his `mark` / `note`);
  `node tools/mark_used.mjs <id>` after; an unused take gets a note ("earlier take of X - Y is in the video").

## 3. The build - FIRST `tools/fast_cut.py <project> plan.json` (SKILL.md "FAST CUT", 2026-11-25): the lines in
order (who, take, a, b), it cuts the silences, joins, overlaps the turns, builds the groups + the strip + the subtitles and
checks all of section 4. Write a builder script (below) only for what it doesn't do (off-screen voices, parallel talk,
a phone call, music).
(The older way - a script that writes ops - keep it in the scratchpad, rerun it each round while he hasn't touched the clips)
- One list of lines in order: `who, take, a, b (take seconds), set`, placed after the one before with `over` (seconds
  of WORD overlap: 0.1 at playback speed - his number since 2026-11-18, SKILL.md "THE OVERLAP"; word edges, not clip
  edges; more only for an interruption), or `with_=(back, s)` = at an earlier line's start + s (parallel
  talk, an off-screen voice dropped into a pause). `pieces` = a line cut into spans (silences ≥ 0.4 s out).
- Each piece = a group: video + its set + voice (+ subtitles), one `link`, same from/dur.
- An off-screen character (the son): its own voice row (group = his name, a little room on the voice, `tempo` 1.2 when
  he must fit a gap), its own subtitles row in a clearly different colour; never a picture.
- Background talk (Lola on the phone through Savta's opening): each phrase ONCE (repeats get noticed), spread evenly
  (~every 4 s), quiet (0.3) when unseen; some seen (whole clip, loud, `duck: -2` on the other's row), some only heard;
  start it after the hook line, not on frame 0; her "bye" lands on a word of the other's.
- The strip, computed: one seen line = that one; two at once = whoever starts a SENTENCE last; cut-aways on top; the
  other character over every cut between two pieces of one person; ≥ 1 s a shot (a short run joins the one before only
  if that one still has picture); the last second on whoever has the last word.
- Subtitles from the heard words (fix the mishears; per-take fixes for what whisper merges/splits - "לא, לא, לא," was
  "לא, לולה,"): a new subtitle at `.?!`, at a comma once it has 3 words, or at 4 words; a 1-2 word end joins the
  subtitle before it (no flashes). One subtitles row per character, each its colour / height, so parallel talk reads.
- **Keep what he set**: read the project first and carry every row's props (volumes, mutes, cut-out on/off, speed), his
  framing of a set (he fixes ONE clip's set - copy that box to every clip of that set: x, y, w AND h by the picture's proportions - an item.update box MERGES, so an old h stays and squashes the picture; frankfurt-flight 2026-11-27, three clips came out stretched), his texts. Before each rebuild
  read `work/history/log.jsonl` since your last rev: only notes / volumes / speed = safe; clip edits = targeted ops instead.

## 4. After every build - the checks (all must pass before you say "ready")
- no two clips overlap on one row; every group's clips have the same from/dur;
- **no strip frame points at a row with no clip** (that played as "broken and stuck");
- no shot < 1 s, no subtitle < 0.4 s; no clip starts > 0.3 s before its first word / ends > 0.2 s after its last;
- the one-line report: length, lines, cut-aways, what you couldn't do.

## What cost extra rounds on savta-1 (13 rounds of notes) - get these right in the FIRST cut
- **Turns back to back** -> he asked for overlap; then "more tango"; then "real life, not a play". (Superseded 2026-11-18:
  turns = 100 ms word-to-word overlap, SKILL.md "THE OVERLAP"; the old "0.7 s / 1.3 s" counted clip edges.) an off-screen voice laid over (tempo 1.2) - never a pause opened for anyone.
- **His selfie start / stop showed 4 times** (a head padded to fit a voice, a tail extended to close a gap, a take's
  first second, a pre-roll added to close a gap). Look at the frames of every head and tail you use; ≤ 0.3 s / ≤ 0.2 s.
- **The strip broke 3 times** (a frame pointing at a row with no clip = "stuck"; a 0.1 s flash; two of Lola's pieces in
  a row). Run the §4 checks after EVERY change, a one-op tweak too.
- **Background talk took 4 rounds** (all the way through -> start later -> no repeats -> spread evenly, some only heard).
  Do all of that the first time.
- **Joins he tightened again and again**: cut each clip to the measured word edge (dB, 25 ms steps), not whisper's times.
- **Mix**: the seen character's dip on the other was too strong (-6 -> -2); Avraham needed his own colour of subtitles.
- **A set's framing took 3 rounds** ("closer to the fridge") until he set one clip himself - offer that early: "set one,
  I'll copy it to all".
- **Subtitles**: mishears in the script's names ("לולה" heard as "לא לה" / "לא, לא") and words ("שתאכל היא") - compare the
  heard words to the script line and fix what differs; no 1-word flashes.
- **"A nostalgic filter"** meant only a light yellow wash (old TV), not grain / vignette: a full-frame shape row, warm
  yellow, opacity ~0.06. When a look is vague, start with the lightest, simplest version.

## 5. His rounds of notes
- `node tools/notes.mjs <id>` → fix every note → `... done <id> "<Hebrew: what changed>"` (earlier rounds' greens clear
  themselves). Reply to him in English, note by note, "F5".
- When he says he's testing ("don't export, don't test yourself") - no stills, no exports; build, check by numbers, hand over.
- Late rounds ("almost perfect, don't ruin it"): targeted ops on exactly the clips his note names (strip items, one
  group's from/in/dur, one clip's gain) - no rebuild; re-run the checks; a strip change must not expose a cut or a hole.
- A gap in one person's picture is never closed with more of the take's head / tail (he saw himself starting the
  recording - "just continue the video, don't add things; at most one finishes after the other"): move the next clip
  up, or let the other character cover it.
- A cut inside one person that can't be hidden feels like a jump - if he says so, put that silence back (cut fewer).
  Moving one line = move everything after it by the same frames (not the loops - they just end earlier).
- Every rule he states "in general" goes into SKILL.md the same turn, committed.

## A phone call - one character on screen, the caller full screen or in a small window (haredit-6, 2026-11-15)
Hani at the office + her mother calling from the ward, each filmed alone (his last word on it: "it's perfect now").
Worked builder: `call-from-takes.example.py` (the cut, the call, the strip, the window, the sounds, the checks; its
end = the targeted late-round fixes). What got it to "perfect" in 3 rounds - do these from the first cut:
- **Edges**: the PICTURE on the loud speech (peak -22 dB), walked out a little over soft sounds; a pause = a gap between
  loud runs at a word boundary - breaths (-37..-44 dB) are pause, cut them; never a cut that saves < 0.12 s (a tiny
  jump inside one take plays the picture off the sound). Never search for a "quiet first word" for the picture - it
  found noise and opened silence ("starts late").
- **His cut between two clips**: picture cut tight in the middle; the left clip's VOICE runs ~0.25 s past its picture,
  the right one's starts ~0.3 s before it, on two alternating voice rows (`voice`, `voice.2`) - every soft first word
  and last syllable is heard even when the picture edge is a little in (SKILL.md, his method).
- **Turns stick**: every turn overlaps ~0.6 s - in the call too.
- **The caller's voice is ONE voice per line**: a line she starts full screen = her room voice to its end, even while
  we already see the other; the phone / speaker filter only for a line wholly in the small window. The one on screen
  is never filtered. The ward beeps switch room <-> phone only where a line starts.
- **The small window** = its own rows (`pip.bg`, `pip.video`, `pip.frame`, `pip.tag`, group "<caller> בחלון קטן") -
  no character's rows, so the strip never hides them; its clips exist exactly where it shows, over the REAL listening
  face from the pauses he left in his call take (more listening from another pause of the same take if needed). Modes
  per line: whole line in the window / full screen / full then the window for her last words (the listener's face
  before the answer) / the window then full on her big moment ("יצחק! שטיי אויף!").
- **The caller's set from HIS camera**: a phone held low, looking up -> a low-angle set (ceiling, curtain track,
  monitor on its arm); her name as a pill on full screen and on the window, in the world's own way ("אמי מורתי פערל שתחי'").
- **Subtitles**: a row per character (her own colour) + a translation row for Yiddish, smaller, under hers; the two
  characters' subtitles never on screen together; none shorter than ~0.6 s - when an overlap squeezes one, move the
  other's start, don't flash it; plain spelling (Assistant draws vowel marks wrong).
- **Late rounds = targeted ops** (`cut(c0, c1, ...)` in the example): remove a stretch of the timeline -> everything
  after moves left, clips crossing it split into two groups (a new link) or shorten, notes and duration follow; then
  subtitles: a clip's end must never take its group's SUBTITLES with it (set each to the next one's start), and no
  0.1 s leftovers at a split. Check after each: the strip has picture everywhere, no overlaps on a row, no subtitle
  overlap / flash.
- **Round 4 (his last notes on haredit-6)**: the STRONGEST passage (the vort + her laugh) = one continuous clip, no
  silence cuts inside ("it's one of the strongest parts, it can't have jumps") - mark such a passage `keep` for its
  whole length from the first cut. Under the small window, ONE continuous listening moment (from the longest quiet pause
  of the call take), never two different ones joined ("she jumps between different waits"). A full-screen line of the
  caller is not cut to the window mid-sentence - stay on her to the end of the sentence, cut to the other on their first
  word. After merging clips, re-check the two voice rows (a merged voice can overlap the next one's pre-roll: move it to
  the free row, else end the earlier tail where the next begins).
- **"Jumps" he sees inside ONE clip** (haredit-6, the window over Hani): measure the export before touching the cut - a
  test export ONLY if he says so (no session exports, 2026-11-16 - else ask him to press "Test on my phone"), frame differences (gray 90x160) around his note: no jump inside the clip = the editor's preview
  stalling (two cut-out videos at once), the file is smooth; tell him to check it on "Test on my phone". **A voice
  glitch at a picture change**: the same take as two butted voice clips (split where the picture switched) clicks /
  repeats a few ms - one continuous voice clip per line (merge back-to-back clips of the same take whose source runs on).
