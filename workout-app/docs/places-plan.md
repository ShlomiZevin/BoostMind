# Places Architecture + Dietary Place — Implementation Plan

> Supersedes `wellbeing-spec.md` (keep that one only for the calorie math + coach-prompt notes).
> Status: **plan, agreed shape, not yet implemented.**

## 0. The idea in one line

The app is a **shell** that hosts N **places**. Every place has the identical skeleton —
TopBar, 4 tabs, one big centre action — and differs only in domain, colour, and what
those five things do. Today: אימונים. Now: תזונה. Later: נשימה, and more.

Building a place must be *filling in a descriptor*, not building a screen tree.

---

## 1. The place descriptor

One object defines a place completely. The shell reads it; nothing else knows a place exists.

```ts
type PlaceId = 'exercise' | 'food' | 'breath';

type Place = {
  id: PlaceId;
  he: string;                    // 'אימונים'
  icon: (props) => JSX.Element;  // line icon, stroke-only, same family as the TabBar icons
  tint: TintColor;               // place identity colour — TopBar accent, FAB, active tab
  defaultTab: string;            // landing tab when you switch into the place
  tabs: [Tab, Tab, Tab, Tab];    // EXACTLY four. Two right of the FAB, two left.
  fab: {
    label: (ctx) => string;      // dynamic — 'התחל אימון' / 'המשך אימון'
    icon: (ctx) => JSX.Element;  // bolt vs play
    onPress: (ctx) => void;
  };
  quickActions: QuickAction[];   // what OTHER places offer to trigger this one (§3)
};

type Tab = { id: string; he: string; icon: JSX.Element; render: (ctx) => ReactNode };
type QuickAction = { id: string; he: string; icon; run: (ctx) => void | Promise<void> };
```

`PLACES: Record<PlaceId, Place>` is the single registry. Adding נשימה later = one entry.

### 1.1 Colour is the place identity

This also fixes UX-REVIEW blocker #3 (13 accent colours, no meaning). From here on,
**accent colour means "which place am I in"** and nothing else.

| Place | Tint | Rationale |
|---|---|---|
| אימונים | `emerald` | already the brand colour of the workout app — no churn |
| תזונה | `amber` | food / warmth, and reads clearly against emerald in both themes |
| נשימה | `sky` | calm, cool — obviously not the other two |

`TopBar` already takes a `tint` prop with exactly these four options. No new CSS.

### 1.2 The skeleton maps 1:1 across places

| Slot | אימונים | תזונה | (נשימה) |
|---|---|---|---|
| Tab 1 (home) | בית | **היום** | היום |
| Tab 2 | היסטוריה | **היסטוריה** | היסטוריה |
| **FAB** | התחל / המשך אימון | **+ ארוחה** | התחל תרגול |
| Tab 3 | גוף | **תובנות** | תובנות |
| Tab 4 | תרגילים | **מאכלים** | תרגולים |
| TopBar actions | הגדרות · AI · שעון עצר | הגדרות · AI | הגדרות · AI |

Same grammar everywhere: *dashboard · past · [do it] · analytics · library*.
A user who learned אימונים already knows תזונה.

---

## 2. Navigating between places — the recommendation

Two affordances, one destination. Visible for discovery, gesture for speed.

### 2.1 Place Pill — the visible entry, always present

The TopBar's left-edge accent bar becomes an **interactive pill** on all four tab pages:

```
┌──────────────────────────────────────────────┐
│  [אימונים ⌄]      בית          ⏱   ✨   ⚙   │   ← RTL: pill at the start (right)
└──────────────────────────────────────────────┘
```

- Coloured in the place tint. Icon + Hebrew name + a small chevron.
- **Tap → Places Sheet** (§2.3).
- Doubles as an orientation cue — answers "where am I?" on every screen, which the
  UX review flagged as entirely missing (blocker #6).
- Costs zero tab slots and zero vertical space: it replaces decoration already there.

### 2.2 FAB long-press — the fast path

Long-press the centre FAB (350 ms + haptic). The FAB stays put and **2–3 pucks fan
upward** in an arc, each one another place's primary quick action, in that place's colour:

```
                    ⋯  כל המקומות

           נשימה                + ארוחה

                     (  ⚡  )                ← FAB, still under your thumb
```

- Keep the finger down and **slide onto a puck, release to fire** (iOS-style).
- Release without moving → the pucks stay up as ordinary tap targets.
- Tap the scrim / Esc → dismiss.
- Firing a quick action **does not leave the current place**: `+ ארוחה` from אימונים
  opens the meal modal on top of אימונים; you save, and you are still in אימונים.
- The `⋯ כל המקומות` puck opens the Places Sheet — this is what teaches the gesture's
  relationship to the pill.

Short tap is unchanged: the current place's own primary action. The mental model stays
clean — **tap = act here, long-press = act elsewhere.**

### 2.3 Places Sheet — the destination

Bottom sheet (thumb zone), one row per place, swipe-down to dismiss.

```
┌────────────────────────────────────────┐
│              ───                       │  ← drag handle
│  ┌──────────────────────────────────┐  │
│  │ אימונים               ● עכשיו    │  │  ← current place, marked
│  │ 3 אימונים השבוע                  │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ תזונה                         →  │  │  ← tap the row = go there
│  │ היום: 1,420 קק״ל                 │  │
│  │ [ + ארוחה ]  [ שאל את המאמן ]    │  │  ← chips = do it without leaving
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

Each row carries a **live status line** — the same number that place's own home shows.
That makes the sheet worth opening even when you don't intend to switch.

### 2.4 Rules

- Available on the **four tab pages only**. Suppressed during: live session, plan
  editor, any modal, the AI panel. `App.tsx` already computes `isTabPage` — gate on it.
- Each place **remembers its last tab**. Switch to תזונה and back, and אימונים returns
  you to היסטוריה if that is where you were. Persisted in `localStorage`.
- Switching places is a hash change, so browser back/forward work.

### 2.5 Rejected alternatives

| Option | Why not |
|---|---|
| A 5th tab / segmented control in the TabBar | Costs a domain tab slot; four real tabs is the requirement |
| A permanent place strip above the TabBar | Permanent chrome for a low-frequency action; eats vertical space on an already dense screen |
| Edge-swipe only | Undiscoverable with no visible affordance. Fine as an *accelerator* later, not as the primary |
| Hamburger / drawer | Wrong for a bottom-nav mobile app; puts the control in the least reachable corner |

---

## 3. Quick actions

A quick action is **place-defined, globally invokable**. Each place declares its own;
the shell surfaces them from anywhere. Same list, same labels, same icons, wherever
you trigger them from.

| Place | Quick actions (MVP) |
|---|---|
| אימונים | `התחל אימון` / `המשך אימון` (context-aware, same logic as its FAB) |
| תזונה | `+ ארוחה` · `שאל את המאמן` |
| נשימה | `נשימה 3 דקות` |

They render in two surfaces — the FAB long-press fan and the Places Sheet chips.
One definition, both surfaces.

---

## 4. Routing

```
#/exercise/home     #/exercise/history   #/exercise/body     #/exercise/exercises
#/exercise/session/:id                   #/exercise/settings
#/food/today        #/food/history       #/food/insights     #/food/meals
#/food/settings
```

`Route` becomes `{ place: PlaceId; page: string; ...params }`.

**Migration**: `parseHash` falls back to `place: 'exercise'` for every legacy hash
(`#/home`, `#/session/x`, …) and rewrites the URL. The existing PWA start URL and any
bookmark keeps working. No Firestore migration.

---

## 5. Data model — תזונה

All under `users/{uid}/`. Disjoint from exercise data.

### 5.1 `personalMeals/{mealId}` — the meal library

Starts **empty**. Grows every time you log something new — same lifecycle as
`personalExercises`.

```ts
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink';

type PersonalMeal = {
  id: string;                  // slug of `he` — reuse exerciseIdOf()
  he: string;                  // 'שקשוקה עם פיתה'
  type: MealType;
  calories: number;            // total, for the meal as this user eats it
  ingredients?: Array<{ he: string; calories: number }>;   // the AI breakdown
  macros?: { protein?: number; carbs?: number; fat?: number; sugar?: number };
  flags?: { highSugar?: boolean; emptyCarbs?: boolean };
  photoBase64?: string;
  aliases?: string[];
  isAnchor?: boolean;          // your staples — pinned to the top of the picker
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
};
```

> **Meals, not ingredients.** The unit of tracking is *your* meal. The ingredient
> breakdown exists to justify the calorie number and let you tweak it — it is not a
> food database, and we never ask the user to assemble a meal from parts.

The reader is written as a layered merge from day one (global ∪ personal → overrides →
hidden), the same shape as `listPersonalExercises`, but with the global layer empty.
That way a seeded Israeli-food DB can land later with **zero migration**.

### 5.1.1 Meal naming convention

The exercise DB has a naming template for a reason: without it the same lift ends up in
the DB five times and the history splits across all five. Meals have exactly the same
failure mode, and worse — free-text meal descriptions are far more variable than
exercise names. The convention below goes in the `parse-meal` prompt and in the
manual-entry hint text.

**Template:** `<מרכיב עיקרי> [הכנה] [עם <תוספת>]`

Rules, in priority order:

1. **Pure Hebrew.** No English, no transliteration. Same rule as exercises.
2. **No quantities in the name.** `פיתה`, never `2 פיתות`. Amounts live in
   `ingredients` and in the serving multiplier. This is the single most important rule
   — quantities in the name is what would fork one meal into ten entries.
3. **No meal-time words.** `ארוחת בוקר` is the `type` field, not part of the name.
4. **No verbs or possessives.** Not `אכלתי שקשוקה`, not `השקשוקה שלי`.
5. **Preparation only when it moves the calories.** `בתנור`, `מטוגן`, `קלוי` — yes.
   `טרי`, `ביתי`, `טעים` — no.
6. **Main component first**, sides after `עם`. Two sides max in the name; the rest live
   in `ingredients`.
7. **Singular, 2–5 words.**

| ✅ | ❌ | Why |
|---|---|---|
| `שקשוקה עם פיתה` | `2 פיתות עם שקשוקה` | quantity in the name; main component not first |
| `חזה עוף בתנור עם אורז` | `ארוחת צהריים - עוף` | meal-time word; not specific |
| `סלט טונה` | `הסלט טונה שלי` | possessive |
| `קפה הפוך` | `קפה הפוך גדול עם 2 סוכר` | quantities |
| `יוגורט עם גרנולה` | `אכלתי יוגורט וגרנולה` | verb |

Same `exerciseIdOf` slug function generates the id, so the convention is what makes the
id stable — and stable ids are what let the parser return an existing `mealId` (§7.1)
instead of a near-duplicate.

### 5.2 `mealLogs/{logId}` — what you actually ate

One doc per logged meal, not an array on a day doc. Denormalised snapshot: editing a
template later never rewrites history.

```ts
type MealLog = {
  id: string;
  mealId?: string | null;      // null for a one-off
  name: string;                // snapshot
  calories: number;            // snapshot
  ingredients?: Array<{ he: string; calories: number }>;   // snapshot
  macros?: { ... };            // snapshot
  flags?: { ... };             // snapshot
  mealType: MealType;
  timestamp: number;
  notes?: string;
};
```

### 5.3 Dietary profile → `profile/main`

**Not** `settings/main`. The user profile already lives at `profile/main`; a second
profile in a different doc is a trap. Add a nested key:

```ts
UserProfile.diet?: {
  enabled?: boolean;
  goal?: 'lose' | 'maintain' | 'gain';
  weightKg?: number; heightCm?: number; age?: number;
  gender?: 'male' | 'female' | 'other';
  activityMultiplier?: number;
  dailyCalorieTarget?: number;
  dailyCalorieTargetManual?: boolean;
  avoidSugar?: boolean; avoidEmptyCarbs?: boolean;
  constraints?: string;
};
```

### 5.4 Auto-add-to-DB rule

`logMeal(entry)`:

1. If `mealId` is set → log against that template, bump `lastUsedAt`.
2. Else look up by name / alias (`findPersonalByName`).
3. Still nothing → **create the template** (`ensurePersonalMeal`, mirroring
   `ensurePersonalExercise`) and log against it.

So "add a meal" and "grow my meal DB" are the same action. Never a separate chore.

### 5.5 Housekeeping

Add `personalMeals` and `mealLogs` to the `wipeAllUserData` subcollection list.

---

## 6. Adding a meal — the core flow

One modal, two paths, opened by the FAB.

```
┌────────────────────────────────────────┐
│  ארוחה חדשה                        ×   │
├────────────────────────────────────────┤
│  [ בוקר ][ צהריים ][ ערב ][ נשנוש ]    │  ← meal type, defaults from the clock
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ ✨ תאר מה אכלת…          📷   ⏎  │  │  ← AI path
│  └──────────────────────────────────┘  │
│                                        │
│  ─────────  או בחר מהמאגר  ─────────   │
│  🔍 [ חיפוש ]                          │
│  ★ שקשוקה עם פיתה            420 קק״ל  │  ← anchors first, then
│    סלט טונה                   310 קק״ל  │    least-recently-eaten first
│    (ריק — עוד לא הוספת ארוחות)          │    (same pickPersonal ranking)
└────────────────────────────────────────┘
```

### 6.1 AI path

Free text ("אכלתי שקשוקה עם 2 פיתות וקפה הפוך") or a photo of the plate.
Returns an **approval card inline in the modal** — not in the chat:

```
┌────────────────────────────────────────┐
│  שקשוקה עם פיתה                  ✏     │  ← every field editable before approving
│  ────────────────────────────────────  │
│  ביצים ורוטב עגבניות            220    │
│  פיתה (×2)                      340    │
│  קפה הפוך                        90    │
│  ────────────────────────────────────  │
│  סה״כ                       650 קק״ל   │
│  🍞 פחמימות ריקות                      │
│                                        │
│  [ הוסף להיום ]   [ ערוך ]   [ בטל ]   │
└────────────────────────────────────────┘
```

Approving writes the log **and** the template (§5.4). Nothing is written before the tap
— the same approval-first rule the trainer already follows.

### 6.2 Manual path

Pick a template → serving stepper → save. Or type a name + calories for a one-off.
An empty DB is the expected first state: the picker shows a single line pointing at the
AI input above it.

---

## 7. Speed — the 30-second problem

Waiting 30 s to log a meal kills the habit. Three fixes, in order of impact.

### 7.1 A dedicated endpoint — not the chat endpoint

`POST /api/food/parse-meal`. **Same model as everywhere else — Opus 5.** The coaches
have to stay smart, and estimating what is actually in a dish is real judgment, not
string matching.

The speed comes from the *payload*, not the tier. The chat endpoint carries the whole
conversation history, the full personal exercise DB, the profile, the planned sessions,
and a 4000-token budget — for a task that is one question with one answer. This one carries:

```ts
{
  uid,
  text?: string,          // 'אכלתי שקשוקה עם 2 פיתות וקפה הפוך'
  image?: string,         // base64, same pipeline as the exercise photo flow
  mealType: MealType,
  knownMeals: Array<{ id, he, calories, ingredients? }>,   // the user's meal DB
}
```

- No history, no exercise DB, no profile
- `max_tokens: 1000`, forced JSON schema
- One turn in, one card out

**It must check `knownMeals` first** — exactly like naming mode checks the exercise DB
before proposing anything new. If the description matches an existing meal, it returns
that `mealId` and the card renders as "your usual, ×1" instead of inventing a duplicate
entry. This is what keeps the DB from filling with six spellings of שקשוקה.

Same-tier model, a fraction of the input → materially faster, and the answer lands in
the modal instead of a chat thread. When it is still slow, §7.3 covers it.

### 7.2 Streaming for the coach chat

The chat is slow because `server/index.js` calls `anthropic.messages.create` and the
client waits for the *entire* response. Switch to SSE (`messages.stream`) and pipe the
deltas through: first token in ~1–2 s. Perceived latency drops by an order of magnitude
for every mode, not just food. Biggest single win in the app.

### 7.3 Background answers + notification

For genuinely long conversational turns. The server **already persists the assistant
message to Firestore before responding**, so half the plumbing exists. What is missing
is the client half:

- An app-shell-level Firestore listener on chat threads, active whether or not the
  panel is open.
- A new assistant message arriving while the panel is closed → **toast**:
  `המאמן ענה · [פתח]` — tap opens straight to that thread.
- Any message carrying an **unapproved action** also raises a persistent badge on the
  Place Pill and on that place's Places Sheet row: `1 ממתין לאישור`.
- Real push via FCM is a later option. Not needed for MVP — an in-app listener covers
  the "I closed the chat and came back" case, which is the actual complaint.

This generalises beyond food: the trainer's `set_weekly_targets` proposals get the same
inbox for free.

---

## 8. Rollout

Each phase is independently shippable and independently revertable.

### Phase 0 — Places framework *(no new features)*

- `Route` gains `place`; `parseHash` / `routeToHash` rewrite legacy hashes
- `PLACES` registry + `Place` type + `PlaceShell` component
- `PlacePill`, `PlacesSheet`, FAB long-press fan
- **אימונים re-expressed as a descriptor** — every current tab renders unchanged
- Ships: an identical app, plus a pill that opens a sheet with one entry
- **Done when**: the exercise app behaves exactly as before, and the diff to
  `FreeHome` / `FreeSession` / `Body` / `Exercises` is near-zero

### Phase 1 — תזונה place, manual logging

- Firestore helpers: `personalMeals`, `mealLogs`, `profile.diet`
- Four tabs live: היום (timeline + running total) · היסטוריה · תובנות (stub) · מאכלים
- Add-meal modal, manual path only
- Minimal diet profile in Settings + Mifflin-St Jeor target (skippable — until it is
  set, היום shows the eaten total with a `הגדר יעד` CTA instead of a balance)
- Ships: **you can log meals.** Everything else builds on this.

### Phase 2 — AI meal parsing

- `/api/food/parse-meal` on Opus 5, text + photo, `knownMeals` in the payload
- Meal naming convention (§5.1.1) in the prompt
- Approval card in the modal, every field editable
- Auto-create template on approve; match to an existing `mealId` when it is not new

### Phase 3 — Cross-place quick actions + async answers

- `quickActions` wired into the fan and the sheet
- Background chat listener → toast + pending-approval badge

### Phase 4 — *(after MVP)* the dietary coach

- `dietary` mode + `dietary` chat bucket (extend `bucket: 'coach' | 'naming'`)
- Deficit math using real exercise burn from `FreeSet` volume + `AerobicEntry` METs
- Streaming (§7.2) — pull this forward if the chat annoys before then
- תובנות tab: weekly kcal bars, deficit / sugar-free streaks

---

## 9. Decisions

1. **Serving multiplier — in the MVP.** `MealLog` carries `servings: number`
   (default 1); logged calories are `template.calories × servings`. This is not a
   nice-to-have — it is what makes naming rule #2 hold. Without it, "half my usual
   shakshuka" becomes a second DB entry called `חצי שקשוקה`, and the whole
   one-meal-one-entry model leaks. Stepper offers ×0.5 / ×1 / ×1.5 / ×2 plus free entry.
2. **Meal photos — in the MVP.** Reuses the existing pipeline end to end:
   `compressImage` from `usePhotos`, `photoBase64` on the template, the same base64
   plumbing the exercise photo flow and the AI image attachment already use. Two uses:
   a thumb on the meal row in מאכלים, and photo-as-input to `parse-meal` (§7.1).
3. **נשימה — not a place yet.** The mechanics are built for N places (registry,
   descriptor, sheet, fan all iterate), but we ship with two. Adding it later is one
   `PLACES` entry plus its four tabs; no shell work. The Places Sheet renders two rows
   for now, and the FAB fan shows a single puck — which is fine, it still reads as a
   fan and the interaction is identical when a third arrives.

4. **Dietary onboarding — form now, chat later.** MVP collects goal / weight / height /
   age / activity as a plain form in the place's הגדרות tab. It unblocks the calorie
   target immediately and carries no AI dependency.
   **Phase 4** replaces the first entry into תזונה with a guided chat, mirroring what
   אימונים already does (`OnboardingScreen` + `useOnboardingBuilder` + the `onboarding`
   server mode + `update_profile` / `ready_to_start` actions). The form stays as the
   edit surface afterwards — same as the exercise profile card in Settings today.

## 10. Model — settled

All modes run **Opus 5** ([`server/index.js:8`](../server/index.js#L8),
`process.env.CLAUDE_MODEL || 'claude-opus-5'`). Verified against the live Cloud Run
service: its only env entry is `ANTHROPIC_API_KEY`, so no override is in play.
**Not to be downgraded** — the coaches need to stay accurate, and that includes the
meal parser.

The latency is therefore not the tier. It is:

1. no streaming — the client waits for the full response before rendering anything
2. `max_tokens: 4000`
3. a system prompt carrying up to 200 exercises + 400 recent sets + profile + plans

§7.1 addresses (3) for the meal path, §7.2 addresses (1) everywhere, §7.3 makes the
remainder not matter.

### 10.1 Cost — caching beats downgrading

| | Input /M | Output /M |
|---|---|---|
| Opus 5 | $5.00 | $25.00 |
| Sonnet 5 | $3.00 | $15.00 |

Sonnet 5 is 40% cheaper on both, at comparable token counts. (An intro rate of
$2/$10 applies through **2026-08-31** only — don't plan around it.) A trainer turn
runs ~15K input + ~700 output ⇒ **~$0.09 on Opus, ~$0.06 on Sonnet**; at 20 turns/day
that is ~$54/month vs ~$34/month.

**Prompt caching is the bigger lever, and the server uses none of it.** Cached reads
bill at ~0.1×, so the same 15K-token prefix costs $0.0075 instead of $0.075 — roughly
**90% off the dominant cost component, on Opus**. That beats the tier downgrade
outright and gives up nothing in answer quality.

One structural change makes it work. The system prompt is currently one joined string
with the volatile recent-sets list inside it, so a single new set invalidates the whole
prefix. Split it:

1. Static instructions + exercise DB → `cache_control: { type: 'ephemeral' }`
2. Volatile per-turn context (recent sets, today's summary) → *after* the breakpoint

Opus 5's minimum cacheable prefix is 512 tokens, so every mode qualifies. Verify with
`usage.cache_read_input_tokens` — if it stays 0 across turns, something above the
breakpoint is still changing.

**Order: streaming → caching → then reassess Sonnet.** After both, the chat is fast and
costs about a third of today on the same model. If Sonnet still looks right after that,
it is a one-line change in a `MODEL_BY_MODE` map.
