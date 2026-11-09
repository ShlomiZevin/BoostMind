# Dialogue editing - a row per character + "What we see" (plan, approved by him 2026-11-09)

A tool change for Shlomiverse Studio, done in its own session. Read first: `zoomcut/CLAUDE.md`, the `edit-video` skill
(`skill/edit-video/SKILL.md`, `editor.md`, `layers.md` - video, backdrop, "link and ripple"), `recipes/hani.md` →
haredit-5, and `episodes/haredit-5/work/cut.py` (what had to be built outside the tool). Load the `edit-video` skill.

## Why (his words, 2026-11-09)
Dialogue videos - characters filmed alone, each cut out on their own background, woven into a conversation (haredit-5:
Hani, Osnat, Yotam, ~80 takes). He wants them cut like films / series: hear the next one before seeing them, still hear
the previous one after the picture moved on. Today Claude's cut needs round after round of his notes; he wants to fix
it himself with a drag and see it at once. **Everything live - he changes, he sees it, nothing rebuilds.**

## What he approved (his model - build exactly this)
```
What we see  [ Hani      ][ Osnat        ][ Hani    ]   ← thin strip on top: who is on screen

Hani         [ video+bg ······· ]      [ video+bg ······ ]
             [ voice ········ ]        [ voice ······ ]
Osnat                  [ video+bg ············· ]
                    [ voice ············· ]
```
1. **One row per character** (Hani, Osnat, Yotam) - NOT a row per clip ("Hani 1, Hani 2" - he said no). All of that
   character's clips sit on their row.
2. **Each clip = its video + its background + its voice.** The voice is its own block right under the video.
3. **Drag a video → its background and its voice move with it. Drag a voice → only the voice moves** (earlier = we
   hear them before we see them; later = their last words run over the next picture). Trim a voice = only the voice.
4. **Nothing pushes anything else** in a dialogue project.
5. **"What we see" strip on top:** coloured blocks, one per stretch, naming who is on screen. Dragging the boundary
   between two blocks changes only who we see - no clip moves, no voice moves. That is how he makes J / L cuts.
6. **The first cut is built this way** and Claude fills the strip (J / L / straight per his rules below); after that
   he drags.

## Is it live? Yes - checked
- Every video item already points at the WHOLE take (`asset` = the take, `in` = where the piece starts) with the cut-out
  (`fg` / `matte`) made for the whole take - dragging an edge already pulls back footage live.
- The strip only decides which character row is drawn at each frame - a visibility choice in the Player, no processing.
- Processing only once per NEW take (its cut-out, its words), as today. Never a rebuild after a drag.
- The export (`pipeline/export_layers.py`) reads the same project and must draw the same frames: same strip, same
  per-clip backgrounds. Check editor vs export on stills.

## Today (haredit-5, for contrast)
- All people on ONE row (`person`, 99 pieces), all backgrounds on another (`set`, 99 pieces), not linked - dragging a
  person leaves its background behind. Voices already one row per character (`voice`, `voice.osnat`, `voice.yotam`).
- `edit.ripple: true` - every drag pushes everything after it.
- `link` exists; no sound-only drag, no "what we see".
- `backdrop` layer exists (`layers.md`): ONE image drawn inside every item of a target video layer, behind the person -
  but a dialogue needs a different background per clip.

## The build

### A. Project format (`layers.md`)
- Per character a group: `<char>.video` (kind video, `cutout: true`, whole-take items) + `<char>.voice` (kind audio,
  items from the same take). A video item and its voice item share a `link`.
- **Background per clip**: the video item carries its own backdrop - e.g. `bg: {asset, x, y, zoom}` (same meaning as the
  backdrop layer's props), drawn inside the item behind the person; falls back to a backdrop layer when missing. So it
  moves and trims with the clip by construction. (Pick the field name; write it in layers.md.)
- **"What we see"**: a new layer kind (e.g. `view`) - items `{from, dur, show: "<char>.video"}`, no gaps. At a frame
  the strip covers, only the named character's video row is drawn (its own background included); everything else
  (texts, subtitles, stickers, effects) as usual. Where the strip has no item, the old stacking rule applies - so every
  existing project is untouched.
- `edit: {"ripple": false}` for dialogue projects (projects without the strip keep today's behaviour - monologues /
  one-camera cuts ripple, his rule 2026-10-28).

### B. Editor (`render/ui/layers/` - LayersEditor, Timeline; live, one undo step per change)
- Character rows: the video block with the voice block right under it (one group per character, coloured by character).
- Drag a video block → its linked voice (and the subtitles of that line) move the same frames. Its background is
  inside it.
- Drag / trim a voice block → only the voice (+ its subtitles). The link stays; the block shows its offset from its
  video ("sound −0.30 s").
- Trim a video edge = more / less of the whole take (exists; `takeRoom` limits).
- "What we see" strip, on top of the timeline, blocks coloured as their character:
  - drag a boundary = who is seen changes there (both neighbours adjust, snaps to voice starts / ends and the playhead);
  - click a block → choose who is seen (the characters list);
  - split at the playhead (a key + a button) = a new cut; delete a block = its neighbour takes the time;
  - a stretch where the chosen character's row has no video is marked (hatched) and shows the last frame / black -
    never a silent wrong picture.
- Edge nudge (`,` `.` frames, typed ms - exists for clips) works on strip boundaries and voice edges too.
- Nothing pushes. Optional: Shift+drag = push everything after (ask him if he wants it; default off).
- No new panel controls (his rule - extra options in a window opened from the item).

### C. Export
- `export_layers.py` + the graphics pass: honour the strip and the per-clip background; `layers_audio.py` unchanged
  (voices are already separate rows). Same frames as the editor (stills at cuts, J / L spots).

### D. The dialogue builder + skill
- Make cut.py's logic a generic dialogue builder (or an action) that writes this format: rows per character, each clip
  with **handles** (listening frames before / after its line, inside the safe margins) so the strip can move without
  stretching clips; voices with the overlap; the strip filled J / L / straight by his rules below.
- Update `SKILL.md` (rule 4 dialogue), `recipes/hani.md`, `editor.md`, `layers.md` the same session.

### E. Test, then hand over
- On a hidden copy `_haredit-5-dlg` (convert haredit-5's rows to this format by script through ops) - never haredit-5
  itself. Load-test dragging (99 clips, 3 rows). Stills editor vs a fast draft export. Delete the copy (and its
  `projects/_x/` + `locks/_x.json` in the bucket) after.
- Then tell him: F5, which project to try, and the gestures in 3 lines.

## What he wants from a dialogue cut (the haredit-5 session, his three rounds of notes)
- Fast talk: the next voice comes in 300-500 ms over the end of the last one. Any gap between speakers = "terrible".
- Sound and picture cut apart, both directions, mixed with straight cuts.
- Exception: the speaker must be ON SCREEN soon after starting (a too-long J got "cut to Osnat first because she starts").
- Reactions run across the cut (Osnat's tongue-between-teeth laugh plays into the next speaker's first words, then cut).
- No silence anywhere - "someone is always talking". Only acted silent beats, which he points out.
- Never a frame of him starting / stopping the recording at a take's edges; never a face-filter slip mid-take.
- No cutaway over the speaker's big lines. Fast reaction chains over a running line are good (Hani looks → whispers to
  Osnat → Osnat nods, all while Yotam talks).
- A retake whose look changed is hidden behind the other character.
- All voices in one atmosphere.

## What cut.py had to do outside the tool (candidates for the builder / tool)
1. Turn planner: script order → turns (take + span), cut into voiced pieces (silences >= 0.18 s removed).
2. Line edges measured strictly on the voice (≈ peak −24 dB) - a looser threshold counted breath / room tone, so a
   "0.3 s overlap" only overlapped tails and he heard gaps. Clamp each end before the next transcript word.
3. Overlap per speaker change (0.3-0.5 s); picture mode per change J / L / straight, limited by the listening frames
   each take actually has.
4. Safe margins: no source frame from a take's first 0.7 s or last 0.45 s.
5. One voice row per character.
6. Laugh tails: a turn's voice runs into the next speaker with the picture held on the laugh.
7. Overlays over a running turn: cutaways, reaction chains at a source time, shots that hide a take switch - in the new
   format these are just strip blocks showing the listener.
8. A sound bed (chewing) with cutaways whose picture `in` = the bed's own time (mouth matches sound).
9. Checks: per-frame motion + sharpness scan (filter slips, recording starts); per-line transcription of the assembled
   voice pieces (swallowed words).
10. Voice matching: octave bands through `tools/voice_chain.mjs`, per-row warmth / presence until 250 Hz-8 kHz is within 3 dB.

His notes on the timeline: `episodes/haredit-5/project.json` → `notes`.

## Rules
Generic (every project gets it), live like CapCut (what he sees while dragging IS the edit, no rebuild). Hidden `_name`
test copies only, deleted after. Never touch adam-1 (being published) or a project he's editing. Never restart the
studio while a job runs (`GET /api/jobs` running + busy empty); never export Full quality. Commit + push each part,
tell him when to press F5. Short updates during long work. Reply in English.
