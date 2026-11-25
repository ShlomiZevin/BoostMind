# Release: naomi-tips (Dr. Naomi-Tzipora: "4 ״אל תצפו״ שכל מנהל HR חייב להכיר בעבודה עם Gen Z")
Status: prepared, waiting for footage.   Release day: when he says.   Scope: the video (no world pieces asked).
Resident: naomi-tzipora. Format: she sits silent and serious in her clinic; the tips appear as cards (his words: script.md).
His text replaced mine. My pun one-liners were "bad" (memory feedback_naomi_tips_style).

## His notes (2026-11-25)
- Naomi sitting (or standing) with a serious face in her clinic. "5 tips / things you have to know" style video.
- Inspirational / relevant music, LICENSED: he adds it himself (TikTok / Instagram music). No music in the project.
- Prepare everything: her logo, her book, her clinic, her certifications. He will point where the text goes and we move it there.

## Prepared (2026-11-25)
Project **naomi-tips-1** (http://localhost:4747/?ep=naomi-tips-1; Drop folder naomi-tips-1), 54.9 s at 1×. Rows by group:
- הקליניקה: set A2 (the armchair under three gold frames, her brand palette) + her 3 diplomas as real layers exactly over
  the set's frames (emotional doula, Hebrew; MD Psychiatry; NLP·CBT·TMI·EMDR practitioner - HTML, correct text) + her
  book standing on the side table.
- נעמי: empty picture row (cut-out on) for his take.
- הטיפים: card (burgundy shape, gold edge) + number pill + heading + body, all text layers. Title 0–4.5 s (with her white
  logo), tips 4.5 / 16.5 / 27.6 / 41.1 – 51.9 s (3 s + 0.3 s a word).
- סיום: 3 s end card, her book (3D) + logo on cream.
Media also has: sets A / B (standing at the bookcase) / C (at her desk), the book cover, both logos.
Files: script.md, shoot-sheet.md, mock-naomi-A2.jpg. Builder: the session's scratchpad tips/build.py (rebuild only while he hasn't touched it).
Cost: 4 sets + 1 mock = ~$0.19 (studio key).

## When the footage lands
Put his take on `naomi.video`: one clip over the whole length, cut-out on, framed so her head sits under the frames. No speech, so no fast_cut. Then move the cards to where he points, check the timing against his take, and leave the music to him.

## Footage (2026-11-25)
His take: Drop folder "דולה טיפים" (one 5:00 clip, three attempts in it - his words: use the LAST one). Analysed on the hidden copy _naomi-tips-1-takes (cut-out: RobustVideoMatting, the whole body; the stool is not in it).
Built into naomi-tips-1 (rev 4): the last attempt 235.0-297.5 s (from when she has sat down to before she gets up) on naomi.video, sitting in the clinic armchair at 1.8x (her hips on the cushion), the whole body seen. Cards re-timed to her 62.5 s: title 0-5, tips 5 / 19.6 / 33 / 49.4 - 62.5, end card 62.5-65.5. No music (his, licensed).
Seen at 3x: clean edges (hair, shawl, raised arm); a sliver of the stool's seat shows beside her leg at times.

## REDO (2026-11-25 - his notes: "almost a redo", "the graphics are terrible", "the comedy comes from the editing")
His asks: start a split second after he presses record (the step back is part of it); a high bar / kitchen stool, not the armchair; a more exaggerated institute (more diplomas, a conference roll-up); DESIGNED graphics - every "אל תצפו" identical, only the text changes, highlight the 4 / Gen Z, each tip like a page of her science's brochure with illustrations in her look; reveals timed to her hand moves ("make it magic"); beauty / colour; his 2 songs on 2 rows (to choose only - he publishes with licensed social music).
Built (rev 7, 1:17): take 216.0-220.5 (1x, his face at the lens) + 220.5-233.6 (2.5x, the walk to the stool) + 233.6-297.5; set S1 (velvet bar stool, gallery wall, blank roll-up) with her own face on the wall (2 magazine covers + an award photo), her doula diploma, her roll-up banner (designed); look {saturate 1.08, contrast 1.06, brightness 1.05} + grade 0.4 + vignette 0.3.
Graphics (design/design.html -> design/gfx, render with design/render-design.cjs): the "אל תצפו" ribbon (gold foil on burgundy, the same piece through all tips, it stamps at each new tip), gold medallions 1-4, headline bands, brochure panels (illustration + text + "שיטת המחוג הפנימי™" footer), title: gold 4 + "״אל תצפו״" + the bottom band (it also hides the edge of his picture while he is close) + Gen Z pill; sparkle bursts at her hands. Tips at 18.1 / 32.1 / 43.7 / 57.7 s: header on her gesture (arm out right), the panel on the next (arm up). Illustrations: _assets/naomi-tips/art (GPT Image, her book-cover look). End card: book + "לכל רגש יש תאריך לידה" + logo.
Songs: Enya "Caribbean Blue" (playing), Einaudi "Experience" (muted) - own pace. Builder: design/build2.py. Cost of the redo: 2 sets + 4 illustrations ~$0.25.

## ROUND 3 (2026-11-25, his notes: "progress, but still a mess")
- Her strip centred (box x 54; his zoom 1.3 / y -0.06 kept). New set S3 (`_assets/naomi-tips/sets/naomi-institute-S3.jpg`): stool in the middle under her (box x -151), no faces on the wall - diplomas only; the roll-up banner stays (he liked it).
- All type designed by GPT Image 2.6 (design key) in the look of her first release's story posters: title = one sentence lockup, the identical "אל תצפו" header per tip (top), a brochure card per tip (bottom), end card = her invitation to organisations (מאונבורדינג לבונדינג, shlomiverse.com/dr-naomi). Hebrew read word by word; card 4's band word patched from card 2. Files: design/gfx3/, design/build3.py. Cost of round 3 ≈ $0.95.

## ROUND 4 (2026-11-25, "really really good now", 6 notes)
- Video exactly as shot: box = canvas, zoom 1, centred, one framing all the way (no dead sides, crossed-leg foot never cut). Room S4 at 1.5x (box -262,0,1536,2304): seat at her hips, footrest ring under her foot.
- The clothes reveal at real speed (216-226), the walk 226-233.6 at 2.5x. Title v2 ("אל תצפו" = the tips' pill, the object): low while she's at the lens, gone for the reveal, back above her once seated.
- Everything in the safe zone 225-1440: header big from her hand on gesture A, shrinks to the top on gesture B and the card opens under it (above her hair). Gestures from the matte outline: tip1 242.0/243.8, tip2 253.0/255.1, tip3 267.6 + the unfold 270.0-272.9 (6 strips following her sweep, a glow riding her hand), tip4 281.5/284.0.
- Stars replaced by a soft glow at each reveal. design/build4.py, gfx4/. Round 4 GPT ≈ $0.26.

## ROUND 5 (2026-11-25, 12 notes) - rev 42
- No speed change anywhere (one clip 216.0-292.5 at 1x, runs 0.45 s under the end card's fade). Title once, low, frame 0 -> tip 1, "4" on the right (title3, GPT). Her name as she steps back (text layers, font.heebo = media/Heebo.ttf).
- Explanation cards = editor TEXT layers (group "כרטיס הסבר": card.box shape, card.illus round picture, card.leadbg + card.lead, card.l0..l6 lines measured with Heebo), smaller; no "שיטת המחוג הפנימי". Headers stay the GPT images (gfx4/head-N).
- His timings: tip1 243.40 / card 244.53; tip2 254.47 / card 258.20; tip3 267.60 / unfold 270.0-272.6 (card, lead, lines, illustration last + glow on her hand); tip4 281.50 / card 284.00; end 292.5. Banner to the floor. design/build5.py, gfx5/.

## HANDOFF (for a dedicated session)
naomi-tips-1 rev 42, all notes answered. Rebuild = scripts/releases/naomi-tips/design/build5.py (checks the rev; keeps his look + music rows). Set S4 at box (-262,0,1536,2304); her video full frame as shot, never re-framed or sped. Gestures come from the matte (work/matte/...quality.mkv, 432x768 -> canvas x2.5). Safe zone y 225-1440. Read his notes: node zoomcut/tools/notes.mjs naomi-tips-1. Never export unless he asks.
