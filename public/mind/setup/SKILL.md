---
name: mind
description: Shlomi's notebook (המוח השני, https://shlomiverse.com/mind/) - his own ideas, to-dos, notes and reminders across all his projects. Use ONLY when he asks - he says למוח / תכניס למוח / רשום במוח / תוסיף לרעיונות / תוסיף למשימות / רשום לי / תזכיר לי / add to mind / put it in mind / send this to mind / תקרא מהמוח / read from mind, or asks what's in Mind / what's open / what's on his plate, or tells the session "if you need anything from me, write it in Mind" (session requests, with pictures to approve). Never write there on your own initiative and never report a session's work there.
---

# Mind - Shlomi's notebook

His page for HIS things: ideas, to-dos, notes, reminders. https://shlomiverse.com/mind/ (desktop and phone).

**The rule (his, 2026-11-12):** a session writes to Mind **only when he tells it to.** No session reports, no "taking"
items, no job tracking, no summaries, no questions there - Claude already tells him when a session waits for him. All
the automatic session tracking was removed because it made a mess of his page.

## When he tells you to write something down
"למוח: ..." / "רשום במוח ..." / "תוסיף לרעיונות ..." / "תזכיר לי ..." / "add to mind ..." / "send this to mind":
1. Search first (`mind_list_items {query}`) so you don't add a duplicate.
2. `mind_add_item` - one item per separate thing; a short title in HIS words (Hebrew if he wrote Hebrew); details,
   paths and links in `body`; the right type (idea / task / reminder + `due` / thought / wait); the project if clear.
3. Answer in one line per item: #id + title.

"תכניס למוח את מה שעלה" / "send the summary to mind" = he wants something from this session kept: write exactly what
he asked for (e.g. one item with the result + where it is), nothing more.

## When he tells a session "if you need anything from me - write it in Mind" (2026-11-17)
He runs many sessions at once and doesn't want to forget one. Then every real need from him - a decision, an answer, an
approval, something only he can do - is ONE item:
- `mind_add_item` with `type: "session"` (בקשה מסשן), `status: "waiting"`, a clear title (Hebrew), and in `body`: what you
  need, why, the options if it is a choice, and which session / project / paths. His phone buzzes; he filters them with
  the "בקשות מסשנים" chip.
- **A picture to approve** (a mockup, a design, a screenshot): add the item, then attach it -
  `node ~/.mind/mind.mjs attach id=<id> file=<path> caption="..."` (or `mind_attach_image` with base64). One item can
  hold several pictures (up to 20, 7 MB each - send a jpg ~2000 px).
- Read his answer on the item's timeline (`mind_get_item`) - he writes a note, or presses "מאשר" (the item turns done
  with the note "אושר"). Act on it, and mark the item done when it is handled.
- Nothing needed = write nothing. Never progress reports.

## When he asks you to change an item
"סמן את X כבוצע" / "add to item X that ..." -> find it (`mind_list_items {query}`), then `mind_update_item`.

## Reading
- "What's open / what's in Mind / what's on my plate" -> `mind_overview` (or with `project`).
- "תקרא מהמוח" / "I wrote you there" -> find the item he means (`mind_list_items {query}` / `mind_get_item {id}`) and
  read his newest notes in its timeline. Then act on them in this session.
- "Work on idea X" -> read it, then do the work in this session. Don't write progress back to Mind unless he asks.

## Item fields
`type`: idea | task | reminder (give it a `due`) | thought | wait | session (+ his own types, listed by `mind_overview`).
`status`: open | active | waiting | done | parked. `project`, `pin`, `due` (YYYY-MM-DD), `today` (true = on his היום view
today - only when he asks), `tags`. Pictures: `mind_attach_image` / the CLI's `attach`.
Never put secrets in Mind.

## No mind tools in this session?
Use the CLI (same tools): `node ~/.mind/mind.mjs overview | list query=... | get id=... | add text="..." | update id=... status=done | attach id=... file=... caption=...`.
No `~/.mind/` on this computer: read https://shlomiverse.com/mind/setup/ and run its one command with his key
(he finds it on the page under "חיבור מחשב").
