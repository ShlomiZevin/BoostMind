# Wellbeing App — Spec

Status: **draft, spec-only**. No code yet.

## 0. TL;DR

Turn the current "workout app" into a **wellbeing app** with two coaching areas that share an identity but live behind their own entry:

- **אימונים** — the existing exercise app (all current tabs, unchanged in scope).
- **תזונה** — a new dietary coach, focused on **caloric deficit** and **craving control** (sugar / empty carbs).

After login, users land on a **Wellbeing Home** with two big cards, one per area. That home replaces "workout app" as the first surface — it is not a tab, it is the entry.

Both areas share the account (uid), the AI infrastructure, and the design language. Their data lives in disjoint Firestore branches and their AI chats live in disjoint history buckets so the two conversations never mix.

---

## 1. Product intent

### 1.1 Two coaches, two jobs

| Coach | Primary loop | Success metric |
|---|---|---|
| **Trainer** (existing) | Log sets + aerobic, follow / plan sessions, weekly per-muscle set goals | Hit weekly volume, progressive overload |
| **Dietary** (new) | Log meals, watch daily calorie balance, avoid sugar & empty carbs | Daily deficit (for loss) + sugar-free / clean-day streaks |

### 1.2 Emotional framing

- **Deficit** is about **losing** — a math game, not moral. The coach quantifies, offers swaps, never lectures.
- **Sugar / empty carbs** is about **control** — willpower training. The coach acknowledges the pull, offers a smaller swap, and celebrates streaks.
- Same tone as the trainer: Israeli, honest, in the eye's level — never pompous.

### 1.3 Non-goals (MVP)

- No macro-perfection tracking (protein g/kg targets, etc.). MVP tracks calories + coarse "sugar / empty-carbs" flag.
- No barcode scan, no external food-DB integration, no restaurant lookup.
- No photo-to-meal analysis (Phase 4, deferred).
- No social / community features.
- No wearables / HR data.

---

## 2. Navigation model change

### 2.1 Before

```
Login → Onboarding (if new) → Workout Home
                                 └─ tabs: Home / Body / History / Settings
```

### 2.2 After

```
Login → Onboarding (if new) → Wellbeing Home  (NEW)
                                 ├─ אימונים  → tabs: Home / Body / History / Settings   (existing tree, unchanged)
                                 └─ תזונה   → tabs: Today / Meals / Insights / Settings (new tree)
```

### 2.3 Wellbeing Home

- Two full-width cards stacked vertically (mobile-first).
- Each card: icon + Hebrew title + one-line pitch + a mini "streak / status" strip (e.g. "6 אימונים השבוע" / "היום: −350 קק״ל").
- Tap → deep-links into that area's default tab.
- A small settings gear in the top-right for account-level things (profile, theme, week order, share app, logout).
- The persistent bottom nav (TabBar) is **scoped to the area** — the wellbeing home itself has no bottom nav. To swap areas, use the "→ ראשי" button in the top bar of any area's Home tab.

### 2.4 Deep-link rules

- URL like `#/exercise/home`, `#/exercise/body`, `#/food/today`, `#/food/meals`.
- Refresh preserves the current area + tab.
- If a user has completed **only** the exercise onboarding, tapping `תזונה` for the first time triggers the dietary onboarding branch (see §7).

### 2.5 Impact on existing code

- `App.tsx` grows a top-level route `wellbeing` and gates the current workout routes under `exercise/*`.
- All in-app internal `navigate({ page: 'home' })` calls become `navigate({ area: 'exercise', page: 'home' })` (or similar). Non-breaking migration path: default `area` to `exercise` on the existing `Route` type so old calls still work.
- The top-bar AI button in the exercise tree stays scoped to the **trainer** coach; food gets its own equivalent button in the food tree.

---

## 3. Data model (Firestore)

All additions live under `users/{uid}/…` alongside the existing exercise data.

### 3.1 `personalMeals/{mealId}` — meal library

Analogous to `personalExercises`. Each doc is a **template** the user (or the coach) has saved.

```ts
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink';

type PersonalMeal = {
  id: string;
  he: string;              // Hebrew name, e.g. "אורז + עוף + סלט"
  en?: string;             // optional English
  type: MealType;
  calories: number;        // required — the whole meal, not per-100g
  macros?: {               // optional; the coach nudges you to fill over time
    protein?: number;
    carbs?: number;
    fat?: number;
    sugar?: number;        // grams (used for the "high sugar" heuristic)
  };
  ingredients?: string;    // free-text short list
  flags?: {
    highSugar?: boolean;   // set by user OR inferred from sugar>20g OR from ingredients
    emptyCarbs?: boolean;  // white bread / pasta / candy / sugary drinks
  };
  photoBase64?: string;
  aliases?: string[];
  createdAt: number;
  lastUsedAt?: number;
};
```

### 3.2 `meals/{logId}` — meal log

One entry per thing you actually ate. Parallel to `sets`.

```ts
type MealLog = {
  id: string;
  mealId?: string | null;  // link to personalMeals (null for one-off free text)
  name: string;            // denormalized snapshot
  calories: number;        // denormalized snapshot
  macros?: {               // denormalized snapshot
    protein?: number;
    carbs?: number;
    fat?: number;
    sugar?: number;
  };
  flags?: { highSugar?: boolean; emptyCarbs?: boolean };
  timestamp: number;
  mealType?: MealType;
  notes?: string;
};
```

**Denormalization rule**: snapshot `name` / `calories` / `macros` / `flags` at log time. Editing a `personalMeals` template later does **not** rewrite history.

### 3.3 Dietary profile — extends `settings/main`

Adds these fields to the existing settings doc (same one that holds `weeklyTargets`, `weekOrder`, etc.):

```ts
type DietaryProfile = {
  enabled?: boolean;              // false / undefined = user hasn't opted in
  goal?: 'lose' | 'maintain' | 'gain';
  weightKg?: number;
  heightCm?: number;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  activityMultiplier?: number;    // 1.2 sedentary → 1.725 very active
  // Auto-computed from BMR × activity, user-overridable in the UI.
  dailyCalorieTarget?: number;    // e.g. 1900
  dailyCalorieTargetManual?: boolean; // if true, don't recompute on stat changes
  // Craving control
  avoidSugar?: boolean;
  avoidEmptyCarbs?: boolean;
  dailySugarBudgetG?: number;     // optional soft cap; default 25g/day if avoidSugar
  // Free text ("צמחוני", "אלרגי לבוטנים", ...) — coach reads it verbatim
  constraints?: string;
};
```

### 3.4 Streaks — computed, not stored

Streaks are derived from `meals` on demand (client-side reduce over the last N days). No separate collection until we see it's slow.

- **Deficit streak** — consecutive days where `Σ calories − burnEstimate ≤ dailyCalorieTarget`.
- **Sugar-free streak** — consecutive days with no meal flagged `highSugar`.
- **Clean streak** — days with no `highSugar` AND no `emptyCarbs`.

### 3.5 Chat history

- New `bucket: 'dietary'` in the same `chatThreads` collection used today.
- Server persists assistant replies with `mode: 'dietary'`.
- Existing `bucket: 'coach'` (session / trainer / onboarding) stays disjoint — the trainer never sees a food chat and vice versa.
- Existing `bucket: 'naming'` stays disjoint.

---

## 4. Calorie math

### 4.1 BMR (Mifflin-St Jeor)

```
male:   10w + 6.25h − 5a + 5
female: 10w + 6.25h − 5a − 161
other:  average of male + female formulas
```

Where `w` = kg, `h` = cm, `a` = years.

### 4.2 TDEE and target

```
TDEE = BMR × activityMultiplier
lose:    target = TDEE − 500   (≈ 0.5 kg / week)
maintain: target = TDEE
gain:    target = TDEE + 300
```

Editable — the UI shows the computed number as a suggestion; user can override, at which point `dailyCalorieTargetManual = true` and future stat edits stop recomputing.

### 4.3 Daily balance shown to user

```
balance = eaten − burnEstimate − target
```

- Negative balance = deficit hit. Positive = surplus.
- `burnEstimate` combines strength + aerobic (see next section).

### 4.4 Exercise → calories (server-side estimation, sent to the coach)

Client sends today's exercise summary each turn:

- **Strength** — `~5 kcal × realSetCount` (± the coach's own judgment). Real sets = weight > 0 OR reps > 0.
- **Aerobic** — small MET lookup:
  ```
  ריצה 8, אופניים 7, חתירה 7, הליכה 3.5, אליפטיקל 5, default 6
  ```
  `kcal = MET × weightKg × minutes / 60`

The number goes into the wire payload as `todayEstimatedBurn: 320` and also into the visible balance. If we don't have `weightKg`, aerobic falls back to `MET × 70 × minutes / 60`.

---

## 5. UI — Food area

Same design language as `גוף`: right-anchored bars, solid navy background, single emerald accent, no gradients. Sticky section headers with the vertical accent line.

### 5.1 Tabs (bottom nav within the food area)

- **היום** (default landing)
- **המאכלים שלי** (meal DB)
- **תובנות** (insights / streaks)
- **הגדרות** (dietary profile + shared account settings)

### 5.2 היום — Today

Structure top-to-bottom:

1. **Balance hero**
   - Big number: `−320 קק״ל` (green if in deficit, red if surplus, amber if within ±100 of target).
   - Subline: `אכלת 1420 · שרפת ~120 · יעד 1800`.
   - Small chips: "יום נקי" (dark or green depending on state), sugar-free indicator.

2. **הצעות לארוחה הבאה** (suggestions row)
   - Small horizontal chip row of the user's top-3 most-eaten meals for the current time slot (breakfast/lunch/dinner/snack chosen by clock).
   - Tap = one-tap log (opens a confirm sheet: `הוסף עכשיו?` + serving size stepper).
   - If no history: chips replaced by a single "שאל את המאמן" button.

3. **מה אכלת היום** (timeline)
   - Rows per meal log entry, RTL:
     - Meal name + calories on the right
     - Timestamp + small flag icons (🍬 for high sugar, 🍞 for empty carbs) in the middle
     - Delete + edit icons on the left
   - Tap a row → edit modal
   - Empty state: "עדיין לא רשמת ארוחות היום — הקש למטה כדי להתחיל"

4. **Bottom action bar** — big `+ ארוחה` (mirrors the workout bottom bar). Adjacent `AI ✨` button opens the dietary coach with the current context pre-loaded.

### 5.3 LogMealModal

Mirrors `LogSetModal`. Two save modes: `set` (log to today) and `add-to-db` (save as template only).

- Meal-type selector (chip row, defaults from clock).
- Personal-meal picker (search + list). List is sorted **least-recently-used first** — same rotation logic that the exercise picker uses (`pickPersonal`). Each row shows name, calories, days-since-last-eaten.
- Free-text fallback: type a name if it's not in the DB, then either save-only-to-log or save-as-template-too.
- Fields: `calories` (required), `macros` (optional, collapsed by default), `sugar_g` (only shown when `avoidSugar`), `flags` (two toggles).
- Bottom: `שמור סט` (log to today) / `שמור תרגיל` (add-to-DB-only) / `שמור שניהם` — same three-way pattern LogSetModal already uses.

### 5.4 המאכלים שלי (personal meal DB)

Same shape as the Exercises DB page:

- List of `personalMeals` sorted by `lastUsedAt` desc (or alphabetical toggle).
- Row: photo thumb (or emoji fallback based on `type`), name, calories, muscle-chip-equivalent = `type` chip.
- Tap → edit modal (name, calories, macros, flags, aliases, photo).
- Long-press or trash icon → delete.
- Top-right `+ AI ✨` — opens the dietary coach in "add meal" mode with an initial prompt like "תאר לי מאכל שאתה רוצה להוסיף". Uses the same LOCAL greeting pattern we already have (nothing persisted unless the user replies).

### 5.5 תובנות (insights)

Reuse Body's bar patterns. Two sections:

- **קלוריות בשבוע** — 7 bars, one per day, height = kcal eaten. Overlay a horizontal line at `dailyCalorieTarget`. Days in deficit get the emerald accent, days in surplus get a warm accent.
- **רצפים** — three tiles: current deficit streak, sugar-free streak, clean streak. Each shows the number + the best-ever number below in small text.

MVP does not have per-macro graphs.

### 5.6 הגדרות (dietary settings)

Sections:

- **פרופיל תזונתי** — weight / height / age / gender / activity (auto-recomputes target unless manual).
- **יעד קלורי יומי** — big number, ± buttons, "חזור לחישוב אוטומטי" reset link.
- **שליטה בדחפים** — two toggles: `הימנע מסוכר`, `הימנע מפחמימות ריקות`. When first is on, a sugar budget slider appears.
- **מגבלות** — free-text `constraints`.
- **התחל מחדש את שיחת ההיכרות** — reopens the dietary onboarding chat (mirrors the existing exercise onboarding reset).

---

## 6. AI dietary coach

### 6.1 New server mode: `dietary`

Added alongside `session` / `trainer` / `onboarding` / `naming`. Payload per turn:

```ts
{
  uid, threadId, bucket: 'dietary', mode: 'dietary',
  messages: [...],
  dietaryProfile: { goal, weightKg, heightCm, age, gender, activityMultiplier,
                    dailyCalorieTarget, avoidSugar, avoidEmptyCarbs,
                    dailySugarBudgetG, constraints },
  personalMeals: PersonalMeal[]  // cap 200, oldest-first
  todayMeals: MealLog[],         // full list
  recentMeals: MealLog[],        // last 14 days, cap 200
  todayExerciseSummary: {
    setsCount: number,
    aerobic: Array<{ type: string; minutes: number }>,
    estimatedBurnKcal: number,
  },
  weekDeficitDays: number,       // streak signal
  sugarFreeDays: number,
}
```

### 6.2 System prompt outline

- Hebrew, native Israeli tone. No preaching, no motivational LinkedIn text.
- Two priorities: **hit the daily calorie target** (deficit / maintain / gain) and, if `avoidSugar` / `avoidEmptyCarbs` are on, minimize those.
- Prefer meals **from the personal DB** the user hasn't eaten recently, before proposing new ones.
- Every proposal comes with a calorie number and, when relevant, a swap ("במקום זה: … חוסך N קק״ל").
- On cravings, acknowledge the pull, offer a smaller swap, mention the sugar delta.
- Bigger meals on heavy training days; leaner on rest days (uses `todayExerciseSummary`).
- Never invent numbers the user didn't provide — if the meal isn't in the DB and calories weren't given, ASK, don't guess.

### 6.3 Actions the model can emit (all approval-first)

Same schema style as the existing `set_weekly_targets` approval flow — nothing is written until the user taps the button on the card.

- **`suggest_meal`** — proposes a specific meal
  ```json
  {"type":"suggest_meal","name":"קערת יוגורט + פרי","type":"snack","calories":180,"macros":{"protein":15,"carbs":22,"fat":3,"sugar":16},"flags":{"highSugar":false,"emptyCarbs":false},"reason":"חוסך 300 קק״ל מול הבורקס"}
  ```
  Card renders: name, calories, macros, "+ הוסף להיום" button.

- **`log_meal`** — one-tap add an existing personal meal to today
  ```json
  {"type":"log_meal","mealId":"m_...","servings":1}
  ```
  Card shows a preview + "אשר רישום".

- **`add_meal_to_db`** — save a new template
  ```json
  {"type":"add_meal_to_db","name":"...","type":"lunch","calories":650,"macros":{...},"flags":{...}}
  ```
  Card shows a preview + "שמור למאגר".

- **`update_dietary_profile`** — patch profile fields (silent-persist, like `update_profile` in trainer mode)
  ```json
  {"type":"update_dietary_profile","patch":{"weightKg":78,"goal":"lose"}}
  ```

- **`set_daily_calorie_target`** — proposal card, approval required
  ```json
  {"type":"set_daily_calorie_target","target":1750,"reason":"BMR × 1.4 − 500"}
  ```

- **`quick_replies`** — same as existing coach.

- **`ready_to_start`** — onboarding-only, emits when profile is complete enough to compute a target.

### 6.4 Prompt guardrails

Explicitly told:
- ✅ "הנה הצעה — לחץ אישור למטה"
- ❌ Past-tense claims like "רשמתי לך את הארוחה" before approval
- ❌ Guessing calorie numbers without asking
- ❌ Moralizing / lecturing tone

### 6.5 Entry points

- Big `AI ✨` button in the Food-area top bar (mirrors the trainer button on the exercise area's top bar). Opens the dietary coach.
- `AI ✨` chip in the LogMealModal — opens the coach with the current meal draft as `replaceContext` equivalent.
- On תובנות tab, a "בקש הצעה למחר" chip that opens the coach with a pre-drafted prompt (drafted in the input, not auto-sent — same pattern we settled on for trainer).
- Wellbeing Home shows a small "3 שיחות היום" hint on the dietary card when there are dietary threads today (parity with the trainer card).

### 6.6 Image (Phase 4, deferred)

The existing `attachImage` flow on the AI panel already works for `naming` and `coach`. When dietary lands, wiring image support means:
- Send `image` to server for `dietary` mode (already forwarded generically).
- Prompt tells the model: "photo of a plate → identify + estimate calories + emit `log_meal` (with new template)".

No client work beyond enabling the paperclip in the dietary panel — the plumbing already exists.

---

## 7. Onboarding — dietary branch

### 7.1 Trigger

- **Existing users**: dietary onboarding does not trigger automatically. First tap on the `תזונה` card on the Wellbeing Home checks `dietaryProfile.enabled`. If false, opens the dietary onboarding chat.
- **New users**: the exercise onboarding runs first (unchanged). At the very end, a soft "רוצה שאעזור לך גם עם תזונה?" prompt with two chips: "כן, בואו נדבר" (opens the dietary chat), "אולי אחר כך" (marks `enabled: false`, user can start it from the Wellbeing Home later).

### 7.2 What the chat collects

Same conversational cadence as the existing onboarding. Fields, roughly in order:

1. Goal — `lose` / `maintain` / `gain`
2. Weight, height, age, gender (chip choices where possible)
3. Activity level (5 chips with plain-language labels: "יושבני", "קצת פעילות", "בינוני", "פעיל", "מאוד פעיל")
4. Craving toggles — `avoidSugar`, `avoidEmptyCarbs`
5. Any dietary constraints (free text)
6. Emit `set_daily_calorie_target` with the BMR × activity ± goal delta, ready for approval
7. Emit `ready_to_start` — client flips `dietaryProfile.enabled = true`, closes chat, lands on `היום`

### 7.3 Skip / reopen

- The chat has a small "דלג לעכשיו" chip in the greeting (identical to the exercise onboarding's escape hatch). Skipping marks `enabled: true` with the target left blank — the `היום` view will show a "הגדר יעד קלורי" CTA until it's set.
- Settings has a "פתח מחדש את שאלון ההיכרות" button — same pattern as the exercise onboarding reset (sets a `forceOnboarding` flag on the dietary profile).

---

## 8. Sugar / empty-carbs detection

Combination of user-marked and inferred:

- **User-marked** — every meal has two toggles (`highSugar`, `emptyCarbs`) both in the log modal and on the personal-meal template.
- **Inferred** — when saving a personal meal, if `macros.sugar > 20g` the `highSugar` flag is auto-set. When ingredients contain any of a small blocklist (`לחם לבן`, `פסטה`, `אורז לבן`, `סוכר`, `סוכריות`, `שוקולד חלב`, `משקה מוגז`, `מיץ`), `emptyCarbs` is auto-set. Both defaults are user-editable.
- **Coach-suggested** — the AI can flip flags via `add_meal_to_db` or on an `update_meal` action (not in MVP, deferred).

Rules are conservative on purpose — false negatives are better than lecturing a user about a meal that shouldn't be flagged.

---

## 9. Rollout phases

Each phase is a self-contained PR-sized chunk.

### Phase 1 — Foundation (nav + data + Today)

- New wellbeing home page + area routing.
- Firestore helpers for `personalMeals` + `meals` + dietary profile.
- BMR / TDEE utility.
- Food area shell with the 4 tabs (only היום + הגדרות functional).
- `+ ארוחה` button + LogMealModal (no AI yet, no picker rotation, plain free-text + calories).
- Today's balance hero + timeline.
- Read-only dietary profile in Settings; edit UI.

**Ships**: user can start logging meals, see today's balance, edit their profile. No coach yet.

### Phase 2 — Personal meal DB

- Full DB page (browse, edit, delete, aliases, photos).
- LogMealModal picker with the least-eaten-first sort.
- Quick-log chips on היום (top-3 meals for current time slot).

### Phase 3 — Dietary coach

- Server: `dietary` mode, prompt, action schemas (approval-first).
- Client: dietary AI panel entry points, `dietary` chat bucket, approve-card renderers for all 5 action types.
- Exercise → calories estimator (client-side, sent to server each turn).

### Phase 4 — Insights

- תובנות tab: weekly kcal bars, three streaks tiles.
- Sugar-free / clean streaks in the balance hero as small chips.

### Phase 5 — Deferred

- Photo → meal (image analysis).
- Barcode.
- External food DB.

---

## 10. Existing app impact — checklist

Changes that touch already-shipped surfaces:

- `App.tsx` — new top-level route `wellbeing`, area routing, deep-link parsing.
- `TabBar` — becomes area-scoped (different tabs when `area === 'food'`).
- `Settings` — split into shared vs area-scoped sections; account bits (theme, week order, share) live on the Wellbeing Home settings; workout-specific (goals, exercises DB link) stays in the exercise area's Settings; dietary-specific in the food area's Settings.
- `useAuth` / `useFirestore` — unchanged, uid-scoped.
- AI panel — no code change; just a new mode + bucket to accept.

Migration strategy: add a top-level `WellbeingHome` page and route existing users through it on next mount. Existing bookmarks / PWA start URL default to the wellbeing home; a one-time redirect handles pre-existing sessions. No Firestore data migration required.

---

## 11. Open decisions worth revisiting later

Not blockers for MVP:

- **Weekly / monthly reports** — email or in-app? (Probably in-app only.)
- **Water intake tracking** — separate from meals? (Defer.)
- **Recipe scaling** (serving size on `log_meal`) — nice-to-have; MVP assumes serving = 1.
- **Import from other apps** (MyFitnessPal, etc.) — no export standard worth targeting.
- **Vegetables-first suggestions** — could be a coach rule once we see behavior.
- **Notifications** — evening "היה יום טוב?" summary push. Needs Firebase Cloud Messaging plumbing.

---

## 12. Success signals

We know this works if, after a month of use:

1. User logs at least one meal on ≥ 5 days/week.
2. Meals come mostly from the personal DB (rotation working).
3. The dietary chat gets used at least 2×/week.
4. User sees a real 7-day deficit streak.
5. Sugar-free days become a visible number the user tracks.

If any of those are near zero we redesign the loop, not add features.
