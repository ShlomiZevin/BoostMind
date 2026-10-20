---
name: edit-video
description: Edit Shlomi's TikTok comedy footage into a finished vertical video with Sketch Studio (c:\workspace\BoostMind\zoomcut) - one editor of layers (picture, sounds, text, filters) and one export; recipes per kind of video (Zoom-call sketch, monologue - rabbi / guru / news anchor / keynote, a person with an off-screen voice, Gen Z thoughts). Use for /edit-video, and whenever Shlomi says he recorded a sketch / has new footage or a folder in Downloads / wants a video edited, mentions zoomcut, Sketch Studio, the editor at localhost:4747, Amir/Ofer/Daniel, POV text, or asks to export/send a video to email or Telegram.
argument-hint: "[footage folder in Downloads] [what the sketch is]"
---

# /edit-video - Sketch Studio

Shlomi runs a 40K-follower Hebrew comedy TikTok. He records every character himself (wigs, face filters), drops the
files in a folder in `C:\Users\shazbak\Downloads`, and wants a finished vertical 1080x1920 MP4. **You make the first
edit; he fine-tunes it in the editor (http://localhost:4747) and exports.** Everything is in
`c:\workspace\BoostMind\zoomcut`; it runs locally (no per-edit API cost).

**One tool, recipes in this skill.** The editor is one thing: layers on a timeline (the cut picture, the set, sounds and
music, subtitles, text, filters) and one Export. What differs between videos is *how you set it up* - that knowledge
is the recipes below, not separate tools. Under the hood two engines exist today: `lesson.py` (any video shot on one
camera - almost everything) and `zoomcut.py` (a Zoom grid of several separately-filmed characters). Pick the engine by
the footage; never name things after a series in the UI.

## The workflow (every video)
1. **Start the studio** if :4747 is down: `cd c:\workspace\BoostMind\zoomcut\render && node server.mjs` (background).
   Never restart it while a job runs (check the Jobs panel / `GET /api/ep/<id>/job` first).
2. **Look before you plan:** list the folder with PowerShell (bash mangles Hebrew names); ffprobe each file; a contact
   sheet of frames (cv2 - Hebrew paths via `np.fromfile` / `cv2.imencode().tofile`); transcribe (faster-whisper via
   `pipeline.transcribe._get_model`). Know the footage second by second before you place anything.
3. **Pick the recipe** (table below); ask only if it is truly unclear. Read that recipe file.
4. **Make the project from the closest earlier one:** `lesson.py new episodes/<slug> --from <closest> --input "<folder>"`
   (or the editor's "+ New video", or `zoomcut.py new` for a Zoom grid). `input_dir` points at his folder - never copy
   footage. His recordings that are not footage (voice notes) go in the project's `media/` (kept out of git).
5. **Build through the server** (`curl -X POST localhost:4747/api/ep/<slug>/analyze`, wait on `/api/ep/<slug>/job`),
   never a parallel CLI run. Check `GET /api/ep/<slug>` → `layers.takes` lists every take (his edits are then instant).
6. **Self-review before he sees it:** placements (`work/edit.json` sounds / captions), lost words, export-path stills
   (`lesson.py episodes/<slug> --still <s>`; mind the project's Speed). Fix what you find first.
7. **Hand over fast** (he prefers a first cut now to a perfect one later): the link, the length, 2-4 timestamps worth
   his ear, which pauses you trimmed / kept, and one line that he can drag any edge to pull footage back.
8. **Iterate on his timestamped notes;** keep a short line going while you work ("what takes so long?"). Never let him
   review a half-built state - say "wait, building" and say when it is ready.
9. **Export** when he says (Export / Export & send in the editor - email, Telegram). Commit and push when he asks.

## His rules for every video
- **He can always re-trim the cut himself:** every cut piece's edge drags to take more / less of the original take,
  instantly (`cut.edges`, `corrections.json` for Zoom). Never ship without it; keep it working when you change the cut.
- **Every change shows at once.** He hates waiting and "Updating preview". The editor plays the cut live over the
  whole takes; only real picture work rebuilds. The heavy export layers render in the background. See `editor.md`.
- **Everything is a layer with a control** - picture, each sound, music, each text, each filter (strength + time
  range). Anything you add for one video lands as a generic button / setting, never a one-off hand edit.
- **What he sees is what he exports, and exports fast.** Same cut, sounds, text, filters, speed in both; the export
  checks itself (length, size, fps, sound) and tidies the work folder.
- **Tight rhythm:** cut dead air; lines land on each other (overlap, not gaps); start on the action, end on the last
  word. When he says "faster", shorten gaps and tails first, then speed.
- **Subtitles follow what he SAID**, not the script (his ad-libs stay). Hook text starts "פוב:" (never "POV:") unless
  his words have no prefix; his exact words; y ≥ ~250 (under the TikTok header).
- **Cinematic, not overdone:** a real-looking scene first (raw person, a normally lit set), effects as layers on top
  at moderate strength. He rejected shake, flashes, zoom kicks, heavy grades ("like Saw").
- **Sound is measured, not guessed** (dB over each window in `work/public/*.wav`); a voice from a device needs its
  filter and a level 5-8 dB under his voice; never let your own processing eat a word (RNNoise ate a last word once).
- **Real people:** no realistic images of real politicians at invented events; "תמונת AI" tag on realistic AI people.
  His own images / recordings stay out of the public git repo.
- Reply to him in English; Hebrew only in the video's text.

## Recipes - read the one you need
| What he recorded | Recipe | Engine |
|---|---|---|
| several characters, one file each, a meeting / call grid | `recipes/zoom-call.md` | zoomcut.py |
| one person talking to camera - rabbi lesson, guru podcast (tadar), news anchor, keynote | `recipes/monologue.md` | lesson.py |
| one person reacting to a voice we don't see - a Zoom at his desk, a phone call on speaker | `recipes/offscreen-voice.md` | lesson.py |
| a silent stare + her thoughts as voice-over (Gen Z), cinematic | `recipes/genz-thoughts.md` | lesson.py |
A new kind of video: start from the closest recipe, then write its recipe file when he signs off.

## More
- `editor.md` - how the editor, the live cut, layers, the background render and the export work (read before
  changing code).
- `reference.md` - every episode.json setting, the tools (Leonardo, sound kit, eye contact, sending), gotchas.
