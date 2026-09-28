TASK: Write ONE short document page that Shlomi sends to יפעה ורדיגר (an IT integrator on the government framework; they talked by phone, she understood who he is). She sent two government briefs and asked exactly three questions: מה מבנה הצוות; על איזה תפקיד אתה עונה; עד כמה עומד בתנאי סף עם יכולת מוכחת ומרשימה לקבל את מלוא ניקוד האיכות. The page answers only these three, clearly, and shows he prepared seriously. It is a document, not a pitch. Length: 350–500 Hebrew words. First person (Shlomi, "אני"), not "אנחנו".

The briefs: (1) פיתוח והגירה לענן מבוסס Agentic AI ו-Spec-Driven Development (assignments across ministries, AWS/GCP); (2) המשך פיתוח מערכת "עולים לענן" (Next.js, React, Playwright on AWS). Quality scoring (brief 1): 20% התרשמות מיכולת המציע (proven team experience in full SDLC + Agentic AI); 20% איכות ההצעה (incl. internal methodology documents for AI tools across the SDLC); 30% התאמת הפתרון לצורכי המשרד; 30% ראיון עם נותני השירות בפועל; plus 2 similar projects with referees (government OR private sector in Israel). Brief 2: minimum one year with Agentic AI.

Shlomi's positions:
- Role: מוביל Agentic AI ו-SDD, ארכיטקט ופיתוח. He also covers DevOps (GCP, AWS) and managing the development work — an all-round player; with Claude Code he delivers the whole cycle himself. He is the person for the interview. Fits both briefs; עולים לענן is a direct stack match (Next.js, React, TypeScript, Playwright, AWS) plus his experience building privacy/compliance platforms that turn regulation into rules and controls — the core of that system.
- Team structure: core = Shlomi (architecture, development, DevOps, managing development, the agentic method). From their side, only what one person structurally can't cover and the briefs require: project manager and contractual interface; service line per the SLA (24/7, human answer); a backup developer for continuity and parallel assignments, trained in the method; QA acceptance and information-security contact as needed; staff with security clearance. Benefit: a lean core team with one professional owner of the whole picture.
- How he works (one short paragraph only): Claude Code as the engineering environment, models via Bedrock/Vertex inside the ministry's cloud account; spec first (Requirements, Plan, Tasks in readable Hebrew); project constitution; human approval gates; every change reviewed by him; traceability from requirement to code and tests; no real data outside the approved environment.
- Threshold and quality score, honestly: SDLC + Agentic AI proven (20+ years, 50+ products from scratch, 2+ years deep with agents — above the one-year minimum; works this way daily and teaches it to dev teams in the talk "מקלוד לפרוד"); methodology document for the 20% proposal-quality part already written; the 30% interview is his strongest point — he can show the method live; fit — direct for עולים לענן; the 2 reference projects can be from the private sector and will be chosen together with referees coordinated; what comes from their side: the government-specific experience (Nimbus, landing zone, יה"ב, the framework) and cleared staff.

Required structure:
1. One intro paragraph (2 sentences): following our call and the two briefs, here are answers to the three questions.
## 1. התפקיד — 2–3 short sentences.
## 2. מבנה הצוות — one sentence, then table | תפקיד | מי | with rows (Shlomi rows, then their-side rows), then one sentence on the benefit.
## 3. תנאי סף וניקוד איכות — table | רכיב | משקל | מה אני מביא | with rows: התרשמות מיכולת (20%); איכות ההצעה ומתודולוגיה (20%); התאמה לצורכי המשרד (30%); ראיון (30%); שנה ניסיון ב-Agentic AI (תנאי); 2 פרויקטים דומים וממליצים (תנאי). Then a callout with one honest sentence: the government-specific side comes from their side; on the agentic and methodology components he can bring the full score.
## 4. איך אני עובד — one short paragraph.
Closing line: אשמח להמשיך לשלב הבא יחד.
No BI mention (it's a separate matter). No product names of Boostart platforms.

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
