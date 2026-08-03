# RTL Audit — workout-app

**Audited:** 2026-07-31 · **Scope:** `workout-app/src/**`, `workout-app/index.html`, `workout-app/public/manifest.json`
**Status:** findings only — nothing was changed by this audit.

> ⚠️ **Concurrency warning:** `src/components/Exercises.tsx` was being edited by another session *during* this audit
> (mtime moved mid-run; `justify-end` → `justify-start` at lines 83/133/157 and a `flex-row-reverse` removal at ~131
> appeared between two reads). **Re-verify every line number in `Exercises.tsx` before editing it.** All other files
> were stable.

---

## TL;DR — the root cause

The app is **a Hebrew-only app rendering inside an LTR document**.

`index.html` declares `<html lang="en">` with **no `dir` attribute**. RTL is then faked, per-element, with
**98 × `dir="rtl"`**, **60 × `text-right`**, and **19 × `flex-row-reverse"`** scattered through the components.

That produces three distinct bug classes, all of which are live in the app today:

| # | Bug class | Why | Count |
|---|-----------|-----|-------|
| **A** | **`justify-end` inside `dir="rtl"` aligns LEFT** | `justify-content: flex-end` is *direction-relative*. Inside an `dir="rtl"` box, `flex-end` = left. The author wrote `justify-end` meaning "right". | 11 sites |
| **B** | **`flex-row-reverse` + `dir="rtl"` = double flip → back to LTR order** | `dir="rtl"` already reverses the main axis; `row-reverse` reverses it again. Children land in LTR order. | 9 sites |
| **C** | **Physical utilities never mirror** | `text-right`, `pl/pr`, `ml/mr`, `left-*`, `rounded-tl/tr` are absolute. They will *not* follow a future `dir="rtl"` on `<html>`. | ~70 sites |

Classes A and B are **visible bugs right now**. Class C is a **landmine**: the moment anyone adds `dir="rtl"` to
`<html>` (the correct fix), every `justify-*` in the codebase silently flips *again* while every `text-right` stays put.

**Tailwind is 3.4.14** — logical utilities (`ps-*`, `pe-*`, `ms-*`, `me-*`, `start-*`, `end-*`, `text-start`,
`text-end`, `rounded-s*`, `rounded-e*`, `border-s`, `border-e`) are all available. No plugin needed.

---

## Recommended fix order

Do these **in order**. Steps 1 and 2 must land in the same commit or the app will look worse mid-way.

### Step 1 — Make the document RTL (the actual fix)

```html
<!-- workout-app/index.html:2 -->
<html lang="he" dir="rtl" class="dark">
```

### Step 2 — Delete the compensation layer

Once `<html dir="rtl">` is set, the per-element workarounds become wrong or redundant:

1. **Remove all 19 `flex-row-reverse`.** Every one of them exists only to un-flip an LTR container.
   Exception: keep it *only* where the visual order genuinely differs from source order (audit each; expect ~0 survivors).
2. **Remove `dir="rtl"` from the 98 elements that just re-declare the page direction.**
   **Keep** `dir="rtl"` only on: elements nested inside a `dir="ltr"` island.
3. **Keep all 6 `dir="ltr"`** — they are correct and load-bearing (English names, numeric ranges).
4. **`text-right` → `text-start`** (or delete — `dir="rtl"` right-aligns by default). `text-left` → `text-end`
   *only* on the English `dir="ltr"` inputs, where `text-left` is already correct and can stay.
5. **`justify-end` → `justify-start`** wherever the intent was "hug the Hebrew edge" (see the §A table — most of them).
6. **Physical spacing → logical:** `pr-*`→`ps-*`, `pl-*`→`pe-*`, `mr-*`→`me-*`, `ml-*`→`ms-*`, `left-*`→`start-*`,
   `rounded-tl-*`→`rounded-ss-*`, `rounded-tr-*`→`rounded-se-*`.
7. **Un-reverse the 5 hardcoded-backwards ellipsis strings** (§E) — they break under a correct `dir="rtl"`.

### Step 3 — Content/locale

`lang="he"` on `<html>`, Hebrew `<title>`, `"lang": "he"` + `"dir": "rtl"` in `manifest.json`, Hebrew loading strings,
Hebrew passcode screen (§F, §G).

---

## A. `justify-end` inside `dir="rtl"` — aligns LEFT, intended RIGHT

Live visual bugs. Fix: `justify-end` → `justify-start`.

| File | Line | Element | RTL ancestor |
|---|---|---|---|
| `src/components/LogSetModal.tsx` | 260 | muscle chip row | `dir="rtl"` on same element |
| `src/components/LogSetModal.tsx` | 335 | exercise history meta row | `dir="rtl"` on same element |
| `src/components/LogSetModal.tsx` | 349 | photo actions row | `dir="rtl"` on same element |
| `src/components/LogSetModal.tsx` | 501 | unit (kg/lb) picker | `dir="rtl"` on same element |
| `src/components/FreeSession.tsx` | 265 | exercise name + muscle badge | inherits from L262 card |
| `src/components/FreeSessionDetail.tsx` | 196 | muscle badge list | `dir="rtl"` on same element |
| `src/components/FreeHome.tsx` | 137 | in-progress session muscle list | inherits from L131 button |
| `src/components/FreeHome.tsx` | 246 | recent-session muscle badges | inherits from L240 button |
| `src/components/FreeHistory.tsx` | 51 | session card muscle badges | inherits from L45 button |
| `src/components/ExercisesMigrate.tsx` | 281 | muscle picker chips | inherits from L251 card |
| `src/components/ExercisesMigrate.tsx` | 298 | reject/pending/accept buttons | inherits from L251 card |

**Already fixed by the concurrent session** (verify, don't redo): `Exercises.tsx:83`, `:133`, `:157`.

**Correct as-is (do not touch):** `LogSetModal.tsx:392` (`justify-start` inside `dir="rtl"` at L390 → right-aligned ✓).

---

## B. `flex-row-reverse` + `dir="rtl"` — double flip, children render LTR

Live visual bugs. Fix: delete `flex-row-reverse`.

| File | Line | What renders backwards |
|---|---|---|
| `src/components/Settings.tsx` | 61 | "מצב תצוגה" label lands LEFT, toggle button RIGHT |
| `src/components/Settings.tsx` | 77 | "התרגילים שלי" label LEFT, `←` chevron RIGHT |
| `src/components/Settings.tsx` | 87 | "מטרות שבועיות" label LEFT, reset link RIGHT |
| `src/components/Settings.tsx` | 106 | every muscle-target row: name LEFT, −/+/count RIGHT |
| `src/components/Settings.tsx` | 130 | "החלף משתמש" label LEFT, logout button RIGHT |
| `src/components/LogSetModal.tsx` | 322 | selected-exercise card: photo LEFT, "החלף" RIGHT |
| `src/components/AiChatPanel.tsx` | 190 | AI action button: name LEFT, "+ הוסף לפוקוס" RIGHT |
| `src/components/AiChatPanel.tsx` | 195 | muscle badge / "חדש" badge order reversed |
| `src/components/StartSessionModal.tsx` | 112 | muscle tile: name LEFT, weekly count RIGHT |

**Note on `Exercises.tsx:131`** — the concurrent session appears to have already removed this one. Verify.

---

## C. Page back-buttons sit on the wrong edge

Five page headers use `flex flex-row-reverse` on an **LTR** container (no `dir` on the flex box itself — the
`dir="rtl"` sits on the `<h1>` child). Result: the `→` back arrow renders at the **top-left**. In an RTL UI, back
belongs at the **top-right**.

| File | Line |
|---|---|
| `src/components/Settings.tsx` | 55–58 |
| `src/components/FreeHistory.tsx` | 25–28 |
| `src/components/Exercises.tsx` | 74–77 ⚠️ re-verify |
| `src/components/ExercisesMigrate.tsx` | 178–181 |
| `src/components/FreeSessionDetail.tsx` | 140–144 |

After `<html dir="rtl">`, dropping `flex-row-reverse` puts the `<h1>` first-in-source at the right and the button at
the left — **still wrong**. Reorder the JSX so the back button is the **first** child.

**Correct as-is (do not touch):** modal headers at `LogSetModal.tsx:244`, `AiChatPanel.tsx:150`,
`StartSessionModal.tsx:46`, `Exercises.tsx:326`. A close `×` at top-left *is* the correct RTL mirror of LTR's top-right.

**Inconsistent, needs a decision:** `FreeSession.tsx:204–212` — the session header has no `dir` at all. `×` renders
left, "סיים" right. Pick one convention and apply it to all six headers.

---

## D. Bidi text-reordering bugs (highest-value finding)

### D1 — Set values render **reversed**: `10×50kg` displays as `50kg×10`

```tsx
<span>{s.reps}×{s.weight}{unit}</span>
```

| File | Line |
|---|---|
| `src/components/FreeSession.tsx` | 307 |
| `src/components/FreeSessionDetail.tsx` | 270 |

Both are inside `dir="rtl"` containers. `×` (U+00D7) has Unicode bidi class **ON** (Other Neutral). Under UBA rule N1,
a neutral between two numbers in an RTL paragraph resolves to **R**, so the whole expression is reordered — the same
reason `5 + 3 = 8` displays as `8 = 3 + 5` in a Hebrew paragraph. The logged **reps × weight** reads back as
**weight × reps**.

**Fix:** wrap the value in an LTR island — `<span dir="ltr" className="font-mono">{s.reps}×{s.weight}{unit}</span>` —
or use `<bdi>`. Note the author *already knew about this pattern*: `LogSetModal.tsx:310`, `:336`, `:443` correctly
carry `dir="ltr"` on numeric ranges. These two set-row sites were simply missed.

### D2 — Manually-built date strings

`FreeHistory.tsx:38` (`${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`) and `FreeHome.tsx:25`
(`formatDayMonth`) build dates by hand. `/` is bidi class CS so these happen to survive reordering — but they are
inconsistent with the `toLocaleDateString('he-IL', …)` used elsewhere (`FreeHome.tsx:123`, `FreeSession.tsx:207`,
`FreeHistory.tsx:39`). Low severity; prefer `toLocaleDateString` and/or `dir="ltr"` on the wrapper.

### D3 — `<input type="date">` inside an RTL card

`src/components/FreeSessionDetail.tsx:150` and `:161` — native date inputs inheriting `dir="rtl"` from the L147 card.
Chrome renders the DD/MM/YYYY sub-fields in RTL order, which reads wrong. Add `dir="ltr"` to both inputs.

---

## E. Hardcoded-backwards ellipsis strings — will break after the fix

Five loading labels have the `...` manually moved to the front of the string to compensate for the LTR document.
Once `dir="rtl"` is correct, these render with the ellipsis on the **right** (wrong side).

| File | Line | Current | Should become |
|---|---|---|---|
| `src/components/Exercises.tsx` | 85 | `'...מייבא'` | `'מייבא...'` ⚠️ re-verify line |
| `src/components/Exercises.tsx` | 339 | `'...חושב'` | `'חושב...'` ⚠️ re-verify line |
| `src/components/ExercisesMigrate.tsx` | 193 | `'...רענון'` | `'רענון...'` |
| `src/components/ExercisesMigrate.tsx` | 343 | `'...מחיל'` | `'מחיל...'` |
| `src/components/LogSetModal.tsx` | 355 | `'...טוען'` | `'טוען...'` |

---

## F. Document / PWA shell

| File | Line | Issue |
|---|---|---|
| `workout-app/index.html` | 2 | `<html lang="en" class="dark">` — **no `dir`**, and `lang="en"` on Hebrew content (breaks screen-reader voice selection, font fallback, spellcheck). → `lang="he" dir="rtl"` |
| `workout-app/index.html` | 11 | `<title>Workout Logger</title>` — English title on a Hebrew-only app |
| `workout-app/public/manifest.json` | 2–4 | `"name": "Workout Logger"`, `"short_name": "Workout"`, `"description": "Track your gym workouts"` — all English; **no `"lang": "he"`, no `"dir": "rtl"`** |
| `workout-app/src/index.css` | 11 | `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` — no Hebrew-optimised face. Consider Heebo/Rubik/Assistant, consistent with the house design language. |
| `workout-app/src/main.tsx` | 6–15 | Theme bootstrap touches `documentElement`/`body` classes but never sets `dir`. If direction is ever made dynamic, set it here. |

---

## G. Hebrew-only violations (PLAN.md §"Languages: Hebrew only")

| File | Line | English string |
|---|---|---|
| `src/components/PasscodeScreen.tsx` | 26 | `Workout Logger` |
| `src/components/PasscodeScreen.tsx` | 27 | `Enter your 4-digit passcode` |
| `src/components/PasscodeScreen.tsx` | 53 | Backspace glyph is `←` — in RTL, backspace points **right**. Use `⌫` (direction-neutral, preferred) or `→`. |
| `src/components/PasscodeScreen.tsx` | 25 | Whole screen has no `dir` and is centered — inherits the fix from `<html>`, no local change needed. |
| `src/components/FreeHome.tsx` | 104 | `Loading...` |
| `src/components/FreeSession.tsx` | 144 | `Loading...` |
| `src/components/FreeSession.tsx` | 145 | `Session not found` |
| `src/components/FreeHistory.tsx` | 30 | `Loading...` |
| `src/components/Exercises.tsx` | 105 | `Loading...` ⚠️ re-verify line |
| `src/components/Exercises.tsx` | 347 | `English name` label — **intentional**, leave it |
| `src/components/ExercisesMigrate.tsx` | 265 | `English name` label — **intentional**, leave it |

Note `ExercisesMigrate.tsx:201` already uses `טוען...` — use that as the canonical loading string.

---

## H. Physical spacing / positioning that won't mirror

| File | Line | Current | Notes |
|---|---|---|---|
| `src/components/FreeSession.tsx` | 218 | `fixed bottom-24 left-4` + `pl-4 pr-5` on the AI FAB | Physical `left-4` won't mirror → `start-4` or `end-4` (decide which edge). The asymmetric `pl-4 pr-5` was tuned for LTR icon-then-text; becomes wrong once the icon/label order flips. → `ps-5 pe-4`. |
| `src/components/FreeHome.tsx` | 178, 204 | `ml-auto` on the progress-bar fills | Works today by accident. Under `dir="rtl"` the fill sits at flex-start (right) with no margin hack — **delete `ml-auto`** and the wrapping `flex` on L176/L202. |
| `src/components/FreeHome.tsx` | 184 | `pr-3` sub-muscle indent | → `ps-3` |
| `src/components/Exercises.tsx` | 120 | `pr-1` on group header | → `ps-1` ⚠️ re-verify line |
| `src/components/LogSetModal.tsx` | 308 | `mr-2` on the "· N סטים" span | → `ms-2` |
| `src/components/AiChatPanel.tsx` | 174, 175, 213 | `rounded-tl-sm` / `rounded-tr-sm` on chat bubbles | Physical corners don't mirror → `rounded-ss-sm` / `rounded-se-sm` |
| `src/components/RestTimer.tsx` | 34 | `left-1/2 -translate-x-1/2` | Centering — direction-agnostic, **safe, leave it** |
| `src/components/Exercises.tsx` | 286 | `left-1/2 -translate-x-1/2` | Same, **safe** ⚠️ re-verify line |
| `FreeSession.tsx:321`, `FreeSessionDetail.tsx:291`, `ExercisesMigrate.tsx:323` | — | `fixed bottom-0 left-0 right-0` | Symmetric — **safe, leave it** |

---

## I. Chat bubble sides — needs a product decision

`src/components/AiChatPanel.tsx:170`

```tsx
<div className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
```

This container has **no `dir`**, so it currently resolves against the LTR document: **user messages left, assistant
right.** The loading indicator at `:212` hardcodes `justify-end` to match the assistant side.

Adding `dir="rtl"` to `<html>` **silently swaps both sides** with no other code change. Decide the intended convention
first (Hebrew messaging apps put the outgoing message on the left), then pin it explicitly rather than letting it fall
out of the inherited direction.

---

## J. Typography nits (low severity, real)

- **`uppercase` + `tracking-wider` on Hebrew text.** Hebrew has no case, so `uppercase` is a no-op, but positive
  letter-spacing on Hebrew is typographically wrong and hurts legibility at the 10px sizes used here.
  Sites: `FreeSession.tsx:230`, `FreeSessionDetail.tsx:149`, `:159`, `:176`, `FreeHome.tsx:134`.
- **`truncate` on Hebrew strings** — `Exercises.tsx:140/143/146/151`, `LogSetModal.tsx:434`. The `…` lands on the
  correct side only when the element's resolved direction matches the text. Will self-resolve once §F step 1 lands;
  worth an eyeball pass on long exercise names afterwards.
- **`LogSetModal.tsx:385`** — the exercise-search input uses `input-field !text-sm !py-2` without `!text-right`, so it
  inherits `.input-field`'s `text-center` while every sibling Hebrew input is right-aligned. Inconsistent.
- **`.input-field`** (`src/index.css:35`) hardcodes `text-center` and `font-mono`, forcing every consumer to override
  with `!text-right`. Consider splitting into a numeric variant and a text variant.

---

## Verification checklist

After the fix, walk every screen with `dir="rtl"` active and real Hebrew data:

- [ ] `#/` — Home: weekly volume bars fill from the **right**; parent/sub-muscle rows indent from the right; in-progress card badges hug the right
- [ ] `#/` — Start-session modal: muscle tiles read name-right / count-left
- [ ] `#/session/:id` — session header (`×` / date / סיים) on a settled convention; AI FAB edge + padding correct
- [ ] `#/session/:id` — **set rows read `10×50kg`, not `50kg×10`** ← the D1 regression test
- [ ] `#/session/:id` — Log-set modal: chips right-aligned, selected-exercise card photo/name/החלף in the right order, kg/lb picker right
- [ ] `#/session/:id` — AI chat: bubble sides match the chosen convention; bubble corner radii mirror
- [ ] `#/session/:id` — rest timer, both minimized and fullscreen
- [ ] `#/history` and `#/session-view/:id` — back arrow on the right; date inputs read LTR; set rows correct
- [ ] `#/settings` — all five rows: label right, control left; muscle-target −/+ rows
- [ ] `#/exercises` and `#/exercises/migrate` — ⚠️ coordinate with the concurrent session before touching
- [ ] Passcode screen — Hebrew copy, backspace glyph points the right way
- [ ] All five loading labels show `טוען...` style, ellipsis on the **left**
- [ ] Install as PWA — app name and splash are Hebrew
