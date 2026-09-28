
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
