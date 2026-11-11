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

## 3. The build (a script that writes ops - keep it in the scratchpad, rerun it each round while he hasn't touched the clips)
- One list of lines in order: `who, take, a, b (take seconds), set`, placed after the one before with `over` (seconds
  before it ends - 0.7 a normal turn, more for a tango), or `with_=(back, s)` = at an earlier line's start + s (parallel
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
  framing of a set (he fixes ONE clip's set - copy that box to every clip of that set), his texts. Before each rebuild
  read `work/history/log.jsonl` since your last rev: only notes / volumes / speed = safe; clip edits = targeted ops instead.

## 4. After every build - the checks (all must pass before you say "ready")
- no two clips overlap on one row; every group's clips have the same from/dur;
- **no strip frame points at a row with no clip** (that played as "broken and stuck");
- no shot < 1 s, no subtitle < 0.4 s; no clip starts > 0.3 s before its first word / ends > 0.2 s after its last;
- the one-line report: length, lines, cut-aways, what you couldn't do.

## 5. His rounds of notes
- `node tools/notes.mjs <id>` → fix every note → `... done <id> "<Hebrew: what changed>"` (earlier rounds' greens clear
  themselves). Reply to him in English, note by note, "F5".
- When he says he's testing ("don't export, don't test yourself") - no stills, no exports; build, check by numbers, hand over.
- Late rounds ("almost perfect, don't ruin it"): targeted ops on exactly the clips his note names (strip items, one
  group's from/in/dur, one clip's gain) - no rebuild; re-run the checks; a strip change must not expose a cut or a hole.
- Every rule he states "in general" goes into SKILL.md the same turn, committed.
