TASK: Write the document "הצעת שיתוף פעולה לספקי מסגרת: הובלת Agentic AI ו-SDD בתיחורי מערך הדיגיטל הלאומי". Audience: management / bid managers at large Israeli IT integrators that are registered suppliers in the framework of מערך הדיגיטל הלאומי (the specialization "פיתוח אפליקציית WEB עם Agentic AI"). They know tenders well; they are less strong on agentic SDD, and these tenders score it heavily. This is a one-to-two page business document, not a pitch deck. Length: roughly 600–850 Hebrew words.

Key facts to use:
- Two current tenders: (1) "פיתוח קוד וביצוע התאמות למערכות קיימות או הקמת מערכות חדשות לטובת עלייה לענן מבוסס Spec-Driven Development" — assignments across ministries, ~24 months; (2) "המשך פיתוח מערכת עולים לענן" — Next.js/React/Playwright on AWS, deliverable catalogue with day SLAs, ~24 months.
- Scoring in tender 1: 20% capability, 20% proposal quality including internal methodology documents for AI tools across the SDLC, 30% fit, 30% interview with the people who will actually do the work, plus 2 similar projects with referees.
- Boostart brings: a ready methodology document (AI-Assisted SDLC Protocol / AI Development Methodology) and approach papers for both tenders; the person for the interview who works this way daily; a multi-agent platform in production (Aspect) as proof; the ability to make the day-based deliverable catalogue deliverable profitably with SDD; training of the integrator's developers in the method (the "מקלוד לפרוד" talk and hands-on).
- The integrator brings: framework eligibility and the submission; the project manager; developers, DevOps and infrastructure staff with the required security clearance; the service center and SLA; the 5% performance bond; contractual responsibility.

Required structure:
1. תקציר — 2 short paragraphs.
2. מה התיחורים האלה בודקים — a table: קריטריון | משקל | מה נדרש בפועל (use tender 1's weights).
3. מה Boostart מביאה — + checklist items, then 2–3 sentences.
4. מה הספק המוביל מביא — bullets.
5. מודלים אפשריים לשיתוף פעולה — table: מודל | מה כולל. Rows: ספק משנה להובלת Agentic SDD בפרויקטים שיזכו; ליווי כתיבת ההגשה וההכנה לראיון; הכשרת צוותי הפיתוח של הספק בשיטה. No prices.
6. חומרים מוכנים — bullets listing: מסמך מתודולוגיה; מענה מקצועי לתיחור ההגירה לענן; מענה מקצועי לתיחור "עולים לענן"; מסמך צוות וניסיון. (They're available as pages and PDF.)
7. צעד הבא — one or two sentences: a short call to check fit, before the submission date.
Sign as שלומי זוין, Boostart, shlomi@boostart.io, 054-5567213.

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
