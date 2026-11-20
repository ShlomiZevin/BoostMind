---
name: chat-story
description: Turn a good real conversation a visitor had with a Shlomiverse resident (the wiki / app chat) into story posters - or, for a long chat, a story video with fast typing in numbered parts (under a minute) - find the recent good chats, pick with Shlomi, clean out anything personal, draw them as chat bubbles (1080x1920, the date on it) and hand him the clean posters. Use whenever he says a story from a conversation / from the chat, "find good chats with <resident>", שיחה לסטורי, סטורי משיחה, or wants to show what people talk about with the residents, or says a chat is long / make a movie / video of a chat.
argument-hint: "[resident id] [days]"
---

# chat-story - a real conversation with a resident, as a story

His idea (2026-11-18): from time to time, find good conversations people had with the residents and make stories of
them. First one: three posters of Hani's chats. Reply in English; the posters are Hebrew.

## The flow
0. **His picks first** (since 2026-11-20): in Backstage he marks a conversation "לסטורי" (the button in an open chat,
   the filter "לסטורי" in שיחות). The server keeps a copy (Firestore storyPicks - chat_logs expire). Start with
   `node scripts/stories/chat-find.cjs --picked --out <scratch>/picked.md` - those are already chosen by him: skip step 2's
   asking, clean and draw them (long = the typing video). When a story is made: `node scripts/stories/chat-find.cjs
   --done <key>` (Backstage then shows "סטורי נעשה"). No picks and he asks for a story = the search below.
1. **Find** - `node scripts/stories/chat-find.cjs <resident id> --days 2 --out <scratch>/chats.md` (his rule: only
   recent ones - the last 2 days unless he says otherwise; every conversation shows its date, Israel time). It lists every
   conversation with 2+ exchanges (at least 2 ping-pongs = 4 messages), longest first.
2. **Pick, then ASK HIM** - read them all and offer him the best 2-3, quoted in full with their dates. A good one: the
   resident is funny in character (Hani's ניסי ניסים about an ER parking spot), the visitor plays along, it has a turn.
   Nothing goes on a poster before he says which, and how much of it (he may want the start of a conversation too).
3. **Clean** (below) - the text he approved, made safe.
4. **Draw** - one JSON per poster, then `node scripts/stories/chat-poster.cjs spec.json out.jpg`:
   ```json
   { "name": "חנה פרידמן", "first": "חנה", "portrait": "public/techietech/team/hani.jpg", "color": "#1f3a5f",
     "date": "16.11.2026", "msgs": [ { "who": "v", "t": "..." }, { "who": "c", "t": "..." } ] }
   ```
   `portrait` = the resident's record (`content.mjs get character <id>`). The letters shrink by themselves
   to fit; it prints the size - under 30px = too much text: shorten the answers (cut, never rewrite) or split into two
   posters. **The verse's branding, never the resident's colour** (his rule, 2026-11-18): the app chat's own look - visitor
   bubbles orange #ff6a1f beside the anonymous visitor's picture (scripts/stories/art/visitor.jpg - someone from our world
   peeking in through the portal, his pick 2026-11-18), the resident's dark glass #1f1f24 beside a face in an orange ring, Heebo,
   the planet logo in the header, an orange pill "דברו עם <first> בשלומיוורס" + shlomiverse.com at the bottom.
   **A long chat** (more than one poster's worth) = a typing VIDEO, not a pile of posters - see "Long chats" below.
5. **Look** at every poster yourself at full size (nothing touching, nothing cut, Hebrew + English mixed lines right),
   then send him ONLY the clean posters (SendUserFile). He posts them himself; posting to the verse = the verse-story
   skill, only when he asks.

## Cleaning - what may go on a poster
The conversations are real people's words. The chat box says so since 2026-11-18 ("...ושיחות טובות עשויות להופיע בסטורי, בלי שמות" - the cx-note in
v2/site/wiki/index.html) - "without names" is the promise, so a poster carries nothing that points at a person:
- **No name of the visitor** - not their message's signature ("אני שירלי"), not the resident calling them by name
  (Hani's "שירלי," / "ירדן,"), not the chat's handle. The visitor is just the grey bubble.
- **Nothing about the visitor's life** - their health, family, work, where they live, a phone / mail / link, a photo.
- **Skip a conversation altogether** when the visitor talks about sex, their own illness or a crisis, a minor's details,
  insults at a real person, or anything they would not want seen. When unsure - don't.
- **Real public people** the visitor names (a TV host, a politician) - fine only when the resident says nothing about
  them (Hani: "אני לא מכירה"); never a resident's opinion on a real person or politics.
- **The resident's side** follows words.md (shlomiverse-content): never a word about Shlomi / שלומי זווין, a creator,
  "characters" - skip an answer that has one.
- Keep the visitor's own spelling (their typos are part of the charm); cut the resident's sign-offs and the sign-in
  wall ("[[signin]]", an answer cut mid-word, the "המשך" that followed it) - never invent a word.

## Long chats - a typing video (his format, 2026-11-19; the Amir chat "went out great")
When the chat needs more than one poster (5+ exchanges), make ONE vertical video instead:
1. **Spec** = the poster spec with `"parts"` instead of `"msgs"`: `"parts": [[4 msgs], [4 msgs], ...]` - 2 exchanges
   (visitor + resident, twice) a part, so the letters stay 40px+. Same cleaning as above (watch for the visitor's chat
   handle inside the resident's first line - "היי Zero," became "היי,").
2. **Render** - `node scripts/stories/chat-video.cjs spec.json out.mp4 [--max 55]` (~3 min to render; prints each part's
   letter size and the final length). What it makes: the poster look, "1/5 ... 5/5" beside the date, every bubble
   TYPED fast with a cursor (speed is set so the whole video fits --max), a short beat after each bubble, 2 s hold at
   the end. Silent track - he adds the music in Instagram.
3. **His rules for it**: never over 60 s (a story clip) - his first note was "much, much faster", slow reading-time
   pacing was rejected; typing, not bubbles popping in; numbered parts.
4. **Look** - pull 3-4 stills (`ffmpeg -ss <t> -i out.mp4 -frames:v 1 x.jpg`) and check them like posters, then
   SendUserFile the mp4.
5. **Music** - offer 2-3 ideas in one line when you send it. Office scheming / politics: Game of Thrones theme was his
   pick for Amir (epic music on a petty fight = the joke); Succession theme for "real", Pink Panther for sneaky-light.
