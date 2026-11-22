# השהיית תגובה - Naomi's game (gate 3: the plan)

## His words
- "I want a game that she created, like for handling emotions and stuff ... a parody that she will be creating." (2026-11-22)
- "In the verse we do everything as real persons, with depth, information and data. The parody is real life parody."
- Picked idea #1 (Fruit Ninja -> her managers' app). Concept approved: "Yes, the design looks great."
- His bar (via the VRM): "nice, fun, super cool, and mobile friendly".

## What it is
A real product of hers: **"השהיית תגובה" - the managers' app of the program "מאונבורדינג לבונדינג"**, by ד״ר נעמי־ציפורה
בן־נון־פרידמן־שטרנבך, under her brand המחוג שבלב (logo, rose-burgundy palette). It looks and talks like a real wellness /
habit app: her coaching, streaks, a weekly progress report with "data". Never a wink - the comedy is how exact it is.

## What you do (Fruit Ninja, our version)
- You are the manager. Your own messages to a new employee (24, three weeks in the company) keep popping up from your
  keyboard at the bottom and fly up toward his chat at the top, like fruit tossed into the air.
- **Swipe = pause the message** before it reaches him (it bursts, "הושהה"). Several in one swipe = a combo.
- **Read before you swipe** - that is the thinking:
  - **Harmful** (pressure / control): "מה הסטטוס עם המשימה?", "נו?", "??", "דחוף!!", "יש עדכון?", "הלקוח מחכה", "רק מזכירה"... -> swipe.
  - **Bonding** (attachment): "איך עולה לך היום?", "אני כאן בשבילך", "קח את הזמן", "גאה בך" -> let it reach him; it lands with a
    warm glow and calms his needle. Swiping one = "פגעת בהתקשרות" (needle up, combo lost).
  - **Golden - his own message**: "אני לא יודע איך להתחיל את המשימה." floats up from his side: never swipe it; let it reach
    you = the big bonus "הבעת קושי!" (her greatest success).
  - **The "נו" that wasn't written**: from the second half, a status message you pause leaves a small faint "נו" behind it -
    swipe it too ("ילד מרגיש הכול").
  - **Breath** (power-up, rare): a round "נשימה" bubble - swipe it = 4 s of slow motion, her line "לעצור. לזהות מה עולה."
  - Later in the round the colours stop helping: all messages come as the same white chat bubble, and disguised ones
    appear ("מה שלומך עם המשימה?", "בלי לחץ, אבל מתי?") - only the words tell.
- **His inner needle (המחוג הפנימי)** is the health bar: every harmful message that lands kicks it toward red; bonding ones
  and time calm it. Each time it hits red = a strike, in the order from her case:
  1. התקף חרדה  2. תלונה למשאבי אנוש  3. מכתב התפטרות = the round ends ("הוא התפטר" + buzzer, plain).
- **A round = one work week in 75 s** (א׳ -> ה׳ ticker in the HUD), speed and density rise each "day"; Thursday ends with a
  pressure burst ("הלקוח מחכה!"). Survive the week = the end report. Instant start - the first messages fly within 1 s.
- Score: each pause 10 x combo multiplier ("השהיה רצופה x5"), bonding landed +20, golden +200, breath 0.
  The same week for everyone each day (seeded by the date) -> the verse's daily records (`VerseFrame.score`).

## The end report (the concept's end screen)
- Survived: "הצלחה אדירה!" + a weekly report from the round's real numbers: השהית N תגובות · רצף הכי ארוך · התקפי חרדה ·
  תלונות למשאבי אנוש · and always "המשימה: עוד לא התחילה" as a calm neutral row. If the golden message landed - his
  message card with the badge "הבעת קושי ראשונה!" and her "המממ... זה מרגש. וזה גם אמיץ.". Score, best, "עוד סבב" (main),
  "לתפריט".
- Resigned: "הוא התפטר" + buzzer, the same report numbers, no joke line; "עוד סבב" + "לתפריט".

## Her voice
A thin coaching strip at the bottom edge with her round face (never over the play field): short lines at real moments -
start "מה עולה אצלך ברגע הזה?", a combo "תראי, מה שאנחנו רואים כאן...", a bonding one sliced "זה הלחץ שלך. למה שהוא
יווסת אותו?", a near-red needle "ילד מרגיש הכול.", breath "לעצור. לזהות מה עולה.". Lines from her sheet + the video, the
employee is "הילד" in her mouth. The manager is addressed in plural (the video's manager is a woman). Her term
"אוטיזם תעסוקתי" is not in the game. Text only in v1 (her real voice is not on this PC; an AI voice of her - only if you ask).

## The look (approved concept)
Bright rose / coral / apricot / burgundy, glossy cards, swipe trail with sparks, particle burst on a pause, warm glow on
a bonding landing, gold shower on the golden one, needle animating, screen shake + red flash on a hit.
Painted (GPT Image 2.6): the employee (sunburst HIGH, 4 faces: calm, worried, panic, relieved), Naomi from her portrait
(sunburst HIGH: coaching, hand on heart, concerned), the office background (flare), blank card pieces red / warm / white /
gold + the needle gauge + the breath bubble (flare), cover, title art, hero, share, story picture. All words in code
(Rubik), exact Hebrew.
Start screen per the menu rule: 3 mockups A/B/C for you to pick, then "שחקו" + "איך משחקים" + "חזרה למשחקים" + the record.

## Sounds (ElevenLabs, several variants each)
Phone buzz per incoming message (3), swipe whoosh (4), pause pop / soft chime (3), combo rising chimes, bonding landing
warm tone (2), harmful landing thud + the needle kick, heartbeat that speeds up near red, strike stings (anxiety / HR /
resignation), golden fanfare, breath slow-mo whoosh, day-change tick, Thursday rush alarm (soft), week-survived fanfare,
resigned buzzer, button taps; an upbeat light music loop. Levels evened out.

## Tutorial (Space / Enter / "הבא", Esc = skip, counter, spotlight)
1. "אתם המנהלים. ההודעות שלכם עפות אל העובד החדש." 2. The goal: get through the week without him resigning.
3. The needle: harmful messages push it to red - 3 times red = התפטרות. 4. Try: swipe a "מה הסטטוס?" (waits for a real swipe).
5. Try: let "איך עולה לך היום?" through (waits). 6. The golden message - never swipe. 7. Combo + score in the HUD.
8. The breath bubble. 9. "מוכנים? שבוע עבודה מתחיל." Runs on the first play, and from "איך משחקים".

## Where
`public/naomi-games/pause/` (index.html, game.js, game.json `character: "naomi-tzipora"`, `status: "draft"`, cover.jpg,
assets/), workshop `scripts/naomi-games/pause/` (prompts, raw art, tools/t1-play.js, t2-phones.js). Canvas 2D, phone
upright first, the frame protocol (`/verse/game-frame.js`, `--safe-t`), stats site `naomi-games`, test hook
`window.PAUSE`. Draft until the VRM's release day; on release a card on her site + her resident page via game.json.

## Decisions (his, 22 Nov 2026)
- Concept approved ("Yes, the design looks great"). Plan approved WITH HER VOICE (AI voice, ElevenLabs "Danit - Natural Israeli Hebrew"; her lines are SAY in game.js -> assets/vo/<key>-<i>.mp3, played when present).
- ElevenLabs out of credit: "without sounds for now, I'll raise it later". 5 sounds made before it ran out (warm1-2, heart, strike3, win); the rest are in sfx/list.tsv - make them + the voice lines when he says the credit is back.
- Draft 1 played: "Good, go on". Start screen B (chat-bubble buttons) kept.
- Round 2 (his notes): the voice does NOT have to be hers - "a therapist voice, very calm, very, very comforting. It will be funny." Drafts only on shlomiverse.com, never a claude URL. "Not clear what you need to cut" -> new painted cards: red spiky + pause badge = swipe, pink cloud + heart = let it land, gold + star = his; colours honest all week (white phase removed). Missing sounds + background: from the libraries (his OK) until ElevenLabs is refilled.
- Sound sources (draft 2): pings = osnat not-a-cog ping-1..3; swishes = Plaxzy sky-jam swish-a/b/c + hoops/swipe; pops = Plaxzy pop-it pop-a/b + beauty-salon/pop; hit = meetings wrong-1/2; strike1 = not-the-question reject-1, strike2 = Plaxzy container-pack/stamp, strike3/heart/warm/win = ElevenLabs (ours); golden = Plaxzy matchjelly/winjingle1; breath = duelstones/cast-holy; tick = shekel-tov/tick; rush = star-guard/alarm; lose = ghost-grabbers buzzer; tap = meetings tap-1/2; music = not-the-question music-loop (to be replaced by her own calm wellness-app loop); room tone = Plaxzy beauty-salon ambience.

## Status
- Draft 1: https://claude.ai/artifact/54eQyqgQb8cYfcSXfiNWd2 (private; rebuild with `python scripts/naomi-games/pause/tools/draft.py <scratch dir>`, then publish the same path).
- Tests: tools/t1-play.js (tutorial with real swipes, play, win, lose), t2-phones.js (4 phones, landscape, desktop, the verse frame), t3-balance.js (slow 2/10 wins, lost on days 4-5; normal 10/10, ~1.4 strikes; sharp 10/10). Serve with `cd public && python -m http.server 5311`.
- Faces (his face): public/naomi-games/pause/assets/face/ + cover.jpg are git-ignored -> gs://shlomiverse-private/releases/naomi/game/public-face/ + public-cover.jpg (the deploying computer needs them).
- Story picture for the VRM: art/story.jpg (bucket: workshop/art/story.jpg).

## Left before release (gate 5)
- 21 more sounds + her voice lines when the credit is back; level the volumes.
- Release day is the VRM's: game.json status live, stats site `naomi-games` (techietech-api/analytics.js SITES + backstage SITE/GAME, deployed), wiki build + push, a card on her site, the story.

## Spend
Concept $0.10 + game art (sheets, bg, pieces, title, key, 3 menus, 2 ui sheets, cover, story) ~$1.6 + 5 sounds ~$0.03 = ~$1.75.
