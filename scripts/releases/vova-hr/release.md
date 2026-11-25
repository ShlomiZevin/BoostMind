# Release: vova-hr (Techy-Tech - Vova vs Osnat, HR)
Status: building (before footage)        Release day: when he says
Scope (his call, 2026-11-24): VIDEO ONLY - "this time we won't release anything besides the video, but prepare everything now".
Residents: vova (וובה קוגן, DevOps, the cynical veteran), osnat (אסנת ברגר, Head of People). Company: Techy-Tech (the verse's high-tech office).
Hook / POV (his line): "העובד הוותיק הזה שכבר אין לו סבלנות ל-HR"
Script: script.md (his text; the fake-laugh cues as stage directions).

## His notes (2026-11-24)
- A high-tech office: the sets use the Techy-Tech logo so they look like the company's offices.
- Osnat stands in the doorway, leaning on the doorframe the whole conversation, so the angles have to suit that (shot / reverse shot: Vova seated in his room; Osnat standing at his door).
- Prepare everything the edit needs: the project, the Reader, the sets, the sfx (no music unless asked, no TTS, no marketing).

## Editor
A NEW editor sub-agent (he did not open an editor session). Project id: vova-hr-1.

## Prepared before footage (2026-11-24)
Project vova-hr-1 (Reader lists it; Drop folder vova-hr-1; PDF Downloads/vova-hr-1-script.pdf). Reader parse: only וובה and אסנת as speakers, 7 stage directions. "חרולד פרינו" (his joke) is in the script.
Sets: sets/sets-grid.jpg (A1-3 Vova's room, B1-3 Osnat's doorway); top picks A3 and B1 on the timeline, the others in Media. Frame mocks: sets/mock-vova-A3.jpg, sets/mock-osnat-B1.jpg. Shoot sheet: shoot-sheet.md. Knock sfx at the start. Hook text 0-5 s. No music. Cost ~$0.44. Sent to his Telegram. HE APPROVED A3 + B1 ("its perfect", 2026-11-24). Waiting for the footage (Drop vova-hr-1).
FIRST CUT = `tools/fast_cut.py vova-hr-1 plan.json` (his ask 2026-11-25: use the new fast-cut tool on today's dialogue). MUST USE LAYER GROUPS (his words 2026-11-25: "we will have to use the layers group"): one group each, וובה / אסנת, sets from the vova.bg / osnat.bg rows (A3 / B1), first line after the knock ("start" ~1.1), subtitles spelled from script.md, the line "זה עם חרולד פרינו" kept as he says it.

## Footage (2026-11-25)
Vova's take is in: Drop folder "עובד וותיק" (one take, 2:52, gs://boostmind-drop/עובד וותיק/). Analysed on the hidden copy _vova-hr-1-takes and linked into vova-hr-1 (asset t.v1c044g50000dc3a2avog65kbc7lp5pg, mark use).
All 8 of his lines are there. The FROM line: the 2nd attempt (from 105 s); its last sentence: the retake at 150 s (fast_cut drops the earlier one by itself). The "אולי אם" restart at 27 s is out. He ad-libbed the skill-review ending ("...נשגב מבינתי"), which stays. Whisper hears "הרולד": check by ear that he said "חרולד" (the subtitles take the script's spelling).
plan.json = the cut in order (Osnat's 8 lines are placeholders, take "OSNAT-TAKE"). WAITING FOR OSNAT'S TAKE, then `fast_cut.py vova-hr-1 plan.json --go` (groups וובה / אסנת).
Osnat's takes are in, in the same Drop folder "עובד וותיק" (11 .mov). 8 lines plus her 2 reactions inside the FROM line ("לא, לא שמעתי." / "לא שמעתי על מה זה, זה קשור למשאבי אנוש?"). Her ad-libs are kept ("וובה, דווקא העובדים בדרך כלל מאוד מרוצים", "ממש לא וובה"). ״ברור…״ was shot twice: B903A525 is in the video (the script wording); 7974EF94 is in Media as the alternate.
FIRST CUT BUILT 2026-11-25 with tools/fast_cut.py (plan.json): 2:57 at 1x, 26 clips, groups אסנת / וובה + the strip (20 shots), the turns overlap 0.1 s, she starts at 0.45 s at the door with the knock under her (3 knocks, 0-0.47 s), it ends on Vova's "...פרוקטולוג מומחה, כן?". Subtitles in each one's own words, script spelling where it's the same word, חרולד (his word). Osnat framed at 80% in her doorway (the Techy-Tech logo shows). Font asset added. No music, no export yet.
Open: the subtitle "אתה נכה בעוז" (132.9 s) is whisper's guess at his ad-lib; he should say what he said.
ROUND 2 (2026-11-25, his 17 notes, all answered on the notes): Osnat full width with no side fade, her doorway at 2x (the door jambs right at her); Vova mirrored (his mug reads) + his room mirrored (vova-room-A3-mirror.jpg, the logo / mug / 1999 pasted back readable); her laughs whole (lines start at the first sound); the pauses inside her speech cut; 0.3 s sound handles at every turn; Vova cuts her off at "אימפקט" (0.7); her "לא, לא שמעתי." after "FROM, כן?" and "זה קשור למשאבי אנוש?" heard off-screen (room, no cut); her last line in 1.2 s earlier; censor beep on "בתחת" + "בת$% שלי"; his subtitle corrections. Music: 5 Techy-Tech beds (sagi's waiting-tiptoe playing, own pace). 2:15 at 1.3x. Post-build script: the session's scratchpad vova-post.py.

## Round 3 (2026-11-25) - "not bad, one very messy area"
- His framing from p4 (zoom 1.13, x -0.175, y -0.21 + room box) on every Vova shot.
- FROM section: her one recorded answer FF9A5476 ("לא שמעתי על מה זה, זה קשור למשאבי אנוש?") right after "את לא מכירה FROM?", off-screen, no room/muffle fx, gain 0.72. C130A6D7 and the split piece are out. Everything after moved +2.61 s; Vova listens (take 6.07-8.69) under her line.
- "המחלקה שלי" no comma; her last line from his mark (from "המפגש"); "בת-" heard (take 163.19-163.35), then the beep. Rev 78, 2:17 at 1.3x.

## Round 4 (2026-11-25) - the FROM section as he explained it
- Vova "FROM, כן?" -> Osnat HEARD only (C130A6D7, no fx, gain 0.75, Vova not slowed) -> "את לא מכירה FROM?" -> Osnat SEEN (FF9A5476 picture + voice) -> Vova's monologue on, no gap (v29->v31 one stretch, -1.73 s).
- Her last line whole again (laugh + "נו אז הנה וובה") from his mark, Vova's answer +1.93 s; the video ends at his mark. Rev 97, 177.57 timeline s (2:16.6 at 1.3x).
- Lesson: his "she should start from here" = MOVE her line to start there, never trim its head.

## Round 5 (2026-11-25) - FROM section by the fast_cut dialogue rules (rev 108)
- Vova one continuous stretch 105.06-110.88 (no jump); Osnat heard (C130) over his pause; her seen answer FF9A starts 0.13 s before his last sound, picture cuts to her on her first word (in 0.353); Vova back 0.13 s over her "אנוש?", picture back on his first word. End right after "מומחה" (take 170.80), timeline 177.17.
- plan.json updated to this structure. WHY it broke: the rest was placed by fast_cut; this section was hand-patched round after round. Next change here = by the same rules (onsets, OVER 0.13, cut on first word), or rebuild from plan.json and re-apply the post edits.

## HANDOFF (for a dedicated session)
Project vova-hr-1, rev 108, 33 notes all answered. Post edits on top of the fast_cut build: subtitle fixes + censor beep (scratchpad vova-post.py logic: "בת-" heard, beep from take 163.35), 5 music rows (waiting-tiptoe playing), his framing p4 (zoom 1.13, x -0.175, y -0.21, bg box -331,-138,1758) on every Vova shot, Osnat full width side_ramp off, her last line whole from his mark. Read his notes: node zoomcut/tools/notes.mjs vova-hr-1. Never export unless he asks.

## Round 6 (2026-11-25) - his 4 notes, rev 120
- His new Drop recording rec-121723.m4a ("מה זה FROM?", audio only; it had NOT been pulled locally - check `gcloud storage ls` of the Drop folder when he says "the recording in the Drop") replaces C130 "לא, לא שמעתי.": heard only, cuts in on Vova's "כן?", +19 dB copy in Media (osnat-ma-ze-from.wav, the slider stops at 2x).
- FF9A (seen answer): voice was 0.47 s off her lips (dragged); now in sync, picture on her first word (src 0.78 - whisper says 0.37, the energy says 0.78), turns 0.1 s; everything after -7 frames.
- Her last line 0.37 s earlier (laugh at his note); everything after -11 more frames.
- End plays the whole "מומחה" (+9 frames). Length 5297 frames (176.6 s timeline, 2:15.8 at 1.3x).

## Round 7 (2026-11-25) - hook, caption, cast; his 3 notes (rev 134). NOT to be uploaded yet (his word).
- Hook = his words "פוב: העובד הוותיק הזה / שלא מבין איך ה-AI חסך לו עבודה / והארגון הוסיף לו עבודה" (size 40, y 250, 7 s timeline). Caption = Terra option 1 + the 4 high-tech tags, saved in Send; cast vova + osnat (fixed).
- 1:05 jump: a 0.28 s pause cut inside Osnat's take 724396CE - now one continuous clip, everything after +8 frames.
- White halo around Vova in the export only = an exporter bug (raw take + matte at the edge instead of the editor's fg copy) - sent to Studio Dialoug; his two halo notes answered with that, still open.
