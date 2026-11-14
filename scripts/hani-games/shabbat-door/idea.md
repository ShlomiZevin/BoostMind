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
