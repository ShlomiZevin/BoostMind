# vova-hr-1 - handoff to the dedicated session (2026-11-25)

He called the last round "terrible" and moved this video to its own session. Read this before you touch it, then
`release.md` (the whole history) and the `edit-video` skill (FAST CUT section + recipes/dialogue-from-takes.md).

## Where it is
- Project **vova-hr-1** (Shlomiverse Studio, http://localhost:4747/?ep=vova-hr-1), project speed 1.3x, groups וובה / אסנת,
  the "What we see" strip (`view`). Last change by me: rev 108; revs since then are his notes only.
- Read his notes first: `node zoomcut/tools/notes.mjs vova-hr-1`. Answer each with `... done <id> "reply"`.
- Footage: Drop folder `Downloads/drop/עובד וותיק` - Vova's one take `v1c044g50000dc3a2avog65kbc7lp5pg.mp4` (2:52),
  Osnat's 11 .mov takes. Words per take: `zoomcut/episodes/_vova-hr-1-takes/work/words/<take>.json` (hidden analysis copy -
  keep it, the cut-outs come from it).
- The cut list: `scripts/releases/vova-hr/plan.json` (fast_cut's input), the script: `script.md`.

## The trouble spot - the FROM section (~1:33-1:45 at 1.3x)
90% of the dialogue was built by `zoomcut/tools/fast_cut.py` and he loves it. This section I hand-patched over 4 rounds
and every patch broke the rules the tool follows. **What he wants, in his words (round 4):**
1. Vova: "...זה מזכיר לי קצת כמו בסדרה הזאת, FROM, כן?"
2. Osnat - **heard only** (not seen): her recording **C130A6D7** ("לא, לא שמעתי"), as recorded - no effects, a bit quieter.
   Vova is NOT slowed for it (overlap is fine; speeding her up is fine).
3. Vova: "את לא מכירה FROM?" - **continuous with 1., no cut / no jump in his picture or voice.**
4. Osnat - **seen**: **FF9A5476** ("לא שמעתי על מה זה, זה קשור למשאבי אנוש?"). She starts answering while he finishes
   (the turn overlap), and the picture cuts to her **when she is already talking** - never on her setting up the camera.
5. Vova goes on with his monologue to the end ("נו, זה עם השחקן הזה חרולד פרינו..."), coming in over her last word like
   every other turn. No more Osnat until her last line.

The house rules for every turn (what fast_cut does): next speaker's first sound 0.1 s (at playback = 0.13 timeline s)
before the previous one's last sound; the picture cuts on the new speaker's first word; 0.3 s sound handles at turns;
never two subtitles at once; no cut inside one speaker's continuous stretch. Check lip sync after any move:
`(voice.in - voice.from/30) - (pic.in - pic.from/30)` within -40..+2 ms.

My suggestion (not tested): rebuild that stretch the tool's way rather than nudging items - plan.json already has the
structure (vova 105.06-110.6 continuous, C130 offscreen over, FF9A seen, vova 111.02-160.17) - try
`fast_cut.py vova-hr-1 plan.json` on a hidden `_` copy, compare, then bring the post edits below back on top.

## Post edits on top of the fast_cut build (keep them)
- Subtitles: his corrections (חרולד, "את הנכה בעוז", "אסנת, נו באמת", "נו, אה, פרוקטולוג מומחה", "המחלקה שלי" no comma).
- Censor: "בת-" is heard (take 163.19-163.35), the 1 kHz beep `media/censor-beep.wav` (row sfx.beep) from take 163.35 to
  163.60, subtitle "בת$% שלי".
- Music: 5 Techy-Tech rows in group "מוזיקה", own_pace; `music` (c-waiting-tiptoe) playing, the other 4 muted.
- Framing: his p4 framing on every Vova shot (item zoom 1.13, x -0.175, y -0.21; vova.bg box {-331,-138,1758});
  Vova mirrored with the mirrored room `m.vova-room-A3-mirror.jpg`. Osnat full width, side_ramp off, door at 2x.
- Her last line ("נו אז הנה וובה, המפגש הזה הוא...") whole, with her laugh, starting at his mark (after Vova's
  "של המקום הזה"); his "הנקודות כואבות" after it.
- The end: right after Vova's "מומחה" (take 170.80).

## Lessons he paid for
- "She should start from here" = MOVE the whole line to start there. Never trim its laugh / first words.
- Heard-only vs seen takes each have a purpose; if a take he mentions is missing, say so and stop.
- Never export or send unless he asks for that version.
