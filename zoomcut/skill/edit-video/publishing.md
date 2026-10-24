# Publishing - the finished video to his socials

The studio posts the exported video itself (render/publish.mjs, the editor's **Publish** window). Your part: write
the post - caption, hashtags, YouTube title - and put it in the window ready for him. **He presses Publish. You never
do** - a post is public and the APIs can't delete it (Instagram refused a delete; he deleted tests by hand).

## The flow
1. The Full quality export is done and he's happy with it (never a Quick check draft - the server won't publish one).
2. Write the post (below) and **save it into the window**, without publishing:
   `POST /api/ep/<id>/publish {save: true, platforms: [...], caption, title, options}`
   (or `{afterExport: true, ...}` when he wants it out as soon as an export ends).
3. Tell him it's ready: Publish button (or Export → "Export and publish…"). The window shows the account, caption,
   file, length, size and export time before his click. A stale export can't be published - export again.
4. After it runs: the window and the Jobs history show each platform's result and link. Tell him what to do by hand:
   **Instagram → "Share to Facebook"** on the Reel, **TikTok → the video arrives as a notification in the app's Inbox
   ("ready to edit", not in Drafts) - tap it, paste the caption from Telegram, add a sound, post**.
- Testing the path: `{dry: true}` runs everything but the platform calls. Never a real test post without his OK.

## Each platform - what it takes
| | Goes to | Caption | Hashtags | Limits / notes |
|---|---|---|---|---|
| **Instagram** | Reel - grid + Reels tab (`options.instagram.reelsOnly` for the Reels tab only) | yes, ≤2,200 | in the caption | ≤15 min. @shlomizevin |
| **Facebook** | his personal profile - **no API can post there** | - | - | he taps "Share to Facebook" on the Instagram Reel |
| **TikTok** | his **drafts** (sandbox app - public posting would need TikTok's audit) | **not with a draft** - the studio sends the caption to his Telegram to paste | in the pasted caption | ≤10 min. He adds a sound in the app |
| **YouTube** | Short (vertical, ≤3 min) on @shlomizevin (owned by shlomi@boostart.io) | description = caption (+ #Shorts added) | in the description | title ≤100 (`title`), `options.youtube.privacy` public / unlisted / private. Public uploads are NOT locked (tested). A new upload can sit under Videos for a while before YouTube files it under Shorts. The API can't edit or delete - he does it in Studio |
| **X** | a post with the video | ≤280 (`options.x.text` = its own text, else the caption cut at 280) | 1-2, inside the 280 | ≤2:20 on a regular account. Waiting for his PIN |
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
