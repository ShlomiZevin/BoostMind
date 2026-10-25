# Publishing - the finished video to his socials

The studio posts the exported video itself (render/publish.mjs, the editor's **Publish** window). Your part: write
the post - caption, hashtags, YouTube title - and put it in the window ready for him. **He presses Publish. You never
do** - a post is public and the APIs can't delete it (Instagram refused a delete; he deleted tests by hand).

## The flow
1. **With every video you make, write its default post** (his rule, 2026-10-25) - don't wait for him to ask. The
   Send window (top bar → **Send**: Test on my phone · Telegram / Email · the socials) opens with it filled in.
2. Write the post (below) and **save it into the window**, without publishing:
   `POST /api/ep/<id>/publish {save: true, platforms: [...], caption, title, options}`
   (or `{afterExport: true, ...}` when he wants it out as soon as an export ends).
3. Tell him the caption in the hand-over. He presses **Send**: an up-to-date full export goes out as is, otherwise
   the button exports first (a Quick / Test export is never published). A stale export can't be published.
4. After it runs: the window and the Jobs history show each platform's result and link. Tell him what to do by hand:
   **Instagram → "Share to Facebook"** on the Reel, **TikTok → the video arrives as a notification in the app's Inbox
   ("ready to edit", not in Drafts) - tap it, paste the caption from Telegram, add a sound, post**.
- Testing the path: `{dry: true}` runs everything but the platform calls. Never a real test post without his OK.

## Each platform - what it takes
| | Goes to | Caption | Hashtags | Limits / notes |
|---|---|---|---|---|
| **Instagram** | Reel - grid + Reels tab (`options.instagram.reelsOnly` for the Reels tab only) | yes, ≤2,200 | in the caption | ≤15 min. @shlomizevin |
| **Facebook** | his personal profile - **no API can post there** | - | - | pick it with Instagram: once the Reel is up the studio sends him a **Telegram reminder** (the Reel link + "⋯ → Share to Facebook") and he shares it |
| **TikTok** | his **drafts** (sandbox app - public posting would need TikTok's audit) | **not with a draft** - the studio sends the caption to his Telegram to paste | in the pasted caption | ≤10 min. He adds a sound in the app |
| **YouTube** | Short (vertical, ≤3 min) on @shlomizevin (owned by shlomi@boostart.io) | description = caption (+ #Shorts added) | in the description | title ≤100 (`title`), `options.youtube.privacy` public / unlisted / private. Public uploads are NOT locked (tested). A new upload can sit under Videos for a while before YouTube files it under Shorts. The API can't edit or delete - he does it in Studio |
| **X** | a post with the video on @ShlomiZevin (his own X app "Sketch Studio", **Pay Per Use** credits, ~1.5¢ a post) | ≤280 (`options.x.text` = its own text, else the caption cut at 280) | 1-2, inside the 280 | ≤2:20 on a regular account. **No links** - the studio strips them (a link makes a post ~20¢) |
Connected = its keys in zoomcut/.env (`GET /api/publish/platforms` says which).

## Writing the post
- **Hebrew**, in the character's world - the caption is one more line of the sketch, not a description of it. Read
  the character's profile.md (how they talk) first. Never "parody", never Shlomi's name in a character's voice.
- **A hook in the first line** (it's what shows before "more"): the joke's premise or a POV line, short. Then at most
  one more line. No emoji walls - one or two at most.
- **Hashtags at the end, 3-6**: the character / series (e.g. #טקיטק, #איילתהשחר, #דמוקרטוביץ), the topic of THIS
  video, one or two broad ones (#קומדיה, #סאטירה, #הומור). No #fyp spam, no 20-tag blocks.
- **A site link only where it works**: Instagram / TikTok captions don't link - write "הלינק בביו" if the video points
  to the character's site; YouTube's description can hold the URL.
- **Per platform**: Instagram + TikTok take the full caption; X gets its own short version (`options.x.text`) - the
  hook + 1-2 hashtags; YouTube gets a title (the hook, ≤100) and the caption as its description.
- Show him the caption before saving it when it's the first post of a series; afterwards follow what he approved.

## A backlog of videos (2026-10-24: his first 16 Shorts)
`node zoomcut/tools/shorts_backlog.mjs [--dry]` - uploads each finished video PRIVATE with a scheduled `publishAt`
(one a day, 19:00 Israel - YouTube itself releases them, nothing looks like a burst). A new Google app gets ~6
uploads a day (quota): the run waits and retries every 30 min; `zoomcut/work/shorts-backlog.json` keeps what's up, so
it's safe to run again. Edit the VIDEOS list for a new batch (the last export of each video - not drafts, not the
`.email` / `.telegram` copies; Shorts max 3:00). He can cancel or move any scheduled one in YouTube Studio.

## How a publish runs (2026-10-25)
All platforms at once - each its own job in the Jobs list (Instagram, TikTok, YouTube, X; Facebook's reminder waits
for Instagram, it needs the Reel's link). Each goes out once, no retries. TikTok: ONE Telegram message - the video's name,
"waiting for you to approve in the TikTok app (Inbox → ready to edit)", and the caption in a tap-to-copy box (he
posted one with an old caption TikTok had kept - 2026-10-25). YouTube's
"exceeded the number of videos" = the channel's daily upload limit (it opens ~24 h after a batch): the job says so in
plain words; `node zoomcut/tools/yt_when_open.mjs <id> public` uploads it the moment it opens.
