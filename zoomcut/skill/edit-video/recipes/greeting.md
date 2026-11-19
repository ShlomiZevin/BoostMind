# A personal greeting (ברכה אישית) - a resident blesses a real person

His ask, 2026-11-19 (plan `greeting-send`, approved in Backstage). Someone asks on /community for a greeting for a real
person's event (a birthday, an anniversary); a resident of the verse (Hani, Yotam...) blesses that person. One take at
the resident's desk, no plot. Requests: Firestore `requests` (the Voice session holds the list and the ids).

## THE RULE: a greeting is NOT a video of the resident's life
**It never goes to the Shlomiverse**: no "Shlomiverse" job, no versePublish, no `verse.mjs`, no `/api/ep/<id>/site` - it
must never reach wiki.json, the resident's videos, "latest videos", the brain or the chat. It goes to the person only,
through its own link-only page. The project's `episode.json` carries
`"greeting": {"char": "<resident id>", "request": "<request id>", "for": "מאיה", "event": "שנתיים ביחד", "date": "28.11.2026"}`
from its first minute - with it, the studio's verse publish refuses the project (`render/verse.mjs` `toVerse`).
**The greeting's details = `episodes/_assets/greetings/<slug>/greeting.json`** (char, request, for, event, date, the
script, the add command - private, the cloud pool, not git) -> copy them into episode.json `greeting`.
Not for the socials either, unless he says so for that greeting.

## The look - his pick (plan greeting-ideas, option 3 "cards")
Light, gentle, subtle: the message is the main thing. Every part a layer in the one editor, like any project.
1. **Opening card ~1.5 s**: the Shlomiverse logo + one line "למאיה · שנתיים ביחד · 28.11.2026" (for · event · date).
2. **The take**: the resident at the desk, with subtitles and only a small name line at the bottom
   ("חנה פרידמן · למאיה" - who blesses · for whom). Nothing else on the picture: no POV band, no stickers.
3. **End card**: "ברכה אישית מתושב בשלומיוורס" + "shlomiverse.com".
- A resident of Techy-Tech (Hani, Yotam, the team) = the Techy-Tech logo next to the Shlomiverse one on the cards.
- **Hani signs as "חנה פרידמן"**, never חני.
- The words: the `shlomiverse-content` skill's `words.md` (תושב, never דמות; never Shlomi's name).
- **The first greeting sets the look; the next ones copy it** (the editor's "+ New video" `from` = the last greeting) -
  only the names, the event, the date and the take change.

**The cards are ready-made pictures** (the Voice session makes them per greeting, 1080x1920, in the library with the tag
"greeting"): `episodes/_assets/greetings/<slug>/open.png` (opening card ~1.5 s), `name.png` (a transparent overlay for
the whole take - the bottom pill: name -> for whom, + the Techy-Tech mark), `end.png` (end card ~2 s). Each one = an image
layer. **The prompter scripts `zoomcut/scripts/greet-*.txt` are git-ignored on purpose** (real people's names, the repo
is public) - never `git add` them, never copy real names into a tracked file.

## Cutting
One take: start on the first word, end on the last, cut the silences inside (the monologue rhythm - `recipes/monologue.md`),
the resident's own voice setting from earlier projects. Keep it short - a greeting, not a lesson.

## Hand-over - the studio's Send does all of it (his ask, 2026-11-19: "all of this part of the automated process")
A greeting project (episode.json `greeting`) opens **its own Send window** ("Send · personal greeting", `ui/publish/Greeting.tsx`,
`render/greeting.mjs`) - no socials, no Shlomiverse videos; the socials' publish and the verse publish both refuse it.
Three steps, each HIS click (you never press them - you set the project up, he exports and sends):
1. **Make the greeting page + send it to my Telegram** - exports first when needed, then `greet.cjs add` (the private page
   https://shlomiverse.com/greeting/<gid>) and the video to his Telegram, to post as a story, with the page's link.
2. **Test email to me** - `greet.cjs send <gid> --test`.
3. **Send to <name>** - `greet.cjs send <gid> --yes`: the email to the person who asked. His click is the approval.
State: `episodes/<id>/greeting-out.json` (gid, url, made, tested, sent); every step is a job in the Jobs list (`greeting`).
A new export after a fix -> "Make again" (a new page; "Send" waits until the page is the newest export).
