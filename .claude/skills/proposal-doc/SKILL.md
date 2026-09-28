---
name: proposal-doc
description: Build a client-facing price or retainer proposal page for Shlomi (הצעת מחיר / הצעת ליווי / הצעת ליווי ופיתוח) — a single-page Hebrew business document under public/, not a marketing landing page. Use this whenever Shlomi asks for a proposal, a quote, a retainer offer, a price page, or says he spoke with a client and wants something to send them, even if he doesn't use the word "proposal" — and also when revising an existing proposal page. Covers the intake questions, the Hebrew copy workflow via terra, the document structure and CSS, the commercial-completeness checklist, and deploy.
---

# Proposal documents

## What this is

Shlomi sends these after a phone call with a client. The page **replaces a Word file** — it is
not a pitch, not a landing page, not a portfolio. The client already spoke to him and already
knows who he is. The document's only job is to state clearly what he takes responsibility for,
what the client gets, what it costs, and under what terms.

This distinction is the thing that goes wrong most often, so hold onto it: **a proposal page
that tries to sell is a failed proposal page.** If a section exists to convince rather than to
inform, cut it.

## What NOT to build

These were all built once and all rejected. They are the default instinct and the default
instinct is wrong here:

- Tabs or multi-panel navigation. It is one document, read top to bottom.
- A hero section, an eyebrow badge, a stats strip ("20+ שנים · 50+ מוצרים").
- "למה אני" / "מה מייחד אותי" / "איך אני עובד" sections that explain his method.
- A live demo, an interactive mockup, a sample conversation widget.
- Case studies or past-project showcases.
- Anything that argues. State terms; don't defend them.

Differentiators can appear, but only as a line or two inside a section that is doing other
work — e.g. a sentence inside מה כלול saying the design won't look like a generic AI template.
Never as its own section with a heading.

**Exception:** if the ad is a public XPLACE bid rather than a follow-up to a call, the client may
have asked for specific things (project examples, stack, estimates). Ask Shlomi whether this is
post-call or a cold bid — the answer changes whether those belong on the page.

## Before building, ask

Don't guess at these. Two of them changed the whole document last time:

1. **Which track — Shlomi or Noam?** (See the root `CLAUDE.md`: Shlomi ~50K/month, Noam 10K/month.)
   He will usually say. If he doesn't, ask; never decide.
2. **The client's website.** Search for it; if you can't find it, ask for the URL. You need it for
   the logo and the colour palette. Searching the company's registered name often fails — the
   brand name is different from the ח.פ name.
3. **Who is the addressee?** A named contact ("לכבוד: איתי שרף · ע.ר.מ עיניים בע\"מ") reads far more
   like a real document than a company name alone.
4. **How much goes in** — commercial terms only, or terms plus a short scope section.

## Hebrew copy

Shlomi has said plainly that Claude's Hebrew is weak and that he does not want it in
client-facing text. Two paths, and picking the wrong one wastes a round:

**When Shlomi supplies the wording** — and he often will, especially on revisions — copy it
**verbatim**. Not "mostly verbatim." His hyphens, his punctuation, his line breaks. Do not run it
through terra to polish, do not smooth a sentence, do not swap `-` for an em-dash. He has
corrected this specifically. If a phrase seems off, build it as written and raise it afterwards.

**When copy has to be written from scratch** — use the `sol-leonardo` skill with
`gpt-5.6-terra`, the newest OpenAI text model on the key:

```bash
node ~/.claude/skills/sol-leonardo/scripts/sol.js \
  --env "C:\workspace\aspect\aspect-agent-server\.env" \
  --in brief.txt --out answer.md --model gpt-5.6-terra --effort high
```

The `--env` flag is not optional: `sol.js` checks `cwd/.env` first, and `BoostMind/.env` holds a
revoked key, so running from the repo root fails with a 401 that looks like a broken script.
Write the brief to a file and read the answer with the Read tool — Hebrew through the Windows
console comes back mangled in both directions.

A brief that produces document-register Hebrew rather than marketing Hebrew needs to say so
explicitly: name it a מסמך that replaces a Word file, ban the clichés by name, ask for short
sentences, and give the exact output shape for each section. Ask for one version per item, not
alternatives — a list of options is work handed back.

**Terra as proofreader.** When the text is Shlomi's, terra still earns its call — but as an editor,
not a writer. Tell it the text is his, that it must not restyle it, and that it should look only
for spelling/syntax errors, ambiguity, internal contradictions, and **missing commercial terms a
client would ask about**. Report what it finds; apply nothing without asking. On the EYE LOVE YOU
document it found zero language errors and five real commercial gaps.

## Commercial completeness

Before handing the page over, check the document answers these. Missing ones are what a client
emails back about, and raising them is genuinely useful to Shlomi:

- Is VAT included or added? (`30,000 ₪ + מע"מ`)
- Is the engagement length stated outright, not just implied?
- What are the stop conditions — notice required, how a mid-period stop is billed?
- Payment terms and dates.
- Who owns the code and deliverables? (Third-party service ownership is a different question.)
- Are third-party/API costs addressed, and on whose account?

Raise gaps as a short list with a recommendation. Don't silently add terms — these are Shlomi's
commercial decisions, and he has deliberately left some loose.

## Document structure

The order below is the one that survived revision. Sections are optional depending on the deal,
but keep the sequence — responsibility before price, price before payment mechanics.

```
letterhead: client logo (right) · Shlomi's details (left)
לכבוד: <contact> · <company>          תאריך: <date, pushed to the far left>
H1 — הצעת ליווי ופיתוח
client name, letterspaced, in the accent colour
intro — 2-3 paragraphs: following our call, what's proposed, what it is and isn't
אופן העבודה — how the work runs, flexibility, sync meetings
מה כלול בליווי — lead line, two-column bullet list, then closing paragraphs on full ownership
עלויות תשתית ושירותים חיצוניים — third-party and model/token costs
מסגרת הליווי ותקופת ההתקשרות — price table + a callout paragraph restating it plainly
תנאי תשלום ועלויות נלוות — VAT, payment schedule, invoicing dates
closing line — אם ההצעה מתאימה, נקבע פגישת פתיחה ונצא לדרך.
signature — name, title, email, phone
```

Commercial terms belong **at the end, together**. Splitting price from engagement period across
the document makes both harder to read; merging them under one heading with the table was a
direct instruction.

A price table beats prose for multi-period terms. Columns: תקופה · עלות · תנאים. Give each `td`
a `data-l` attribute so it can stack into labelled blocks on mobile.

## Visual language

`assets/example-eyeloveyou.html` is the finished EYE LOVE YOU document — copy it and replace the
content. Its CSS is the template: letterhead, `.incl` two-column list, the terms table with its
mobile stacking, `.callout`, print rules.

- **Light theme by default**, dark available on the toggle. Shlomi asked for "בהיר — יותר דומה
  למסמך": white paper on a soft background reads as a document, dark reads as a product page.
  Use a fresh `localStorage` key when flipping the default so returning visitors aren't stuck on
  the old one.
- **The client's palette**, pulled from their site. On EYE LOVE YOU that was cream/teal/black. This
  quietly answers the "AI designs look generic" worry that clients raise — the page itself is the
  counter-example, without a paragraph claiming so.
- **Their logo** downloaded into `assets/` next to the page. A black wordmark needs a light chip
  behind it so it survives dark mode; don't invert it.
- Section headings in **dark text**, not the accent colour — accent text headings read as web,
  dark headings read as print. Keep the accent for small marks: bullets, the client name, a
  callout border.
- Follow the root `CLAUDE.md` design rules: no gradients, solid colours, 1px borders, Heebo,
  generous whitespace.
- **Print-ready A4.** `@page{size:A4;margin:15mm 14mm}`, white background, black text, hide the
  theme toggle, `page-break-inside:avoid` on the table, the callout and the signature. The page
  then doubles as a PDF Shlomi can attach instead of a link.
- RTL throughout, mobile-tested: the two-column list collapses to one, the table stacks.

## Deploy

```bash
firebase deploy --only hosting --project boostmind-b052c
```

Then verify with `curl -s -o /dev/null -w "%{http_code}"` on both the page and the logo.

Two things worth telling Shlomi: this pushes **everything** in `public/`, so unrelated modified
files in the working tree go live too; and the page URL is `boostmind-b052c.web.app/<folder>/`.

## The outreach message

Offer a short WhatsApp message alongside the page — 4-5 lines, in follow-up to the call, pointing
at the link, inviting a reply. No selling, no restating the proposal, no emoji, no exclamation
marks. Signature is always Shlomi's, including on Noam's proposals.

The root `CLAUDE.md` says to attach the Boostart page
(`https://boostmind-b052c.web.app/boostart/`) to outreach. That rule is aimed at cold XPLACE
bids; on a proposal that follows a real phone call it reads as padding. Leave it out and say
you did, so Shlomi can put it back if he wants it.
