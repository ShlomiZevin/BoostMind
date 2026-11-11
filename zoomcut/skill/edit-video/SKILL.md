---
name: edit-video
description: Edit Shlomi's TikTok comedy footage into a finished vertical video with Shlomiverse Studio (c:\workspace\BoostMind\zoomcut) - one editor where every element is a layer (each take, each character's background, subtitles, texts, images, voices, music, filters) and one export. Projects, never templates; recipes per kind of video (Zoom-call sketch, monologue - rabbi / guru / news anchor / keynote, a person with an off-screen voice, Gen Z thoughts, a "quick edit" of short phone takes). Use for /edit-video, "quick edit" / עריכה מהירה, and whenever Shlomi says he recorded a sketch / has new footage / uploaded through the Drop / a folder in Downloads / wants a video edited, mentions zoomcut, Shlomiverse Studio, the editor at localhost:4747, Amir/Ofer/Daniel/Ronit/Gilad, POV text, or asks to export/send a video to email or Telegram.
argument-hint: "[footage folder in Downloads or the Drop] [what the sketch is]"
---

# /edit-video - Shlomiverse Studio
(Was "Sketch Studio" until 2026-11-06 - renamed at his ask: everything is on the Shlomiverse, from production to live to backstage. Same folder, same address: zoomcut/, localhost:4747.)

Shlomi runs a 40K-follower Hebrew comedy TikTok. He records every character himself (wigs, face filters) and wants a
finished vertical 1080x1920 MP4. **You make the first edit; he fine-tunes it himself in the editor
(http://localhost:4747) and exports.** Everything is in `c:\workspace\BoostMind\zoomcut`; it runs locally.
Reply to him in English; Hebrew only inside the video.

## THE EDITOR IS THE TOOL. YOU FILL IT - YOU DON'T CHANGE IT. (his words, 2026-10-22)
"When an editor is working, he doesn't change the tool almost never. He is mainly spilling things into the tool."
"We need to have a tool which can have layers ... zoom is a great example of a very complex layered composition ...
any AI code tool can work with and spill things into it without changing it. The skill should say what to do."

**A video is a list of layers: `episodes/<id>/project.json`.** Read `layers.md` (the format) before you touch one.
- Layer kinds: video (footage in a window, cut-out), backdrop (the photo behind a cut-out person), image, text
  (styles: pov, plain, tag, toast, pill...), subtitles, shape, audio (voices, effects, music - with RNNoise / clarity /
  speech levelling), effect. Every item has `from` / `dur` in frames; the editor shows each layer as a lane he controls.
- **You fill it, three ways - all through the studio, never by editing files behind the editor:**
  1. a **builder** turns footage + script into layers: Zoom grid = Re-analyze (`POST /api/p/<id>/build {action:
     "analyze"}`; a new Zoom project: analyze, then `{action: "layers"}` once). Line fixes: `{action: "line", n, fix}`.
     A rebuild never touches what he changed by hand (pipeline/project.py merge);
  2. **ops** for everything else: `POST /api/p/<id>/ops {rev, ops: [...]}` - add a text / picture / sound layer, move
     an item, set a background, a voice filter, a speed (examples in `layers.md`);
  3. **files** into Media: `POST /api/p/<id>/assets?name=<file>` (raw body), then use the asset id in a layer.
- A look the tool doesn't have (a new text style, a new layer kind) = tool work: one generic addition (a style in
  `render/src/layers/styles.tsx`, documented in `layers.md`), on its own, tested on a `_` copy - never a one-video hack.
  If you notice you are about to edit `render/`, `pipeline/` or the engines while making a video - stop, tell him in
  one line, treat it as its own task.
- Export = the one exporter (`pipeline/export_layers.py`): what the editor shows is what the file gets.
- **One editor for every project** (his call, 2026-10-22: "I just want one editor"): every project has a
  project.json and opens in the layered editor. Zoom projects get it from every analysis; one-camera projects from
  the solo builder (`pipeline/to_layers_solo.py`). The older screens are not used any more. Deleting project.json
  brings a project back to its older screen (its episode.json / captions / corrections are never touched).


**Projects travel through the cloud, never through git** (his rule, 2026-11-02): commit code only - never files under
`zoomcut/episodes/<id>/`. Moving a project to his other computer = he opens it there; the studio brings it.

## EVERYTHING IS LIVE - NOTHING REBUILDS (his words, 2026-10-22: "as in CapCut exactly")
"When I'm changing something, it should be live." Every change in the editor shows at once - a filter, a voice
setting, noise cleaning, pitch, speed, the set, the cut-out's edge, a text, a drag of any clip. The only real jobs are
new content: **Analyze** (new footage) and **Make eye contact**; the cut-out engine (fast / quality / hybrid) is chosen
at Analyze. A builder that must re-plan after a drag does it quietly in the background - the edit already shows.
If you find something that makes him wait, it's a tool bug: fix it generically (a live prop + the same math in the
export), never "press Re-analyze".

There is ONE kind of project: layers. Never talk about "Zoom videos" vs "regular videos" - a grid of people is just
layers a builder made; the editor and the export don't know or care which builder.

## READ FIRST - how we work (his rules; each one cost him a round)

1. **No templates. Only projects.** A new video is a new project. Learn from earlier projects and copy their look and
   feel (a Zoom grid, office backgrounds, the POV band, an end poster, a voice setting) - but it is a project, never a
   "template". Never say or show "template" to him. (2026-10-22: "We don't need templates. We just need projects.")
2. **Everything is a layer he can change himself.** Each take's picture, **each character's background / set**, **the
   subtitles**, every text, every picture (end card, poster, sticker), **every voice with its own filters and volume**,
   the music, every filter - each one visible on the timeline with its own controls. Nothing is baked into another
   layer's pixels or audio. A setting you add for one video becomes a generic control, never a hand edit.
   - **Before you build:** check the engine shows every element as a layer. If it can't, tell him in one line first;
     the fix is a layer in the editor, never a one-video workaround that bakes it in.
   - **Before you hand over:** open the project in the editor and confirm every layer is there; name any that is not.
   - *What went wrong (gilad-joins, 2026-10-22):* the Zoom engine baked the office backgrounds into the takes, had no
     subtitles layer and one mixed voice track - the edit was "very, very good", but he could not show the whisky in
     Gilad's room or play with Daniel's voice himself. "It has to be layers." Bringing them to the editor is the work.
3. **Every scripted line is accounted for.** After each build read `matched X/Y · N to check · N missing` and run the
   audit. The recogniser drops short phrases ("חד משמעית", "נכון", "מצוין", "טוב, תודה"), so a "missing" line is often
   there: measure the voice (dB per 10 ms) and transcribe that span alone before you call it missing. If a line is
   really not in his takes, **tell him**: who, the exact line, where it falls. Never patch it silently.
4. **A real conversation.** Normal turns: lines land on each other, no dead air (he called this "perfect"). **Cut-offs:
   the one cutting in starts while the other is still clearly talking** (0.5-1 s of both voices), the cut-off voice
   keeps going underneath, then stops. A line said over someone ("זה סדר הגודל" over "תקשיב ×3") plays in full on top,
   and the view switches between them. Start each line on its first word (no breath, no tail of the line before) and
   end on its last word (no gasp after).
   **Film / series editing of dialogue** (his words, 2026-11-08, haredit-5): the picture cut and the sound cut are not at the
   same moment - J-cuts (hear the next speaker while still seeing the one who finished) and L-cuts (see the next one /
   a reaction while the first finishes), mixed with straight cuts; cut away to the listener during long runs. Details:
   `recipes/hani.md` → haredit-5.
   **A dialogue is built as a row per character + the "What we see" strip** (his approved model, 2026-11-09 -
   `layers.md` → "Dialogue"): a group of rows per character - video, background (its own row), voice, its pictures -
   every one a row he sees and changes (a background hidden inside the clip was rejected); clips with handles; the strip
   says who is seen when, so he makes the J / L cuts himself by dragging a line - nothing rebuilds, nothing pushes.
   Build it that way from the first cut (fill the strip by the rules above); an older one-row cut becomes a dialogue
   copy with `tools/to_dialogue.py`.
5. **The editor is the tool; this skill uses it.** Making a video = setting up a project's layers with the tool as it
   is, then he (or you, on his word) changes them. A video session does not change the tool. Something the tool can't
   do = a deliberate, generic tool improvement (a layer kind / control every project gets, written in `editor.md`) -
   never a one-video patch. See `editor.md` → "The tool and the skill".
6. **This skill learns.** Anything you learn about how he wants it - cutting, rhythm, sound, looks, how he works -
   goes into this skill (here, the recipe, or `reference.md`) the same session, with the date and his words. A lesson
   that stays only in the conversation is lost.
7. **First cut fast, then his notes.** Never let him review a half-built state ("wait, building" - then say it's ready).
   His timestamps are the editor's time at 1x speed. When he says "you do it", make the call yourself.
8. **You don't export - he does.** Exporting is HIS step (the Send window), not part of your hand-over (his words,
   2026-10-25: "I hate it when he exports, especially the full quality"). If YOU want to check your work, use the live
   preview and stills first; if you still need a file, ONLY the fast test export, without sending it
   (`POST /api/ep/<id>/export {test: true, send: []}` - about a minute, `out/<id>.test.mp4`), and only when nothing else
   runs (`GET /api/jobs` → `busy` empty). **Never a Full quality export on your own** - only when he asks or presses Send.

## USING THE TOOL RIGHT - what went wrong on gilad-joins (2026-10-22) and the rules from it
The video came out great; the way I used the tool did not ("something in the tool you didn't use as supposed to").
What I did wrong:
- **Built features into a side screen.** The Zoom project opens in an older, Zoom-only screen. I added backgrounds,
  voices and subtitles THERE (a "רקע" lane, a character card) instead of in the main editor every other project uses -
  so its backgrounds were nowhere in Media, controls sat in other places, it didn't feel like his tool.
- **Changed the tool in the middle of a video**, under time pressure, piece by piece, while he was waiting.
- **Worked behind the editor's back**: edited episode.json / corrections.json and ran `zoomcut.py voices` from the
  shell instead of going through the editor's controls / the studio's endpoints - the screen didn't always show it.
- **Exported without checking what he set**: an export went out at 2× because the project's speed had changed.
- **Made the export heavier without load-testing it** - his PC blue-screened mid-export.
- **Debugged too long** on one problem (the export freeze) before taking the simple route.

The rules:
1. **One editor.** Every project - Zoom grid or one camera - is edited in the same main editor: its Media tab, its
   layers, its inspector. Never add a feature to a side screen. If a project type still opens elsewhere, say so and
   bring it into the main editor (tool work, below) - don't extend the side screen.
2. **Use the tool the way he does.** Change a project through the editor's own controls / the studio's endpoints, so
   what you set is what he sees. Never edit project files behind an open editor; never run the engine from the shell
   while the studio is up (build / export / voices go through the studio).
3. **Tool work is separate from video work.** Making a video = setting layers with the tool as it is. If the tool
   lacks something: stop, tell him in one line, and do the tool change as its own planned task - generic (every
   project gets it, in the main editor's existing places), tested on a hidden copy, load-tested before he exports with
   it, written in `editor.md`. Never patch the tool piece by piece while he waits on a video.
4. **Before every export:** read the project as he left it - speed, the layers, the length (`GET /api/ep/<id>`) - and
   export exactly that (a layered project: `GET /api/p/<id>` - speed, hidden / muted layers, length). A setting that
   looks off (2× speed) = ask, don't export.
5. **Show before applying** a look or sound change: stills of the tiles (big AND small), short before / after mp3s.
6. **Time-box debugging:** two or three attempts, then the simplest route that works.

## Clips, layers, groups - preparing a project he edits himself (his words, 2026-11-11)
**Clip** = one piece on a layer (video, background, sound, music, text, sticker); **layer** = a row of clips; **group** =
clips that belong together and are edited as one (a character talking: his cut-out clip + his background clip + his
voice clip, maybe a sticker; one layer holds clips of many groups). Use these words with him. He works this way now:
he drops footage, a session PREPARES the raw project (backgrounds, cut-outs, crops, voices), and he cuts it himself -
moving, stretching, cutting (S, or Ctrl = scissors) and deleting whole groups. So every piece you prepare is a group:
one `link` on its video, background, voice and subtitles, video / background / voice with the same `from` / `dur`.
Details and the check: `layers.md` -> "Clips, layers, groups".

## Dialogue projects - working in the new format (learned on haredit-5-dialogue, 2026-11-09)
Format: `layers.md` -> "Dialogue". A row group per character: **video** (cut-out clips) / **רקע** (one background per
clip, linked, moves with it; may be a video) / **voice** (the character's sound). One **"What we see"** strip picks who is
on screen; `edit.ripple: false`. Make one from a cut: `tools/to_dialogue.py <project> <new-id>` (every frame checked).
- **Once he edits it, it is HIS - be gentle** ("the version is almost perfect, don't ruin it"): never re-convert or
  rebuild it; only small targeted ops on exactly what his note names; say which clip / row changes. No backups needed.
- **What you see is what you get** (his rule): every change must be visible on a layer and undoable there. A fix for
  one section = a per-clip setting (e.g. `clean: "nn"` on just those voice clips - shown in the clip's "Clean the noise")
  or its own clip / row - never something baked or hidden; name the exact clip in the reply.
- **A character's other sounds go on its own voice row** (chewing, a whisper) as clips with overrides
  `voice: false, clean: "off", level: "off"` + gain - he saw Osnat chewing on screen and "no Osnat sound" under it
  because the chewing sat on a separate row far below.
- **An overlay shot (a reaction / "the look") needs its own background clips** under it (a `*.bg` row), else the person
  of the row below shows through.
- **A tight join he wants to fine-tune = two rows**: put the next line on a second voice row of the same character
  (`קול - חני 2`, same props) so he can drag the end of one and the start of the other independently.
- **Cutting a silence in a dialogue project**: cut every row, the strip, the captions and his notes together (split
  clips that cross the cut, `in` moved); measure the WORD edges first - three cuts clipped a word ("לך" -> "לה",
  "בפוניבז'", the "ה" of "הסתכלתי"); a few frames given back fixes it. Moving something later = shift everything after.
- **No fades anywhere** (his rule) - 0.01 s click guard only.
- A text / card meant on top (over a poster) must be the TOP layer - index 0 is the bottom.
- The studio holds the old format checker until it restarts once after a format merge (he restarts it, or allows you).
- Stems folders can hold cloud "(conflict ...)" copies - ignore them when measuring.
- A missing editor feature (no background row, a sound not under its picture) = a message to the tool session, not a
  workaround in the project.

## "fix notes" - his notes on the timeline (2026-10-28)
He leaves notes for you IN the editor: "+ Note" on the timeline bar (or N) puts a yellow flag on the ruler at the
playhead, his words in a window right above it, optionally a spot he clicked on the picture. They live in project.json
`notes: [{id, at (frame), end? (frame - a note on a STRETCH: fix the whole of it, at..end), text, x?, y? (canvas px), done?, reply?}]` - saved, Ctrl+Z, kept through rebuilds, and they
move with what plays under them when a take is made longer / shorter. When he says **"fix notes"** (or "תתקן את
ההערות"):
1. `node tools/notes.mjs <ep>` - every open note: when, his words, the spot, EVERY layer's item at that frame (ids,
   times, words, refs) and a still of that exact frame with his spot boxed (`episodes/<ep>/work/notes/<id>.png` -
   LOOK at it). Which project: the one he is on (ask if unsure).
2. Fix each one the right way (this skill's rules: ops API with the rev / the builder - never hand-edit project.json).
   Ready-made notes carry a `kind` (one click in his note window; the tool prints what each needs):
   - `tighten` = **Tighten the cut**: the join nearest the note (the tool prints it, with source seconds) - close the
     gap / pause between the two clips: one camera = that take's `cut.edges` (`/api/ep/<id>/trim` - the same as his
     drag; everything after moves), down to the last / first word (check `work/transcripts`, never clip a word, keep the
     project's `join` overlap); Zoom = the line's `pause_before` / timing fix.
   - `silence` = **Cut the silence**: remove the pause at that moment - one camera = `cut.removes` {take: [[a, b]]} in
     the take's seconds (the tool prints "@ N s in the source"; measure the pause edges from the words / the voice
     level). His note overrides "pauses inside a take stay" for THAT pause only. A whisper, a stare, acting in it is
     not silence - look at the still / frames first and reply with a question if it is acted.
3. Answer each: `node tools/notes.mjs <ep> done <id> "what I did"` (he reads it on the note and can reopen it; a done
   note is GREEN = "fixed on this run" until he checks it - his timeline's "Check fixed ›" walks through them, "Looks
   good" hides each, "Not yet" sends it back open; 2026-11-09); a note
   you can't do or that needs his call: `... reply <id> "the question"` (stays open). Never delete his notes.
4. Tell him: F5, then a short list - note by note, what changed - and that they are green on the timeline: "Check fixed ›"
   on the bar takes him to each one (Looks good hides it, Not yet reopens it for you). Never mark a note done that you
   didn't fix (use reply) - green means "fixed, go look". A note he sent back (open again, your reply on it) = fix it again.

**A piece you change by hand (box, in, dur via ops) becomes `user: true` - a later rebuild never re-cuts it**
(haredit-2, 2026-10-28: I enlarged one Lego piece, then cut a silence inside that take; my piece kept its old length
and lay over the new one - he saw "two videos merging"). After every rebuild, check the picture lane: no two items
overlap, no gaps (`from + dur` of one = `from` of the next), and re-apply your hand change to every new piece of that
take. A framing for a whole take is better as one change you re-apply than as a one-piece edit you forget.

## The workflow (every video)
1. **Studio up?** `cd c:\workspace\BoostMind\zoomcut\render && node server.mjs` (background). Never restart it or start
   another heavy job while ANY job runs, test (`_`) projects too: `GET /api/jobs` → `busy` must be empty.
2. **Footage.** The folder he names, or **the Drop**: he uploads from the iPhone at
   https://shlomiverse.com/drop/ and files land in `Downloads\drop\<folder>` within a minute (the studio
   pulls each minute, then removes it from the Drop - the folder here is the footage; if one is late, `gcloud storage
   ls gs://boostmind-drop/<folder>/` and pull it yourself). **His marks:** in Media he marks takes Use / Don't use with
   a note (asset `mark` / `note`, layers.md) - read them before picking or changing takes. **Every video on the
   layers is marked Use** (his rule, 2026-10-28 - he was marking them by hand): after anything that puts or changes
   videos on the layers (Analyze, a builder run, your own ops), run `node tools/mark_used.mjs <ep>` - it marks the
   unmarked ones Use, keeps his notes, never flips his Don't use (a used ✕ one is listed: tell him). **His Use marks are the takes to use** (2026-10-28, haredit-2: he
   marked 759BC0AF / CA80BF04 and the cut still had the older takes - "see that you used the video I marked"): every
   Use take that is not in the cut replaces the take of the same passage. Two Use takes of one passage = pick one,
   clear the other's mark and note why on it ("same part as X - X is in the video"), so Media shows only what plays. iPhone
   and filter-app files have random names (`13944E36-….MP4`, `export_….mov`):
   - **who is who** from a contact sheet of frames (wig, cap, glasses, shirt); ask once if unsure;
   - **order** from the recording time (`ffprobe … creation_time`; filter-app exports: the number in the name) →
     episode.json `"files": {"<file>": {"char": "ofer", "order": 2}}`;
   - he uploads while you work: start with what's there, but **one build with everything** - cancel a build a new
     arrival makes obsolete (`POST /api/ep/<id>/cancel`) instead of rebuilding twice.
   - **Ask how many takes he sent when the count looks low** (tzvika-1, 2026-11-02: one file had landed, he had shot
     four scenes - I edited one and sent it; "you did something strange"). The engine orders takes by FILE NAME, not by
     time: with random iPhone names always write `sequence` [{take, from, to}] in recording-time order. A passage
     said in two takes (the end of one = the start of the next, re-said): end the first before it, use the retake.
   - **After every build read the first subtitle of every piece**: the builder can start a piece after the first word
     (tzvika-1 started at 1.87 s and lost "הפרומפט שלנו") - pull the edge back with `/api/ep/<id>/trim`.
   - **A new PC** (2026-11-02): `zoomcut/setup.ps1` sets up all of it in one step - tools, npm + the export's browser,
     `.venv` from requirements.txt, Google sign-in, the keys from Secret Manager (`studio-keys`), `models/` from the
     bucket, the cloud sync on. Every project and the asset library then come from the cloud (render/cloud/,
     zoomcut/CLAUDE.md "The studio online"). Say so to him in one line.
   **Look before you plan:** ffprobe each file, frames, transcribe (faster-whisper via `pipeline.transcribe._get_model`,
   feed numpy). Know the footage second by second.
3. **Pick the recipe** (table below) and read it. (Where an idea starts: the studio's **Ideas** page in the left
   rail - his notebook of video ideas, `GET /api/ideas`; "add an idea" = `POST /api/ideas {title, text}` (Hebrew, his
   words, speech-to-text slips fixed). The file is git-ignored - unfilmed jokes stay out of the public repo.)
4. **Make the project** - before filming, from a script: the Reader's **Paste → "Create a new project for it"** (one
   camera / Zoom call, optional "settings like" an earlier project) makes the project with the script AND its Drop folder
   (`POST /api/new-from-script {name, kind, like, text}`) - he films with the Reader, uploads the takes into that Drop
   folder, and the project finds them. Or after filming: the editor's "+ New video" (`POST /api/new {name, template: "zoom" | ..., folder, from}`;
   `from` = the closest earlier one-camera project: its set, music, voice, eye contact, look, subtitle style).
   `input_dir` points at his folder - never copy footage. Every new project is a layered one from the first minute
   (an empty project.json) and opens in the one editor with a **"New video"** step:
   - Zoom: the footage files with a thumbnail each - pick who is in each (Dialogue / Listening). The analysis starts
     by itself once every file has its person (`POST /api/ep/<slug>/files` per pick; it answers `waiting: n` until
     the last one).
   - One camera: the takes, and **Analyze**.
5. **Eye contact only when the video needs it** (2026-10-25): any `eye_contact` key - even `{"on": false}` - runs it
   (minutes). Not a talk to the lens -> remove the key before Analyze (`recipes/monologue.md` → Eye contact).
   **Analyze through the server** (`POST /api/p/<slug>/build {action: "analyze"}`, wait on `/api/ep/<slug>/job`),
   never a parallel CLI run, and only when `GET /api/jobs` → `busy` is empty. The analysis (zoomcut.py / lesson.py)
   ends by writing the project's layers; they appear in the same editor. Then **fill the layers** (hook text, end
   poster, backgrounds, voice cleaning, effects, sounds) with ops - read `layers.md`; copy the look of the closest
   earlier project as ops.
   **A background, music or a sound: the library first** (his rule, 2026-11-02 - "look for images when we need
   them", no tagging run): `zoomcut/library/index.json` (or `GET /api/lib`) = everything his layered videos used,
   with the series / video / prompt / labels each came from. Search it, LOOK at the candidate pictures (Read the
   files) and check the sounds, and use one (`POST /api/lib/<id>/add {ep}`) before generating anything new.
   **Anything you DO make goes into the library at once, labelled** (his rule, 2026-11-02): the makers take
   `--about "<what it is, for which video>" --tags "<mood, place, use, character, style>" --project <id>`
   (`tools/leonardo.mjs`, `tools/elevenlabs_music.mjs`); anything else -> `node tools/library_add.mjs <file> --about
   ... --tags ...`. `node tools/library_add.mjs --unlabelled` must be empty for what you made before you finish.
6. **Self-review before he sees it** - lines (rule 3), rhythm (rule 4), voices (levels per take: a mostly silent take
   gets a huge automatic gain), stills of the key moments (opening, every cut-off, the ending) through the export path.
   **What he marked to keep comes first:** before ANY cut-out work run
   `tools/sam/.venv/Scripts/python.exe tools/sam/keep.py show episodes/<id>` - it lists what he marked in the editor's
   "Keep things" window ("Save for Claude", his ask 2026-11-04: "a way to help the session not make mistakes"), with a
   picture of each thing outlined (work/keep_marks/) and whether the cut-out has it yet. His marks are his instruction:
   keep exactly those (Analyze makes them - episode.json keep_objects), look at the pictures, never swap them for a colour
   range or a box. **Anything he holds** that he did NOT mark (a bottle, a box, a phone, a booklet): mark it yourself the
   same way (reference.md "KEEP THINGS" - a point or two, `keep.py preview`, look) and tell him what you marked; the
   older ways (reference.md "HELD PROPS - THE ONE WAY", `prop_color` / `props`) only where tools/sam isn't installed - the
   cut-out engines drop held props or leave them see-through ("a recurring issue", 2026-10-28). **Every full export: `python tools/flash_frames.py <ep>`** - one-frame flashes
   (he saw "a glitch of empty Hani for a micro second" on some cuts, 2026-10-28: the exporter placed a third of the
   clips a rounding-hair late, fixed in pipeline/export_layers.py; the check stays). Exit 1 = don't send it.
   After a rebuild, the picture lane: no two items overlapping, no gaps. Fix what you find first.
7. **Hand over:** the link, the length, the lines you fixed or could not find, 2-4 timestamps worth his ear, one line
   that he can drag any cut edge to pull footage back. **And the post is already written** (his rule, 2026-10-25):
   every video you make comes with its DEFAULT caption - a hook line + 3-6 hashtags, in the character's voice
   (`publishing.md`), **always including #שלומיוורס** (every video, every platform - his rule, 2026-11-01; max 5 hashtags,
   only real in-use ones; a high-tech video = exactly #הייטק #הייטקס #צרותבהייטק #שלומיוורס, nothing added) - and its YouTube title, saved into the Send window (`POST /api/ep/<id>/publish {save: true,
   platforms, caption, title}`), so when he opens Send it's all there; tell him the caption in the hand-over.
   **And who's in it**: the Send window's "Who's in this video?" chips (`POST /api/ep/<id>/cast {cast: [ids]}` + project
   `characters`) - every character who appears or speaks; that is how the video reaches their pages on the Shlomiverse
   (his rule, 2026-11-09 - he had to add Hani / Osnat / Yotam himself; publishing.md step 2b).
8. **Iterate on his notes**, keep a short line going while you work.
9. **Send - one window for everything** (2026-10-25): the top bar's **Send** button opens it - **Test on my phone**
   (`POST /api/ep/<id>/export {test: true, send: ["telegram"]}`: 378x672, ultrafast, `out/<id>.test.mp4`, marked TEST,
   never published - to check the look and the sound), **Send the file** (Telegram, Email) and **Publish** (the
   socials). An up-to-date full export goes out as is; otherwise its button exports first (`out/<id>.mp4`, 1080x1920).
   **This is his step** - you never press Send or export Full quality for him (rule 8); you tell him it's ready.
   Commit and push when he asks - only your own files (other sessions have uncommitted work in this repo).
10. **Post it** - read `publishing.md`. The caption you saved in step 7 is in the Send window; **he presses Send**,
   never you. Instagram, TikTok drafts, YouTube Shorts and X are live; Facebook = a Telegram reminder to share the
   Instagram Reel.
11. **Put it on the Shlomiverse (= "upload it to the verse")** - part of publishing, not an extra; the ONE path is
   in `wiki.md` "A finished video -> the Shlomiverse". The studio's "site" job runs
   `render/verse.mjs` by itself after every Publish (Jobs panel "Shlomiverse"); by hand
   `POST /api/ep/<id>/site` (`wiki.md`): web copy + poster, the record through the Shlomiverse's publish API (the fan
   title by Terra, the site and the chat read it at once). Check it ended ✔ and act on any "!". Until then the video isn't on https://boostmind-b052c.web.app/wiki/ and the characters can't talk
   about it. **Do it the moment he publishes - don't wait to be asked** (2026-10-25, haredit-1: he had to remind me).
   A video reaches the wiki only when its project is **done** (`POST /api/ep/<id>/done {done: true}`) and has
   `out/<id>.mp4`.
12. **Every place the character and the video must reach - check each one, every video** (his ask, 2026-10-25:
   "make sure the edit video knows to guide each session to add the character to all these places if it wasn't
   already, and the character's videos"). **The site job checks these by itself** (`publish_site.py --check`, run by the site job)
   and prints one `  !` line per gap - a missing portrait, a Techy-Tech card, a site without a links-page button, a
   character site that shows videos but not this one. Act on every `!` line. For each character in the video:
   - [ ] **Characters page** - a profile (`POST /api/characters/<id>`), its portrait, the video in `videos`, the
     facts the video added (family, catchphrases) - saved in the Shlomiverse's database, live everywhere at once.
   - [ ] **The world's site** - a Techy-Tech character gets a team card (`public/techietech/index.html` TEAM +
     the org chart DIVS, photo `team/<id>.jpg` 560x560 corporate headshot) and BOTH copies deployed:
     `sh techietech-site/deploy.sh` (techytech.web.app) AND `bash scripts/deploy.sh` (/techietech/ on the
     main site). His browser caches techytech for an hour - tell him Ctrl+F5.
   - [ ] **Their own site** if they have one (a new video tile, its 540p copy) + its button on the links page.
   - [ ] **The Shlomiverse wiki** (step 11) - character page, portrait, the video, the fan copy.
   - [ ] **The chat agent** - it learns from the brain the server composes from the database records (since
     2026-11-05; `shlomiverse-content` skill): after `build.py` + `node scripts/wiki/push.cjs` it knows within ~3
     minutes - no wikiChat deploy (only when wiki.js itself changes). Then TEST it: POST
     `https://europe-west1-boostmind-b052c.cloudfunctions.net/wikiChat` `{"mode": "<id>", "own": true,
     "messages": [{"role": "user", "content": "<a question about this video>"}]}` (Python, UTF-8; `own` keeps it
     out of his logs) and read the answer - it must know the new video. The chat answers 3 questions a day without an
     account (since 2026-11-01, counted per `v` visitor id, else per address) - send `"v": "test<anything new>"` so a
     test isn't refused (429 `quota`).
   Before a main-site deploy: other sessions' unfinished pages ride along - compare the modified `public/` files with
   the live ones first (md5 of local vs `curl`), and say what else would go out.

## More of his rules
- **A song clip from people's sung takes** (zot-hani-karaoke, 2026-10-29): every take its own audio layer (the WHOLE
  original take, one item per line placed on the beat with `in`), the processing live in the layer's `voice` chain
  (low cut, warmth, presence, de-ess, comp, a little room) - NEVER a resynthesized / pitch-corrected file: my WORLD
  tuning made it "terrible". Two or three voices at a time (lead + a double; the rest muted layers he can turn on),
  vocals ~1 dB under the music. The words = the `lyric` text style ("a word here, a word there" - not karaoke), the
  font from the poster's look (Rubik Spray Paint for a brush-graffiti title, `fonts/`). He trims the start / end
  himself (a note "שיתחיל מכאן", End here) - follow it. **The whole recipe and its tools: the `make-songs` skill**
  (`skill/make-songs/SKILL.md`).
- **He can always re-trim the cut himself - in the one editor, in every kind of video** (asked 6 times, last
  2026-10-22: "make sure I can drag videos to start before them and after them... always on partial videos"): every
  cut piece's edge drags out to take more of the original take, or in to take less. Zoom: the drag becomes a line
  fix (the analysis re-times the line, picture / voice / subtitles together). One camera: as in CapCut (2026-11-05) - the edge
  shows more / less of the take and everything after it moves by exactly that (end card, music, subtitles - the words
  it uncovers get subtitles), live, no rebuild. A session doing the same: the same ops (`/api/p/<id>/ops` - the clip +
  its voice, everything after shifted, `project.duration`), not `/api/ep/<id>/trim` once he has hand edits / an end
  card - `/trim` re-cuts the whole take and that re-cut broke sagi-1's end. A layer you make
  yourself: the item's edge pulls back footage up to the take's start / end.
  **The whole-take rule for any session:** a video item points at the WHOLE take (`asset` = the take, `in` = where the
  piece starts in it). Never a file cut down to the piece - then there is nothing to pull back.
- **Sound is never naked; calls always have the other side** (2026-10-25, haredit-1): every video gets an ambience
  layer of the place + a bed (reusable comedy beds in `_assets/music/`), and every phone / Teams call gets the
  other side's mumble in her pauses (`recipes/offscreen-voice.md` → hani). A whispered blessing / drinking is acted,
  not silence - check the frames of a long pause before cutting it.
- **A phone-filter monologue (Asaf on the couch - TikTok-app takes with a face filter, many short recording
  segments): cut EVERY pause** (asaf-1, 2026-11-03: "the edit is terrible - cut all the silence in between sentences -
  sometimes you can see me just start or end shooting"). Not the demokratovich rule above: here `cut` = {merge 0.2,
  pad_in 0.05, pad_out 0.1, join 0.3, after_last_word 0.15} (silence cutting ON), `cutout: false`, speed 1.15, the
  video opens on his first word. Recording restarts = `scdet` jumps (`ffmpeg -vf scdet=threshold=10`): `sequence` from
  just after each jump; drop the repeats of the opening (use the last take). Check the picture lane for 2-6 frame
  fragments (a click as he presses record) and breaths inside a piece (`cut.removes`). His script = the subtitles.
  **His notes on the next round (2026-11-03) were all things a script can find - do them BEFORE he sees it:** every
  pause of 0.15-0.2 s between sentences inside a piece (`cut.removes`, measured at 10 ms, keep the next consonant), every
  piece that ends 0.3-0.5 s after its last word (end it on the word's energy end; `join` 0.3 then lays the next line
  over it - "I rather one sentence start on top of the other"), and an ad-lib that is NOT in the script he pasted
  (he cut "וואלה, תיזהר עכשיו עם הרכב... אם לא" - flag off-script lines, don't keep them silently).
- **HOW HE WANTS A ONE-CAMERA CUT - do exactly this, nothing more** (said three times on demokratovich-nechama,
  2026-10-29: "your cuts are really bad... each video stops when it stops, the next starts where he talks, a little
  room to hear the end and the start of the word - and that's it, don't cut more things"):
  `cut` = {silence: false, join: 0}; every take starts ~0.15 s before its first syllable and ends ~0.3 s after its last
  word (measure dB per 50 ms; `edges` / `sequence` from-to); no overlap, no fades eating words, no extra pieces. Only
  exceptions: a silent opening he acts in (`lead_in`), and a stumble he redid in the next take (cut the stumble).
  Someone heard off-screen (a question): the picture under it comes ONLY from the take where he listens; if it is too
  short, speed the sound up (`tempo`) - never borrow footage from other takes. Room echo on anyone: very, very gentle
  (`room` ~0.1, "light, pleasant to the ear"). A noise filter that colours his voice: back to the original.
- **Sound = a setup, by name** (his ask, 2026-11-03: "eventually the sessions do it; I only polish"). Every voice row
  (and a clip that needs something else) gets a setup: `node tools/setup_apply.mjs <project> <layer> [item] <setup>` -
  it sets the cleaning, the voice chain and the effects at once, and his panel shows "<setup> · set by a session".
  `--list` shows them all (his own saved ones too - prefer his). Which one: a monologue to camera / an anchor -> Podcast
  or News studio; the rabbi / a hall -> Synagogue hall; a keynote -> Stage / keynote; at a desk -> Office; a colleague
  across the room -> Someone in the background; a sung take -> Singer; the other side of a call -> Phone call; a
  loudspeaker -> Speakerphone / PA; a live / a video call -> Laptop speaker; a thought -> Inner thought; a dramatic beat
  -> Dark echo; through a wall -> Muffled; a big ending line -> Trailer voice. The clip wins over its row (layers.md),
  so one line in another place = a setup on that clip only. Tell him in the report which setup went where.
- **RNNoise (clean "nn") swallows the first word after a long silence** (demokratovich-nechama, 2026-10-29: "the
  first רבותיי sounds bad"): after his 10 s silent opening it cut that word by 25-45 dB (the rest of his speech ~10 dB).
  Measure the word raw vs the nn source (`work/public/layers/src/voice__t.<take>__nn.wav`); fix = split the voice item
  around the word and play the word from its own audio layer with the same voice props and `clean: off` (layer.add +
  item.update/item.add, 0.03 s fades) - his cleaning choice on the main layer stays.
- **A music bed shorter than the video**: it fades out and goes silent mid-video ("a break in the niggun at 1:02").
  Glue it: end the first music item before the track's fade-out (`fade_out` 1.0) and a second item of the same track,
  1 s earlier, back into its theme (`in` = a section start, `fade_in` 1.0). Check the bed's length against the video's
  when you set it.
- **Pauses inside a take stay; only the joins BETWEEN takes are tight** (his words, 2026-10-23: "don't cut spaces in
  the same video, only between videos"). One-camera projects with several short takes: `cut.silence: false`. At a
  join the previous take's sound runs on under the next one's start (`cut.join` 0.25 - "continue the sound of the
  previous and start the sound of the next"); each take starts on its first syllable (measure the onset, dB per 10 ms).
- **A cut that changes the length (`removes`, `keep_pauses`, merge) moves only the builder's items** - everything he
  placed or trimmed by hand after that point (his own sound layers, `user` items, a hand-trimmed last piece, a
  duplicate subtitle) stays at its old frame: a gap before the last piece, music past the end (haredit-1,
  2026-10-25: "something in the end is not right... fit everything again, make them stitch"). After such a cut,
  shift every hand item after it by the same frames, then check: no gap between Person pieces, nothing past
  `duration`.
- **A weak take is saved by the EDIT, not by sound effects** (adam-1, the robot CEO, 2026-11-08 - "the raw is not that
  good... do some magic"): servo whirrs on his gestures, computer blips, an awkward clap from the room = "terrible,
  remove them" ("any sound effect is terrible"); a "regenerate" restart of the speech at the end = "why you started
  again? I don't like it". What he wanted: speed (he asked 1.8x), the character in the VOICE (`Robot` setup - the
  monotone vocoder robot at 75%, he picked it from 7 samples: `robot` fx filter, ZcMono worklet in render/ui/soundfx.ts),
  music in the character's world (robotic electro / techno), and edit tricks made of his own footage: a syllable
  repeated 2-3x as a glitch (`sequence` entries repeating the same 0.2-0.3 s, e.g. "וו-וו-וואו") with a short `flicker`
  effect item on it, and hard punch-ins (item `zoom` 1.12 + `x` nudge) on alternating sentences. For a sound he must
  choose, render 4-7 short samples of HIS line and send them before building anything. What made the final cut
  (adam-1): 2.0x; close / far cuts (long shots split in two, alternating wide / `zoom` 1.2 with a `y` nudge so the head
  stays under the hook); a "Screen glitch" effect item (RGB split, torn bands, static) + a very soft glitch noise on
  EVERY jump cut - "scratches on the screen" meant THIS, not a cracked-glass overlay; skin = a light look (saturate
  0.85, warm -0.06, smooth 0.35 - he picked it from a sheet of 8 stills; strong looks were "too much"); a hard cut to
  the end card ON the last word with the music running through it (a music dip at the cut felt "like something is
  missing"); the hook held 20 s of the FINAL (sped) video, size 52, max 3 lines. Show looks as a labelled sheet of
  stills on Telegram before exporting.
- **`cut.join` fades eat words** (adam-1, 2026-11-08 - "some of the cuts are too eager taking words out"): with
  `join` 0.3 every piece fades out over its last 0.3 s, on top of `pad_out` 0.1. For a fast cut use `join: 0`,
  `pad_in` 0.1, `pad_out` 0.2, `after_last_word` 0.3 - and get the pace from `speed`, not from shaving the words.
- **Silent acting is content** (his words, 2026-10-29: "at the start I rock, scratch my head, play with the glasses - I
  need that bit, you cut it because there's no talking"): before trimming a take to its first word, LOOK at the frames
  before it (a contact sheet every second). Business without words (fidgeting, a look, a prop) stays; only the hand on
  the phone at the very start goes. Then move hand-placed overlays by the same shift (word-tied ones follow by themselves).
- **A `sequence` `to` right after a word eats it**: the join fades the piece out over its last 0.27 s, so a cut 0.05 s
  after "סוקר" lost the word ("לא שומעים את הסוף", 2026-10-29). Leave >= 0.3 s after the last word; if the next word
  follows too closely, keep the sentence in one take and start the next take after its repeat.
- **Trim a take's start / end with `cut.edges` [[where the cut put it, where it goes]] - never `cut.removes`** for that.
  removes run AFTER his drags, so the editor's edge stopped moving and he dragged six times for nothing (2026-10-23).
  The natural edges come from `lesson.spans` with no edges / removes. removes = a piece cut out of the middle only.
- **Several takes of the same passage:** show them before choosing - one numbered comparison video (`TAKE 1..n`
  burnt in, outside the footage folder) + a table of what differs; he picks. Drop exact duplicates by hash (the Drop
  can bring `<name>-2.mp4` copies); pick the takes with a `takes` glob that matches exactly those files.
- **Every change shows at once.** He hates waiting and "Updating preview". Only real picture work rebuilds.
- **What he sees is what he exports, and exports fast.** Same cut, sounds, text, filters, speed in both.
- **Subtitles follow what he SAID**, not the script (his ad-libs stay - add them to the script line). Hook text starts
  "פוב:" (never "POV:") unless his words have no prefix; his exact words; y ≥ ~250; max ~3 lines so it never covers
  a face (smaller `size` before more lines).
- **A still set has NO people in it** (rosenblum-1, 2026-11-10 - "it's a movie, so how can it be that people are
  still, don't move there? It doesn't make sense"): a crowd in a photo backdrop - even blurred, even "motion blur" -
  is frozen behind a moving person. Sets are empty places; the crowd lives in the SOUND (ambience beds, laughs,
  shouts). Also: an old-school CHARACTER does not mean an old place - "the teacher is old-fashioned, but the school
  shouldn't be"; a present-day Israeli public school (whiteboard, smart screen, AC), mid-range, not a 90s one.
- **One long TikTok-app take with a face filter (Rosenblum's lips / nose) - rosenblum-1, 2026-11-10, his notes on a
  "terrible first draft":** (1) the take is many recordings glued together: list the restarts (`ffmpeg -vf
  scdet=threshold=10`) and **never let a piece cross one** - after each restart the filter is OFF for ~0.3 s (his real
  face flashes) and before it he reaches for the phone; look at the frames around every restart and every piece edge
  (a contact sheet of first / middle / last frame of each piece) before he sees it. (2) **No RNNoise on a whispering
  character** - it removed Rosenblum's whispers ("the whispers are the main thing"): `clean: off`, a firm compressor,
  quiet pieces lifted by item gain. (3) Off-screen lines he recorded (Omer) go in his pauses over his OWN silent stares
  (cutaways from elsewhere in the take, never across a restart), each line levelled against his voice around it
  (0-2 dB under), and on **their own subtitles row** - another colour, font and place, with the name ("עומר:"). (4) A
  high-school class laughing = adult voices (the sfx model makes little kids from "class"; ask for 18-year-olds with
  deep voices, pick by measuring the pitch). (5) Measure the balance in a fast test export (music ~12-14 dB under the
  voice in the gaps), not by guessing gains. (6) **A hand change on a builder piece (zoom, box) makes it his** - the
  next rebuild keeps it AND adds the new one (doubles); deleting it puts it in `layer.removed` and it never comes back
  until that list is cleared (`layer.update set {removed: []}`). Do picture tweaks only after the last rebuild.
  (7) Out-of-order pieces (cutaways, a line moved) break the builder's subtitle placement - write the subtitles from
  the word times on your own row and hide the builder's row. The AI shot he couldn't film (a ball to the head):
  Seedance 2.0 **Fast** from a real frame composited on the set (it keeps his face; Mini drifts), cut in just before
  the action, our own impact sound on the hit frame, the music stops dead on the hit.
- **EVERY FRAME MUST MAKE SENSE - the set is shot from HIS camera's angle and distance** (rosenblum-1, 2026-11-10 -
  "something which always gets back to it... if we see him, we don't only see the background image and the back. You
  need to adjust the background so it will be really POV, otherwise it looks strange, doesn't make sense"). Before you
  make or pick a set, LOOK at his frames and read the camera: how high (a phone held low = looking UP: behind him there
  is upper wall and ceiling, lights, the top of the board - not desks and the floor), how far (a selfie at arm's length =
  his head fills a third of the frame, so the room behind him is big and close, never a doll's-house room behind a
  giant), tilt / lens. Prompt the set with exactly that ("steep low angle from a phone held at chest height 40 cm from a
  standing man, looking up: ceiling lights and the top of the walls fill most of the frame"), then place and zoom it so
  the horizon and the scale match his body. Check a still of EVERY set with him on it (big and phone-size) before
  handing over; a frame where he looks pasted on = not done.
- **The set must be where the camera really is** (adam-1, 2026-11-08 - "it's not realistic, he is sitting in front of
  the table so you can't see the table behind him... it happens a lot"): a person sitting at a desk / meeting table is
  filmed from ACROSS the table, so behind him there is only what is behind his seat - a wall, a window, his chair's
  back - never the table running away behind him. Before picking a background, look at his frame: seated at a table
  -> a "behind the seat, no table" set (library: `seat-yotam`, `seat-hani`, `seat-itay`, `seat2-a/b`); standing ->
  a set shot from standing height. A "head of the table" photo (the table in the front of the frame) fits only a
  person standing BEHIND that table's far end. Check the first still before handing over.
- **Cinematic, not overdone:** a real-looking scene first, effects as layers on top at moderate strength. He rejected
  shake, flashes, zoom kicks, heavy grades ("like Saw").
- **Sound is measured, not guessed** (dB per window, spectrum, ring-out after words). Phone / filter-app voices: find
  the actual problem first (muffled? ringing? codec "watery" top?) and fix that; one fixed loudness gain for the whole
  video (no level riding); never let processing eat a word (RNNoise ate an "אה" and a last word) - transcribe before /
  after.
- **The ending:** end on the last word. A character / company site goes on a **full-screen poster on black** right on
  that word (logo, the hook - e.g. "מחפשים עובדים!" - the site, the URL big and clear), held ~4 s. No Zoom tail.
- **Every video ships with two posters** (his rule, 2026-10-23: "for every video it has also to prepare story
  poster with link below"): the END CARD inside the video (above) and a **STORY POSTER** he posts the same day -
  1080x1920 JPG in the footage's Downloads folder, two versions: `<name>-story-instagram.jpg` with a dashed box BELOW
  ("👇 לקביעת טיפול 👇" / "👇 הקישור כאן 👇") where he drops Instagram's link sticker with the site URL, and
  `<name>-story-tiktok.jpg` with "🔗 הלינק בביו ⬆️" in that box (TikTok stories carry no link). Same art as the end
  card - a Leonardo portrait from his frame, the character's logo, the site's CTA in the character's voice, a line
  tied to the video's punchline. Nothing important in the top 240 px or the bottom 300 px (the apps' bars). Made as
  HTML + headless Chrome at 1080x1920, ONE render per call (parallel renders sharing a profile fail silently).
  Layouts to copy: `recipes/monologue.md` → tadar. Make both as soon as the script arrives - before the footage.
- **Story clips from story posters** (haredit-2 ads, 2026-10-28: "send me both stories as short movies of 10 seconds
  with the music of the Chani movies on 1.2 and add a poster at the end"): 1080x1920, 10 s - the poster with a slow
  push-in (zoom 1.00 -> 1.06) for ~7 s, a 0.25 s slide to an END CARD in the same look (the shop / site / CTA in his
  words) for ~3 s with a slight zoom-out; the series' music (`episodes/<series>/media`) through `atempo` at the speed he
  names, fade in 0.15 / out 0.8, `loudnorm` -14 LUFS; a different part of the track for each clip. ffmpeg trap: a
  looped still is 25 fps unless `-loop 1 -framerate 30` - the first try came out 6 s with no end card; count the frames
  (300) and look at a still from the end card before sending. End card = HTML + `_assets/dorit/tarot/shoot.mjs`, like
  the posters (`_assets/haredit/ads/booklet.html`). Telegram: an English caption (a Hebrew one in curl -F failed, 400).
- **A shop / brand from a video gets a site** when he asks (שפע עד, `public/shefa-ad/`): the same look as its ads,
  בס״ד at the top (a Haredi brand - his note), a photo for EVERY product (Leonardo packshots on white, MEDIUM, one
  per call - never text-only cards), jokes from the video's world in the copy, phone-width check. Then every list
  (wiki.md -> "A NEW site") and a deploy only after checking nothing else unfinished rides along (compare each
  changed page under public/ with the live one).
- **A script before the footage = a ready project before the footage** (2026-10-23: "prepare first the project
  reader then the rest, I'm filming" / "fill it while I'm filming"). He films with the Reader, and **the Reader lists
  PROJECTS, not scripts** - a script with no project never shows ("I don't see it here").
  **"Ready" means he opens the editor and sees every layer on the timeline** - set, wall pictures, stickers, texts,
  subtitles, music, end card - NOT a plan in episode.json that only Analyze turns into layers (2026-10-25, dorit-1:
  "why I can't see the Dorit project on the layers... I want you to create it already"). Never hand over a
  before-footage project with an empty timeline: build it on a stand-in take (step 3b). So, in this order:
  1. **Script** - `POST /api/scripts {name: "<id>"}` then `PUT /api/scripts/<id> {text}` (first line `# <title>`, a
     `# על המסך – ...` note above each line that gets a sticker / card). **The Reader text = only what the character
     SAYS** (2026-10-25, haredit-1: he had me strip the `**(stage directions)**` and the `**` marks - "רק את הטקסט
     שהיא אומרת"). **Directions (הוראות בימוי) ARE wanted (2026-10-28) - on their own row in parentheses**, e.g.
     `(נכנסת לחדר, מחזיקה טלפון)`: the Reader shows them as a dashed "הוראת בימוי" note that Play never stops on,
     and the pipeline shows them nowhere. Never inside a spoken line, never with `**`; the line stays only what's said
     (`editor.md` → "Directions"). A pasted script = a NEW script id - never paste it over a project's script in the Reader (that
     overwrote dorit-1's astrology script; restored from `scripts/<id>.txt.bak`).
  2. **Project, at once** - make the footage folder (`Downloads\<series>\<n>`, empty is fine), then
     `POST /api/new {name: "<series>-<n>", folder, from: "<last project of the series>"}`; set its `script` to the id
     and its Hebrew `title` (the copy still points at the old script). Tell him: "refresh the Reader, pick <id>".
  3. **Fill it while he films** - the pictures (stickers via Leonardo, cut out; the end card; the story posters) AND
     the project's layers in episode.json `overlays`, each tied to her words (`from_words` / `to_words`, a list of
     alternatives each) so the analysis places them where she says it: hook (draft), ticker, every sticker, the verse
     card, the mid-video polaroid, the blinking CTA, the end card (`poster`, `fade_in` 1.5, from her last line, no
     `to_words` = to the end), `music.lift`; the files in `media/` + episode.json `media`. What needs the takes
     (re-take overlaps, the end-card hold, the fade to black) goes in `_todo` for right after Analyze.
  3b. **Then BUILD it on a stand-in take, so he SEES every layer in the editor before he films** (his words, 2026-10-25:
     "when I say to create everything before the actual video, I want you to create it already. So why it's not
     there?" - dorit-1 had 32 overlays in episode.json and an EMPTY timeline). A stand-in = edge-tts `he-IL-HilaNeural`
     (or AvriNeural for a man) reading the script's spoken lines over his reference photo, "STAND-IN" burnt in, in
     `episodes/<id>/stand-in/` (git-ignored); `input_dir` there, eye contact off, Analyze through the studio. Check
     every overlay landed (count = episode.json overlays) and do the `_todo` on it, so he can move things now.
  4. Footage arrives -> `input_dir` to his folder, eye contact on -> Analyze (replaces the stand-in) -> redo the
     take-bound `_todo` (end-card hold, fade) -> review -> hand over.
     **Trap (dorit-1, 2026-10-25 - "you didn't run the fix eyes to look to the camera"):** the stand-in build saved the
     Person layer's `eyes: false`, and layer props are never overwritten by a rebuild - the NVIDIA copies were made but
     the editor kept showing the original eyes. After the real Analyze: `layer.update person props {eyes: true}` by op,
     and check `GET /api/p/<id>` → the takes' `eyes_engine` is set AND the Person layer's `eyes` is true.
     **Also:** the Reader edits whichever script is selected - if he pastes a new script over this project's, the
     analysis subtitles the wrong text (dorit-1 got another video's lines). Before Analyze, read the script's first
     line; `scripts/<id>.txt.bak` holds the version before the last project-script edit.
  Example: tadar-6 (spiritual-4, elections).
- **Mirror** a take when he holds up a book / sign and the letters read backwards (front camera): the Person layer's
  Inspector → "Mirror (flip left ↔ right)" (`props.mirror`, layers.md) - his picture flips, the set and texts don't.
- **As few layers as possible** (asked 2026-10-23 and again 2026-10-25): stickers / texts that are not on screen
  together share one layer - time them so they don't overlap; a second layer only for things meant to be seen together.
  Report "N items on M layers" (reference.md → "Few lanes").
- **A new character = a new idea** (2026-10-25: "don't copy. We need to come with our own idea for this project"):
  look at earlier projects for the mechanics, never reuse another character's look (stickers, set, music, posters).
  **Each character has ONE studio** used by all their videos, and the video's own pictures (a chart on her wall, a
  map) are separate layers on it (`behind: true` overlays) - never baked into the studio photo.
- **Real people:** no realistic images of real politicians at invented events; "תמונת AI" tag on realistic AI people.
  His own images / recordings stay out of the public git repo.
- **Every character is a real person** (2026-10-21): each recurring character gets their own web presence built the
  way THEY would build it - Ayelet's 2009 healer site (/ayelet/), Yuval's publisher page (/homo-useless/), Yotam's shop
  (/yotamverse/), Techy-Tech's corporate site (techytech.web.app - a serious company site, no jokes on it). Never
  "parody", never Shlomi's name on it. Every such site gets a button on his links page (public/links/), and the video
  shows it (an end poster, or a short ticker / blinking box that says "הלינק בביו" - never the boostmind URL).
- **Every video can have its character's site, and every site has a CTA that reaches his email** (his ask, 2026-10-23:
  "there should be a cta on the website, a call to do something... going to my email"). If a character has no site
  yet, offer one. Live now: /ayelet/ (book a treatment), /hindsight/ (join a plan), /demokratovich/ (ask the rabbi /
  pledge a donation), Techy-Tech (send a CV). How to make one:
  - **Look like the character would build it**, as lame or as slick as the real thing (a community-shul site: בס״ד,
    navy + gold, marquee, red "תרמו עכשיו" everywhere, a donation pop-up). The jokes are in the character's voice and
    from his scripts; the site plays it straight.
  - **Pictures with Leonardo** (below): his portrait from a frame of his footage, the logo, a product, an event photo.
    `public/<site>/img/` + `v/` for his video (a 540p copy). His face and recordings go in `.gitignore` (deployed from
    this machine, never in the public repo). A realistic AI crowd gets a small "תמונת AI" tag.
  - **The CTA = a form posted to `siteLead`** (`techietech-api/index.js`, emailed to shlomi@boostart.io; name + phone or
    email, a `choice` line and a message; nothing charged, nothing stored, a hidden `website` field for bots). A new
    site = one entry in `SITES` there, then `cd techietech-api && firebase deploy --only functions:siteLead --project
    boostmind-b052c`, then one test POST with curl (a "בדיקה" name) before he relies on it. Money is only ever a pledge
    ("we'll call you back") - never a payment.
  - **A good link preview** (WhatsApp / social - he asked, 2026-10-23): `img/og.jpg` 1200x630, under 300 KB, made as
    HTML and shot with headless Chrome (his portrait, the logo, the name, one line in the character's voice, the CTA);
    og:title / description / url / image (ABSOLUTE https URL - WhatsApp ignores a relative one) + og:image:width /
    height + `twitter:card` summary_large_image. Check with `curl -A "WhatsApp/2.23" <url>`.
  - Deploy the site (`bash scripts/deploy.sh` from BoostMind - never a bare `firebase deploy`), check the URLs 200,
    add the links-page button, and give the video a poster / CTA that sends them to the bio.

## ElevenLabs - more people from his own voice (his call, 2026-10-23: "it might be a game changer")
`node zoomcut/tools/elevenlabs.mjs choir <his take.mp4> <out.wav>` = a crowd singing / saying it WITH him: the voice
changer (`eleven_multilingual_sts_v2`) turns his take into 4 other men (Brian, Bill, Callum, Roger), each lined up
to his take by its loudness envelope (they come back within +-20 ms), 0/15/30/45 ms apart, one hall; mix it UNDER him
(a sound tied to the take: `at` = `from` = the take second, gain ~0.45). Also `sts <in> <voice> <out>` (his line in
one other voice), `voices`, `balance`. Key: `ELEVENLABS_API_KEY` in `zoomcut/.env` (git-ignored, never printed).
- **Cost** (always tell him): ~1000 credits per minute of audio per voice; Creator plan = 300k credits a month,
  ~$0.07 per 1000. The medley (8 songs x 4 voices, made twice) used 12,195 credits (~4%, ~$0.90).
- The plan allows 5 requests at once - the tool retries; run takes one after another. The voices are kept in
  `<out>.voices/` - a new mix never pays twice.
- **Never re-time a voice** (an asetrate detune drifted 0.2 s over a song - "the singers are not synced").
- **Each singer its own layer, never one mixed choir** (his words: "put all the singers as layers. Don't merge
  them"): one `sounds` entry per take per singer with `lane` 0-3 (= Sounds 1-4, renamed "קהל – <name>" by op), the
  file = the voice kept in `<choir>.voices/<voice id>.mp3`, gain ~0.36, `room` 0.4.
- **Tie a take's sound to where HIS voice starts in it** (`from` = `at` = the piece's `in`, e.g. 1.13): `at` 0 put
  every choir 0.7-1.4 s late - the cut starts the sound at the clip, not before it.
- **Nobody sings on the dot** (his words): Brian 14-22 ms early, Roger 4-12 early, Bill 18-26 late, Callum 36-44
  late, a few ms different every song. Late = `at` later than `from`; early = `from` later than `at` (start further
  into the singer's own recording) - an `at` before the clip start is clamped to 0.
- Clear the project's `work/layers/sounds/` after replacing a sound file under the same name (cached copies).
- Free alternative to compare: his own voice through `rubberband=pitch=..:formant=preserved` x4 (0.84 / 0.92 /
  1.06 / 0.5), same delays and hall. Send him both (A / B) the first time a video needs a crowd.
- **Hebrew voices, picked per song** (2026-10-23, "some came out good and some terrible"): the 8 Israeli men in the
  account ("HE Nimrod / Itamar / Viktor / Dorian / Itai / Omer / Tomer / Amit" - the tool's default 4 are Hebrew now).
  Convert every song with every voice, then SCORE each pair: the recogniser on the voice vs his own take's words
  (clarity) + the loudness-curve correlation with his take (timing, and its lag). Keep per song only timing >= 0.75
  (0.85 on a wordless niggun - no voice says "רק") and clarity within 0.25 of that song's best; e.g. "אנא עבדא" kept 4,
  "גוש השינוי חי" all 8. Depth baked into each kept file (close dry / mid darker + short room / far darker + more
  room, gains 0.26 / 0.24 / 0.20). 8 songs x 8 voices = ~5k credits.
- He is happy to spend the credits ("you can even use them all") - quality over saving; still say what it cost.
- Try a big change to his video on a COPY (`<id>-he`: copy episode.json, captions.txt, project.json, media/, work/)
  while he is still checking the original (his ask).
- **Quirky / awkward comedy music = the LIBRARY first** (tzvika-1, 2026-11-02): five rounds of ElevenLabs Music (28
  tracks, ~45k credits - cartoon instruments, genre beats, a Terra-written brief, variations) were all "terrible"; the
  real TikTok comedy beds he knows were approved at once: `_assets/music/library/` (Kevin MacLeod, CC BY 4.0 -
  credit line in the caption, see LICENSE.md there; Sneaky Snitch, Fluffing a Duck, Monkeys Spinning Monkeys
  approved). Offer those (in Media, on a pick page) before generating anything; generate only for a character-specific
  bed (a niggun, a song). Of the generated ones only `_assets/music/quirky/awk-boombap.mp3` was "not that bad".
- **A character's OWN bed = Leonardo Music v1, 1 minute, looped** (asaf-1, 2026-11-03: ElevenLabs at 80% of the
  month, "use the Leonardo budget - the last time"): `node tools/leonardo.mjs music <prompt.txt> <out.mp3> 1 --about ...
  --tags ...` (Eleven Music resold, whole minutes, instrumental; ~$1.05 a minute, ~700 of the Leonardo tokens; 22k left
  on 2026-11-03). **Make 1-minute tracks and loop them in the editor** (his words: "create usually a 1 min track which you
  can then stick in a loop") - never 2 min. Each character gets its own bed; brief the CHARACTER, not the scene (Asaf =
  "the annoying friend everyone is fed up with - נמאס על כולם"; he picked the sneaky pizzicato + nagging bassoon caper).
  Send the options to Telegram as audio AND on a page he can open from his phone (he is often away from the PC).
- **Music beds** (2026-10-25, "find the background music suitable... create it with 11 labs or Leonardo"):
  `node zoomcut/tools/elevenlabs_music.mjs <out.mp3> 80 "<prompt>"` (Eleven Music, instrumental). Only 2 requests at
  once on this plan (a third gets 429). Make 3 options in the character's world, put all three in the project's
  `media`, pick one for `music.sound`; **never ask the prompt to be "quiet / sparse / gentle so speech sits on top"** -
  that made three slow, empty tracks he called awful (2026-10-25); the level is the mix's job. A bed with a
  character = a composition plan (`node zoomcut/tools/elevenlabs_music.mjs <out.mp3> - <plan.json>`: global styles
  with the BPM + instruments, negative styles slow / ambient / sparse / vocals, 4 sections). Measure every option's
  tempo and onsets per second before offering it (he can't be the first to hear a slow one). ~1,200 credits per
  90 s track; measure its LUFS and set `gain` against a known bed (tadar harp: -17.2 LUFS at
  0.08 → a -9.5 LUFS track ≈ 0.04).
  **A sad Hasidic niggun** (demokratovich-nechama, 2026-10-29): a crying clarinet in freygish = "a holocaust song"; a
  wordless solo + choir plan = "too empty"; what he loved ("מודז'יץ זה ענק!!!") = a composition plan, Modzitz-style
  men's choir in rich harmony, charming tenor/baritone, solemn and noble with a hopeful lift, strings + clarinet + piano
  + bass, 72 BPM, negative styles tragic / crying / funeral / sparse / empty; wordless lines ("Ai dai dai...") give the
  men's voices. File: `_assets/demokratovich/nechama/niggun-E-modzitz.mp3` + `niggun-E-plan.json`. A plan with
  vocals costs ~3,400 credits per 90 s (~₪0.25). Send options to his Telegram as audio (sendAudio, a title each).

## Keys - where each one lives (read before saying "I have no key")
Never print a key, never write one into a file in the repo, never ask him for one that is listed here.
- **OpenAI (GPT: Terra, SOL, Luna, image models through OpenAI)** - two working keys:
  - **Local scripts / sessions:** `OPENAI_API_KEY` in `scripts/design.env` (the Shlomiverse design key - Backstage →
    הוצאות counts it; missing → `node scripts/design-env.mjs`). Never the Aspect or Plaxzy key (their spend doesn't
    show as the verse's), never `BoostMind/.env` (revoked). `openai.js` run inside `c:/workspace/BoostMind` takes the
    design key by itself - no `--env`. A script you write reads `scripts/design.env` (CLAUDE.md → AI keys).
  - **His own key** (he gave it 2026-10-24, "use it"): Google Secret Manager on boostmind-b052c as **`WIKI_OPENAI_KEY`** -
    it runs the live wiki chat (`techietech-api/wiki.js`, `defineSecret('WIKI_OPENAI_KEY')`). In a local script:
    `KEY=$(gcloud secrets versions access latest --secret=WIKI_OPENAI_KEY --project=boostmind-b052c)` into a variable,
    never echoed. The project's `OPENAI_API_KEY` secret belongs to something else - never overwrite it.
  - Models: `gpt-5.6-terra` (his pick for chat and Hebrew copy), `gpt-5.6-sol`; `node ~/.claude/skills/openai-leonardo/scripts/openai.js --models` (from the repo) lists them.
- **Pictures and sound effects** (`tools/leonardo.mjs`): `OPENAI_API_KEY` (pictures, direct), `ELEVENLABS_API_KEY`
  (sounds, direct) and `LEONARDO_API_KEY` (the fallback + video) - all in `zoomcut/.env`, the editor's own keys; the
  tool reads only that file. A missing OpenAI key = it says so and goes to Leonardo - never borrow another project's.
- **ElevenLabs, NVIDIA (eye contact), the Drop, Instagram / Facebook / TikTok / YouTube / X:** `zoomcut/.env`.
- **Gmail** (sending): aspect-agent-server/.env; **Telegram:** xplace-auto-bidder/.env.
- **Secrets the deployed functions use** (`gcloud secrets list --project boostmind-b052c`): GMAIL_USER, GMAIL_APP_PASSWORD,
  WIKI_OPENAI_KEY, LEONARDO_API_KEY, MAPS_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY (not ours to touch).

### ElevenLabs - the whole toolbox (learned 2026-10-27, haredit-2; docs + github.com/elevenlabs/skills)
**ElevenLabs out of credits? Leonardo resells it** (his tip, 2026-11-09 - "I'm almost certain you can create in
Leonardo"): `POST https://cloud.leonardo.ai/api/rest/v2/generations {model: "dialogue-v3", public: false, parameters:
{prompt, voice_id, language_code: "he", prompt_influence: 0.5, quantity: 1}}` = ElevenLabs v3 speech on the Leonardo
tokens (~$0.13 a short line; voice ids = ElevenLabs' presets - George JBFqnCBsd6RMkjVDRZzb, Brian nPczCjzI2devNBz1zQrb,
Adam, Daniel...; no Israeli library voices). Hebrew came out exact, audio tags honoured and not read (haredit-5 sponsor
VO). Poll v1/generations/<id> until COMPLETE; the file URL has the Hebrew words in it - take it from the parsed JSON,
URL-quote it. **Ambiguous Hebrew words: write the vowel marks** - plain "פרווה" was read as fur (parva); "פַּרְוֶה" came out
parve (check a word's sound: transcribe just that word with language 'en'). (`seed-audio-1.0` = Chinese / English voices only, `music-v1` / `sound-effects-v2` in tools/leonardo.mjs.)
He said "I don't think you are utilizing all of its power with annotation". What it can do, measured:
- **Speech: `eleven_v4`** (`POST /v1/text-to-speech/<voice>`, `language_code: "he"`, `voice_settings {stability 0.3,
  similarity_boost 0.75}` - v4 takes only those two; lower stability = more emotion). In Hebrew v4 beat v3: "מלכי
  עלתה על השיש" came out exact on v4, "מרקי ... לשייש" on v3. Always transcribe a generated line before using it.
- **Audio tags = the annotation**: inline, in brackets, where the delivery changes - `[panicked, out of breath]`,
  `[whining]`, `[straining, frustrated]`, `[flat, matter-of-fact]`, `[shouting away from the phone]`, `[sighs]`,
  `[crying]`, `[whispers]`, `[laughs]`, `[sarcastic]`, `[excited]`; combine them (`[calm again, into the phone]`).
  Punctuation directs too: `...` = a pause, CAPITALS = stress, `—`/`-` = cut off. Tags are NOT read aloud (checked).
- **Text to Dialogue** (`POST /v1/text-to-dialogue`, `inputs: [{text, voice_id}]`, `model_id eleven_v4|eleven_v3`,
  `language_code`, `settings {stability}`, `seed`): a whole multi-voice scene in one file, up to 10 voices / 2,000
  chars; interruptions = a dash at the cut + `[jumping in]` on the next turn. Use it when the lines overlap each other;
  separate lines when he needs to move each one (usually - every sound its own item).
- **`audio_effects`** on TTS and dialogue: `filter_preset_id` (Phone, Low Quality Phone, Bright Phone, Old Radio,
  Cheap Microphone, Robot), `environment_id` (Small Room, Big Room, Hall, Tunnel, Street, Valley, Forest),
  `background_noise_id` (Call center, Café, City, Keyboard), `distance`, `pan` (`GET /v1/audio-effects/catalog`).
  We generate CLEAN and put the phone on in the editor (`filter: phone`, live, adjustable) - bake it only if he asks.
- **Sound effects** (`POST /v1/sound-generation`, `model_id eleven_text_to_sound_v2`, `duration_seconds` 0.5-30,
  `prompt_influence` 0.5, `loop: true` for a bed): specific prompts that combine elements and context ("a boy with a
  plaster leg cast clumsily climbing a wooden kitchen cabinet: wood creaking, doors banging, a heavy thud"). One file
  per event (each its own item he can move), plus one looping bed under the whole scene.
- **Voice Design refuses children** (`/v1/text-to-voice/design` -> 403 "safety guidelines" for "a 12-year-old girl") -
  never rephrase around it. A young character = a young ADULT library voice + `pitch` 1.1 on the item (live): Hebrew
  library voices `GET /v1/shared-voices?language=he&age=young` - Zina (female, `Tbj9UQjXon5RB9MPEyc2`), Dorian (male).
  Crying / screaming kids come from sound effects (generic vocalisations), never a designed child voice.
- **The other side of a chaotic call** (haredit-2, his favourite thing in it - "super funny, though nonchalant"):
  **a little kid on the line = CHIPMUNK**: her real lines (v4) at item `pitch` 1.7 (the rate goes up with it - 4.8 s
  -> 2.6 s), `filter: phone` - "like chipmunks, a little girl saying stuff quick" (his words, 2026-10-27; plain
  mumble was the step before). **Nobody else speaks but the hero** - no office / colleague mumbles ("I don't need any
  other one speaking"). **Any word is Hebrew TTS, never a sound effect**: the sfx model voiced "mommy" in English -
  "אמא!" on the call = v4 `[crying, shouting] אמאאא! אמא!` DRY + `filter: phone` only - everything heard during a
  call comes out of the phone: no `room`, and no "far away" in the tag (v4 bakes reverb in; he heard an echo). And **the house events LOUD**
  (gains 0.6-0.9 on a crash / crying / climbing, 2-3x a bed) - in HIS pauses, each answering the line before; under the whole call a looping chaos bed;
  on top the events, each timed to a word (a crash, then the crying, right before "מי בוכה שם?"); all through
  `filter: phone`; the caller deadpan while the house burns, Hani calm over it. Assets: `_assets/haredit/calls/`.
  **Real words, never mumble slices** (2026-10-28, on his takes: "where it was real speech it works really great";
  mixed mumble / words = "can't be some understood, some not"): he writes the other side's lines into the script, every
  line = its own v4 file (`_assets/haredit/calls/brachi-rNN.mp3`; names with niqqud - שְׁרוּלִי - or v4 says
  "שאולי"), transcribed before use, all levelled to one loudness (-20 dB active, gain per file). His pauses are
  0.1-0.4 s and her lines 1-3 s at 1.7: **never slow him down to make room** (tried `cut.slow` on his pauses -
  "don't make Hani go slower when she talks to Brachi - if you need, make Brachi speak faster", 2026-10-28; near-frozen
  pieces also went black in the export) - her line starts on his pause at `tempo` 1.3 (+ pitch 1.7) and may run under
  his next words. Under a side conversation (he talks to a colleague, phone covered) her long nagging plays over him,
  ~7 dB softer, and keeps going until he is back on the phone (generate more lines if it runs out). The background
  (house bed, wails) stays well under her.
  **The whole call is QUIET** (his words, 2026-10-28, asked three times: "it's coming out of the phone... it can't be
  louder than her... much quieter"): every lane of the other side (her lines, the house bed, the events, the
  shower) through `filter: phone`, the lanes at ~0.3-0.35 volume - her words still clear but plainly a phone held
  to Hani's ear; only the phone ringing on the desk (in the room, no filter) keeps its level.

## Pictures - every picture we make (sets, portraits, logos, stickers, posters' art)
`node zoomcut/tools/leonardo.mjs image <prompt.txt> <out.jpg> <flare|sunburst> MEDIUM 1024x1024` and
`... portrait <his-frame.jpg> <prompt.txt> <out.jpg> flare MEDIUM 0.6 1024x1024` (repaints from a reference: his face,
wig, beard kept; 0.5 when the scene changes a lot).
**Since 2026-10-30 the same commands call OpenAI directly** (pictures) and **ElevenLabs directly** (`sfx` / `loop`) -
the very models Leonardo resells, 30-67% cheaper for pictures, ~4x for sound, same quality (measured side by side,
faces from references held). Leonardo only as the fallback - the tool says why and switches by itself on a refusal,
an error or a missing key - and for `video`; `--leonardo` forces it. OpenAI has no reference-strength dial: the
strength (0.5 / 0.6 / 0.8) becomes a sentence in the prompt ("keep exactly the face, pose and position"...). Each
result line says which side made it and what it cost. **Key: his official Leonardo account's key in `zoomcut/.env` (`LEONARDO_API_KEY`, set 2026-10-26 - he: "this should be the official API key we are using for our editor to run everything"); the script reads ONLY it - no fallback; the aspect project runs on its own Leonardo key and the two never cross (his ask, 2026-10-27). Never another key.**
- **Models - only these two** (his taste, 2026-10-20: "I'm loving more the sunburst and flare models"):
  `flare` = `openai/gpt-image-2.5-flare` - photoreal people, portraits from his frames, sets, event photos;
  `sunburst` = `openai/gpt-image-2.5-sunburst` - logos / emblems, products, die-cut stickers, flat graphics.
- **Cheap (his rule):** MEDIUM and the smallest size that works - 1024x1024, 1536x1024 for a wide one. Never HIGH /
  HD / 2x unless he asks. Direct on OpenAI (2026-10-30): 1024x1024 MEDIUM $0.013, 1024x1536 $0.010, a portrait from
  a reference $0.019 (Leonardo charged $0.021 / $0.030 / $0.033).
- Run several at once (`&` + `wait`), look at every result before using it; batches of ~8 (Leonardo, the fallback,
  refuses beyond ~10 pending - "RATE_LIMIT_EXCEEDED").
- **Real politicians as tarot cards / costumes, when he asks** (2026-10-25: "create a BB tarot and Gadi tarot and
  Bennett and Yair Lapid"): reference = the Wikipedia lead photo (`action=query&prop=pageimages&piprop=original`,
  a UA header, resized to 1024), `portrait ref.jpg prompt.txt out.jpg flare MEDIUM 0.6|0.8 1024x1536`, both
  strengths, pick per person; the card carries a "תמונת AI" tag; refs + results stay git-ignored.
- **No words in the picture** (Hebrew breaks): ask for "no text" and put the words on in HTML / a text layer.
- A logo or sticker: ask for it on a flat white / mint background, then `tools/cutout_logo.py in.jpg out.png`.
- A real person's face never - his own face, from his frames. No real politicians at invented events.
- **A character based on a REAL person** (he worries about being sued, 2026-10-21): the character gets a fully fictional
  name - in the hook, on the site, on the poster ("נהור (ציון) מינוף", not the real surname); the site gets
  `<meta name="robots" content="noindex">` so a search for the real name never lands on it; faces are his own
  (Leonardo from his frames), never the real person's; nothing collected or charged.

- **Family members of a character** (Hani's husband and nine kids, 2026-10-28): a child = `portrait` from the parent's
  portrait at 0.6 ("the son of the woman in the reference - a clear family resemblance"); one who looks like the other
  parent = that parent's picture as the reference. A spouse who must NOT look like her = a plain `image`. Studio
  portraits on light grey, like the rest of the family; a scene with two people = both pictures side by side as ONE
  reference ("the woman on the left... the boy on the right"). Then a profile per person and relations both ways.
- **Leonardo and children:** it refuses ("failed" / "rejected", ~$0.03 each) a picture with TWO young children, and a
  crying child most of the time (the first one slipped through); after a few refusals it refused even plain child
  portraits that had worked an hour before. Don't loop: two photos side by side as an album is the honest fallback;
  a child pasted in by hand (GrabCut + shadow) looked fake - he called it "terrible". Ask him before spending more.
- **The family WhatsApp** (his ask: Hani "sends" the story photos to the family): Hani has a kosher phone, so she writes
  from the office computer ("חני · מהמחשב בעבודה"), seen on Grandma's phone; a real-looking group - the photo, her
  caption, two or three replies from Grandma / an aunt / an uncle. NO stickers ("the sticker makes it not realistic").
  `_assets/haredit/wa/` (wa.css + one HTML per photo, shot with shoot.mjs).
## Characters - the multiverse (his ask, 2026-10-23)
Every recurring character has a profile in the studio (left rail → **Characters**): name, portrait, who they are,
personality, catchphrases, look, voice preset, **pace** (words per minute), writing rules, relations, their website,
their videos and their assets. It's where he learns about them and briefs a session ("Copy brief for a session").
**A new character is not done until it is in every place of workflow step 12** (profile, the world's site, their
own site, the wiki, the chat agent - tested).
- **Data: the Shlomiverse's database** (since 2026-11-06, his rule: "I don't want duplication and git stuff where we
  don't need it") - one record per character (catalogCharacters/<id>; the worlds = catalogSeries, each with `world` =
  the name a character's `world` uses), the same record the site and the chat use. The studio reads and saves it
  (render/verse_db.mjs - `GET / POST /api/characters`); there is no character.json / index.json / profile.md any more.
  A session changes a character through the page / `POST /api/characters/<id> {patch}` (null clears a field;
  `site` = `{url, notes}`) or `node scripts/verse/content.mjs put character <id> --file patch.json` (the
  shlomiverse-content skill) - every change is logged (`content.mjs log character <id>`). A save of the studio's own
  fields (voice, pace, links, videos, sources, portrait, assets, tier, site notes) doesn't touch the site; anything else
  recomposes the site and the chat in seconds - never dozens of those in a row. Images stay files on each computer,
  referenced by path (`assets.portraits / backgrounds / logos / sounds`, `portrait`; zoomcut/characters/<id>/ is
  gitignored - his face, public repo - and the same on both computers by the cloud pool); the face on the site is the
  portrait sent with `content.mjs portrait <id> <image>`.
- **Every video:**
  - Before you build it, find its characters on the page (`GET /api/characters`).
  - **A new character gets a profile first:** `POST /api/characters/<id> {patch: {...}}` with name, world, role and brief
    from the script, a portrait from his frame, the look and the voice preset.
  - **The profile picture is made on OpenAI directly with GPT Image 2.5 flare (or sunburst)** - his rule, 2026-10-31:
    `node zoomcut/tools/leonardo.mjs portrait <his-frame.jpg> <prompt.txt> <out.jpg> flare LOW 0.6 1024x1024`
    (`OPENAI_API_KEY` in `zoomcut/.env`; LOW is enough, MEDIUM at most, never HIGH; ~$0.01 LOW / $0.019 MEDIUM).
    Never Leonardo for it (the tool only falls back there by itself on an OpenAI error - say so if it does).
  - Then the video lists them: project.json `"characters": [ids]`. The builders fill it (Zoom: the participants;
    one camera: the series' character). Check it, and add a guest character by hand.
  - Use the profile when writing for the character: the catchphrases, the writing rules (e.g. Yotam speaks in the first
    person; the sites never say parody) and the relations.
- **Writing for a character:** read their profile first - `node scripts/verse/content.mjs profile <id> --out p.md` (from BoostMind; read the
  Hebrew from the file). It's the same text as the page's "Copy profile for a session": who they are, what they do, how
  they talk (and their pace), what's funny about them, the rules, the people around them, and what their videos
  already did - built from the database each time, so it's always current.
- **Pace** comes from the Reader by itself. Measuring a character (⏱ by the name) or typing their pace updates the
  profile. The name must match the character's `name` / `aka`.
- After a video is done, add anything new you learned about the character to their profile (a new catchphrase, a
  new set, the website's new page). The page is the one place that knows them.

## The Shlomiverse, the links page, his images - read `wiki.md`
His world on the web is filled from this studio: **שלומיוורס** (https://boostmind-b052c.web.app/wiki/ - every
character, every video, a chat with each one in their own voice), the **links page** in all his bios
(https://boostmind-b052c.web.app/links/), and **his own analytics** (/stats/). A new character or a finished video
reaches them only through step 11.
- **Profile photo:** https://boostmind-b052c.web.app/links/shlomi.jpg (880x880, studio with the wigs) ·
  older: https://boostmind-b052c.web.app/links/profile.jpg
- **Facebook cover:** https://boostmind-b052c.web.app/links/img/fb-cover.jpg (1640x624) · sharp:
  https://boostmind-b052c.web.app/links/img/fb-cover-2x.jpg - made from his real portraits (`scripts/wiki/fb-cover.html`).
- Deep links for posts and end cards: `/c/<character>`, `/v/<video>`, `/chat?with=<character>`.

## Recipes - read the one you need
Under the hood two engines exist: `lesson.py` (one camera - almost everything) and `zoomcut.py` (a Zoom grid of
separately filmed characters). Pick by the footage; never name things after a series in the UI.

| What he recorded | Recipe | Engine |
|---|---|---|
| **"quick edit" / עריכה מהירה** - one person in short phone takes (TikTok app, face filter), joined tight + POV + the character's music, minutes, ONE round (Asaf) | `recipes/quick-edit.md` | lesson.py |
| several characters, one file each, a meeting / call grid | `recipes/zoom-call.md` | zoomcut.py |
| one person talking to camera - rabbi lesson, guru podcast (tadar), news anchor, keynote | `recipes/monologue.md` | lesson.py |
| one person reacting to a voice we don't see - a Zoom at his desk, a phone call on speaker, an office day (Hani) | `recipes/offscreen-voice.md` | lesson.py |
| **a new Hani Friedman video (haredit-N)** - read this FIRST: the steps + every lesson from haredit-2 | `recipes/hani.md` (then `offscreen-voice.md`) | lesson.py |
| a silent stare + her thoughts as voice-over (Gen Z), cinematic | `recipes/genz-thoughts.md` | lesson.py |
| **a teaser / preview from a still** (a comic cover, a poster - no footage), and the **Shlomiverse bookends** ("שלומיוורס מציגים" / "רק בשלומיוורס") on ANY teaser or preview: `python tools/verse_bookends.py <project>` | `recipes/teaser.md` | layers only |
A new kind of video: start from the closest recipe and the closest earlier project, then write its recipe file when
he signs off.

## More
- `layers.md` - **the project format**: layer kinds, items, ops, builders, export. The contract for filling a video.
- `wiki.md` - **the Shlomiverse, the links page, his profile / cover images, his analytics**: addresses, step 11,
  the chat, his rules for those pages.
- `publishing.md` - **posting to his socials**: what each platform takes (caption, hashtags, limits), how to write
  the post, how to prepare it for him.
- `editor.md` - how the editor, the live cut, layers, the background render and the export work (read before
  changing code).
- `reference.md` - every episode.json setting, the tools (Leonardo, sound kit, eye contact, sending), gotchas.
