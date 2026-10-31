# The Shlomiverse, the links page and his channel's images

His world on the web, built 2026-10-24. Everything here is filled from the studio's own data: the characters
(`zoomcut/characters/*/character.json`) and the finished exports (`zoomcut/episodes/<id>/out/<id>.mp4`). A video you
finish in the studio is not on the site until you run the steps below.

## Addresses
| What | Where | Files |
|---|---|---|
| **Links page** - the link in ALL his social bios | https://shlomiverse.com/links/ (old: boostmind-b052c.web.app/links/ - same site) | `public/links/index.html` |
| **שלומיוורס** - the wiki of every character, every video, and a chat with each character | https://shlomiverse.com/wiki/ (old: boostmind-b052c.web.app/wiki/ - same site) | `public/wiki/index.html`, data `public/wiki/data/wiki.json` |
| **His analytics dashboard** (private: his link with the key, or the code box - once per device) | https://shlomiverse.com/stats/ (old: boostmind-b052c.web.app/stats/ - same site) | `public/stats/index.html` |
| **Everything he runs** (private: his link / code, once per device): every page, the Vault, tools, servers | https://shlomiverse.com/all/ (old: boostmind-b052c.web.app/all/ - same site) | `scripts/all/catalog.py` -> redeploy `stats` |
| The characters' own sites | the table below | `public/<site>/` |

**Every character site** (each character's profile has it as `site.url`, each world in `zoomcut/characters/index.json`
as `site` - the Characters page shows it; keep all three in step):

| Site | Whose | Files / deploy |
|---|---|---|
| https://techytech.web.app (+ the same at /techietech/) | Techy-Tech: Amir, Ofer, Ronit, Gilad, Daniel, Erez, Hani, Ido, Lior, Osnat, Rami, Sagi, Tamir, Tzvika, Vova, Yaniv, Dr. Yoav | `public/techietech/` - BOTH: `sh techietech-site/deploy.sh` and `firebase deploy --only hosting` |
| /yotamverse/ | Yotam (works at Techy-Tech, his own multiverse site) | `public/yotamverse/` |
| /ayelet/ | Ayelet Hashachar (תדר) | `public/ayelet/` |
| /demokratovich/ | Rabbi Demokratovich + the Rabbanit (קהילת שערי בג״ץ) | `public/demokratovich/` |
| /dorit/ | Dorit Mercury (astrology) | `public/dorit/` |
| /ofnat-hani/ | אופנת חני - a modest-fashion shop on Rabbi Akiva, Bnei Brak. NOT Hani's shop: Hani Friedman is its presenter and model - she wears every mitpachat and outfit, very modestly (his correction, 2026-10-26). Order for pickup -> siteLead `ofnat-hani` | `public/ofnat-hani/` (every picture with her face git-ignored) |
| /shefa-ad/ | שפע עד - the discount supermarket of Hani Friedman's world (haredit-2: the עיגוליות ברכת השפע she eats, the אבני בניין "לגו זה לגו-יים"); its weekly booklet, branches, hours to 16:20. The stories' end card points here | `public/shefa-ad/` (ads + end card: `zoomcut/episodes/_assets/haredit/ads/`) |
| /birkat-hashefa/ | מאפיית ברכת השפע - the bakery behind the עיגוליות (and גלגליות, challah, cakes); every product "נמכר בשפע עד" and links to /shefa-ad/ (and back). Its "collaboration" with Hani is super modest: she is never pictured - her husband Avraham Moshe holds the box "בשמה", a footnote says her photo is withheld for modesty. Packaging = Leonardo portrait mode with the עיגוליות box as the reference (same brand, new product), refStrength 0.5. **Products in his world never carry a real product's name** (his catch, 2026-10-28: "ערגליות" is a real product -> renamed גלגליות; check a name is invented before it goes on a package) | `public/birkat-hashefa/` (sources, collab poster + video end card: `zoomcut/episodes/_assets/haredit/bakery/`, `collab/`) |
| /friedman/ | משפחת פרידמן - Hani's family tree as Shterni's REAL bat-mitzvah roots project (his words, 2026-10-28: "keep it real" - no Shlomiverse links, no meta; a first page of cards was "terrible"). The page = ONE poster + her few words. The poster: Leonardo paints the tree from my layout sketch (`tree/layout.py` -> layout.png with 21 white frames, portrait mode refStrength 0.75 - it kept every frame in place), `frames.json` = the frames measured back (white blobs, cv2), the faces + name tags composed in `poster.html`, rendered at 2x. The verse (Psalm 1:3), once, big, in Ashkenazi STaM (`fonts/StamAshkenazCLM.ttf`, Culmus from Debian's fonts-culmus, GPL + font exception). LITVISH family (his call): fedoras, side-locks tucked, women in sheitels. Both grandparent couples (Friedman, Bnei Brak / Berger, Jerusalem), uncles/aunts יוסי+רחלי, אסתי+מנחם קליין, נחמן+פנינה ברגר, nine children (חיימי 9, פייגי 7 added; no studio profile yet). Leonardo made every child's portrait this time (one child, a sibling's portrait as the reference) | `public/friedman/` (all jpgs git-ignored; sources + prompts `zoomcut/episodes/_assets/haredit/tree/`) |
| /hani-games/ | המשחקייה של חני - Hani's kosher games corner (his ask, 2026-10-29): built by her sister-in-law פנינה ברגר (Hani's brother נחמן's wife, on the family tree) as her final project in a seminary track that trains Haredi women developers, and Hani reviewed every line (his story idea, 2026-10-29; launch story = `games/story.py`, Instagram + TikTok versions); a seal "כשר למהדרין · בהשגחה פרטית" (invented - never a real kashrut authority), a תקנון הכשרות (no ads, no chat, niggunim only, no links out, 20 minutes then תהילים), and it KEEPS SHABBAT: Friday sunset - 30 min to Saturday sunset + 40 min (Bnei Brak, computed in the page) it shows only a שבת שלום screen with a countdown; `?preview` opens it anyway. The games are built by OTHER sessions, each in its own folder (`ketoret/` = אבני בניין: מזבח הקטורת, `nisei-nissim/` = ניסי ניסים!) with a `game.json` the page reads for the card (title, tagline, status live/soon, cover.jpg 1200x900, badges, best.key = localStorage best score shown on the card). A new game = a folder + game.json + its slug in GAMES in the page. The song section "זוט חני" (his ask): the purple poster + the karaoke chorus (only the words "זוט חני" sung) on repeat from the first tap, framed as the song her Techy-Tech friends made her, with his note that the voice is AI, not a real woman, "בהיתר ובהסכמת הרב" (the site's own rule is no women's singing). Sound pack for the games: /hani-games/sounds/ (`games/sounds.py`). Analytics: site `hani-games`; events game_open (card click), game_start / game_over (the games report them, x = slug), song (x = zot-hani); /stats/ has a משחקים box | `public/hani-games/` (hero/og/icon jpgs git-ignored; sources `zoomcut/episodes/_assets/haredit/games/`) |
| /hindsight/ | Nahor (Zion) Minuf (HINDSIGHT VIP) | `public/hindsight/` |
| /homo-useless/ | Yuval (Kise) Noah Harari | `public/homo-useless/` |
| - (none yet) | Gen Z cashier, the gym guy + Sigal, the news anchor | a site of their own is welcome - ask him |

His own pages (not characters): /links/, /wiki/, /stats/, /all/ (above); Sketch Studio's public pages
/sketch-studio/ (+ terms, privacy - for the social apps); /karaoke/. /micro-comedy/ is obsolete - never link it.

**A NEW site (a character's, or any page of his) is not done until it is in every list:** the character's profile
`site` (`POST /api/characters/<id> {patch: {site: {url, notes}}}`) and its world's `site` in index.json · this
table · the sites strip of the links page (`public/links/index.html`) · his private index /all/ (`python
scripts/all/catalog.py`, then `firebase deploy --only functions:stats` from techietech-api/) · `/t.js` analytics
(below). Then deploy - and say what else rides along (other sessions' unfinished pages, step 12).

Deep links into the wiki (use them in posts, end cards, the links page):
`/wiki/#/c/<character-id>` a character's page · `/wiki/#/v/<video-id>` plays a video ·
`/wiki/#/chat?with=<character-id>&ask=<question>` opens a chat with that character, already asking.

His socials (link all of them wherever socials appear): TikTok https://www.tiktok.com/@shlomizevin · Instagram
https://www.instagram.com/shlomizevin · YouTube https://www.youtube.com/@shlomizevin · Facebook
https://www.facebook.com/shazbak/ · X https://x.com/ShlomiZevin

## His channel's images
| What | Link | Size |
|---|---|---|
| Profile photo - studio, wigs on the shelf behind him (the links page uses it) | https://boostmind-b052c.web.app/links/shlomi.jpg | 880x880 |
| Older profile photo | https://boostmind-b052c.web.app/links/profile.jpg | 540x540 |
| Facebook cover - his character portraits fanned out + "שלומיוורס" | https://boostmind-b052c.web.app/links/img/fb-cover.jpg | 1640x624 |
| Facebook cover, sharp | https://boostmind-b052c.web.app/links/img/fb-cover-2x.jpg | 3280x1248 |
The cover is HTML with the real portraits (`scripts/wiki/fb-cover.html`, rendered by `node scripts/wiki/fb-cover.mjs`
into `scripts/wiki/work/`, then copied to `public/links/img/`). To change who is on it, edit the `ids` list in the HTML.
Keep the words in the middle: Facebook crops the sides on phones and the profile photo covers a bottom corner.

## A finished video -> the Shlomiverse (step 11 of the workflow)

**UPLOADING A VIDEO TO THE VERSE - THE ONE PATH** (his ask, 2026-10-31: "super clear to the editor skill and zoomcut")
1. The video's project is finished and has its full export (`zoomcut/episodes/<id>/out/<id>.mp4`), and every character
   in it lists the episode in their studio profile's `videos` (that is how the verse knows the cast).
2. **He presses Publish** in the studio -> the studio queues a **"site" job** by itself (Jobs panel "Shlomiverse").
   No publish (an old video, a socials-only miss)? **`POST http://localhost:4747/api/ep/<id>/site`** - the queue keeps
   deploys one at a time. Only with the studio down: `python scripts/wiki/publish_site.py <id>` from BoostMind.
3. The job puts it everywhere it can by itself: the wiki (the video, each character's page, fan copy by Terra), the
   links page's videos strip (it reads the wiki's data), the chat agent (every character can talk about it), then the
   safe deploy (`scripts/deploy.sh` - pulls Hani's games first) and a check that the live wiki lists it.
4. It then checks **every other place** each character must reach and prints one `  !` line per gap: no portrait,
   a Techy-Tech person with no card on the company site, a character site with no links-page button, a character
   site that shows videos but not this one. **Act on every `!` line** (SKILL.md step 12) and deploy again with
   `bash scripts/deploy.sh`. The same lines reach his Telegram.
5. **A video is published only at `✔ on the Shlomiverse: <link>`** - give him that link.
Never deploy with a bare `firebase deploy --only hosting`: it can put old Hani game files back.
The verse is moving to **https://shlomiverse.com** (same site, same paths - every old link keeps working).

**Publishing a video = publishing it to his sites too** (his words, 2026-10-25: "this is part of publishing a video -
it should go to my site... everything just one direction"). ONE command does all of it, from `c:\workspace\BoostMind`:
`python scripts/wiki/publish_site.py <episode-id>` - marks the project done, web copy + poster, fan copy (Terra) for
anything new (the video, a new character), build, deploy the site + the chat agent, checks the live wiki lists it
(`✔ on the Shlomiverse: <link>`), and warns (`!`) for every place a character hasn't reached yet (see the one path above).
**The studio runs it by itself after every Publish** (since 2026-10-25, commit 72d08ff): a publish with any platform
out queues a "site" job (Jobs panel "Shlomiverse", one at a time - each deploys the whole site), Telegram with the ✔
link and any "!" warning, or the last log lines on failure. **By hand: `POST /api/ep/<id>/site`** (needs
`out/<id>.mp4`) - never the script straight from a session while the studio is up: the queue keeps deploys one at a
time. After a publish, check the Jobs panel's Shlomiverse job ended ✔ and act on any "!" (a Techy-Tech card).
Keep the script's `✔ on the Shlomiverse:` and `  !` line prefixes - the Telegram reads them. Three videos (dorit-1
and two Demokratovich) missed the site because their sessions stopped at the socials - a video is not published
until the ✔.
The steps it runs, for when one fails:
1. **Web copy + poster:** `sh scripts/wiki/encode.sh <episode-id>` (720p, ~10 MB, into `public/wiki/v/`).
2. **Fan copy** (the title and one-line teaser people see; a new character also gets a tagline, bio and 3 questions):
   `python scripts/wiki/copy_brief.py --only-missing`, then
   `node ~/.claude/skills/sol-leonardo/scripts/sol.js --in scripts/wiki/work/copy-brief.txt --out scripts/wiki/work/copy-answer.md --model gpt-5.6-terra --env "C:/workspace/aspect/aspect-agent-server/.env"`,
   read the answer, then `python scripts/wiki/merge_copy.py`. **Terra, not SOL** (his call). The copy lives in
   `scripts/wiki/copy.json` - fix a line there by hand any time.
3. **Build:** `python scripts/wiki/build.py` - it lists anything still MISSING (an encode, a copy line).
4. **Deploy:** `bash scripts/deploy.sh` (from BoostMind; it pulls Hani's games first), and because the chat knows every
   transcript: `firebase deploy --only functions:wikiChat --project boostmind-b052c` from `techietech-api/`.
5. Check the video on the wiki (the character's page and the videos page) and tell him its link
   (`/wiki/#/v/<episode-id>`).
A video that lives only on TikTok / Instagram (old ones): add `{"url", "title", "cast": [ids]}` to
`scripts/wiki/clips.json` and build.

## The fan copy - how the wiki talks about the characters
- Inside the wiki the characters are **real people**: a fan wiki written from inside their world. Never "parody",
  "sketch", "character played by", never who plays them, never explain the joke - the facts themselves are funny.
- The profile's `brief` / `comedy` explain the joke (for us); the wiki's bio translates them into facts from their world.
- Modest: he didn't want to sound proud ("שלומיוורס" is the name he chose; no superlatives about him).
- **The characters in the studio are not his main ones** - he has many more, more successful characters with no videos
  here yet. Never frame the current cast as the core; a new character = a profile in the studio, then build.

## The chat (each character in their own voice)
- `techietech-api/wiki.js` - OpenAI **gpt-5.6-terra** (his choice over Claude), key in Secret Manager as
  `WIKI_OPENAI_KEY` (the project's `OPENAI_API_KEY` secret belongs to something else - never overwrite it).
- It knows `techietech-api/wiki-brain.json` (written by build.py: full profiles + transcripts) - **redeploy wikiChat
  after every build**, or it won't know the new video.
- In a reply, `[[video:id]]` plays that video inside the bubble; `[[char:id]]` offers "bring them into the chat".
- Safety it keeps: real distress / medication / money / law -> out of the joke, kindly, ERAN 1201. Ayelet and Nahor
  never give harmful advice to a real person.
- Local test with a working chat: `node scripts/wiki/dev.mjs` -> http://localhost:5180/wiki/ (kill it after).

## The links page - his rules
- It stays the hub (fast in the TikTok / Instagram in-app browser): the Shlomiverse first (on desktop a full-width
  hero with the wiki's walls of faces + "מי עונה?"), collaborations (WhatsApp + email, one tap), latest videos, the
  characters' sites. The faces and videos come from `wiki.json` by themselves.
- **No emoji as icons** - make the icon with Leonardo (3D clay, on the card's solid colour; `public/links/img/`).
- No "נעים להכיר", no "בין השאר" line. His photo is never stretched or covered (his face looked low).
- **The spotlight** (`<section class="spot">`, right under his socials on the phone, a banner above the hero on
  desktop): ONE slot for whatever he is pushing now (first: Hani's playhouse). His focus moves between characters, so
  it is a slot, never a permanent favourite: to move it, replace that section (picture, pill, title, line, links, the
  row of five) and set `--spot` to that world's own colour; small images go in `public/links/img/spot/`. The pill
  always says "עכשיו בשלומיוורס" (his pick) - never describe the content ("חדש · 4 משחקים" was wrong; "עכשיו בפוקוס" dumb). Clicks count as `site` and as
  `click` `spotlight:<data-spot>` in /stats/.
- **The wordmark is two-tone everywhere:** שלומי in the text colour, וורס in orange (`שלומי<b>וורס</b>`), like the
  FB cover and the YouTube banner. Never one colour.

## His analytics (own, not Google Analytics)
- `public/t.js` on every page; the wiki and links page add their moments with `window.track(event, target)`.
  A new page of his needs `<script src="/t.js" data-site="<id>" defer></script>` (add the id to SITES in
  `techietech-api/analytics.js`). Write that tag with an editor or Python - Git Bash turned `/t.js` into
  `C:/Program Files/Git/t.js` once.
- Counted: views, characters opened, chats / messages / switches, videos played, the question box, searches, links out
  (WhatsApp, mail, socials, the sites), source (TikTok / Instagram / ...) and device. **Not stored:** IP, cookies,
  what people write to the characters. Events auto-delete after 90 days; daily totals stay.
- His own devices don't count (opening /stats/ signed in, or `?notrack=1`). Tests: a normal user agent (headless is
  dropped), then remove them: `node scripts/wiki/analytics_forget.js <visitorId>`; read the log with
  `node scripts/wiki/analytics_check.js`.
- Tag bio links per network for exact sources: `/links/?src=tiktok`, `?src=instagram`.
