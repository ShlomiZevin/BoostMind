# Sagi - scooter snake (PLANNING, 5 Nov 2026)

## His words
"use make verse game and lets create a game for my shlomiverse scooter guy. תכנן משחק לזה. הבחור הזה מעבודה שמגיע על
הקורקינט מאוהב בקורקינט וחייב לדבר תמיד רק על הקורקינט שלו. ושים לב לפנים שלו זה צריך להיות דומה לפריימים יש לו מעין
פזילה כזו זה חשוב."
"Wait with his image. It's good. It looks like him, but he has his eyes looking at the same direction, like pozel" -
he may send an image of the eyes.

## Decisions
- Mechanic: Snake (his pick from 4: Snake / Paperboy / Subway Surfers / Excitebike).
- Story: Sagi rides his electric scooter through the Techy-Tech open space. Every colleague he reaches gets a scooter
  lecture and has to ride behind him - the line of bored listeners is the snake's tail.
- FACE: Sagi is פוזל - the squint must be in every painted Sagi (check against his reference image / sagi-1 frames
  before anything is used). Portrait techytech.web.app/team/scooter.jpg has straight eyes = wrong.
- Working title: "שמעת על הקורקינט שלי?" (to confirm).

## Plan (draft)
- Upright phone. Top-down painted open space on a grid (desks, pillars, coffee corner = walls). Sagi + scooter = head.
- A colleague stands somewhere -> ride into them -> Sagi's line in the speech strip ("בלם דיסק כפול!", "40 ק"מ סוללה!")
  -> they join the tail with a bored face. Score = people listening (daily record unit "מאזינים").
- Thinking: an Enterprise client visitor (worth 5) appears for a few seconds only; Ofer (his VP) walks a route - hit him
  and the run ends ("לחדר ישיבות, עכשיו"). Speed rises with the tail.
- Lose: desk/wall, your own tail, Ofer. 
- Controls: swipe anywhere + 4 big thumb arrows under the board; arrows/WASD on desktop.
- Sounds (ElevenLabs): electric hum loop, bell ding variants, catch pops, colleague sighs/groans (several), Sagi lines.
- Tutorial: who you are -> goal (everyone must hear about the scooter) -> how you lose -> steering (try it) ->
  catch a colleague (try it) -> the client -> Ofer -> ready.
- Lives at public/sagi-games/scooter-snake/ (built in this workshop until his OK), on Sagi's wiki page.

## 5 Nov - his reference clip
- Clip (2.7 s selfie) -> ref/frame-crosseyed.jpg: BOTH eyes turn IN toward the nose (cross-eyed), black bike helmet
  with loose straps, light-blue tank top, stubble, rectangular glasses. That is Sagi's game look (not the site's sweater).
- ref/sagi-painted.png (sunburst HIGH) = first painted Sagi; TODO remove the shoe brand logo before use.
- art/concept/concept.png = concept screen (its text is placeholder; real HUD is code, Hebrew).
- Music options art/music/music-a.mp3 (whistle/ukulele) / music-b.mp3 (electro-funk) - his pick pending.
- Keys: zoomcut/.env on this PC has no OpenAI/Leonardo key; he OK'd loading OPENAI_API_KEY from gcloud secret
  (plaxzy12) per session for oai-image.js. ElevenLabs key in .env works.

## 5 Nov - built (not released)
- Source = public/sagi-games/scooter-snake/ (build/ was the pre-release copy, now ignored). LIVE 5 Nov, silently (no story).
- Snake on a 9x15 grid, daily office layout seeded `scooter-snake|<Israel date>`; 4 desks + 5 props, Ofer's aisle row 7.
- Colleagues = real Techy-Tech people (his ask): c1 Yotam, c2 Hani (modest: tichel, long skirt), c3 Osnat, c4 Yaniv,
  c5 Tzvika, c6 Ido - each with own lines (PEOPLE in game.js). Ofer appears at 3 listeners; client at 4+ (worth 5, 7 s).
- Floating joystick (drag anywhere) + arrows/WASD. Music A in tutorial / alternating per run with B.
- Tests: tools/t1-play.js (tutorial + bot round + crash + end) and tools/t2-phones.js (5 sizes + desktop) - both pass.
  Local: node tools/serve.js 8765 -> http://localhost:8765/sagi-games/scooter-snake/?solo=1
- Library: every asset labelled (project game-scooter-snake) and pushed to the cloud library (tools/lib-push.mjs) -
  this PC's studio sync is off, so push by hand after adding.
- Release TODO on his word: copy build/ -> public/sagi-games/scooter-snake/, status live, SITES/GAME stats tables,
  /all/ catalog, wiki build+push, deploy-onto-live, story.
