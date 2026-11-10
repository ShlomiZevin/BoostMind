# הקטר המאסף - Rosenblum's shelter drill (Lemmings)

## His words (10 Nov 2026)
- "בוא ניצור משחק למורה רוזנבלום... סרטון חדש של איך מורים מתנהגים בירידה למקלטים" - script rosenblum-1 (the drill).
- Picked Lemmings: "lemmings is awesome!!!!!" - "do it as fun as simple as addictive as lemmings",
  "especially cause the teacher says there to walk in columns, not like an ant swarm".

## The game
Lemmings, our version. Upright phone. A side cut through the school (המקיף נווה תדהר): the class on the top floor,
the shelter (מרחב מוגן) at the bottom. The siren goes, the classroom door opens and the class walks out by itself,
**two by two, holding hands** - 14 pairs, and last, alone, **Shahar the קטר מאסף**. They walk straight on, turn at a
wall, take stairs down, and go wherever their feet lead: into the toilets ("בירידה אין שירותים!"), after another
class's column ("לא להיגרר אחרי כיתות אחרות!"), out to the yard where the ball is. You are Rosenblum: pick an order,
tap a pair.

### Rosenblum's orders (a few of each per level, like Lemmings' skills)
| Order | Lemmings | What the pair does |
|---|---|---|
| ✋ עצור! | Blocker | Stops, arms out; everyone who reaches it turns back. Tap again to release (free). |
| ↩️ חזור! | (turn) | The pair turns around once. On Shahar: he runs all the way back to the classroom (the script's ending). |
| 🪑 גשר! | Builder | The pair lays a row of chairs over a gap in front (a hole in the floor under repair, a spilled-water patch). |
| 🚪 פתח! | Basher | Opens the closed door / moves the cart blocking the way. |

- **Lost** (never hurt): a pair that walks into the toilets, joins another class, goes to the yard, or falls into the
  storeroom below a hole is "lost" - Rosenblum writes the name on his list.
- **Win**: enough pairs in the shelter (the level's quota, e.g. 11 of 14) before the siren drill ends; Shahar must come
  in LAST - the קטר מאסף closes the column (bonus "טור מושלם").
- **Columns, not an ant swarm**: kids walk at a spacing; pairs that bunch up get "לסגור רווחים!" chatter - the neat
  column is the joy of watching it (Lemmings' march).
- Other classes (רעות's class) walk the stairs as moving columns - a timing hazard: hold your class with עצור until
  they pass.
- Fast-forward button, pause, restart level - Lemmings' controls, nothing more.

### Levels
~12 hand-made levels, each one screen (no scrolling), each a puzzle with exact orders. New order introduced every
few levels (Lemmings' first levels each teach one skill). Level names in his voice: "רק הולכים", "בירידה אין
שירותים", "הכיתה של רעות", "לא מטיילים באמצע השיירה"...

### Score + daily record
Per level: pairs saved x100 + seconds left x5 + 300 if Shahar came last. Run score = all levels played in a row.
Daily record = best total of the day (`VerseFrame.score`), record unit "נקודות", better "high".
Levels unlocked are remembered (`shlomiverse:drill:level`).

### Rosenblum's lines (the speech strip, short, from the script)
"שניים שניים! לסגור רווחים!", "אני רוצה לראות טור! לא נחיל של נמלים!", "שחר! לאן אתה רץ?! אתה הקטר המאסף!",
"במדרגות לא רצים!", "בירידה אין שירותים. מתאפקים.", "לא להיגרר אחרי כיתות אחרות!", "עצור! עצור! מי נתן הוראה
להתקדם?!", "להיכנס פנימה! עד הסוף! לא להיעצר לי בפתח!", "עשרים ושמונה... רגע, יצאנו עשרים ותשעה." (loss),
"עומר, איפה שחר?" (Shahar lost).

## Look
Painted, warm Israeli school: corridor tiles, green doors, notice boards, stairwells, the shelter's heavy door.
Kids are small painted sprites (a pair = two kids holding hands, walk cycle), Shahar alone with a backpack.
Rosenblum's painted head in the strip at the top (from his portrait). Orders at the bottom under the thumb.

## Tutorial (steps)
1. "אתה המורה רוזנבלום. צופר - תרגיל ירידה למרחב מוגן."
2. Goal: spotlight the shelter + quota - "הכניסו לפחות X זוגות. שחר נכנס אחרון."
3. Lost: spotlight the toilets - "מי שנכנס לשירותים - הלך לאיבוד."
4. The orders bar - "בחרו הוראה, ואז הקישו על זוג."
5. Try it: "עצור!" on the first pair (waits for it).
6. Release it - tap again.
7. Siren bar + fast forward + restart.
8. "מוכנים? יורדים."

## Where
- Game: `public/rosenblum-games/drill/` -> shlomiverse.com/rosenblum-games/drill/
- Workshop: `scripts/rosenblum-games/drill/`
