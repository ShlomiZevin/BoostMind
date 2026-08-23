# Trial indicator — the two approved designs, and how to switch

A trial account has to see, on every screen, that it is on a trial and how many
days are left. Two designs were approved. **Only one is ever shown** — the other
is dormant code. A user never sees both.

The switch is one line:

```ts
// src/config/access.ts
export const TRIAL_INDICATOR: 'badge' | 'strip' = 'badge';
```

Currently: **`strip`**.

The badge was live first and was replaced: on a real phone the two lines jam
against the screen edge and clip against the gear (rep_1787496744618_hwre). It
is kept as dormant code, not deleted.

---

## `badge` — two lines on the settings gear

`TrialBadge` in `components/TrialGate.tsx`, geometry in `.trial-badge`
(`index.css`).

```
ניסיון
  ⚙
7 ימים
```

Why the geometry is CSS and not utility classes: it was tuned by eye against the
icon, and the numbers are load-bearing.

| | value | why |
|---|---|---|
| `right` | `23px` | Both lines are anchored by their **right** edge. In RTL that is where text *starts*, so `ניסיון` and `7 ימים` begin at the same point despite different widths. Anchoring by `left` aligns their ends instead, which looks broken. |
| `top` / `bottom` | `3px` | Pulled slightly onto the gear rather than floating clear of it. |
| `text-shadow` | `var(--bar-bg)` halo | 9.5px text crosses the gear's teeth; without the halo it is unreadable. `--bar-bg` flips with the theme. |

It is `position: absolute` inside the gear button, so **the gear keeps its exact
40px box and nothing in the top bar moves**. That was a hard requirement — an
earlier version made the button auto-width and shifted every icon.

The badge is `aria-hidden`; the gear's `aria-label` carries the meaning
(`הגדרות — תקופת ניסיון, נותרו 3 ימים`).

---

## `strip` — sticky amber bar above the top bar

`TrialStrip`, plus `TrialGearDot` (a small amber dot on the gear, so the gear
still shows the trial lives behind it).

### When it appears, and closing it

Two rules keep it from becoming wallpaper:

| rule | where | why |
|---|---|---|
| Hidden for the first **3 days of use** (`STRIP_FROM_DAYS_USED`) | `App.tsx`, on `trial.daysUsed` | A brand-new user should be meeting the product, not a countdown they cannot act on yet. |
| Dismissable, returns **the next day** | `trialStripHidden:{uid}:{YYYY-MM-DD}` in localStorage | A banner you can never close becomes furniture; one that never comes back stops being a reminder. |

`TrialGearDot` shows on the gear for the **whole** trial regardless, so the
reminder exists from day one even before the strip starts and on days it has
been dismissed.

### ⚠️ The sticky-offset trap

The strip is `sticky top-0` **above** the top bar. Everything else that pins has
to move down by its height, or sticky section headers (`אימוני השבוע`,
`נפח שבועי`, the exercises search row, the scoreboard…) pin *underneath* the
strip and get covered.

There are **12 call sites** using `top: var(--top-bar-h)`. They are not patched
individually. Instead the strip's height is folded into that variable:

```css
/* index.css */
--trial-strip-h: 0px;                                        /* 32px when shown */
--top-bar-h: calc(env(safe-area-inset-top) + 64px + var(--trial-strip-h));
```

```tsx
/* App.tsx — publishes the height, 0px when no strip */
document.documentElement.style.setProperty('--trial-strip-h', showStrip ? '32px' : '0px');
```

```tsx
/* TopBar.tsx — the bar itself sticks below the strip */
style={{ top: 'var(--trial-strip-h)' }}
```

So `--top-bar-h` now means *"everything sticky above the content"*, which is what
all 12 call sites actually wanted. **Any new sticky header must use
`var(--top-bar-h)`** and it gets this for free.

If you add a second always-on bar later, fold it into the same variable rather
than adding a second one to every `calc()`.

---

## What a user sees when the trial ends

`TrialExpired`, rendered in `AuthedShell` **before** the onboarding gate — an
expired account is never walked into a wizard it cannot finish.

- Full screen, login-screen styling: `שבוע הניסיון הסתיים.` /
  `הנתונים שלך שמורים. כדי להמשיך — נדבר.`
- WhatsApp `054-5567213` (message pre-filled with their email) + `shlomi@boostart.io`
- Their email echoed, plus `התנתק`

**Nothing is deleted.** It is a gate, not a wipe — reopening the account restores
everything.

### Reopening an account without a deploy

On `users/{uid}/profile/main`:

| field | effect |
|---|---|
| `trialExempt: true` | never gated again |
| `accessUntil: <epoch ms>` | access until that date |

The owner (`user_6724`) is exempt in code and short-circuits before any network
read, so it can never lock itself out. A failed profile read also **fails open** —
a network blip must not look like an expiry.

### Known gap

There is no warning before the block beyond the day count, and no email goes out.
If someone does not open the app on day 7, the block screen is the first they
hear of it.
