# דלת של שבת (hani-games/shabbat-door) - started 14 Nov 2026

## His words
Script: "POV: אתה יושב ליד החרדית של המשרד – חלק 4" (Abba falls into a pothole on Rabbi Akiva on Friday night, Shabbat at
Tel HaShomer, one roll = no lechem mishneh, Reb Shmulik brings a roll from the other building, the eruv, Shabbat lights).
He picked "Red Light Green Light", then: "red light green light בדלתות אוטומטיות של בית חולים" - the hospital's Shabbat
doors. "פשוט תכין ושים את זה דראפט".

## Decisions
- Mechanic: Red Light, Green Light (new in the verse). Each Shabbat door opens/closes BY ITSELF on a timer.
- Hold "הולכים" to walk, let go to stop. "בשינוי" = a short hurry (2.2 s per door, ring around the button) - Avraham
  Moshe's heter from the script.
- The yellow sensor mat in front of the door: on it (or in the doorway) while the door is not open = it opens because of
  you -> "חס וחלילה!", +5 s, back to the start of the scene.
- Light above the door: green = open, red = closed, yellow blinking = about to close; the number = seconds left.
- A staff member sometimes comes through and opens the door (legit - you can pass behind him).
- Route: 7 doors - orthopedics -> out of the building -> the path (eruv) -> internal ward, Reb Shmulik gives the second roll
  (1/2 -> 2/2) -> back x3 -> "לחם משנה! נס בתוך נס!".
- Score = time (lower better), daily seeded doors; record unit שניות.
- Hani = player (back-view walk poses painted from her portrait). Avraham Moshe is never seen (his profile).

## Tutorial (9 steps)
who/rolls -> goal -> the Shabbat door -> the light -> the sensor + penalty -> try: walk & stop -> try: בשינוי ->
try: wait for green and pass -> staff may open it.

## Files
art/ (prompts + raw paintings), snd/ (raw ElevenLabs), tools/prep.py (cut -> public assets), tools/sfx.js,
tools/t1-play.js (tutorial + 3 bots), tools/t2-phones.js (5 sizes + landscape). Server: python -m http.server 5302 in public/.

## Round 2 (14 Nov 2026) - his note
"Let's do it red light, green light, as we had in Squid Games... just in our hospital. Put timers on the doors for when
the color is changing, and without פסיעה גסה."
- Now the Squid-Game rules: GREEN = the door is open, walk; RED = the door's sensor watches the whole corridor (a red beam
  sweeps) - any movement after a 0.28 s grace = "חס וחלילה!", back to the start of the corridor. No sensor mat any more.
- Each phase has its own length (seeded by the day); a timer sign above every door: colour light + ring + "0:0N" until it
  changes; yellow blink the last second; the motor-box light matches; a big "ירוק – הולכים!" / "אדום – קופאים!" call.
- בשינוי removed (no פסיעה גסה) - one button only.
- A 2:30 clock "עד המוציא" for the whole route; run out = "הסעודה התחילה..." (doors passed / 7). Score = time (low).
- Other visitors (3 painted Haredi men, from behind) play too; ~14% of reds one of them is caught and goes back.
- Bots: sharp 89 s, careful 99 s, very cautious 142 s, always-holding fails at door 1.

## Round 3 (14 Nov 2026) - his notes
- "Every level you start with חס וחלילה... not clear what happened" -> bug: the button held through a door was still held
  when the next corridor opened on red. Now every corridor needs a fresh press, and opens with a CARD: "✓ עברתם את דלת N!",
  "דלת N+1 מתוך 7", the department, the goal, "מוכנים... 3 2 1" (game clock paused) -> green. Green sparks on passing a door.
- "We need background music ... with beeps of hospital" -> ElevenLabs instrumental loop (pizzicato + klezmer clarinet +
  heart-monitor beeps), softer on red. Option B kept in snd/music-b.mp3 (quiet master).
- "Didn't get the 1 out of 2 breads... make it clear that you need a lechem mishneh" -> HUD: "לחם משנה" + one full roll +
  one empty (grey) roll; every card says the goal: to Reb Shmulik in פנימית for the second roll, then back to Abba.

## Round 4 (14 Nov 2026) - "לא צריך את החס וחלילה זזתי באדום... צריך פשוט פסילה, סאונד של פסילה וסאונד של הצלחה. חסרים סאונדים"
- Caught = "נפסלת!" (visitors: "נפסל!"), no Hani sentence. Loud elimination buzzer (3 variants).
- New sounds: door passed jingle (3), countdown ticks + GO on the card, tense ticks in the last second of green, shoe
  squeak when she stops (2), stronger red alarm / green go (3 each), scanner sweep loop on red, heartbeat in the last
  25 s, card whoosh (2), visitor eliminated (2), victory fanfare, sad trombone on time-out. All loudness-matched.

## Round 5 (14 Nov 2026) - "the other players' logic is broken; פסיעה גסה is gone; more seconds between levels; let me click to start"
- Visitors fixed: same-side visitors walked through each other (now they wait behind, gap 0.16), a sideways jump at the
  door (removed), late movers drawn standing (drawn walking now). Test: 0 overlaps, no jumps over 3 whole runs.
- פסיעה גסה is a rule again (not a hurry button): holding fills a ring around "הולכים" (2.6 s) and her steps grow
  (up to +70% speed); full = "פסיעה גסה! נפסלת"; letting go empties it (0.9 s). Warning ticks + "פסיעה גסה בשבת?! לאט!".
- The card between levels waits for a tap on "יוצאים!" (enabled after 1.2 s so it is read), then 3-2-1 -> green.
- Bots: sharp 56 s, careful 82 s, cautious 135 s; never-let-go fails (24 disqualifications), always-hold fails.

## Round 6 (14 Nov 2026) - "when I'm too close to the door it remains open... if it's with the person it's חילול שבת"
- The door follows its timer ONLY (no more "stay open while someone is in the doorway"). A dashed threshold on the floor
  marks the doorway (red when it is about to close). In the doorway after the light turns red = "נפסלת! נתקעת בדלת";
  visitors too, and they don't start through without time to cross. Test: door open on red = 0 frames in 3 runs;
  t6-doorway.js stops inside on purpose -> disqualified, door closes.
- Clock 2:50 (the doorway rule makes it harder). Bots: sharp 66 s, careful 105 s.

## Round 7 (15 Nov)
- Level card cut to 4 lines (done / door N of 7 + name / goal with arrow / יוצאים!), light card like the concept art/concept/card-a.png; during 3-2-1 only a big number.
- Walking is now TAP: one tap = one step. Taps under 0.23 s apart = running (+0.34 on the ring), under 0.32 s = hurrying (+0.2), the ring empties 0.4/s. Full = פסיעה גסה. Fast taps reach the door sooner, so the limit bites (hurry bot 0.22 s fails, sharp bot 67 s, careful 118 s).

## Round 8 (15 Nov) - "now the game is perfect"
- 3-2-1 = a red glowing light on the door glass (never over the timer sign), then a green "צעד!" light.
- No Hani strip during play: she speaks on the level card (face + bubble), and her face is on the failure / win banners.
- Tutorial key bumped to tut2, so everyone sees the new tap tutorial once; "איך משחקים" also in the pause menu.
