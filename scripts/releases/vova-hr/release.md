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
