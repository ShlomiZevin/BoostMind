---
name: mind
description: Shlomi's notebook (המוח השני, https://shlomiverse.com/mind/) - his own ideas, to-dos, notes and reminders across all his projects. Use ONLY when he asks - he says למוח / תכניס למוח / רשום במוח / תוסיף לרעיונות / תוסיף למשימות / רשום לי / תזכיר לי / add to mind / put it in mind / send this to mind / תקרא מהמוח / read from mind, or asks what's in Mind / what's open / what's on his plate. Never write there on your own initiative and never report a session's work there.
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

## When he asks you to change an item
"סמן את X כבוצע" / "add to item X that ..." -> find it (`mind_list_items {query}`), then `mind_update_item`.

## Reading
- "What's open / what's in Mind / what's on my plate" -> `mind_overview` (or with `project`).
- "תקרא מהמוח" / "I wrote you there" -> find the item he means (`mind_list_items {query}` / `mind_get_item {id}`) and
  read his newest notes in its timeline. Then act on them in this session.
- "Work on idea X" -> read it, then do the work in this session. Don't write progress back to Mind unless he asks.

## Item fields
`type`: idea | task | reminder (give it a `due`) | thought | wait (+ his own types, listed by `mind_overview`).
`status`: open | active | waiting | done | parked. `project`, `pin`, `due` (YYYY-MM-DD), `tags`.
Never put secrets in Mind.

## No mind tools in this session?
Use the CLI (same tools): `node ~/.mind/mind.mjs overview | list query=... | get id=... | add text="..." | update id=... status=done`.
No `~/.mind/` on this computer: read https://shlomiverse.com/mind/setup/ and run its one command with his key
(he finds it on the page under "חיבור מחשב").
