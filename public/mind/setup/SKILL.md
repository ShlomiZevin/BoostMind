---
name: mind
description: Shlomi's second brain (המוח השני, https://shlomiverse.com/mind/) - the ONE place where everything in his head (ideas, to-dos, running jobs, thoughts, follow-ups) and every Claude Code session on his computers is tracked, across ALL his projects. Use it in every session - report what you work on, capture any idea / to-do / "later" / "remind me" he mentions, take an item when you handle it, finish it with where the result is. Also use whenever he asks what's open, what's waiting for him, what a session did, "what did I ask about X", "what's on my plate", or says report to mind / tell the mind / put it in my notes / למוח / תכניס למוח / רשום במוח / תקרא מהמוח / read from mind / רשום לי / תזכיר לי / תוסיף לרעיונות / תוסיף למשימות.
---

# Mind - Shlomi's second brain

He runs many Claude sessions at once, on two computers, across his own projects and the companies he's CTO for. He
forgets which session did what. Mind is the fix: **one page that shows every idea, task and session, and its state.**
Page: https://shlomiverse.com/mind/ (desktop and phone). You report through the **`mind` MCP tools**.

## What happens by itself (don't duplicate it)
Hooks on his computers already tell Mind when this session starts, when he asks something ("working"), when you finish a
turn ("your turn", with your last words), when you wait for a permission ("needs you") and when the session ends.
Your session id is in the SessionStart context line ("this session's id is ...") and in `$MIND_SESSION` (Bash).

## What YOU add - the meaning
1. **Name the session** once you understand the job: `mind_report_session {session_id, name}` - a short name of the
   work ("Mind app build", "Aspect billing bug"), not the first words of the prompt.
2. **Link the work to an item.** If the job is one of his items (`mind_list_items {query}`), take it:
   `mind_update_item {id, status: "active", session_id, note: "taking this"}`. A new substantial job with no item ->
   `mind_add_item {text, type: "task", status: "active", project, session_id}`. Small questions need no item.
3. **Capture what he says in passing** - an idea, "later", "remind me", a to-do for himself, something he waits for
   from someone: `mind_add_item` (type idea / task / wait / thought; his own types are listed by `mind_overview`).
   Search first so you don't add a duplicate. Title short, in his language (Hebrew if he wrote Hebrew); the details,
   paths and links go in `body`. Tell him in one line that you added it.
4. **A job that keeps running** after your turn (a deploy, a render, a scheduled task, a server you left up, a
   background agent): `mind_add_item {type: "job", status: "active", ...}` with how to check it; mark it done when it ends.
5. **When you need him** (a decision, an OK, an answer): `mind_report_session {session_id, state: "waiting", question}`
   and, if it belongs to an item, `mind_update_item {id, status: "waiting", note: <the question>}`.
6. **Stuck**: `mind_report_session {state: "stuck", question: <why, what would unblock>}`.
7. **Finished**: `mind_update_item {id, status: "done", note: <what was done + where to see it: url / path / commit>}`
   and `mind_report_session {state: "done", summary: <2-4 lines: what you did, where it is, anything left>}`.
   A summary is what a future session (or him, days later) needs to pick the work up - be concrete.

Report at those moments only - not every step. Keep notes short and factual. Never put secrets in Mind.

## When he hands you something to write down
"למוח: <anything>" / "רשום במוח ..." / "תוסיף לרעיונות ..." / "add to mind ..." = put it in Mind now: search first
(`mind_list_items {query}`), then `mind_add_item` - one item per separate thing, short title in his words, the rest in
`body`, the right type (idea / task / job / thought / wait), the project if it's clear. "תכניס למוח את כל מה שעלה" =
go over this conversation and add every open idea / to-do / follow-up. Answer with one line per item (#id + title).

## "תקרא מהמוח" / "read from mind" / "I added a comment / answered you there"
He wrote to you on the page (a note on your item, an answer to your question, a change of status). Read it now:
`mind_get_session {id: <your session id>}` -> your items -> `mind_get_item {id}` for each, and act on his newest
notes in the timeline (the ones by "שלומי" after your last note). If he names an item or a subject, find it with
`mind_list_items {query}`. Then confirm in one line what you read and what you'll do. (CLI: `node ~/.mind/mind.mjs
get-session id=<id>`, then `get id=<item>`.)

## When he asks about his work
- "What's open / what's waiting for me / what's going on" -> `mind_overview` (or with `project`).
- "Which session did X / what did I ask about Y" -> `mind_list_sessions` / `mind_list_items {query, include_done: true}`,
  then `mind_get_session {id}` - it gives the resume line (`cd <folder> && claude --resume <id>`).
- "Work on idea X" -> find it, take it (step 2), then do it.

## Item fields
- `type`: idea | task | reminder (something to remind him of at a time - give it a due) | job | thought | wait (+ his own types). `status`: open | active (being handled) | waiting
  (waiting for HIM) | done | parked. `project`: the repo / company name (BoostMind / Shlomiverse, Aspect, Lybi, ...).
  `pin`, `due` (YYYY-MM-DD), `tags`.

## No mind tools in this session?
A session that started before Mind was set up on this computer has no `mind` MCP tools and no hooks. Use the CLI - the
same tools, from a shell:
```
node ~/.mind/mind.mjs whoami                                   # your session id
node ~/.mind/mind.mjs report name="Aspect billing bug" state=working summary="..."
node ~/.mind/mind.mjs list query=billing                       # status= type= project= include_done=true
node ~/.mind/mind.mjs add text="..." type=idea project=Aspect body="..."
node ~/.mind/mind.mjs update id=abc123 status=done note="what was done + where"
node ~/.mind/mind.mjs overview                                 # sessions / get id=... / get-session id=...
```
session_id, your folder and the computer are filled in by themselves. Without hooks nobody sees your turns, so report
at every key moment yourself: when you start, when you need him (state=waiting question="..."), when you finish
(state=done summary="..."). After he restarts / resumes the session, hooks and MCP are there.
No `~/.mind/` on this computer at all: set it up with his key - read https://shlomiverse.com/mind/setup/ and run its
one command. He finds the key on the page under "חיבור מחשב".
