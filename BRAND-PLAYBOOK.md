# Brand, positioning & marketing changes — how to do them

A guide for whoever picks this up next. Not a record of what was done — a checklist of
what a change like this touches, in what order, and which traps have already bitten.

Applies to: renaming, changing the tagline or positioning, reworking the homepage or
login copy, swapping the logo, and rebuilding the Instagram creative set.

---

## 0. First, classify the change

The scope of everything below depends on which of these it is.

| Change | What it touches |
|---|---|
| **Phrasing only** — a headline, a subtitle | that surface + anything mirroring it (§3) |
| **Positioning** — what the product claims to be | homepage, login, share card, Maya's brief, creatives |
| **Name** | everything in §2. All of it. |
| **Logo / mark** | app icons, manifest, favicons, share card, every creative lockup |

**Ask before starting: is this a *name* change or a *word* change?** They look similar
and cost an order of magnitude apart.

---

## 1. Decide the wording before touching code

Do not start editing files and invent copy as you go. Settle the words first.

**Use GPT for Hebrew phrasing.** It is measurably better at it than writing it inline.
Current model: `gpt-5.6-terra`. Key is in `aspect/aspect-agent-server/.env`.

> ⚠️ **Check the model list before assuming a model is current.** Filter the
> `/v1/models` response and print *all* matches — a truncated list once made `gpt-5.1`
> look like the newest available when 5.2 through 5.6 were sitting right there.

How to frame the request so the answer is usable:

1. **Send the full brief as context.** `workout-app/server/maya-context.js` is the single
   source — PRODUCT, BRIEF, RULES. Extract the three blocks and paste them in.
2. **Give the exact current text** for every string you want rewritten. Without it you
   get generic suggestions instead of edits.
3. **Ask for JSON** with one field per string, plus a `why` per change.
4. **Make "change nothing" a legitimate answer.** Say so explicitly. Copy that already
   works is easy to damage, and a model asked to improve something will always find
   something to improve.
5. **Ask it to flag its own risk.** It will, and the flag is usually right.

**Then judge the output — do not apply it wholesale.** Reject anything that collides
with a decision already made. Both of the following actually happened:

- It proposed dropping the brand name from the one creative whose job is to *be* the
  brand statement.
- It reached for infrastructure (`RTL`, `PWA`) as marketing copy, which an earlier
  brief had explicitly removed.

Record what you rejected and why. That list is worth more later than the accepted list.

---

## 2. The surface inventory

Anything missed here shows up as a stale brand weeks later.

### App
- `index.html` — `<title>`, `apple-mobile-web-app-title`, `og:*`, `twitter:*`
- `public/manifest.json` — `name`, `short_name`, `description`, `start_url`, `scope`,
  every `icons[].src`, and `shortcuts` if present
- `public/sw.js` — cached paths **and `CACHE_NAME`**
- `vite.config.ts` — `base` and `build.outDir`
- `src/main.tsx` — the service-worker registration path
- Screens showing the name: `LoginScreen`, `PasscodeScreen`, `TrialGate`
- **Share sheets** — `Settings.tsx` and `FoodSettings.tsx` both have their own
  `title` + `text`. Easy to update one and miss the other.
- `FirstRunTour` and anywhere else copy names the product

### Server
- `server/maya-context.js` — brand, product description and marketing brief in one
  file on purpose, so they cannot drift across the four coach prompts.

> **A hosting deploy does not update Maya.** She keeps answering with the old brand
> until Cloud Run is redeployed. Verify by asking her the product name (§7).

### Pages
- The homepage, the current marketing round, the marketing hub, the meeting page
- The hub's generated data manifest

### Creatives
- `matzav-marketing/code/campaign*.js` — the lockup, CTAs, and the `URL` constant
- **`build_c*.js` has its own `SITE_URL` constant that overrides the module.** Changing
  the module alone silently leaves the old address printed on every with-url variant.
- Check whether generated images have text burned in before paying to regenerate them.
  Often the burned text is a real moment with no brand name, and needs nothing.

### Deliberately not renamed
Previous marketing rounds and the hub's bundled history. They are a record of what
shipped when. Leave them.

---

## 3. Surfaces that must not drift apart

When positioning changes, these four say versions of the same thing. Update them
together or they diverge and nobody notices for a month:

1. Homepage hero
2. Login subtitle
3. `og:title` / `og:description` — homepage **and** app `index.html`
4. The text rendered *on* the share card image

---

## 4. Auditing — do it in Python

> ⚠️ **Do not audit Hebrew with shell `grep`.** Terminal output mangles it, and a
> truncated line reads like a false positive or hides a real one. A "clean" grep pass
> once let `מה זה מצב?` survive on a live marketing page.

Write a short script that reads files as UTF-8, finds the term, prints clean context,
and classifies. `scratchpad/audit_name.py` is a working starting point.

**Watch for words that are both brand and ordinary language.** מצב is the clearest
case: it was the brand, and it is also the Hebrew word for *mode*. After the rename,
`מצב אימון`, `מצב תזונה`, `מצב נשימה`, `מצב תצוגה`, `מצב שיתוף` all correctly stay.
Only standalone uses were the brand.

Build the rule into the audit script rather than eyeballing it, or a later session
will "fix" the ones that are correct.

---

## 5. Paths and the PWA

**Moving the app path orphans every installed home-screen icon.** `start_url` and
`scope` are what an install is keyed on. Users must remove and re-add the icon.

Say this out loud before doing it. It is a real user cost, not a detail.

If you move it anyway:
- 301 every historical path to the new one, and **re-aim older redirects** so they do
  not become double hops
- Order redirects **most specific first** — `/x-app` before `/x`, or the broader
  pattern can swallow the narrower one
- **Bump `CACHE_NAME` in `sw.js`.** Without it, clients holding the old cache keep
  serving the old shell from the old paths and it looks like the deploy failed

---

## 6. The share card

Two rules, both learned the hard way.

**1. Never point `og:image` or `og:url` at a domain that does not resolve.**
A blanket find-and-replace once aimed them at a brand domain that was not registered
yet. The result is a WhatsApp preview with **no image at all** — the exact thing the
card exists for. Point them at the URL that actually serves until the domain is live.

**2. Version the image filename on every content change.**
WhatsApp and Facebook cache previews by image URL. Overwriting the same filename keeps
serving the stale card indefinitely. Go `og-image-v2.png` → `v3` → `v4`, and update
both `og:image` and `twitter:image`.

Generate the card the same way as everything else: an HTML file screenshotted at
1200×630 with headless Chrome. Keep the source next to the other build scripts.

---

## 7. Deploy and verify

```bash
cd workout-app && npx tsc -b && MSYS_NO_PATHCONV=1 npx vite build
cd ../../marketing-hub && MSYS_NO_PATHCONV=1 npx vite build
cd ../BoostMind && npx firebase deploy --only hosting --project boostmind-b052c

# only needed when server files or Maya's brief changed
cd workout-app/server
gcloud run deploy workout-ai --source . --region me-west1 --project boostmind-b052c \
  --allow-unauthenticated \
  --set-secrets=ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,LEONARDO_API_KEY=LEONARDO_API_KEY:latest \
  --memory=512Mi --cpu=1 --max-instances=3 --timeout=300 --quiet
```

`MSYS_NO_PATHCONV=1` matters on Git Bash for any argument starting with `/`.

### Verify, and do not trust the first check

> ⚠️ **Redirects are CDN-cached.** The first curl after a deploy can return the
> *previous* config. This once looked like a broken deploy when the config was correct.
> Re-test with a cache-buster before diagnosing.

```bash
B=https://boostmind-b052c.web.app
for u in <new-path> <old-path>; do
  curl -s -o /dev/null -w "$u %{http_code} -> %{redirect_url}\n" "$B/$u/?cb=$RANDOM"
done
curl -s "$B/<app-path>/manifest.json" | head -6      # name, start_url, scope
curl -s -o /dev/null -w "%{http_code}\n" "$B/<page>/og-image-vN.png"   # must be 200
```

Verify the **rendered output**, not the source. Grep the built bundle for the new
strings and the live HTML for the live copy.

And ask Maya the product name — it is the fastest check that the server actually shipped:

```bash
curl -s -X POST "$SERVER/api/marketing/chat" -H "Content-Type: application/json" \
  --data-binary @payload.json | python -c "import sys,json;print(json.load(sys.stdin)['text'])"
```

> Build the JSON payload in a **UTF-8 file** and send with `--data-binary`. Hebrew
> inlined in a bash heredoc gets re-encoded and arrives as mojibake. Maya will tell you
> the text arrived garbled, which is a useful signal but wastes a round trip.

---

## 8. Positioning — the standing rules

**The name may be wider than the product. The homepage may not.**
A name should have room to grow into. The hero must still say what the app does today,
or a first-time visitor leaves without knowing.

The best lines do both at once — naming the live capability *and* framing the ambition
in one sentence — rather than trading one for the other.

**Show the big idea, don't claim it.** A creative demonstrating two domains behaving as
one system beats any sentence containing "holistic". Prefer the demonstration.

**Real moments beat constructed slogans.** `"אכלתי פיצה על דף אורז"` beats
`"כותבים משפט. מקבלים ארוחה."` — one is something a person said, the other is an
agency line. Both GPT and Claude will happily produce the slogan; the rule has to come
from the brief.

**Never ship a promise for something that does not exist.** Roadmap items get
`בדרך` / `בהמשך`, never present tense.

### Never write

`הכול במקום אחד` · `אפליקציה אחת` · `המסע שלך` · `הבריאות שלך` ·
`הגרסה הטובה ביותר של עצמך` · `חוויה חכמה` · `כל הגוף שלך במקום אחד` ·
`ליווי הוליסטי מלא` · `AI שמבין אותך לגמרי` · anything implying it replaces a
trainer, dietitian or clinician.

**The golden test:** if the sentence would work verbatim on a competitor's page, delete
it and write something specific.

### Two standing constraints

- **Nutrition is guidance, never advice.** `אפשרות טובה`, `כיוון שיכול להתאים`,
  `לפי מה שנשאר היום` — never `תאכלו X`, never diagnosis, never a professional title.
- **Coaches: no B2B promises.** There is no coach dashboard. Invite them to try it and
  ask for professional feedback. Never `לכל מתאמן`, never `אתם רואים הכול`.

---

## 9. Creative pipeline

**Leonardo does photography and backdrops. HTML does typography.** That split is why
the Hebrew is correct, the logo is exact, and copy stays editable without paying to
regenerate.

If you are tempted to have the model render the Hebrew: it can, but the measured hit
rate is roughly **4 correct in 7 attempts**, with single-letter errors that are easy
to miss — `ייודעת`, `מבקשם`, `התזוומה`. Retries are not reliably better and one came
back worse. **Proofread every generated image letter by letter**, and budget $0.21 per
attempt.

Guard rails worth keeping in the build script:
- Fail loudly if any creative has more than one `←`. The CTA text and the template can
  each add one, and the double arrow has reappeared twice.
- Normalise non-breaking hyphens (`U+2011`) — GPT returns them in `ה‑AI` and they
  render inconsistently against the rest of the set.

Keep previous rounds. They are cheap to keep and useful to compare.

---

## 10. Before calling it done

- [ ] Wording settled with GPT, rejections recorded with reasons
- [ ] Python audit clean across app, pages, creatives, Maya's brief
- [ ] Words that are both brand and ordinary language handled deliberately
- [ ] Hero, login, `og:*` on both pages, and the card image all say the same thing
- [ ] Share image filename versioned; `og:image` on a host that resolves
- [ ] `sw.js` `CACHE_NAME` bumped if paths moved
- [ ] Redirects ordered specific-first; old paths 301 to new
- [ ] Hosting deployed; server deployed **if** the brief or server changed
- [ ] Verified live with a cache-buster, against rendered output
- [ ] Maya asked the product name and answering correctly
- [ ] User told about anything with a real cost — a re-install, a dead domain, a
      surface that could not be updated
