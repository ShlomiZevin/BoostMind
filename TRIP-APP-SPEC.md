# Generic Trip Planner — Build Spec

**For a fresh session.** Build a new, dedicated React project that generalises an
existing single-file trip-guide app so that **any trip works by swapping one JSON
file**. Everything that exists today must keep working — the tabs, and above all
the chat that can read, explain, and edit the plan.

---

## 0. The user's own instructions, verbatim

These are the requirements as the owner (Shlomi) stated them. They are the
contract; everything below is the elaboration.

> בלי קשר אני רוצה אחכ בצד שתכין פרויקט חדש של זה אפליקציה גנרית לתכנון טיולים
> ותכתוב מחדש בריאקט נורמלי בפרויקט חדש יעודי בדיפלוי יעודי שבעצם כל
> הפונקציונליות שיש עכשיו אבל שהטיול עצמו מגיע מגייסון או מהגדרות ואז אפשר הכל
> להתאים עם הצאט לשנות לעדכן למחוק לשאול וכולי. בעצם כל מה שיש עכשיו אבל שזה
> יהיה גנרי כך שזה יצאים לי לכל טיול רק עם גייסון שונה ואז כל השאר יעבוד מיד.
> הטאבים ובעיקר הצאט. תכין לי קובץ md באנגלית שמסביר את זה מה צריך לעשות
> ושמריך לחקות את האפליקציה שכאן עם הפניה לקבצים כדי שזה יווצר בדיוק אותו דבר
> אבל בשינויים שהסברתי. סשן אחר יעשה את זה אז שהאמדי יהיהי מקיך ככל שצריך והכל
> יהיה ברור כולל שים שם בדיוק את מה שכתבתי כאן כהנחיות גם כן.

Translation of the operative points:

1. New dedicated project, **real React** (not a single HTML file), with its own
   dedicated deployment.
2. **All current functionality preserved** — the tabs, and especially the chat.
3. The trip itself comes from **JSON or configuration**, not hardcoded content.
4. The chat can **change, update, delete, ask** — everything it does today.
5. Generic: a **different JSON is the only thing needed** for a new trip;
   everything else works immediately.
6. Mimic the existing app closely, using the file references in this document,
   so the result is the same app with the changes described.

**Read this as: copy the logic and the behaviour, not just the feature list.** The
model id, the effort setting, the tool list, the system prompt's voice and rules,
the operation contract, the parser's edge cases and the CSS decisions in §2.1 are
all deliberate. Where this document says "copy exactly", it means it. Where it
says "make generic", change only that.

---

## 1. Source material — read these first

All paths are absolute on this machine.

| File | Lines | What it is |
|---|---|---|
| `c:/workspace/BoostMind/public/sicilia/index.html` | 1458 | **The whole current app.** React 18 UMD + in-browser Babel, single file. This is the reference implementation — read it end to end before writing anything. |
| `c:/workspace/BoostMind/public/sicilia/sw.js` | 75 | Service worker. Network-first for HTML, cache-first for CDN assets. |
| `c:/workspace/BoostMind/public/sicilia/manifest.json` | 20 | PWA manifest (RTL, standalone, emoji icon as inline SVG data URI). |
| `c:/workspace/BoostMind/workout-app/server/trip.js` | 233 | **The chat backend.** Express route `POST /api/trip/chat`, Anthropic streaming over SSE, the system prompt, the edit-operations contract, rate limiting. |
| `c:/workspace/BoostMind/workout-app/server/index.js` | — | Mounts it: `import mountTrip from './trip.js'` (line 5), `mountTrip(app, anthropic)` (line 1785). Also holds the CORS allowlist (~line 283). |
| `c:/workspace/BoostMind/public/corfu/index.html` | — | The predecessor the Sicily app was cloned from. Useful only for lineage; the Sicily file supersedes it. |
| `c:/workspace/BoostMind/firebase.json` | — | Hosting rewrites; `/sicilia/**` → `/sicilia/index.html` (line 85). |
| `c:/workspace/BoostMind/deploy.sh` | — | The single deploy entry point for the existing infrastructure. |

The current app's top-level functions, in file order — the new project should
have an equivalent for each:

```
useStore  insertByTime  pick  applyOps  ActionButtons  KV  Overlay
PlaceDetail  MealDetail  ItineraryView  LeftView  PlacesView  FoodView
splitAction  phoneNode  inlineNodes  renderRich  ChatView  InfoView  App
```

---

## 2. What the app does today

A mobile-first, Hebrew, RTL, installable PWA for one trip. Dark by default with a
light theme toggle. Six tabs in a fixed bottom nav.

### 2.1 App shell — one screen, never scrolls

The page itself never scrolls. The shell is a fixed-height column:

```
┌─ topbar (flex: none) ────────────┐
│ ─ screen (flex: 1, overflow-y)  │   ← only this scrolls
└─ bottomnav (flex: none) ─────────┘
```

Non-negotiable details, each of which was a bug at some point:

- `body` and the root element use **`height: 100dvh`** with `100vh` as a
  fallback. **Not `100%`** — on iOS `100%` resolves against the *large* viewport
  (the one with the URL bar hidden), which pushes the bottom nav below the
  visible area where it is invisible **and untappable**.
- `<meta name="viewport" ... viewport-fit=cover>` and `overflow: hidden` on body,
  `overscroll-behavior: none`.
- The bottom nav uses a small flat `padding-bottom` (8px). Do **not** reserve
  `env(safe-area-inset-bottom)` — iOS reports 34px and the owner explicitly
  rejected the resulting gap in standalone mode.
- Paint the background on the root element as well, so nothing white shows
  through in standalone.
- Detail views are full-screen overlays (`position: fixed; inset: 0`) that are
  themselves a flex column with their own internal scroll area.

### 2.2 The six tabs

| Tab | Content |
|---|---|
| **לו״ז** (Itinerary) | One collapsible card per day. Progress bar and `done/total`. Optional per-day warning banner. Inside: a timeline of items. |
| **נשאר** (What's left) | Every unchecked item, grouped by day, one tap to check off. |
| **מקומות** (Places) | Filter chips by category, then a grid of place cards opening a full detail overlay. |
| **אוכל** (Food) | The trip's meals/restaurants, each opening a detail overlay, plus a static list of local dishes. |
| **צ׳אט** (Chat) | See §3. |
| **מידע** (Info) | Checkable packing list, the accommodation card, driving/local-practicalities cards, and a "restore the original plan" button. |

**Timeline row layout** (this went through several iterations — land on the final
one): three aligned columns, `time → checkbox → content`, all top-aligned, with a
thin separator between rows. No timeline rail and no dots — they competed with
the checkbox and the time for the same space and read as clutter. Items flagged
optional show an "אופציונלי" pill and are excluded from the day's progress count
and from the "what's left" tab.

### 2.3 Checkbox / packing state

Per-item `done` flags and packing-list flags persist in `localStorage`, keyed by
the item's stable id. They are separate from the trip data itself.

---

## 3. The chat — the centre of the product

### 3.1 Architecture, and why

The app is statically hosted. **An API key in the client is a public key** —
anyone opening the page can read it. So the chat calls a small server endpoint
that holds the key.

Today that endpoint rides on an existing Cloud Run service:

- Service `workout-ai`, region `me-west1`, project `boostmind-b052c`
- `https://workout-ai-463727469066.me-west1.run.app/api/trip/chat`
- The key lives as the Secret Manager secret `ANTHROPIC_API_KEY`, injected at
  deploy time. It never reaches the browser.

**For the new project, stand up a dedicated backend** (the owner asked for a
dedicated deploy). Anything that keeps the key server-side is fine — a small
Cloud Run service, a Cloud Function, or an edge function. Keep the same contract.

### 3.2 Request / response contract

Request body:

```jsonc
{
  "messages": [ { "role": "user" | "assistant", "content": "…" } ],  // last 20
  "trip": { /* the entire current trip JSON, live from the client */ }
}
```

The client sends the **current** trip on every turn. That is what lets the chat
answer about what is actually on the plan, including edits it made earlier. There
is no server-side persistence of anything.

Response: **SSE**, three event types:

```
event: delta   data: {"t":"<text chunk>"}
event: done    data: {"stop":"end_turn"}
event: error   data: {"message":"failed"}
```

Errors after headers are sent must go out as an `error` **event**, not a status
code — the headers are already flushed.

Server hardening that must be carried over:

- Filter incoming messages to `role`/`content` only, cap content length, keep the
  last 20, reject if the first is not a user turn.
- Cap the serialised trip size (currently 120 KB) and return 413 above it.
- Per-IP rate limit (currently 60/hour per instance). CORS protects browsers, not
  scripts, and the endpoint is public.
- CORS allowlist must include the new app's origin.

### 3.3 Model configuration

**Copy this exactly.** Every value here is a decision that was made and tested,
not a default. Do not substitute a different model, drop the effort setting, or
skip the tool — and do not "upgrade" the model without asking the owner first.

```js
model: 'claude-sonnet-5',
max_tokens: 3000,
output_config: { effort: 'low' },     // this is what makes it feel fast
tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }],
system: [
  { type: 'text', text: GUIDE, cache_control: { type: 'ephemeral' } },  // static, cached
  { type: 'text', text: 'The current plan:\n\n' + tripJson },           // volatile, after
],
```

Notes:

- The static instructions come **first** with a cache breakpoint; the volatile
  trip JSON comes after, so the cached prefix survives edits.
- Streaming is required — both for UX and because searches make turns long.
- **Handle `pause_turn`**: server-side web search can pause a turn. Loop at most
  3 times, pushing `final.content` back as an assistant turn each time.
- **`claude-sonnet-5`** is the owner's explicit choice. The chat originally ran on
  `claude-opus-5`; the owner moved it to Sonnet for cost, with the same setup
  otherwise ("OPUS too much יכול SONNET באותו אופן"). Keep Sonnet unless told
  otherwise. Model ids in this family carry no date suffix.
- **`effort: 'low'`** is what makes it feel fast — less deliberation, no preamble,
  shorter answers. It is not a cost knob here, it is the product decision. A
  plan question answers in a few seconds; a search-backed one takes ~30s.
- **`web_search_20260209`** requires Sonnet 5 / Sonnet 4.6 / Opus 4.6+. No beta
  header. It runs on Anthropic's servers — no extra key, no extra infrastructure.
- Streaming is required — both for UX and because searches make turns long.
- **Handle `pause_turn`**: server-side web search can pause a turn. Loop at most
  3 times, pushing `final.content` back as an assistant turn each time.

**SDK note.** The current backend runs `@anthropic-ai/sdk@^0.30.1`, which predates
these parameters and passes `output_config` and `tools` through as plain body
fields. That works, but the new project should install a **current** SDK version
so the parameters are typed and validated.

**Before writing any of this code, load the `claude-api` skill.** It carries the
authoritative, current reference for model ids, `output_config`, adaptive
thinking, server tools and streaming. Do not write Anthropic API calls from
memory — several of these shapes changed during 2025–2026 and a stale prior will
produce code that 400s.

### 3.3.1 Port the behaviour, not just the plumbing

The system prompt in `workout-app/server/trip.js` is the product. Port it
**faithfully**, translating only the trip-specific framing into values read from
`meta`. Specifically, carry over:

- The **voice**: Hebrew, at eye level, "like a friend who has been there". Short —
  a line or two when that is enough. No preambles, no "great question", no
  summary paragraph at the end.
- The **knowledge boundary** of §3.4 — this wording was corrected after a real
  failure and the exact framing matters.
- The **formatting instructions** of §3.5, including the rule that phone numbers
  must be written in full international form or the client cannot linkify them.
- The **proposal language** of §3.6 — "I suggest", never "I updated", because the
  user has not approved yet.
- The **operations contract** of §3.7 verbatim, including the two-operation rule
  for adding a restaurant and the warning that the worked example's placeholder
  name must never be mentioned to the user.

Read `trip.js` end to end before rewriting it. It is only 233 lines and every
paragraph in it is there because something went wrong without it.

### 3.4 What the chat is allowed to know and say

This distinction was a real bug and must be preserved:

- **Place and restaurant names, and what somewhere is known for** — the model
  knows these. It must give concrete names. An early prompt said "never invent
  restaurant names", which suppressed genuine knowledge and made the assistant
  useless. Refusing to name a restaurant is a failure.
- **Prices, today's opening hours, table availability** — volatile. Either search,
  or say to check. Never invent numbers.
- Web search should be used for current recommendations, opening hours, whether a
  place still exists, weather and closures. Instruct it to search in English or
  Italian (or the trip's local language) rather than Hebrew.

### 3.5 Response formatting — the client renders it

The client has its own small renderer. **Do not add a markdown library** — the
app must work offline and a CDN dependency breaks that. It handles exactly what
the model produces:

| Input | Rendered as |
|---|---|
| `**bold**` | bold; a line that is entirely bold becomes a small heading |
| `- item` lines | a bullet list |
| `# heading` | heading |
| `[text](url)` | link |
| `https://…` | link, displayed shortened without `https://www.` |
| bare domain (`example.com`, `.it`, `.org`, …) | link, `https://` prepended |
| `name@host.tld` | `mailto:` link |
| `+39 0942 21265` | phone chip: call + WhatsApp |
| Italian domestic `0942 628874` | phone chip too |

Four defects were found here. Do not reintroduce them:

1. **Bold must recurse.** The model writes `**trattoriadaninotaormina.com**`; a
   non-recursive parser renders that as bold text and the link dies. Parse the
   contents of a bold run.
2. **A `g`-flagged regex must not be shared across the recursion.** The shared
   `lastIndex` gets reset by the inner call, the outer loop restarts on the same
   token, and the browser hangs in an infinite loop — freezing the whole UI so no
   tab responds at all. Build a fresh `RegExp` instance per call.
3. **Phone numbers need explicit LTR isolation.** An LTR digit run inside an RTL
   paragraph is reordered by the bidi algorithm and displays reversed
   (`21265 0942 39+`). Use `dir="ltr"`, `unicode-bidi: isolate`, and `<bdi>`.
4. **Italy keeps the trunk zero in international format.** `0942 628874` dials as
   `+390942628874`, *not* `+39942628874`. Make this per-country configuration in
   the generic app, not a hardcoded rule — see §4.4.

Also verify that prices, times (`08:00`) and years (`2026`) are **not** matched as
phone numbers.

### 3.5.1 Every place the chat names is actionable

A place mentioned in conversation is not yet on the plan, so it has no card — but
the user still wants to act on it immediately. Every place **name** in a chat
answer is therefore tappable, opening a bottom action sheet with: copy name,
Google search, Google Images, open in Maps, navigate.

Detection heuristic, which works because of how the model writes: a bold run is
treated as a place name when it contains Latin letters and does **not** itself
contain a link, domain, email or phone token. That keeps Hebrew section headings
(`**חשוב לדעת**`) as plain bold, keeps `**example.com**` a link, and keeps
`**+39 …**` a phone chip, while `**Trattoria Don Ciccio**` and
`**St. George by Heinz Beck**` become tappable.

In the generic app this heuristic must be locale-aware: "Latin letters" is a proxy
for "a foreign proper noun in a Hebrew sentence". Drive it from
`meta.language` / the destination's script rather than hardcoding it, or have the
model wrap names in an explicit marker and fall back to the heuristic.

The clipboard helper needs a `document.execCommand('copy')` fallback — the
Clipboard API is unavailable in older browsers and outside secure contexts.

### 3.6 Editing the plan — propose, then approve

The chat does not mutate the plan on its own. The flow the owner asked for:

> כשהוא רוצה לעדכן תוכנית הוא מציג את מה שהוא רוצה לעשות. ואז מאפשר לאשר או לא
> עם כפתור בתוך השיחה של הצאט. שלא יעשה על דעת עצמו שיבדוק יתעדכן יסביר יתן את
> האופציה המובנית ויאשר אישור ביטול לפני שמשנה

1. If information is needed (a recommendation, hours, whether a place is open),
   **search first**.
2. Explain briefly, in proposal language — not "I updated" but "I suggest".
3. Emit a fenced operations block, text first, block last:

````
```action
{"ops":[ … ]}
```
````

4. The client parses the block, runs the operations **against a copy** to produce
   a human-readable preview, and shows a proposal card in the conversation with
   the exact list of changes and two buttons: **approve** / **cancel**.
5. Only on approve is the real plan changed; the card then turns into a green
   "plan updated" summary. Cancel leaves a muted "no change made" line so the
   history shows what was declined.

Implementation requirements:

- **Approval re-runs the operations against the plan as it is at click time**, not
  as it was when the proposal was made. Two proposals approved out of order both
  land correctly.
- Parse the action block **wherever it appears** in the response. The model does
  not reliably put it last, and a parser that assumes "last" loses the text.
- While streaming, strip both a complete block and a half-written trailing one so
  raw JSON never flashes in the live preview.
- A malformed block degrades to "text only, no operations". Never throw.
- Any single operation that fails (unknown id, missing field) is skipped
  silently; it must never corrupt the rest of the plan.
- **Never let an example in the prompt leak into answers.** An earlier prompt used
  a plausible restaurant name in its worked example and the model told the user
  that restaurant was already on their plan. Use an obviously fake placeholder and
  state explicitly that it must never be mentioned.

### 3.7 The operations

Applied in order. Ids are stable and come from the trip JSON.

```jsonc
{"op":"addItem","day":"<dayId>","t":"20:30","x":"<what>","n":"<note>",
 "place":"<placeId>","meal":"<mealId>","opt":true}     // inserted in time order
{"op":"updateItem","day":"<dayId>","item":"<itemId>", …}  // re-sorts if t changes
{"op":"removeItem","day":"<dayId>","item":"<itemId>"}
{"op":"moveItem","day":"<fromDayId>","item":"<itemId>","toDay":"<toDayId>","t":"09:00"}
{"op":"setWarn","day":"<dayId>","warn":"<text|null>"}
{"op":"setDay","day":"<dayId>","label":"…","date":"…"}

{"op":"addPlace","id":"<newId>","he":"…","name":"…","emoji":"📍","cat":"…",
 "tag":"…","drive":"…","q":"<maps query>","web":"…","phone":"+39 …",
 "desc":"…","why":"…","time":"…","best":"…","parking":"…","facilities":"…",
 "tips":["…"]}
{"op":"updatePlace","id":"<placeId>", …}
{"op":"removePlace","id":"<placeId>"}   // also clears references from items

{"op":"addMeal","id":"<newId>","day":"…","time":"…","he":"…","name":"…",
 "area":"…","q":"…","web":"…","phone":"…","emoji":"🍝","desc":"…","look":"…",
 "dishes":["…"]}
{"op":"updateMeal","id":"<mealId>", …}
{"op":"removeMeal","id":"<mealId>"}     // also clears references from items
```

Rules:

- Adding a restaurant is **always two operations**: `addMeal` with an id the model
  chooses, then `addItem` (or `updateItem` on an existing meal slot) pointing at
  it — so it lands both in the food list and in that day's itinerary. Same shape
  for a new place: `addPlace` then `addItem` with `place`.
- Field whitelists on apply. Never `Object.assign` a raw operation onto a record.
- `web` and `phone` become the "website" and "call" buttons on the card. Fill them
  only when actually found; never invent them.

### 3.8 Chat session behaviour

Per the owner:

> אני לא צריך היסטוריית שיחות שם. רק אפשרות לעשות שיחה. אם לא עשיתי כלום זה
> נשאר על השיחה שהייתי עליה. ויש לי אפשרות לעשות שיחה חדשה

One conversation, persisted locally so it is still there when the app reopens. No
conversation list, no history browser. A "new chat" control clears it. Empty state
offers a few one-tap starter questions.

---

## 4. What must become generic

This is the actual point of the rewrite.

### 4.1 One trip file drives everything

Today `DEFAULT_TRIP` is a literal inside the HTML. In the new project a trip is a
JSON document (or a small module exporting one) that the app loads at startup and
copies into local state on first run.

Shape, generalised:

```jsonc
{
  "version": 1,
  "meta": {
    "id": "sicily-2026-09",
    "title": "סיציליה",                       // header title
    "subtitle": "2–6 בספטמבר · 5 ימים",
    "emoji": "🌋",                            // favicon, manifest icon, header
    "language": "he",
    "direction": "rtl",
    "theme": { "accent": "#f59e0b", "bg": "#120f0d", … },
    "country": { "code": "IT", "dialCode": "+39", "keepTrunkZero": true },
    "base": { "name": "…", "area": "…", "q": "…", "note": "…" },
    "gateway": { "name": "Catania Fontanarossa · CTA", "q": "…" },
    "distances": [ { "label": "…", "value": "…" } ]
  },
  "days":   [ { "id", "d", "label", "date", "warn", "items": [ … ] } ],
  "places": { "<id>": { … } },
  "meals":  [ { "id", … } ],
  "reference": {
    "dishes":  [ ["English","Local","description"], … ],
    "packing": [ ["category", ["item", …]], … ],
    "cards":   [ { "title": "🚗 …", "html": "…" }, … ]   // driving, weather, tips
  }
}
```

Everything currently hardcoded moves in here: the header, the theme colours, the
apartment, the airport, the packing list, the dishes, the driving/weather/etiquette
cards in the Info tab, and the map/parking shortcuts. **Nothing Sicily-specific may
remain in the components.**

### 4.2 The chat prompt must be built from the trip

The system prompt today contains Sicily wording. In the new project the server
composes it from `meta` — destination name, dates, local language for searches,
currency, dial code. The operations contract and formatting rules stay fixed; only
the trip-specific framing is interpolated.

### 4.3 Multiple trips

Support more than one trip file, selected by route (`/trip/:id`) or by a picker.
Per-trip `localStorage` namespacing, keyed by `meta.id`, so plans, checkmarks,
packing state and the conversation of different trips never collide.

### 4.4 Locale-dependent behaviour must be config, not code

- Phone dialling: `dialCode` plus `keepTrunkZero` (true for Italy, false for most
  countries) instead of a hardcoded `+39`.
- Search-language hint for the chat.
- Currency and units where they appear.
- Any category list (`beach | city | nature | town | wine | food`) should come
  from the trip file, with the filter chips generated from what is actually used.

### 4.5 Editing without the chat

Since the plan is now data, add a small manual editor (add/edit/delete a day, an
item, a place, a meal) reusing the same operation functions the chat produces. The
chat becomes one producer of operations rather than the only one. Also keep the
"restore the original plan" action, and add JSON export/import so a trip can be
backed up or moved to another device.

---

## 5. Technical requirements for the new project

- **Vite + React 18 + TypeScript.** Real modules, real build, type the trip schema
  and the operation union properly — the operation contract is exactly the kind of
  thing that benefits from a discriminated union.
- **PWA**: manifest generated from `meta`, installable, and a service worker that
  is **network-first for HTML and cache-first for hashed assets**. The predecessor
  shipped cache-first for everything and updates silently never reached the
  installed app — refreshing did not help because the refresh was served from
  cache too. Bump the cache name on every release.
- **Offline**: everything except the chat must work with no network. The chat is
  the only online feature and must fail with a clear message, keeping any partial
  answer already streamed.
- **State**: trip, checkmarks, packing, conversation and theme in `localStorage`,
  namespaced per trip. Migrate gracefully when a trip file gains fields.
- **RTL and i18n**: driven by `meta.direction`/`meta.language`. Do not hardcode
  Hebrew strings in components — put UI strings in one file so another language is
  a translation, not a rewrite.
- **Dedicated deploy**, separate from `boostmind-b052c` hosting. Its own project or
  its own site, plus its own backend service for the chat.
- **Tests** for the parts that broke here: `applyOps` (each operation, plus
  malformed input), the inline text parser (bold recursion, no infinite loop,
  bidi phones, bare domains, false-positive prices/times/years), and the action
  block splitter (block first, block last, malformed, absent).

---

## 6. Definition of done

1. A new trip is created by writing one JSON file. No component changes. The
   header, theme, tabs, cards, packing list, dishes and chat all follow.
2. Every current behaviour survives: six tabs, collapsible days, checkmarks,
   what's-left, place and meal detail overlays with navigate / Waze / Maps /
   Google / images / copy-name / website / call, the packing checklist, and the
   restore action.
3. Any place the chat merely *mentions* — not yet on the plan — is tappable in the
   conversation and offers copy / Google / images / Maps / navigate.
4. The chat answers about the plan, searches the web for real recommendations,
   returns formatted text with working links and tappable phone numbers, and
   proposes plan edits that only apply after explicit approval.
5. One screen that never scrolls, in the browser and installed to the home
   screen, with a tappable bottom nav flush to the bottom edge.
6. The API key is never present in any client bundle.
7. Deployed to its own URL, installable, and working offline apart from the chat.

---

## 7. Regression list

Every one of these was a live bug in the current app. Re-verify each in the new
project.

| # | Symptom | Cause | Fix |
|---|---|---|---|
| 1 | Updates never reached the installed app; refreshing did nothing | Service worker was cache-first for HTML | Network-first for HTML, cache-first for assets, bump cache name per release |
| 2 | Tapping the chat tab froze the entire app; no tab responded | A `g`-flagged regex shared between an outer loop and its recursive call; `lastIndex` reset caused an infinite loop | A fresh `RegExp` per call |
| 3 | Bottom nav invisible and untappable, wrong position | `height: 100%` resolves against iOS's large viewport | `100dvh` with a `100vh` fallback |
| 4 | Visible gap under the bottom nav in standalone | `env(safe-area-inset-bottom)` reserved 34px | Flat 8px padding, no safe-area reservation |
| 5 | Phone numbers displayed reversed | LTR digit run inside an RTL paragraph | `dir="ltr"` + `unicode-bidi: isolate` + `<bdi>` |
| 6 | Website shown but not clickable | Model wrapped the domain in `**…**`; parser did not recurse into bold | Recursive inline parsing |
| 7 | Italian numbers dialled wrong | Stripped the leading zero as most countries require | Italy keeps the trunk zero — make it per-country config |
| 8 | "That restaurant is already on your plan" — it was not | The prompt's worked example used a plausible name and the model treated it as data | Obviously fake placeholder, plus an explicit instruction never to mention it |
| 9 | "I have no information about restaurants" | The prompt banned inventing names and thereby suppressed real knowledge | Separate stable knowledge (names, what a place is known for) from volatile facts (prices, hours) |
| 10 | Itinerary rows looked cluttered and misaligned | Timeline rail, dot, checkbox and time all competed for the same space | Three aligned columns — time, checkbox, content — with a thin separator |
| 11 | Duplicate suppliers/entities after a data-shape change | Merge compared names that had been renamed in between | Stable ids everywhere; never key domain data by display name |
| 12 | A place the chat recommended could not be copied or searched | Actions existed only on saved cards, not on names in conversation | Tappable names in chat opening an action sheet (§3.5.1) |

---

## 8. Suggested order of work

1. Read `public/sicilia/index.html` end to end, then `workout-app/server/trip.js`.
2. Scaffold the Vite + TS project and define the trip schema types.
3. Port `applyOps` and the inline text parser first, with tests — they are the
   two pieces that broke most often and they have no UI dependencies.
4. Build the shell (dvh column, bottom nav, overlay pattern) and verify on a real
   iPhone in both Safari and installed-to-home-screen before building the tabs.
5. Port the tabs, reading all content from the trip file.
6. Stand up the backend, port the prompt with the trip-specific parts
   interpolated, and wire the chat with the propose/approve flow.
7. Extract the Sicily trip into `trips/sicily-2026-09.json` and confirm it renders
   identically to the current app.
8. Write a second trip file with different content and confirm nothing else needs
   to change. That is the acceptance test for "generic".
