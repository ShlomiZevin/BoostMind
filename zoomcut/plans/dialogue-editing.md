# Dialogue editing - J / L cuts by hand (brief, 2026-11-09)

A tool change for Shlomiverse Studio, its own session. Read first: `zoomcut/CLAUDE.md`, the `edit-video` skill
(`skill/edit-video/SKILL.md`, `editor.md`, `layers.md` → "link and ripple"), `skill/edit-video/recipes/hani.md` →
haredit-5, and `episodes/haredit-5/work/cut.py` (what had to be built outside the tool).

## The problem (his words, 2026-11-09)
Dialogue videos - characters filmed alone, each cut out on their own background, woven into a conversation. He wants
them cut like films / series: hear the next one before seeing them, still hear the previous one after the picture moved
on. Today Claude's cut needs many rounds of his notes; he wants to fix it himself with a drag. "Everything in a layer",
sound detached from the picture but linked, drag one thing without pushing everything, and drag a person WITH their
background.

## What exists (checked in haredit-5)
- Voices: one sound row per character (`voice`, `voice.osnat`, `voice.yotam`) - they can already overlap.
- Pictures: all people on ONE row (`person`, 99 pieces), all backgrounds on another (`set`, 99 pieces), NOT linked -
  dragging a person leaves its background behind.
- `edit.ripple: true` - every drag pushes everything after it.
- `link` exists (items move together), but the editor has no unlink / sound-only drag and no ripple toggle
  (`render/ui/layers/LayersEditor.tsx` ~L267-300 liveEdit / onItemEdit, `Timeline.tsx` ~L155 rippleTake).

## Proposed - confirm each point with him before building
1. **A shot = the person + its background as one block** (drag / trim / move together).
2. **One "what we see" picture row + one voice row per character.** (His first idea was a picture row per character;
   one row was suggested so two overlapping pictures never hide each other - ask him which.)
3. **Dragging the join between two shots = a roll edit**: only those two shots change, nothing else moves, the sound
   stays. One drag = a J or an L cut.
4. **Sound moves with its picture by default; Alt+drag = only the sound** (a "sound −0.3 s" label on the clip).
5. **No pushing by default in dialogue projects; Shift+drag = push everything after.** Monologues / one-camera cuts
   keep today's ripple (his rule, 2026-10-28).
6. **The skill builds every dialogue this way from the first cut** - SKILL.md, the recipe, `editor.md`.

## What he wants from a dialogue cut (from the haredit-5 session, his three rounds of notes)
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

## What cut.py had to do outside the tool (candidates for the generic tool / builder)
1. Turn planner: script order → turns (take + span), cut into voiced pieces (silences >= 0.18 s removed).
2. Line edges measured strictly on the voice (≈ peak −24 dB) - a looser threshold counted breath / room tone, so a
   "0.3 s overlap" only overlapped tails and he heard gaps. Clamp each end before the next transcript word.
3. Overlap per speaker change (0.3-0.5 s); picture mode per change J / L / straight, limited by the listening frames
   each take actually has.
4. Safe margins: no source frame from a take's first 0.7 s or last 0.45 s.
5. One voice row per character.
6. Laugh tails: a turn's voice runs into the next speaker with the picture held on the laugh.
7. Overlays over a running turn: cutaways, reaction chains at a source time, shots that hide a take switch.
8. A sound bed (chewing) with cutaways whose picture `in` = the bed's own time (mouth matches sound).
9. Checks: per-frame motion + sharpness scan (filter slips, recording starts); per-line transcription of the assembled
   voice pieces (swallowed words).
10. Voice matching: octave bands through `tools/voice_chain.mjs`, per-row warmth / presence until 250 Hz-8 kHz is within 3 dB.

His notes on the timeline: `episodes/haredit-5/project.json` → `notes`.

## Rules
Generic (every project), live like CapCut (what he sees while dragging IS the edit, no rebuild). Test on a hidden
`_name` copy of haredit-5, delete it after. Never touch adam-1 (being published) or a project he's editing. Never
restart the studio while a job runs; never export Full quality. Commit + push each part, tell him when to press F5.
Reply in English.
