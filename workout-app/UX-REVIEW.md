# Workout App — UX/UI Review & Implementation Brief

> **What this document is:** a full UX/UI audit of the workout app, written as an executable brief for a Claude Code session. Every finding carries a file reference and an acceptance criterion.
>
> **How to use it:** work top-down through §7 (Work Plan). P0 items are release blockers. Do not start P1 before P0 is green.

---

## 0. Ground rules for the implementing session

**Read this before touching code.**

| Fact | Detail |
|---|---|
| **Language** | The app is **Hebrew-only**. There is no i18n layer and none is planned. Every user-facing string must be Hebrew. See §4 for the exceptions that are legitimately Latin. |
| **Direction** | RTL-only. `index.html` already sets `<html lang="he" dir="rtl">`. |
| **Stack** | React 18 + TypeScript + Vite + Tailwind, Firebase (Auth + Firestore), Express backend for the AI endpoints. |
| **Entry** | [src/App.tsx](src/App.tsx) — hash routing, `AuthedShell` gates onboarding, `AppShell` renders tabs. |
| **Shared UI** | [src/components/TopBar.tsx](src/components/TopBar.tsx), [TabBar.tsx](src/components/TabBar.tsx), [TopBarActions.tsx](src/components/TopBarActions.tsx). Design tokens in [src/index.css](src/index.css) (`.card`, `.btn-primary`, `.input-field`, `.text-muted`, …). |
| **Do not break** | See §8. The app is in daily production use by the owner (a professional trainer). Behaviour changes must be conservative; this is a clarity pass, not a rewrite. |

**Working style for this brief:** prefer extracting shared components over editing 6 copies. Several findings below are the *same* problem duplicated across files — fix the root, not the instances.

---

## 1. Executive summary

The functionality is deep and the engineering is solid. The problem is not missing capability — it is **unexplained abundance**. A first-time user is shown every feature at once, with no hierarchy signalling what matters now and what can be discovered later.

**Five blockers for selling this:**

| # | Blocker | Why it kills the sale |
|---|---|---|
| **1** | **The "exercise vs. set" model is never explained** | It is the app's core concept. The bottom bar offers `+ אירובי` · `+ תרגיל` · `+ סט` — all three open the *same* modal in different `saveMode`s. Six differently-worded add buttons exist across the session screen. A newcomer cannot guess the model. |
| **2** | **Colour carries no consistent meaning** | 13 accent colours in use. Blue = planned *and* history *and* the "workouts this week" section *and* the primary "log set" button. Green = live *and* completed *and* brand *and* AI. There is no language to learn. |
| **3** | **The session screen is overloaded** | ~14 interactive targets in a *single* exercise card. Supersets — a pro-level feature — sit at the same visual weight as logging a set. |
| **4** | **Panels don't separate from each other** | `TopBar` and sticky section headers use near-identical treatment (gradient + accent bar + bold title). While scrolling it reads as if the header swapped. This is the root of the "can't tell the areas apart" feeling. |
| **5** | **No moment of orientation** | No visual onboarding, no coach marks, no guiding empty states. Skip the AI chat and you land on a Home screen full of zeros and dashes that looks broken. |

**Plus one product-level miss:** the PWA manifest is entirely English, so a Hebrew-only app installs to the home screen labelled **"Workout"**. See §4.1.

---

## 2. New-user journey — screen by screen

### 2.1 Login · [src/components/LoginScreen.tsx](src/components/LoginScreen.tsx)

**What the user sees:** a dumbbell icon, the heading "מאמן אישי", the line "התחבר כדי להתחיל", a Google button.

- **No product name, no value proposition.** "מאמן אישי" is a category label, not a brand. A user arriving from a link has no idea what they are about to get.
- **No screenshots, no benefit bullets, no social proof.** Mandatory for a paid product.
- **Google only.** No Apple Sign-In (a hard blocker for iOS App Store distribution), no email, no "try without an account" demo path.
- The white Google button on a white light-mode background has weak contrast ([L40](src/components/LoginScreen.tsx#L40)).

**Fix:** turn it into a short landing screen — product name + tagline + three benefit bullets (track sets in seconds · personal AI coach · a plan built for you) + auth buttons. One screen height, no scroll.

---

### 2.2 Onboarding · [src/components/OnboardingScreen.tsx](src/components/OnboardingScreen.tsx)

**What the user sees:** a full-screen AI chat opening with a long paragraph, a text input, and a small "דלג לעכשיו" chip.

- **The chat is the *only* onboarding path.** There is no alternative for someone who does not want to talk to a bot. The skip chip ([L65](src/components/OnboardingScreen.tsx#L65)) disappears after the first reply — from then on the only exit is an unlabelled `×`.
- **No progress indication.** The user cannot tell if this is question 1 of 4 or an open-ended conversation.
- **The opening message is too long** ([L26](src/components/OnboardingScreen.tsx#L26)) — four lines of text before the first question. On mobile that is a wall.
- 🔴 **`BuildOverlay` in the error state is a dead end.** [L128–L140](src/components/OnboardingScreen.tsx#L128) renders a red circle and a message with **no buttons at all** — no retry, no dismiss, no skip. If `build-skeleton` fails (server down, rate limit, no network) a brand-new user is trapped in a modal until they kill the tab. **This must be fixed before shipping.**
- The success moment is wasted: `setTimeout(…, 1600)` then a silent navigate home ([L36–L39](src/components/OnboardingScreen.tsx#L36)). No "here is the plan we built you" screen.

**Fix:**
1. Add "נסה שוב" and "דלג" buttons to `BuildOverlay`'s error branch.
2. Add a non-chat path: four screens of large buttons (level / goal / days per week / limitations), with the chat offered as "או פשוט דבר איתי".
3. Add a summary screen after the build: "בנינו לך 4 ימי אימון" + preview + "בוא נתחיל".

---

### 2.3 Home · [src/components/FreeHome.tsx](src/components/FreeHome.tsx)

The screen that decides retention. It stacks **three layers of chrome before any content**: TopBar (64px) → edge-to-edge `TodayTile` → sticky section header. On a small phone that is ~40% of the viewport.

- **Day order is inverted.** [L616](src/components/FreeHome.tsx#L616) sorts `b.date.getDay() - a.date.getDay()`, rendering Saturday → Sunday. Users expect today first, or plain chronological order. A newcomer sees Saturday at the top and hunts for their position.
- **Five visual "moods" for day tiles, with no legend** ([L630–L647](src/components/FreeHome.tsx#L630)): today / today+done / past+done / rest day / future. The rest day has **no text whatsoever** — just a moon glyph on a dotted background. Elegant, but unreadable to a newcomer.
- **The "נפח שבועי" panel is the densest thing in the app.** One small sticky header holds: title + "ערוך" chip + a 3-option `<select>` + two toggle chips = **five controls** ([L433–L473](src/components/FreeHome.tsx#L433)). A new user has no mental model of "comparison basis" and cannot interpret יעדים / שבוע שעבר / מוחלט.
- 🟠 **The `↺` badge relies on `title=` alone** ([L516](src/components/FreeHome.tsx#L516)). There is no hover on mobile, so it is **completely inaccessible**. This applies to every `title=` tooltip in the app.
- **`—` as the empty value** makes a first-week user think data failed to load.
- **Destructive actions are top-level and undersized.** Trash on the active-session banner ([L991](src/components/FreeHome.tsx#L991)) and on every planned card ([L774](src/components/FreeHome.tsx#L774)) — `w-7 h-7` and `p-0.5`, i.e. **well under the 44px minimum**. Destructive, tiny, in a gym, with sweaty hands.
- **The FAB is a lightning bolt** ([TabBar.tsx L122](src/components/TabBar.tsx#L122)). Not a universal "start workout" symbol. `+` or `▶` would read instantly. There is an `aria-label` but no visible label.

**Fix:**
1. Reorder days: today first, then upcoming, then past. Or plain chronological.
2. Add a one-line legend under "אימוני השבוע": `● היום  ✓ בוצע  ▢ מתוכנן  ☾ מנוחה`.
3. Volume panel: keep only the בוצע/מתוכנן toggle. Move the comparison-basis `select` into Settings or behind a small ⚙. Replace every `title=` with visible text or tap-to-reveal.
4. Move delete behind a swipe or a `⋯` menu.
5. Day-one empty state: replace the all-zero volume panel with "עוד אין נתונים — אחרי האימון הראשון תראה כאן את הנפח השבועי שלך".

---

### 2.4 Session · [src/components/FreeSession.tsx](src/components/FreeSession.tsx)

The densest screen in the app, and where the "too many buttons" instinct is most correct.

**Interactive targets in a *single* logged-exercise card:**

| Element | Location |
|---|---|
| ↑ / ↓ superset reorder | top-left cluster |
| 🔗 link to superset | top-left cluster |
| ⛓️‍💥 unlink from superset | top-left cluster |
| each set row (tap = edit) | body |
| 🗑 delete, per set | body |
| `+ סט נוסף` | footer |
| `AI` | footer |
| `+ הערה` / `ערוך הערה` | `ExerciseInline` |
| 4 difficulty chips | `ExerciseInline` |
| `+ הוסף גם` (partner suggestion) | sub-card |
| `✕` never suggest again | sub-card |

**~14 tap targets per card.** Above them: three TopBar buttons, a floating chronograph, a floating AI pill, and a bottom bar with three more add buttons.

- 🔴 **"תרגיל" vs "סט" — the core model, unexplained.** The bottom bar shows `+ אירובי` · `+ תרגיל` · `+ סט` ([L1732–L1746](src/components/FreeSession.tsx#L1732)). All three open the same `LogSetModal` with a different `saveMode`. **This is the single highest-value fix in the document.**
- **Six add affordances, six different labels:** `+ סט`, `+ תרגיל` (bottom bar), `+ הוסף תרגיל` (inline, [L1678](src/components/FreeSession.tsx#L1678)), `+ רשום סט` (planned card), `+ סט נוסף` (logged card), `+ אירובי` (bottom bar *and* aerobic section).
- **Supersets are a pro feature exposed to beginners.** A–E labels, `1/2` badges, "המשך של הסופרסט למעלה" ([L1539](src/components/FreeSession.tsx#L1539)), a link mode with transparent overlays on every card. It works well — but to someone who doesn't know what a superset is, it is noise. **Move superset controls behind a `⋯` menu and show a one-time explainer on first use of 🔗.**
- **Delete sits adjacent to the primary action.** [L843–L866](src/components/FreeSession.tsx#L843) renders `סיים` → 🗑 → `×` within ~4px of each other. One is the primary action, one is destructive and irreversible.
- **"בפוקוס" tiles are tappable with no affordance.** [L1117](src/components/FreeSession.tsx#L1117) opens a modal on tap. No chevron, no hover state, no hint.
- **Placeholder sets** render as `— להשלים —` with a dashed amber border ([L1308](src/components/FreeSession.tsx#L1308)). The concept is never explained anywhere.
- **Three section colours on one screen:** rose (בפוקוס) · blue (תרגילים) · cyan (אירובי), plus indigo for supersets, green for AI, red for delete.
- 🟡 **`handleAbandon`** ([L711](src/components/FreeSession.tsx#L711)) is dead code — never called.

**Fix — restructure:**
1. **One primary action.** Replace the three bottom-bar buttons with a single `+ הוסף` opening a bottom sheet with three *explained* choices:
   `📋 תרגיל לתוכנית — בלי משקלים, לרשום אחר כך` / `🏋️ סט — משקל וחזרות עכשיו` / `🏃 אירובי`.
2. **Collapse the exercise card** to three visible actions — set rows, `+ סט נוסף`, and a `⋯` menu holding AI / superset / note / difficulty / delete.
3. **Separate delete from "סיים"** — move it into a `⋯` menu in the TopBar.
4. **One-time coach marks** on first session entry: three bubbles — "כאן רושמים סט" / "כאן השעון" / "כאן המאמן".

---

### 2.5 Log-set modal · [src/components/LogSetModal.tsx](src/components/LogSetModal.tsx)

- 🔴 **Weight and reps fields render even when they are discarded.** The reps/weight grid at [L651–L678](src/components/LogSetModal.tsx#L651) renders **unconditionally**, including when `saveMode === 'exercise'` (the `+ תרגיל` and "החלף" flows). The user types 40kg × 10, taps "שמור תרגיל", and the numbers are **silently dropped** — `onPickOnly` does not receive them. Reads as a bug. **Fix: hide the grid when `saveMode === 'exercise'`.**
- **`dual` mode shows two equal-weight buttons** — `שמור תרגיל` and `שמור סט` ([L744–L768](src/components/LogSetModal.tsx#L744)) — with no explanation of the difference. Add a helper line: "שמור תרגיל = מוסיף לרשימה, בלי משקלים".
- **"שריר (לחץ להסרה)"** ([L352](src/components/LogSetModal.tsx#L352)) is awkward phrasing. Use "בחר שריר" and let tap-again deselect without announcing it.
- 🟢 **Biggest missed win in the app:** "פעם קודמת: 40kg × 10" is plain text ([L482](src/components/LogSetModal.tsx#L482)). **Make it a button that prefills the fields.** This turns the single most frequent action in the app from 5 taps into 2.
- 🟠 **`alert()` for upload errors** ([L815](src/components/LogSetModal.tsx#L815)) breaks the design language. Same in [Exercises.tsx L540](src/components/Exercises.tsx#L540).
- No global unit preference — kg/lb is re-chosen on every set.

---

### 2.6 AI chat · [src/components/AiChatPanel.tsx](src/components/AiChatPanel.tsx)

The strongest selling feature, and the least framed.

- 🔴 **No Markdown rendering.** [L841](src/components/AiChatPanel.tsx#L841) uses `whitespace-pre-wrap` only. When the coach returns a program with headings, lists and emphasis, the user sees raw `**מסה**` and `## יום א׳`. **On an app sold on its AI coach, this is the most visible quality gap.**
- 🔴 **No streaming.** Three bouncing dots only. A long answer means 15–20 seconds of a screen that looks frozen. Minimum viable fix: staged status text ("המאמן חושב…" → "כותב תוכנית…").
- **The header never shows context.** Always "מאמן AI" ([L676](src/components/AiChatPanel.tsx#L676)). The context *is* sent to the model ([L491–L519](src/components/AiChatPanel.tsx#L491)) but never shown to the user. **Add a chip under the title:** `אימון חי · חזה, גב` or `תוכנית ליום ג׳ 15/8`.
- 🟠 **"שיחות היום" is a false label.** [L743](src/components/AiChatPanel.tsx#L743) says "today's conversations", but [L253](src/components/AiChatPanel.tsx#L253) keeps coach threads forever (`isCoach ? threads : filter(ts >= cutoff)`). Users see week-old threads under a "today" heading.
- 🟢 **Cheapest win for AI adoption:** the four example prompts at [L800–L820](src/components/AiChatPanel.tsx#L800) are plain text that must be retyped. **Make them tappable chips that send on tap.**
- **The input placeholder is wrong in most modes.** `"תאר תרגיל או בקש הצעה..."` ([L1051](src/components/AiChatPanel.tsx#L1051)) is used identically in `trainer` and `onboarding` mode, where it does not apply.
- **Internal failures leak to the user.** `⚠️ נחתך באמצע — לחץ להמשך` ([L1008](src/components/AiChatPanel.tsx#L1008)) should auto-continue in the background. Raw errors like `שגיאה: HTTP 500` ([L1040](src/components/AiChatPanel.tsx#L1040)) need a human message plus a retry button.
- **The suggestion-card CTA reads as a label.** `+ הוסף לאימון` ([L935](src/components/AiChatPanel.tsx#L935)) is a `<span>` floated to the side. The whole row is clickable, but nothing signals it.
- No copy-message, no share, no "save as plan".

**Keep as-is:** `quick_replies` chips, suggestion cards with how-to steps + Google search, and the blue "already in session" vs. green "new" distinction — all genuinely good.

---

### 2.7 History · [src/components/FreeHistory.tsx](src/components/FreeHistory.tsx)

- 🔴 **The default filter hides the new user's data.** `range = 'last-week'`, `statusFilter = 'completed'` ([L74–L75](src/components/FreeHistory.tsx#L74)). A user who just finished their first workout opens History and reads **"אין אימונים בטווח שנבחר"** — and concludes their workout was lost. **Change the default to `30d` or `all`.**
- **Nine filter buttons above the list** (3 status + 6 ranges). More chrome than content for a user with three sessions. Collapse to one select or a scrollable chip row.

---

### 2.8 Body · [src/components/Body.tsx](src/components/Body.tsx)

- 🔴 **Near-total duplication of Home.** The "נפח לפי שריר" panel is effectively the same component as Home's "נפח שבועי", differing only in the range picker. A newcomer cannot understand why two screens show the same thing.
- **The name "גוף" promises something else.** With a body-silhouette icon, users expect measurements, weight, progress photos. They get volume charts.
- 🟡 `sessionsInRange` reads the legacy boolean `sess.completed` ([L109](src/components/Body.tsx#L109)) while the rest of the app has moved to `status === 'completed'`. It works today, but two sources of truth for one concept.
- 🟡 Dead expression `{… ? '' : ''}` at [L266](src/components/Body.tsx#L266).

**Fix:** either merge Body into History as a sub-tab (רשימה / סטטיסטיקה), or rename it to **"נפח"** / **"סטטיסטיקה"**, remove the volume panel from Home, and leave a one-line summary on Home linking to it.

---

### 2.9 Exercises · [src/components/Exercises.tsx](src/components/Exercises.tsx)

- **Four buttons for two actions.** A violet FAB + an AI FAB ([L131–L150](src/components/Exercises.tsx#L131)) *and* two full-width buttons with identical meaning in the content flow ([L196–L213](src/components/Exercises.tsx#L196)). The code comment says the inline pair exists "so users don't have to hunt for the FAB" — the correct fix is to remove the FABs, not duplicate them.
- **Six text actions per row**, all at identical visual weight, including the destructive "מחק".
- 🟠 **No search and no filter** in a list that can hold 300 exercises — only muscle-group grouping. A search field is mandatory.
- Violet appears only on this screen — another colour with no system-wide meaning.

---

### 2.10 Settings · [src/components/Settings.tsx](src/components/Settings.tsx)

- **Percent-goal mode ships ~26 sliders and a "bank" concept** ([L352–L419](src/components/Settings.tsx#L352)) at the same hierarchy level as "מצב תצוגה". This is a professional-trainer feature. **Collapse it behind "הגדרות מתקדמות".**
- **Missing settings users will look for:** default weight unit (kg/lb), default rest time (currently only in `localStorage` as `scoreboard:defaultRestSec`, reachable *only* from inside the chronograph — effectively undiscoverable), and 🔴 **sound/vibration on rest-timer completion** (entirely absent — a silent rest timer is a functional gap in a gym app).
- **"שכח אותי" sits above "החלף משתמש"** — irreversible above routine. Move it to the bottom under a "אזור מסוכן" heading. (The red border and type-your-email confirmation are excellent — keep them.)
- No about/version screen, no support link, no privacy policy — all required for app store distribution.

---

### 2.11 Chronograph · [src/components/Chronograph.tsx](src/components/Chronograph.tsx)

Excellent engineering — a floating disc, draggable, snapping to 8 anchors, three modes. **Zero affordance.**

- The user sees a green circle with numbers. Nothing tells them it can be dragged, that tapping expands it, or that it contains three modes (אימון / טיימר / סטופר).
- **Needs a one-time coach mark:** "גרור אותי לאן שנוח · לחץ להרחבה".
- 🟠 **The stopwatch icon in the TopBar** ([TopBarActions.tsx L41](src/components/TopBarActions.tsx#L41)) is nearly identical to **the History tab icon** ([TabBar.tsx L47](src/components/TabBar.tsx#L47)) — both a circle with hands. Two clocks, two unrelated meanings.

---

### 2.12 Navigation — TabBar & TopBar

- **"גוף" vs "היסטוריה" is unguessable.** Both are past-data views; nothing tells the user that one is a session list and the other is volume analytics. See §2.8.
- **Tab labels are 10px** ([TabBar.tsx L31](src/components/TabBar.tsx#L31)) — too small.
- **The active tab is signalled by colour alone** — add an indicator bar or pill.
- 🟡 **Settings is in `TAB_PAGES` but not in `TabBar`** ([App.tsx L56](src/App.tsx#L56)). On the Settings screen the tab bar renders with **no active tab**, which reads as a broken state.
- **`TabActions` puts three controls in every TopBar** (AI pill + stopwatch + gear) on top of the accent bar. On the session screen the cluster becomes סיים + 🗑 + × — five controls competing in one corner.

---

## 3. Design system

### 3.1 Colour — the root cause of "panels look the same"

Measured in code (`*-500` utilities): `emerald ×120`, `blue ×86`, `red ×61`, `amber ×30`, `cyan ×22`, `indigo ×17`, `violet ×15`, plus teal / purple / pink / orange / sky / rose.

**Every colour currently means several things:**

| Colour | Current meanings |
|---|---|
| Emerald | brand · live session · completed session · AI · volume section · primary button · success |
| Blue | planned session · History tab · Body tab · "אימוני השבוע" section · "תרגילים באימון" section · "רשום סט" button · links |
| Violet | Exercises screen only |
| Rose | "בפוקוס" section only |
| Cyan | aerobic |
| Indigo +5 | supersets |
| Amber | warning · placeholder · difficulty rating "בסדר" |

**Target: four semantic colours, strictly enforced.**

| Role | Colour | Exclusive use |
|---|---|---|
| **Now / active** | Emerald | live session, primary button, active state |
| **Planned / future** | Blue | plans only — nowhere else |
| **Data / history** | Neutral slate | history, statistics, charts |
| **AI** | Violet | every AI touchpoint, without exception |

Aerobic keeps cyan (a genuine category). Delete keeps red. Warning keeps amber. **Supersets: drop the 5-colour palette for a single treatment — one border plus a "סופרסט A" label.**

### 3.2 Panel hierarchy — why everything blends

Three hierarchy levels currently look nearly identical:

1. `TopBar` — gradient background + accent bar + bold title
2. Sticky section header — **also** gradient background + accent bar + bold title
3. `.card` — surface + 1px border

Levels 1 and 2 are visually interchangeable, so scrolling makes it look like the header swapped.

**Target:**
- **TopBar** — opaque, no gradient, no coloured accent bar. It is the navigation layer; it should be quiet and constant.
- **Section header** — not sticky, no background. Small `uppercase tracking-wide` muted text plus a thin rule above it. That is all "a new area starts here" requires.
- **Card/panel** — this is where surface and border belong. It carries the content.
- **Remove every `bg-gradient-to-b` from section headers.** Gradients blur boundaries; panel separation needs the opposite.

### 3.3 Typography

- **151 occurrences of `text-[9px]` / `text-[10px]`.** Too small — especially for Hebrew, especially in a gym, especially for the 40+ audience. **Minimum 12px for anything meant to be read.**
- **No type scale.** In use: `text-[9px]`, `[10px]`, `[11px]`, `[12px]`, `[13px]`, `xs`, `sm`, `base`, `lg`, `xl` — ten levels. **Reduce to five:** 12 / 14 / 16 / 20 / 28.
- 🟠 **No Hebrew webfont is loaded.** [src/index.css](src/index.css) imports only `VT323` (the scoreboard face, Latin-only), and the body stack is `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` — **no Hebrew family at all**. Hebrew falls back to whatever the OS picks, so the app looks materially different across iOS / Android / Windows. Load **Heebo** or **Assistant** and put it first in the stack.

### 3.4 Touch targets

Below 44×44px: `IconBtn` (`w-7 h-7` = 28px), superset arrows (`w-5 h-5` = 20px), plan delete (`p-0.5`), aerobic delete (`w-8 h-8`), all text actions in Exercises. **Critical in a gym app.**

### 3.5 Loading and error states

- 🟠 **"Loading..." in English on 5 live screens** (see §4.2).
- No skeleton loaders — blank surfaces during fetch.
- **Two consecutive blank screens on cold start:** `<div className="page-bg" />` once while `useAuth` hydrates ([App.tsx L312](src/App.tsx#L312)) and again while `shouldShowOnboarding` resolves ([App.tsx L366](src/App.tsx#L366)). On a slow connection this reads as a crash.
- 🔴 **No global error state.** If Firestore fails, `loading` stays `true` forever and the user sits on "Loading..." indefinitely.

### 3.6 Dialog consistency

**Six separately hand-written confirm modals** (delete set, delete session, delete aerobic, delete plan, delete exercise, finish session), each with slightly different wording and button order. **Extract a single `<ConfirmDialog>`.**

---

## 4. Hebrew & RTL audit

The app is Hebrew-only, so this section is a correctness audit, not a translation task.

### 4.1 🔴 Non-Hebrew strings that reach the user

| Severity | String | Location | Action |
|---|---|---|---|
| 🔴 | `"name": "Workout Logger"`, `"short_name": "Workout"`, `"description": "Track your gym workouts"` | [public/manifest.json](public/manifest.json) | **The home-screen icon label on a Hebrew-only app reads "Workout".** Translate all three. Also add `"lang": "he"` and `"dir": "rtl"`. |
| 🟠 | `Loading...` ×5 | Body [L132](src/components/Body.tsx#L132), Exercises [L185](src/components/Exercises.tsx#L185), FreeHistory [L163](src/components/FreeHistory.tsx#L163), FreeHome [L333](src/components/FreeHome.tsx#L333), FreeSession [L737](src/components/FreeSession.tsx#L737) | Replace with "טוען…" — or better, skeletons (§3.5). |
| 🟠 | `GO!` | Chronograph [L283](src/components/Chronograph.tsx#L283), [L337](src/components/Chronograph.tsx#L337) | Inconsistent with the app's own caption "קדימה!" at [L386](src/components/Chronograph.tsx#L386). Unify on "קדימה!". |
| 🟠 | `English name` (field label) | Exercises [L647](src/components/Exercises.tsx#L647) | → "שם באנגלית". *(The placeholder `Barbell Bench Press — Medium Grip` is correct as-is — it demonstrates the English field.)* |
| 🟡 | `default` (button label) ×2 | Exercises [L336](src/components/Exercises.tsx#L336), LogSetModal [L535](src/components/LogSetModal.tsx#L535) | Admin-only, but still English. → "ברירת מחדל". |
| 🟡 | `alert(err?.message)` surfaces English browser/Firebase errors | LogSetModal [L815](src/components/LogSetModal.tsx#L815), Exercises [L540](src/components/Exercises.tsx#L540) | Replace with a Hebrew toast. |
| 🟡 | `שגיאה: HTTP 500` — raw server text | AiChatPanel [L1040](src/components/AiChatPanel.tsx#L1040) | Map to Hebrew messages + retry. |
| ⚪ | `AI` on buttons ×5 | TopBarActions, FreeSession ×3, Exercises | Defensible as a loanword. If strict Hebrew is required, use "מאמן". Decide once and apply everywhere. |

**Legitimately Latin — do not translate:** `המשך עם Google` (brand), `Install app` / `Safari` / `Chrome` / `Android` / `iPhone` in [Install.tsx](src/components/Install.tsx) (these quote actual OS UI strings — translating them would break the instructions), `kg` / `lb`, and the English exercise-name field (a deliberate secondary-name feature).

**Good already:** [index.html](index.html) is fully Hebrew — `lang="he"`, `dir="rtl"`, Hebrew `<title>`, description, and complete Hebrew Open Graph / Twitter metadata with `og:locale = he_IL`.

### 4.2 🟡 Dead components containing English strings

Four components are **imported by nothing** — ~1,000 lines of dead code, and every English string inside them is a false positive for any future audit:

| Component | Lines | English inside |
|---|---|---|
| [PasscodeScreen.tsx](src/components/PasscodeScreen.tsx) | 68 | `"Workout Logger"`, `"Enter your 4-digit passcode"` |
| [FreeSessionDetail.tsx](src/components/FreeSessionDetail.tsx) | 379 | `"Session not found"`, `"Loading..."` |
| [SessionScoreboard.tsx](src/components/SessionScoreboard.tsx) | 420 | `"GO!"` |
| [RestTimer.tsx](src/components/RestTimer.tsx) | 137 | — |

**Action: delete all four.** Also dead: `ActiveSessionBanner` + `PlannedTodayBanner` in [FreeHome.tsx L1181–L1317](src/components/FreeHome.tsx#L1181) (~140 lines), and `handleAbandon` in [FreeSession.tsx L711](src/components/FreeSession.tsx#L711).

### 4.3 RTL implementation issues

- 🟠 **178 redundant `dir="rtl"` attributes.** `<html>` already declares `dir="rtl"`, so almost every one of these is noise. Worse, it is a correctness hazard: with direction re-declared on hundreds of nested nodes, a single missing or misplaced `dir` produces a layout bug that is very hard to trace. **Strip them; keep `dir` only where direction genuinely flips (see next item).**
- ✅ **33 `dir="ltr"` uses are legitimate** — numeric and English runs (`40kg × 10`, English exercise names, dates). This is the right technique.
- 🟠 **Hebrew nested inside a forced-LTR span.** [FreeSession.tsx L1310–L1312](src/components/FreeSession.tsx#L1310) renders `<span dir="ltr">{s.reps}<span>שנ'</span> · {s.weight}<span>{unit}</span></span>` — Hebrew text (`שנ'`) inside `dir="ltr"`. The apostrophe and separator placement can flip unexpectedly. Wrap the Hebrew in `<bdi>` or keep the container RTL and isolate only the numbers.
- 🟠 **Zero logical CSS properties.** No `ms-*` / `me-*` / `ps-*` / `pe-*` / `text-start` / `text-end` anywhere. Instead: **111 × `text-right`** and 12 physical `ml/mr/pl/pr`. It works in an RTL-only app, but it is semantically wrong and every one is a latent bug. The dangerous subset is **`ml-auto` ×4 and `mr-auto` ×1** — auto-margins in a flex row behave differently depending on the container's resolved direction, and the intent is ambiguous at the call sites (e.g. [LogSetModal L552](src/components/LogSetModal.tsx#L552), [Exercises L347](src/components/Exercises.tsx#L347)). Migrate to `text-start` / `ms-auto` / `me-auto`.
- 🟠 **Two different techniques for the same RTL progress bar.** Parent bars use `flex flex-row-reverse` ([FreeHome L523](src/components/FreeHome.tsx#L523), [StartSessionModal L147](src/components/StartSessionModal.tsx#L147)); child bars use `flex` + `ml-auto` ([FreeHome L564](src/components/FreeHome.tsx#L564), [Body L230](src/components/Body.tsx#L230)). Same visual result, two implementations, in the same component. **Pick one** — `ms-auto` is the cleaner choice — and extract a shared `<ProgressBar>`.
- 🟡 **`<bdi>` is used only 8 times**, all for aerobic type names. Any Latin or numeric run embedded in Hebrew text should be isolated the same way — notably `ל-iPhone ול-Android` ([Settings L286](src/components/Settings.tsx#L286)), where the hyphen-plus-Latin sequence is a classic Hebrew bidi trap.
- 🟡 **Chronograph corner anchors are physical.** `tl/tr/bl/br` are computed with raw `left`/`top` pixel math while the container carries `dir="rtl"`. It works, but the code's own comment — *"top-left corner of the disc (RTL: top-right visually)"* ([L359](src/components/Chronograph.tsx#L359)) — shows the confusion is already live in the codebase.

### 4.4 🔴 Zoom is disabled

[index.html](index.html) sets `maximum-scale=1.0, user-scalable=no`. This **blocks pinch-zoom**, which is a WCAG 1.4.4 failure and a common App Store review rejection. It is especially damaging here given §3.3 (151 instances of 9–10px text) — users who cannot read the small Hebrew text have no recourse. **Remove `maximum-scale` and `user-scalable`.**

---

## 5. Defect table

| Sev | Defect | Location |
|---|---|---|
| 🔴 | `BuildOverlay` error state has no exit — new user is trapped | [OnboardingScreen.tsx L128](src/components/OnboardingScreen.tsx#L128) |
| 🔴 | Weight/reps fields shown then silently discarded in `saveMode='exercise'` | [LogSetModal.tsx L651](src/components/LogSetModal.tsx#L651) |
| 🔴 | History empty for new users due to `last-week` default | [FreeHistory.tsx L74](src/components/FreeHistory.tsx#L74) |
| 🔴 | No Markdown rendering in coach replies | [AiChatPanel.tsx L841](src/components/AiChatPanel.tsx#L841) |
| 🔴 | PWA manifest fully English — home-screen label reads "Workout" | [public/manifest.json](public/manifest.json) |
| 🔴 | Pinch-zoom disabled (`user-scalable=no`) | [index.html](index.html) |
| 🔴 | No global error state — Firestore failure hangs on "Loading..." forever | all screens |
| 🟠 | "שיחות היום" label shows threads from all time | [AiChatPanel.tsx L743](src/components/AiChatPanel.tsx#L743) |
| 🟠 | `title=` as the only explanation mechanism — invisible on mobile (dozens) | app-wide |
| 🟠 | `alert()` for upload errors | [LogSetModal.tsx L815](src/components/LogSetModal.tsx#L815), [Exercises.tsx L540](src/components/Exercises.tsx#L540) |
| 🟠 | `Loading...` in English ×5 | see §4.1 |
| 🟠 | `GO!` contradicts the app's own "קדימה!" caption | [Chronograph.tsx L283](src/components/Chronograph.tsx#L283) |
| 🟠 | Two different RTL progress-bar techniques in one component | [FreeHome.tsx L523](src/components/FreeHome.tsx#L523) vs [L564](src/components/FreeHome.tsx#L564) |
| 🟠 | 178 redundant `dir="rtl"` attributes | app-wide |
| 🟠 | No Hebrew webfont loaded | [src/index.css](src/index.css) |
| 🟠 | No search in an exercise list that holds up to 300 items | [Exercises.tsx](src/components/Exercises.tsx) |
| 🟡 | 4 dead components, ~1,000 lines, containing English strings | see §4.2 |
| 🟡 | `handleAbandon` — dead code | [FreeSession.tsx L711](src/components/FreeSession.tsx#L711) |
| 🟡 | `ActiveSessionBanner` / `PlannedTodayBanner` — dead, ~140 lines | [FreeHome.tsx L1181](src/components/FreeHome.tsx#L1181) |
| 🟡 | Hebrew nested inside `dir="ltr"` span | [FreeSession.tsx L1310](src/components/FreeSession.tsx#L1310) |
| 🟡 | `sess.completed` vs `status === 'completed'` — two sources of truth | [Body.tsx L109](src/components/Body.tsx#L109) |
| 🟡 | Dead expression `{… ? '' : ''}` | [Body.tsx L266](src/components/Body.tsx#L266) |
| 🟡 | Settings in `TAB_PAGES` but absent from `TabBar` — no active tab | [App.tsx L56](src/App.tsx#L56) |

---

## 6. Quick wins — highest value per unit of effort

Do these first regardless of the phased plan. Each is small and independently shippable.

1. **"פעם קודמת" → a button that prefills** ([LogSetModal L482](src/components/LogSetModal.tsx#L482)). Turns the most frequent action from 5 taps into 2.
2. **Example prompts → tappable chips** ([AiChatPanel L800](src/components/AiChatPanel.tsx#L800)). Cheapest possible lift in AI engagement.
3. **History default → `30d`** ([FreeHistory L74](src/components/FreeHistory.tsx#L74)). One line; removes a "my data is gone" moment.
4. **Translate the manifest.** Three strings; fixes the home-screen icon label.
5. **Remove `user-scalable=no`.** One line; unblocks accessibility and store review.
6. **Delete the 4 dead components.** ~1,000 lines gone, audit noise eliminated.

---

## 7. Work plan

### P0 — release blockers

| # | Task | Acceptance criterion |
|---|---|---|
| 1 | **Explain exercise vs. set.** Replace the 3 bottom-bar buttons in FreeSession with one `+ הוסף` opening an explained bottom sheet. | A first-time user can state the difference between תרגיל and סט after one use. |
| 2 | **Fix the 7 red defects** in §5. | Each verified manually. |
| 3 | **Markdown rendering in chat** + tappable example prompts. | Coach programs render with headings/lists/bold. No raw `**`. |
| 4 | **Hebrew string sweep** (§4.1) — manifest, `Loading...`, `GO!`, `English name`, `default`, `alert()`, raw HTTP errors. | `grep` for Latin in user-facing strings returns only the §4.1 allow-list. |
| 5 | **Sellable login screen** — product name, tagline, 3 benefit bullets. | Fits one viewport, no scroll. |
| 6 | **Onboarding: non-chat path** + progress indicator + summary screen. | A user who never types can complete onboarding. |
| 7 | **One-time coach marks** on Home and Session (3 bubbles, skippable, persisted). | Shown once per user; dismissible. |
| 8 | **Sound + vibration on rest-timer completion.** | Audible and haptic on iOS and Android. |

### P1 — clarity and consistency

| # | Task | Acceptance criterion |
|---|---|---|
| 9 | **Four-colour semantic system** (§3.1) — refactor all usages. | Each colour has exactly one meaning; documented in a comment block in `index.css`. |
| 10 | **Panel hierarchy** (§3.2) — remove gradients from section headers, make them non-sticky and quiet; opaque TopBar. | Three visually distinct levels: nav / section / panel. |
| 11 | **Collapse the exercise card** to 3 visible actions + `⋯` menu. | ≤5 tap targets per collapsed card. |
| 12 | **Supersets behind advanced** + one-time explainer on first 🔗. | A user who never opens `⋯` never sees superset UI. |
| 13 | **Type + touch minimums** — 12px text, 44px targets. | Zero `text-[9px]`/`[10px]`; zero sub-44px interactive elements. |
| 14 | **Single `<ConfirmDialog>`** replacing all 6 hand-rolled modals. | One component, six call sites. |
| 15 | **Separate delete from "סיים"** in the session TopBar. | Delete lives in a `⋯` menu. |
| 16 | **Home day order** — today first + legend row. | Today is the first tile. |
| 17 | **RTL cleanup** (§4.3) — strip redundant `dir="rtl"`, migrate to logical properties, unify the progress-bar technique into a shared `<ProgressBar>`, fix the Hebrew-in-LTR span. | Zero `text-right`; one progress-bar implementation. |
| 18 | **Load a Hebrew webfont** (Heebo or Assistant), first in the stack. | Identical rendering across iOS / Android / Windows. |

### P2 — polish

| # | Task |
|---|---|
| 19 | Merge or rename **"גוף"**; remove the Home/Body volume duplication. |
| 20 | **Search in Exercises**; remove the duplicate FABs. |
| 21 | **Skeleton loaders** + global error state + offline state. |
| 22 | **Collapse advanced Settings** (percent goals); add global unit + default rest time. |
| 23 | **Chat context chip** under the panel title + response streaming. |
| 24 | **Apple Sign-In**, privacy policy, about/version screen. |
| 25 | **Delete all dead code** (~1,140 lines — §4.2). |
| 26 | Fix the Settings tab-bar active state; unify `sess.completed` → `status`. |

---

## 8. Do not break these

These are genuinely good. Preserve behaviour when refactoring.

- **The floating chronograph** — an original, well-executed idea. It needs affordance, not redesign.
- **Superset partner suggestions mined from history** ([FreeSession L653](src/components/FreeSession.tsx#L653)) — genuinely smart. Keep the logic; only change how it surfaces.
- **AI suggestion cards** with how-to steps and a Google-search link.
- **The done-vs-planned distinction** in the volume panel (solid vs. striped fill) — legible and precise.
- **Exercise photos/video** captured inline in the logging flow.
- **"שכח אותי"** with type-your-email confirmation — responsible destructive-action design.
- **`effectiveMuscles`** — showing what was actually trained rather than what was planned. Small detail, correct thinking.
- **Full Hebrew metadata** in `index.html` — title, description, Open Graph, `og:locale=he_IL`.
- **`dir="ltr"` isolation for numeric runs** — the correct bidi technique, applied consistently in 33 places.
