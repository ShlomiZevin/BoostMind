# Handoff: marketing for "יוסף מוקיר שבת" (Hani's playhouse) - 30 Oct 2026

You are taking over the MARKETING of a finished game. The game itself is done and the user loves it - don't change the game unless asked.
Talk to the user (Shlomi) in Hebrew, short, and ask with clickable options (AskUserQuestion).

## The game
- Live direct link: https://boostmind-b052c.web.app/hani-games/yosef/ (the site now sends Cache-Control: no-cache, so every load is fresh).
- The card on the games page (https://boostmind-b052c.web.app/hani-games/) is still "coming soon" (yosef/game.json "status": "soon").
  To release it: set "status": "live" and run from C:/workspace/hani-games: `MSYS_NO_PATHCONV=1 node tools/deploy-onto-live.js yosef`. Do it ONLY when Shlomi says so.
- Source: C:/workspace/hani-games/yosef. Story: story.json (10 pages, niqqud). Narration: voice Itamar (ElevenLabs).
- The story (Bnei Brak take on Shabbat 119a): Yosef, an avrech hi-tech guy (wife + 7 kids, 3 rooms on Rabbi Akiva st), a developer in the BSR towers by Ayalon mall, saves all his Ten Bis (the ORANGE meal card) for Shabbat food. Zvi Kaplan - an arrogant, privileged, secular Ashkenazi hi-tech millionaire (80M exit), a Kaplan-protest leader, navy cap "ברית המשרתים" - asks his AI about his net worth in 10 years: "everything goes to Yosef Mokir Shabbat from Bnei Brak". He sells everything, buys one diamond, sews it into the cap. Thursday on a Kaplan bridge (sign "שוויון בנטל") the wind blows the cap into the truck of "המסעדה היהודית" (that is the place's name - always "המסעדה היהודית"), the diamond rolls into a cholent pot. Friday the pot is unsold, the workers run it to Yosef, he pays all his Ten Bis, finds the diamond, sells it, gets rich. "מאן דחסיך תן ביס לשבתא - פרעיה שבתא".
- 10 pages = 10 games: catch Ten Bis cards / Zvi whack-a-mole (Haredim pop out of "עולמה של תורה" shtenders with laptops dreaming of hi-tech, Zvi bonks them with the "שוויון בנטל" sign back to the Gemara) / find Yosef on the AI screen / biggest diamond / steer the cap in the wind into the truck / which pot has the diamond / run with the pot to Yosef (jump) / pay with Ten Bis cards in day order / scratch the cholent to find the diamond / tap gold coins into 13 attics.
- Art for the promo (all approved): new cover `yosef/art/v2/cover.png` (Yosef + Zvi + title, made with sunburst), pages `yosef/assets/pages/p01-p10.jpg`, Zvi `yosef/art/v2/zvi-2.png`, game sprites `yosef/assets/sprites/*.png` (zvi-up-r/hit-r etc., cap, workers, pop-a, bonked-a...), game screenshots `yosef/shots/` (n-phone-*.png, w-phone-0.png = the whack hit). Take fresh screenshots of the games if needed (tools/t2-new-games.js, tools/t3-whack-hit.js; local server: `python -m http.server 5301` in C:/workspace/hani-games).

## The existing promo is OUT OF DATE - redo it
- yosef/promo/: posts.html + render-posts.js (6 posts 1080x1350 -> out/post-N.jpg), video.html + render.js (1080x1920 silent video, ~5 s per chapter, window.at(t) timeline -> out/yosef-promo.mp4), out/captions.txt.
- They were made for the OLD story (a lawyer named Gvirtzman, old pictures, 5 games). Everything must move to the new story, the new pictures, Zvi Kaplan, and 10 games.
- ffmpeg: `C:/Users/shazb/AppData/Roaming/Python/Python312/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe`. Playwright: `require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core')` with Chrome at C:/Program Files/Google/Chrome/Application/chrome.exe.

## Shlomi's promo rules (from his feedback - keep them all)
- The brand is **המשחקייה של חני**, and **Hani is at the center of every post** (her poses: C:/workspace/hani-games/nisei-nissim/assets/pose-*.png - joy, calm, chin, phone, talk, tehilim). Hani is never funny on purpose; her figure must be perfect; **her fingers/hands never cut by the frame edge**.
- KEEP IT SIMPLE: "a new game in the playhouse" + what the story is + how you play. Not sophisticated, not joke-heavy. The post he loved: big "משחק חדש במשחקייה!", a tilted cover card, a green pill, Hani with arms up (old post 1 layout).
- Posts must be FULL - no big empty areas (he said the design was "קצת ריק"): bigger pictures, objects from the game around, a dotted-paper background.
- Wording: "עלה עכשיו" / "עכשיו במשחקייה של חני" (NOT "בקרוב"). Grammar: **במשחקייה**, never "בהמשחקייה".
- **No picture may cover text** - every block has its own band. Instagram: keep clear of the bottom ~260 px and the right edge in the video.
- The video is silent - he adds the song "יוסף מוקיר שבת" in Instagram. Pace: SLOW, about 5 s per chapter (2.5 s was too fast). Hani in the intro ("המשחקייה של חני מציגה:") and the end card.
- A plain mention that Hani's sister-in-law (הגיסה) developed the game, after finishing הכשרה לחרדיות, is fine.
- Kosher: no women singing, instrumental niggunim only, no crosses or other symbols, no chat/ads/links in games, no emoji icons in games. In generated crowd pictures ask for MEN ONLY, modestly dressed; a woman shown (Yosef's wife) must be modest with her hair covered.
- THE FACE RULE: anything made from Hani's face never goes into git (yosef/.gitignore covers *.jpg *.png *.webp art/). Only commit your own files, and only when Shlomi asks.
- Show any NEW generated picture to Shlomi before building on it.

## Tools and keys (never print a key)
- Images: ONLY direct OpenAI (his rule from 30 Oct): `. ~/.plaxzy/openai-env.sh` (loads the gcloud secret OPENAI_API_KEY, project plaxzy12), then `node yosef/tools/oai-image.js --model flare|sunburst --prompt-file p.txt --out x.png [--size 1536x1024] [--ref style.jpg --ref zvi-2.png] [--transparent]`. Style ref: yosef/art/style/p1b-flare.jpg. Write Hebrew prompts to files, never through the console. Prompts say WHAT is needed, not how it looks.
- Send to Shlomi's Telegram (he reviews there): token + chat id in C:/workspace/BoostMind/.env (TELEGRAM_TOKEN, TELEGRAM_CHAT_ID; he authorized it). Load them with `set -a; . <(grep -E '^TELEGRAM_(TOKEN|CHAT_ID)=' /c/workspace/BoostMind/.env | tr -d '\r'); set +a`, then curl sendPhoto / sendMediaGroup / sendVideo. A Hebrew caption sent through bash failed (400) - send captions from a node script or without a caption.
- Git Bash eats backslashes in heredocs/inline node: write scripts with the Write tool.
- Deploy only via tools/deploy-onto-live.js (never `firebase deploy` from BoostMind). The games page (hub) is owned by another session ("חרדית") - tell them about any hub change.

## What to deliver
1. New posts (6-7, 1080x1350) + the slow chapter video (1080x1920, silent) for the new story, and the caption texts (out/captions.txt) - all "עלה עכשיו", Hani at the center.
2. Send everything to his Telegram for review; iterate on his notes.
3. When he says so: release the card (status live + deploy) - he publishes the promo together with the release.
