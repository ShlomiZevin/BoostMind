TASK: Shlomi rejected the previous version as bad: too formal, pretentious, philosophizing ("פלצני"). Rewrite from scratch, two outputs. IGNORE the formal tender register from the system instructions for this task — here the register is a person talking plainly, like he would explain it on the phone to a colleague.

Context: Yifat (יפעה) from an IT integrator on the government framework talked with Shlomi by phone, then emailed two government briefs (cloud development/migration with Agentic AI and Spec-Driven Development; continuing development of "עולים לענן" — Next.js, React, Playwright, AWS) and asked: מה מבנה הצוות; על איזה תפקיד אתה עונה; עד כמה עומד בתנאי סף עם יכולת מוכחת ומרשימה לקבל את מלוא ניקוד האיכות. She also said about a separate, unrelated BI-to-cloud role: green light, their architect will talk with him.

Facts (use only these):
- Role: he leads the development with Agentic AI and spec-driven development — architecture, development, DevOps (GCP and AWS), and managing the development work. He works with Claude Code every day, alone or leading a dev team. He is the person for the interview.
- עולים לענן: his stack exactly (Next.js, React, TypeScript, Playwright, AWS). He also built privacy/compliance systems that turn regulation into rules and controls, which is what that system does.
- Team: he covers the technical side himself. From their side, what the briefs require and one person can't cover: project manager, the service line (24/7 SLA), a backup developer for continuity and parallel work, and people with security clearance. Small team, lower cost.
- Threshold / quality: 20+ years, 50+ products built from scratch, 2+ years deep with AI agents (the brief asks for one year). Works exactly this way daily and teaches it to dev teams. He already wrote a methodology document (that's part of the scoring). The interview is where he's strong — he can show the work live. Reference projects: the brief allows private-sector projects; they'll choose two together. What comes from their side: the government experience (Nimbus, יה"ב, the framework) and cleared staff.

Style rules for BOTH outputs:
- Plain spoken Hebrew. Short sentences. First person.
- Banned: מעטפת, ליבה רזה, בעלות מקצועית, מתודולוגיה (except once: "מסמך מתודולוגיה"), תמונה מלאה, מענה, ביחס ל, להלן, מושכל, הוליסטי, סינרגיה, "אני מאמין", big words, philosophy about AI, English jargon (no SDD, HITL, Quality Gate, Spec, Agentic — say "פיתוח עם סוכני AI" / "עבודה מסודרת מאפיון לקוד"). Allowed English: Claude Code, AWS, GCP, Next.js, React, Playwright, DevOps, SLA.
- No selling, no superlatives, no exclamation marks, no emoji.

OUTPUT 1 — the email. Like a normal reply after a good call. 6–9 short lines total: thanks / went over both briefs, it fits; one line each answering the three questions very briefly; one line with the link to a page where he wrote the points ([LINK]); one line on the BI: happy to talk with the architect, tell me when. Then "חג שמח," and signature:
שלומי זוין
shlomi@boostart.io | 054-5567213

OUTPUT 2 — the reference page, in the parse format below. Title short and plain (e.g. "שלומי זוין — התאמה לשני הבריפים"). Subtitle: one plain line. Then three sections ## התפקיד / ## הצוות / ## תנאי הסף וניקוד האיכות, each with 3–5 short bullets (one line each). Optionally one closing plain line. Total 150–230 words. No tables, no callouts, no numbering in headings.

Print "=== EMAIL ===" before output 1 and "=== PAGE ===" before output 2.

# OUTPUT FORMAT — follow exactly, it is parsed by a script
Return only the document, in Hebrew, using ONLY these constructs:
- `# ` one line: the document title (H1). Exactly once, first line.
- `>> ` one line right after the title: a one-line subtitle.
- `## ` section heading. Number sections like `## 1. ...`.
- `### ` sub-heading inside a section.
- Plain paragraphs separated by a blank line. Keep paragraphs to 1–3 sentences.
- `- ` bullet list items (single line each).
- `+ ` items of a compact two-column checklist (short items, 2–7 words each). Use for lists of 6+ short items.
- Tables in pipe format. First row is the header. No separator row needed (you may include `|---|` rows, they are ignored). Keep cells short; a cell may contain up to 2 sentences.
- A callout box:
  ::: callout
  one or two sentences
  :::
- `**bold**` is allowed inside text, sparingly. No other markdown (no links, no images, no code blocks, no HTML, no horizontal rules, no nested lists).
Do not add a preface, notes to me, or anything after the document.
