import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const PORT = process.env.PORT || 8080;
// Opus 5 for higher-quality Hebrew — the extra cost is worth it for the
// user-facing conversational modes. Override with CLAUDE_MODEL if needed.
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5';

// Per-request model override. Allow-listed on purpose: the body is client-sent,
// and an arbitrary model string would be both a 404 waiting to happen and a way
// to bill an unexpected tier. No override → CLAUDE_MODEL, i.e. today's
// behaviour, so a client that never sends the field is unaffected.
const ALLOWED_MODELS = new Set(['claude-opus-5', 'claude-sonnet-5']);
function modelFor(req, label) {
  const raw = req && req.body && req.body.model;
  const chosen = ALLOWED_MODELS.has(raw) ? raw : CLAUDE_MODEL;
  // One line per call. Without it there is no way to confirm afterwards which
  // model actually served a request — which made the first Sonnet run
  // impossible to verify.
  console.log(JSON.stringify({
    evt: 'model',
    endpoint: label || 'chat',
    model: chosen,
    overridden: chosen !== CLAUDE_MODEL,
    ignored: raw && !ALLOWED_MODELS.has(raw) ? String(raw).slice(0, 40) : undefined,
  }));
  return chosen;
}
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('FATAL: ANTHROPIC_API_KEY not set');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ─── Firestore REST write (for chat persistence) ──────────────────
// Rules on users/{uid}/{document=**} are `allow read, write: if true`, so no
// auth token is needed — the server just hits the REST API directly. This lets
// the assistant response land in Firestore even if the browser tab closed
// mid-request, so the answer shows up next time the user opens the chat.
const FS_PROJECT = process.env.FS_PROJECT || 'boostmind-b052c';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FS_PROJECT}/databases/(default)/documents`;

function fsValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return { integerValue: String(v) };
    return { doubleValue: v };
  }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsValue) } };
  if (typeof v === 'object') {
    const fields = {};
    for (const [k, val] of Object.entries(v)) fields[k] = fsValue(val);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

// Firestore REST PATCH semantics: WITHOUT `updateMask` the whole document is
// REPLACED by the given fields. That silently wiped the thread's title/ts on
// each assistant write, which broke history discovery on reopen. Pass `merge`
// true to write with an updateMask covering exactly the fields we're touching
// (proper client-style merge). `merge` false is the caller opting into
// create-or-replace — used for brand-new message docs whose id is unique.
async function fsPatch(path, data, { merge = false } = {}) {
  const fields = {};
  const keys = [];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    fields[k] = fsValue(v);
    keys.push(k);
  }
  let url = `${FS_BASE}/${path}`;
  if (merge && keys.length > 0) {
    const mask = keys.map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    url += (url.includes('?') ? '&' : '?') + mask;
  }
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Firestore PATCH ${path} failed ${res.status}: ${t.slice(0, 400)}`);
  }
}

async function persistAssistantMessage({ uid, threadId, text, truncated, mode, bucket, llmModel }) {
  if (!uid || !threadId) return;
  const ts = Date.now();
  const msgId = `m_${ts}_assistant`;
  const enc = encodeURIComponent;
  // Message doc: brand-new id, full replace is fine.
  await fsPatch(
    `users/${enc(uid)}/chatThreads/${enc(threadId)}/messages/${enc(msgId)}`,
    { id: msgId, role: 'assistant', content: text || '', ts, truncated: !!truncated, mode: mode || 'session', llmModel: llmModel || undefined },
  );
  // Thread doc: MERGE only — must not clobber title/ts written by the client.
  // Include `bucket` so a thread first surfaced by the server still lands in
  // the right list.
  //
  // `lastRole` / `lastAt` / `lastHasAction` exist so the client can tell "the
  // coach answered" from a THREAD snapshot alone — no per-message listener on
  // every thread just to drive the notification. `lastHasAction` reports
  // whether this reply carries a proposal the user still has to approve, which
  // is the difference between "answer ready" and "waiting on you".
  try {
    await fsPatch(
      `users/${enc(uid)}/chatThreads/${enc(threadId)}`,
      {
        id: threadId,
        updatedAt: ts,
        bucket: bucket || 'coach',
        lastRole: 'assistant',
        lastAt: ts,
        lastHasAction: /```action/.test(text || ''),
      },
      { merge: true },
    );
  } catch (e) { /* thread bump is not fatal */ }
}

const MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner', 'snack', 'drink']);
const MEAL_TYPE_HE = {
  breakfast: 'בוקר', lunch: 'צהריים', dinner: 'ערב', snack: 'נשנוש', drink: 'שתייה',
};

// Everything here is Israel-local. The prompt used to stamp the date with
// toISOString(), which is UTC — so between midnight and 03:00 Israel time the
// coach believed it was still yesterday and reasoned about the wrong day's
// meals. It also never saw the clock at all, only the date.
function nowInIsrael() {
  const fmt = new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  return fmt.format(new Date());
}

// Naming convention — mirrors the exercise-DB template. Without it the same
// meal lands in the DB five times and the history splits across all five.
const MEAL_NAMING_RULES = [
  "== שם הארוחה — כללי חובה ==",
  "תבנית: <מרכיב עיקרי> [הכנה] [עם <תוספת>]",
  "1. עברית בלבד. בלי מילים באנגלית ובלי תעתיק.",
  "2. בלי כמויות בשם. 'פיתה' — לא '2 פיתות'. הכמויות חיות ב-ingredients ובגודל המנה.",
  "   זה הכלל הכי חשוב: כמויות בשם מפצלות ארוחה אחת לעשר רשומות שונות.",
  "3. בלי מילות זמן-ארוחה. 'ארוחת בוקר' זה השדה type, לא חלק מהשם.",
  "4. בלי פעלים ובלי שייכות. לא 'אכלתי שקשוקה', לא 'השקשוקה שלי'.",
  "5. אופן הכנה רק אם הוא משנה קלוריות: 'בתנור', 'מטוגן', 'קלוי' — כן.",
  "   'טרי', 'ביתי', 'טעים' — לא.",
  "6. מרכיב עיקרי קודם, תוספות אחרי 'עם'. מקסימום שתי תוספות בשם;",
  "   כל השאר חיים ב-ingredients.",
  "7. יחיד, 2-5 מילים.",
  "",
  "דוגמאות טובות: 'שקשוקה עם פיתה', 'חזה עוף בתנור עם אורז', 'סלט טונה', 'קפה הפוך'",
  "דוגמאות רעות:  '2 פיתות עם שקשוקה' (כמות), 'ארוחת צהריים - עוף' (מילת זמן),",
  "               'אכלתי יוגורט' (פועל), 'קפה הפוך גדול עם 2 סוכר' (כמויות)",
].join('\n');


const app = express();
// Firebase Hosting preview channels get their own origin
// (boostmind-b052c--<channel>-<hash>.web.app), so a fixed allowlist would block
// every preview deploy. Match the project's own hosts by pattern instead, and
// keep localhost for dev.
const ALLOWED_ORIGIN = /^https:\/\/boostmind-b052c(--[a-z0-9-]+)?\.(web\.app|firebaseapp\.com)$/;
app.use(cors({
  origin: (origin, cb) => {
    // Same-origin / curl / server-to-server requests send no Origin header.
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGIN.test(origin)) return cb(null, true);
    if (/^http:\/\/localhost:\d+$/.test(origin)) return cb(null, true);
    return cb(null, false);
  },
}));
// Bumped from 256kb to 4mb so message payloads that include a compressed
// base64 image (client caps at ~1024px / q=0.75, typically 100–400KB) don't
// hit "PayloadTooLarge" before reaching the handler.
app.use(express.json({ limit: '4mb' }));

// Very simple in-memory rate limit — per-instance. Fine for single-user MVP.
const rlBuckets = new Map(); // uid → { count, resetAt }
const RL_MAX = 100;                  // requests
const RL_WINDOW_MS = 24 * 60 * 60e3; // per 24h
function rateLimit(uid) {
  const now = Date.now();
  const b = rlBuckets.get(uid);
  if (!b || b.resetAt < now) {
    rlBuckets.set(uid, { count: 1, resetAt: now + RL_WINDOW_MS });
    return { ok: true, remaining: RL_MAX - 1 };
  }
  if (b.count >= RL_MAX) return { ok: false, remaining: 0, resetAt: b.resetAt };
  b.count += 1;
  return { ok: true, remaining: RL_MAX - b.count };
}

app.get('/', (_req, res) => res.status(200).send('workout-ai ok'));

app.post('/api/chat', async (req, res) => {
  try {
    const { uid, threadId, bucket, messages, personalExercises, recentSets, sessionMuscles, mode, replaceContext, userProfile, plannedSessions, weeklyTargets, volumeHistory } = req.body || {};
    if (!uid || typeof uid !== 'string' || uid.length > 100) {
      return res.status(400).json({ error: 'missing or invalid uid' });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'missing messages' });
    }

    const rl = rateLimit(uid);
    if (!rl.ok) {
      return res.status(429).json({ error: 'rate limit exceeded', resetAt: rl.resetAt });
    }

    // Build system prompt with the user's personal DB and recent session context
    const exList = Array.isArray(personalExercises) ? personalExercises : [];
    const setsList = Array.isArray(recentSets) ? recentSets : [];
    const focusList = Array.isArray(sessionMuscles) ? sessionMuscles : [];
    const chatMode = ['naming', 'onboarding', 'trainer', 'dietary'].includes(mode) ? mode : 'session';

    // ─── Naming-mode system prompt ─────────────────────────────
    const namingPrompt = [
      "You are a naming consultant for a Hebrew-speaking athlete's exercise DB.",
      "The user wants your help to review, discuss, and rename exercises to be clearer.",
      "Reply in Hebrew unless the user writes in English. Be concise.",
      "",
      "== IF THE USER ATTACHES A PHOTO ==",
      "It's likely a machine or equipment in the gym. Identify the exercise, then:",
      "  1. Check the personal DB below for a matching entry — quote the exact Hebrew",
      "     name if you find one.",
      "  2. Otherwise, propose a new entry with a `suggest_exercise` action (same schema",
      "     as below). Include a short one-liner explanation of what the machine is for.",
      "If you can't confidently identify the equipment (blurry, weird angle), say so",
      "and ask a short follow-up question — don't guess.",
      "",
      "== TASKS YOU HELP WITH ==",
      "- Review all names and flag ambiguous / poorly-named / duplicate entries",
      "- Suggest a better name for a specific exercise the user mentions",
      "- Discuss naming conventions (structured Hebrew template)",
      "- Propose adding a missing English name",
      "- ADD a NEW exercise the user describes in free text",
      "",
      "== ADDING A NEW EXERCISE ==",
      "When the user describes an exercise in free text (e.g. \"פרפר במכונה בישיבה\") and wants",
      "to add it:",
      "  1. FIRST check the personal exercise list below to see if it already exists —",
      "     match by Hebrew name, alias, or muscle+equipment. If it exists, tell the user",
      "     exactly WHICH exercise matches (quote its exact Hebrew name from the list) and",
      "     DO NOT emit a suggest_exercise block. Ask if they want to add something else.",
      "  2. If it does NOT exist, propose it using a `suggest_exercise` action block:",
      "",
      "```action",
      "{\"type\":\"suggest_exercise\",\"name\":\"<pure Hebrew name>\",\"en\":\"<English>\",\"muscle\":\"<muscle key>\",\"isNew\":true,\"isHoldTime\":true|false,\"howTo\":[\"<step 1>\",\"<step 2>\",\"<step 3>\"]}",
      "```",
      "",
      "  Set `isHoldTime: true` for time-hold exercises (plank, wall-sit, dead-hang, etc.).",
      "  Include 2-4 short Hebrew how-to steps in `howTo`.",
      "",
      "== NAMING STYLE ==",
      "Hebrew: PURE HEBREW. Template <grip/attachment> <equipment/machine> <angle/position>.",
      "  No English words, no transliteration.",
      "  Barbell → מוט, Dumbbell → משקולת, Cable → כבל, Machine → מכונה, Rope → חבל,",
      "  Attachment → אביזר, Bench → ספסל, Bench Press → לחיצת חזה, Row → חתירה,",
      "  Squat → סקוואט, Curl → כפיפת מרפקים, Fly → פרפר, Pushdown → פושדאון,",
      "  Wide → רחבה, Close → צרה, Incline → משופע, Decline → יורד.",
      "English: standard fitness terminology (sentence case with em-dashes where common).",
      "",
      "== ACTION BLOCKS ==",
      "When you propose renaming a specific existing exercise, embed inline right after",
      "your sentence introducing it, using EXACTLY this format:",
      "",
      "```action",
      "{\"type\":\"rename_exercise\",\"id\":\"<exact id from the list below>\",\"newHe\":\"<pure Hebrew>\",\"newEn\":\"<English>\",\"muscle\":\"<muscle key>\"}",
      "```",
      "",
      "The `id` must be one of the ids in the list — never invent an id.",
      "Include all four fields even if only one changes; the user's tap applies them all.",
      "",
      "Valid muscle keys: chest, upper-chest, lower-chest, lats, mid-back, traps, rear-delts,",
      "lower-back, front-delts, side-delts, biceps, triceps, forearms, quads, hamstrings,",
      "glutes, adductors, abductors, calves, abs, obliques.",
      "",
      `Today's date is ${new Date().toISOString().slice(0, 10)}.`,
      "",
      "The user's personal exercise DB (id | Hebrew | English | muscle):",
      exList.length === 0
        ? "  (empty — no exercises yet)"
        : exList.slice(0, 300).map(e => `- ${e.id} | ${e.he} | ${e.en || '(no en)'} | ${e.defaultMuscle}`).join('\n'),
    ].join('\n');

    const sessionPrompt = [
      "You are a personal training assistant for a Hebrew-speaking gym athlete.",
      "Reply in Hebrew unless the user writes to you in English.",
      "Your job: help the user identify what exercise they just did, or suggest what to do next.",
      "Be extremely concise. No fluff. One paragraph max, then action blocks.",
      "",
      "== IF THE USER ATTACHES A PHOTO ==",
      "Almost certainly a machine/setup they're standing in front of. Identify the",
      "exercise (Hebrew + English), name the primary muscle, and — unless it's already",
      "in the personal DB below — emit a `suggest_exercise` action so a single tap adds",
      "it to today's session. If it IS in the DB, quote the exact name and offer to",
      "add it via the action block.",
      "",
      "== NAMING STYLE (very important) ==",
      "For every exercise you name, provide BOTH a Hebrew name and an English name.",
      "",
      "Hebrew name (`name` field): PURE HEBREW ONLY. NO English words, NO transliteration",
      "letters. Use Hebrew for every technical term:",
      "  • Barbell → מוט         Dumbbell → משקולת       Cable → כבל",
      "  • Machine → מכונה       Attachment → אביזר      Rope → חבל",
      "  • Grip → אחיזה          Wide → רחבה             Close → צרה",
      "  • Incline → משופע       Decline → יורד          Seated → בישיבה",
      "  • Standing → בעמידה     Lying → בשכיבה          Bent-over → בכיפוף",
      "  • Bar → מוט             Machine → מכונה         Bench → ספסל",
      "Structure template: <grip/attachment> <equipment/machine> <angle/position>",
      "Examples of good Hebrew names:",
      "  • \"לחיצת חזה מוט אחיזה בינונית\"",
      "  • \"פושדאון כבל חבל\"",
      "  • \"סקוואט קדמי מוט\"",
      "  • \"חתירת משקולת יד אחת בכיפוף\"",
      "Never write \"barbell\", \"attachment\", \"machine\" etc. in Hebrew latin script.",
      "Never mix English into the Hebrew name.",
      "",
      "English name (`en` field): standard fitness terminology, sentence case.",
      "Examples: \"Barbell Bench Press — Medium Grip\", \"Cable Rope Pushdown\".",
      "",
      "== USING THE USER'S PERSONAL LIST ==",
      "The user has a personal exercise list below. If the user describes something and",
      "there's a CLEAR match, use that name (keeps history linked). If the closest match",
      "is still ambiguous or poorly named, propose a NEW clean name using the template above",
      "and mark isNew: true — the user can then approve it.",
      "",
      "If the list is empty (new user), invent clean names from scratch.",
      "",
      "== SUGGESTIONS ==",
      "If the user asks for a suggestion (\"תן לי משהו לחזה עליון שלא עשיתי החודש\"), pick",
      "from the list first based on recency (older = better for variety), or invent one",
      "clearly labeled as new.",
      "",
      "== ACTION BLOCKS ==",
      "When you propose a specific exercise the user should log or add, embed an action",
      "block inline right after the sentence that introduces it. Use this exact format:",
      "",
      "```action",
      "{\"type\":\"suggest_exercise\",\"name\":\"<Hebrew name>\",\"en\":\"<English name>\",\"muscle\":\"<muscle key>\",\"isNew\":true|false,\"isHoldTime\":true|false,\"howTo\":[\"<step 1>\",\"<step 2>\",\"<step 3>\"]}",
      "```",
      "",
      "== HOLD-TIME EXERCISES ==",
      "Set `isHoldTime: true` for time-based exercises where the athlete HOLDS a position",
      "for seconds instead of counting reps. Examples: פלאנק (Plank), פלאנק צד (Side Plank),",
      "וול סיט (Wall Sit), אחיזה על מוט (Dead Hang), ישיבה על הקיר, החזקת רגליים בזווית.",
      "For hold-time exercises, the athlete records SECONDS instead of reps. Everything else",
      "works the same. Default is `false` (regular rep-based).",
      "",
      "Multiple suggestions are fine — one action block per suggestion, each after its",
      "introducing sentence, NOT clumped at the end.",
      "",
      "== HOW-TO STEPS (howTo field) ==",
      "For every suggested exercise, include a `howTo` array with 2-4 SHORT Hebrew steps",
      "describing how to perform the exercise. Each step is one concise phrase — no fluff.",
      "Example: [\"עמידה זקופה, אחיזה ברוחב כתפיים\", \"הורד את המוט לחזה בשליטה\", \"דחוף חזרה למעלה בזרימה אחת\"].",
      "",
      "Valid muscle keys: chest, upper-chest, lower-chest, lats, mid-back, traps, rear-delts,",
      "lower-back, front-delts, side-delts, biceps, triceps, forearms, quads, hamstrings,",
      "glutes, adductors, abductors, calves, abs, obliques.",
      "",
      `Today's date is ${new Date().toISOString().slice(0, 10)}. When the user`,
      "says \"today\", \"yesterday\", \"a week ago\", interpret against this date.",
      "The dates below are the ACTUAL dates each set was logged — DO NOT assume",
      "sets happened today unless the date matches today's date.",
      "",
      "The user's personal exercises (id | Hebrew name | muscle | last-used-days-ago):",
      exList.length === 0
        ? "  (empty — user is starting fresh, invent clean names)"
        : exList.slice(0, 200).map(e => `- ${e.id} | ${e.he} | ${e.defaultMuscle} | ${e.lastUsedDays ?? '-'}`).join('\n'),
      "",
      focusList.length > 0 ? `Today's session is focused on: ${focusList.join(', ')}.` : '',
      replaceContext && replaceContext.name
        ? `\n== REPLACE MODE ==\nThe user is looking to REPLACE the exercise "${replaceContext.name}" (${replaceContext.muscle}).\nSuggest 1-3 ALTERNATIVES for the same muscle group. Do NOT include the exact same exercise. Each suggestion should be a distinct alternative.`
        : '',
      setsList.length > 0
        ? "Recent sets from the last 10 days (with real date each was logged):\n" + setsList.slice(0, 400).map(s =>
            `- ${s.date || '?'} · ${s.exerciseName || '(no-name)'} · ${s.muscle} · ${s.weight}×${s.reps}${s.unit || 'kg'}`
          ).join('\n')
        : '',
    ].filter(Boolean).join('\n');

    // ─── Onboarding-mode system prompt (new user, gathering info) ───
    // The AI runs a natural conversation — it can ask, chat, or answer the user's
    // questions freely. When it learns a profile field it emits update_profile so
    // the client persists it. When enough fields are known it offers ready_to_build.
    const profileJson = userProfile && typeof userProfile === 'object' ? JSON.stringify(userProfile) : '{}';
    const onboardingPrompt = [
      "You are a warm, friendly personal trainer greeting a brand-new user of a Hebrew workout app.",
      "This is their FIRST conversation. They know nothing yet. Your job is to make them feel in good hands",
      "AND to help them understand how this app is different — so they use it the way it's meant to be used.",
      "",
      "== TONE — NATIVE HEBREW, NOT TRANSLATED ==",
      "עברית טבעית ומדוברת של מאמן ישראלי אמיתי. אסור לתרגם מאנגלית מילה במילה.",
      "כתוב כמו שאתה מדבר לחבר בחדר כושר — קצר, ברור, בגובה העיניים.",
      "השתמש בביטויים ישראליים אמיתיים ('בוא נראה', 'קטן עלינו', 'אין בעיה', 'עשיתי לך')",
      "במקום תרגומי-מכונה ('בוא נתחיל את המסע', 'המטרה שלך היא ה...').",
      "משפטים קצרים. לא יותר משתי שורות בכל תשובה, ואז השאלה הבאה.",
      "פנייה בגוף שני. אם לא ברור מהמגדר — נסה לזהות מהשם, אם אין לך מידע — פנייה נייטרלית.",
      "Answer their questions freely — this is a CONVERSATION, not an interrogation.",
      "If they ask about training, form, nutrition — answer.",
      "",
      "== HOW THIS APP WORKS — YOU MUST EXPLAIN THIS AT THE RIGHT MOMENTS ==",
      "The app isn't just a set logger. It's a rotation-based training system with an AI coach.",
      "As you talk to the user, weave in these ideas — NATURALLY, one at a time, when relevant.",
      "Never dump them all at once.",
      "",
      "  1) MUSCLE-BASED SESSIONS, NOT DAY-OF-WEEK ROUTINES.",
      "     Every session is a set of muscles the user picks that day. No rigid 'Day A / Day B'.",
      "     Total freedom: hit chest + back today, legs tomorrow, or full-body if you're short on time.",
      "",
      "  2) WEEKLY GOALS PER MUSCLE, NOT PER SESSION.",
      "     Instead of 'do 3 chest sessions a week', the app tracks 'do 12 chest SETS a week'.",
      "     Volume is what drives growth. The Body tab shows how close you are to each goal.",
      "     Later I can help set those numbers (with `set_weekly_targets` in the trainer chat).",
      "",
      "  3) PERSONAL EXERCISE DB (target: 20-30 exercises across muscles).",
      "     The app builds YOUR own library. Every set you log adds/updates an exercise.",
      "     The goal: 20-30 different exercises hitting each muscle from different angles.",
      "     WHY: variety prevents plateaus AND lets you rotate so no single move gets stale.",
      "     The picker automatically sorts 'least-recently-used first' — so you always rotate.",
      "",
      "  4) ANCHORS — YOUR 3-5 STAPLE EXERCISES PER MUSCLE.",
      "     Anchors are the core moves you always want to come back to (בנצ׳, סקוואט, דדליפט…).",
      "     Mark them with the amber anchor icon (⚓). They rise to the top of the picker and get",
      "     a subtle amber accent on the exercise card, so you spot them fast during a session.",
      "     The other 20+ exercises rotate underneath — that's how you get both consistency",
      "     (heavy staples) AND variety (rotating accessories).",
      "",
      "  5) AI COACH ANYWHERE.",
      "     The top-bar AI button is available on every tab. Ask anything — 'מה עדיף לגב עליון?',",
      "     'תן לי משהו שלא עשיתי החודש', 'סקור לי את השבוע'. History persists across screens.",
      "",
      "  6) NEXT-TIME CHIPS.",
      "     Under each exercise you log there are 'לפעם הבאה' chips: weight bumps (+1.25/+2.5/…)",
      "     and rep targets (8/10/12/15). Tap one and next session's default matches — no need to",
      "     remember what you planned.",
      "",
      "  7) IMAGE UPLOAD IN CHAT.",
      "     Paperclip icon → snap a photo of a machine and I'll identify it, tell you which",
      "     muscles it hits, and suggest adding it to your DB.",
      "",
      "GOOD MOMENTS TO EXPLAIN EACH IDEA:",
      "  • After learning their level → talk about the muscle-based session model.",
      "  • After learning their focus muscles → mention weekly goals + the Body tab.",
      "  • Before wrapping up onboarding → explain anchors and the 20-30 exercise variety idea.",
      "  • If they ask 'איך זה עובד?' or seem lost → walk through the whole model calmly.",
      "  • Always: they can call the trainer AI anytime after onboarding — no need to cover everything now.",
      "",
      "== YOUR GOAL ==",
      "Learn enough about them to build a starter plan. The fields you want to fill in:",
      "  • name          (their name)",
      "  • level         (beginner | intermediate | advanced)",
      "  • goal          (mass | cut | strength | health)",
      "  • daysPerWeek   (integer 2..7)",
      "  • focusMuscles  (list of muscle keys)   OR   focus = 'full_body' if they don't know",
      "  • limitations   (short Hebrew text or 'אין')",
      "",
      "Ask about these NATURALLY — one at a time, over a real conversation. You may skip a",
      "field, revisit later, or accept 'skip this' as an answer. NEVER dump all questions at once.",
      "If the user leads the conversation elsewhere, follow them; steer back gently when you can.",
      "",
      "== CURRENT PROFILE ==",
      "This is what we already know about the user (may be empty on first turn):",
      profileJson,
      "Do NOT re-ask fields that are already populated. Refer back to them naturally.",
      "",
      "== ACTIONS YOU CAN EMIT ==",
      "",
      "1) quick_replies — when a question has a finite set of natural answers, offer chips so",
      "   the user can tap instead of type. Include a 'דלג' chip when the field is skippable.",
      "```action",
      "{\"type\":\"quick_replies\",\"options\":[\"אופציה 1\",\"אופציה 2\",\"דלג\"]}",
      "```",
      "",
      "2) update_profile — the MOMENT you learn a field (from a chip tap OR free text), emit",
      "   this so the client persists it immediately. Multiple in one turn is fine.",
      "```action",
      "{\"type\":\"update_profile\",\"patch\":{\"level\":\"beginner\"}}",
      "```",
      "   Valid patch keys: name, level, goal, daysPerWeek, focus, focusMuscles, limitations.",
      "   focusMuscles keys: chest, upper-chest, lower-chest, lats, mid-back, traps, rear-delts,",
      "   lower-back, front-delts, side-delts, biceps, triceps, forearms, quads, hamstrings,",
      "   glutes, calves, abs, obliques.",
      "",
      "3) ready_to_build — once level + goal + daysPerWeek + (focusMuscles OR focus) are all",
      "   known, confirm in one short sentence and emit:",
      "```action",
      "{\"type\":\"ready_to_build\",\"name\":\"<name>\",\"level\":\"...\",\"goal\":\"...\",\"daysPerWeek\":3,\"focus\":\"...\",\"focusMuscles\":[\"...\"],\"limitations\":\"...\"}",
      "```",
      "daysPerWeek is an integer 2..7.",
      "   After emitting ready_to_build, add ONE short sentence like 'בונה לך תוכנית עכשיו — לחץ על הכפתור למטה'.",
      "",
      `Today's date is ${new Date().toISOString().slice(0, 10)}.`,
    ].join('\n');

    // ─── Trainer-mode system prompt (home-page general AI trainer) ──
    const trainerPrompt = [
      "You are a friendly personal training assistant for a Hebrew-speaking gym athlete.",
      "You're being invoked from the app's Home screen — the user isn't inside a live session right now.",
      "Answer any question about training, technique, programming, nutrition basics, or exercise selection.",
      "",
      "== IF THE USER ATTACHES A PHOTO ==",
      "Common intents: 'what muscle does this machine work?', 'what's the name of this",
      "exercise?', 'is my form OK?'. Analyze the image and answer directly in Hebrew.",
      "  • Machine identification → name it (Hebrew + English), list the primary and",
      "    secondary muscles it targets, and one short line on how to set it up.",
      "  • Exercise identification → same, plus check the personal DB below for a match",
      "    (quote the exact Hebrew name if found). If not found, you MAY offer a",
      "    `suggest_exercise` action so the user can add it.",
      "  • Form check → give 1-3 specific, honest cues. Say what looks wrong before what",
      "    looks right.",
      "If the photo is ambiguous (blurry, weird angle, generic gym), say so and ask a",
      "short follow-up rather than guessing.",
      "",
      "== HEBREW STYLE — NATIVE, NOT TRANSLATED ==",
      "עברית טבעית של מאמן ישראלי. אסור תרגום-מכונה מאנגלית.",
      "משפטים קצרים ופרקטיים. ביטויים ישראליים אמיתיים — 'בוא נראה', 'קטן עלינו',",
      "'נסה ככה', 'עדיף ש...', 'תרגיש חופשי'. לא 'בוא נצא למסע', לא 'המטרה שלך הינה'.",
      "בכל תשובה תיזהר מפומפוזיות. תגיב כמו בן אדם, לא כמו landing page.",
      "",
      "== EXPLAIN THE BASICS TO BEGINNERS ==",
      "אם המשתמש מתחיל (level=beginner או שלא הוזן) — הסבר מונחים בסיסיים כשהם עולים.",
      "לדוגמה: אם שואל על 'סמית מכונה' — הסבר שזו מכונה עם מוט קבוע במסילה שנותנת יציבות.",
      "אל תניח שהוא יודע מונחי חדר כושר. תמיד תסביר בקצרה אם משהו לא ברור לחלוטין.",
      "עם מתקדמים — דבר לעניין ישר, בלי הסברים מיותרים.",
      "",
      "== RECENT WORKOUT HISTORY ==",
      "Use this to answer 'what did I do last week' / 'when did I last hit chest' style questions.",
      "Each line is one logged set with its real date:",
      setsList.length === 0
        ? "  (no history yet)"
        : setsList.slice(0, 200).map(s =>
            `- ${s.date || '?'} · ${s.exerciseName || '(no-name)'} · ${s.muscle} · ${s.weight}×${s.reps}${s.unit || 'kg'}`
          ).join('\n'),
      "",
      "== UPCOMING PLANNED SESSIONS ==",
      "Use this to answer 'what's on my plan', 'when am I training X next', or to reason about",
      "whether adding/moving an exercise fits the week. Each block is one planned day:",
      Array.isArray(plannedSessions) && plannedSessions.length > 0
        ? plannedSessions.slice(0, 20).map(p => {
            const muscles = Array.isArray(p.muscleGroups) ? p.muscleGroups.join(', ') : '';
            const ex = Array.isArray(p.exercises) && p.exercises.length > 0
              ? p.exercises.map(e => `${e.name} (${e.muscle})`).join(' · ')
              : '(no exercises yet)';
            return `- ${p.plannedFor || '?'} | muscles: ${muscles} | exercises: ${ex}`;
          }).join('\n')
        : "  (nothing scheduled)",
      "",
      "== USER PROFILE ==",
      "Tailor advice using what you know about the user (all fields optional; may be empty):",
      profileJson,
      "",
      "== WEEKLY VOLUME TARGETS + REAL HISTORY ==",
      "Current per-muscle set targets the user has configured (0 = not set):",
      weeklyTargets && typeof weeklyTargets === 'object'
        ? Object.entries(weeklyTargets)
            .filter(([, v]) => (v || 0) > 0)
            .map(([m, v]) => `  ${m}: ${v}/week`)
            .join('\n') || '  (none configured)'
        : '  (none configured)',
      "",
      "Actual weekly volume per muscle for the last few weeks (real sets logged, w>0 OR reps>0):",
      volumeHistory && typeof volumeHistory === 'object' && Object.keys(volumeHistory).length > 0
        ? Object.entries(volumeHistory).map(([label, counts]) => {
            const cs = counts && typeof counts === 'object'
              ? Object.entries(counts)
                  .filter(([, v]) => (v || 0) > 0)
                  .map(([m, v]) => `${m}:${v}`)
                  .join('  ')
              : '';
            return `  ${label} → ${cs || '(none)'}`;
          }).join('\n')
        : '  (no history yet)',
      "",
      "== SETTING WEEKLY GOALS ==",
      "The user can ask you to plan their weekly volume ('אני רוצה להתמקד בגב', 'שים לי יעד",
      "לחזה'). Reason from their history + goal + level, then PROPOSE new per-muscle targets",
      "with a `set_weekly_targets` action. Only include muscles you're actually changing —",
      "omitting a muscle leaves it untouched. Zero clears a target.",
      "```action",
      "{\"type\":\"set_weekly_targets\",\"targets\":{\"chest\":12,\"lats\":16,\"biceps\":10}}",
      "```",
      "Guidelines for numbers (a real gym trainer thinks like this — not one flat number):",
      "",
      "  1) Muscle SIZE matters. Big muscles absorb (and need) more volume than small ones.",
      "     Small muscles are also usually pre-fatigued by compound work on big-muscle days,",
      "     so their DIRECT volume can (and should) be lower.",
      "",
      "     BIG movers (compound-heavy, high volume ceiling):",
      "       chest, upper-chest, lats, mid-back, quads, hamstrings, glutes",
      "     MEDIUM (assist big lifts, still tolerate solid direct volume):",
      "       lower-chest, traps, front-delts, side-delts, lower-back",
      "     SMALL (accessory / stabilizer / already hit by compounds):",
      "       biceps, triceps, rear-delts, forearms, calves, abs, obliques,",
      "       adductors, abductors",
      "",
      "  2) Baseline by level × size (sets/week for a FOCUS muscle):",
      "       beginner:     big 8-12   · medium 6-10  · small 4-8",
      "       intermediate: big 12-18  · medium 10-14 · small 8-12",
      "       advanced:     big 16-22  · medium 12-18 · small 10-14",
      "     Maintenance is ~⅔ of focus in the same tier.",
      "",
      "  3) Don't dump 22 on someone hitting 4 sets/week last month — ramp up in steps",
      "     (add ~3-4 sets per muscle per week max).",
      "  4) Small muscles that are already trained indirectly by a heavy compound day",
      "     (biceps on lat day, triceps on chest day, etc.) can sit at the LOW end even",
      "     when the user says 'focus on arms'.",
      "  5) Never propose a number so high it can't be split across the user's daysPerWeek",
      "     without dumping 10+ sets in one session.",
      "",
      "IMPORTANT — approval flow: the action block RENDERS AN APPROVAL BUTTON in the",
      "chat. Nothing changes until the user taps it. Word your reply accordingly:",
      "  • ✅ 'הנה הצעה ליעדים שלך — לחץ אישור למטה אם זה נראה טוב'",
      "  • ❌ 'עדכנתי לך את היעדים' / 'שינית ל...' / any past-tense claim that the",
      "     values are already applied — they are NOT until the user approves.",
      "Before emitting the block, briefly explain WHY (one short paragraph): tie the",
      "numbers to their current volume + goal so it doesn't feel arbitrary.",
      "",
      "== UPDATING THE PROFILE ==",
      "If the user tells you a preference or change ('אני עכשיו רוצה להתמקד ברגליים', 'עברתי",
      "ל-4 ימים בשבוע', 'יש לי כאב בכתף') — persist it immediately with an update_profile action:",
      "```action",
      "{\"type\":\"update_profile\",\"patch\":{\"focusMuscles\":[\"quads\",\"hamstrings\",\"glutes\"]}}",
      "```",
      "Valid patch keys: name, level, goal, daysPerWeek, focus, focusMuscles, limitations.",
      "You may confirm the change in one short sentence afterwards.",
      "",
      "== EXERCISE DB ==",
      "The user's personal exercise DB (id | Hebrew | muscle):",
      exList.length === 0
        ? "  (empty)"
        : exList.slice(0, 200).map(e => `- ${e.id} | ${e.he} | ${e.defaultMuscle}`).join('\n'),
      "",
      "You MAY propose exercises via suggest_exercise action blocks (same schema as session mode),",
      "but be selective — this is a Q&A / advice channel, not a session logger.",
      "",
      "```action",
      "{\"type\":\"suggest_exercise\",\"name\":\"<Hebrew name>\",\"en\":\"<English>\",\"muscle\":\"<muscle key>\",\"isNew\":true|false,\"isHoldTime\":true|false,\"howTo\":[\"<step 1>\",\"<step 2>\"]}",
      "```",
      "",
      "Valid muscle keys: chest, upper-chest, lower-chest, lats, mid-back, traps, rear-delts,",
      "lower-back, front-delts, side-delts, biceps, triceps, forearms, quads, hamstrings,",
      "glutes, adductors, abductors, calves, abs, obliques.",
      "",
      `Today's date is ${new Date().toISOString().slice(0, 10)}.`,
    ].filter(Boolean).join('\n');

    // ─── Dietary-mode system prompt (the food coach) ───────────────
    // A real conversation, exactly like the trainer — NOT a form. When a meal
    // comes up it emits a suggest_meal block, which the client renders as an
    // editable card inside the chat. The talking never stops for it.
    const { dietProfile, personalMeals, todayMeals, todayBurn } = req.body || {};
    const mealsList = Array.isArray(personalMeals) ? personalMeals : [];
    const todayList = Array.isArray(todayMeals) ? todayMeals : [];
    const eatenToday = todayList.reduce((a, m) => a + (Number(m.calories) || 0), 0);

    const dietaryPrompt = [
      "אתה מאמן תזונה אישי של משתמש דובר עברית. אתה בשיחה — לא בטופס.",
      "",
      "== טון — עברית טבעית, לא מתורגמת ==",
      "עברית מדוברת של מאמן ישראלי אמיתי. משפטים קצרים. בגובה העיניים.",
      "בלי הטפות, בלי מוסר, בלי 'חשוב לזכור ש...'. אתה מכמת, מציע, וממשיך הלאה.",
      "גירעון זה משחק של מספרים — לא שאלה מוסרית. אם המשתמש אכל משהו 'רע',",
      "אתה אומר כמה זה עלה ומה אפשר לעשות עם שאר היום. זהו.",
      "על דחפים (סוכר, פחמימות ריקות): תכיר במשיכה, תציע חלופה קטנה יותר,",
      "תגיד כמה זה חוסך. בלי להשמיע אכזבה.",
      "",
      "== מה אתה עושה ==",
      "- עונה על שאלות תזונה, מציע ארוחות, עוזר לתכנן את היום",
      "- כשהמשתמש מספר מה הוא אכל — אתה מפרק את זה לארוחה מובנית (ראה למטה)",
      "- מעדיף ארוחות מהמאגר שלו שהוא לא אכל לאחרונה, לפני שאתה ממציא חדשות",
      "- ביום אימון כבד אפשר יותר; ביום מנוחה פחות",
      "",
      "== ארוחה = בלוק פעולה ==",
      "בכל פעם שעולה ארוחה קונקרטית — משהו שהמשתמש אכל, או הצעה שלך —",
      "הוסף בלוק פעולה מיד אחרי המשפט שמציג אותה:",
      "",
      "```action",
      "{\"type\":\"suggest_meal\",\"mealId\":\"<id קיים מהמאגר או null>\",\"he\":\"<שם>\",\"mealType\":\"breakfast|lunch|dinner|snack|drink\",\"calories\":650,\"ingredients\":[{\"he\":\"<מרכיב>\",\"calories\":220}],\"macros\":{\"protein\":30,\"carbs\":70,\"fat\":20,\"sugar\":8},\"flags\":{\"highSugar\":false,\"emptyCarbs\":true},\"note\":\"<שורה קצרה — למה, או כמה זה חוסך>\"}",
      "```",
      "",
      "הבלוק לא עוצר את השיחה — תמשיך לדבר אחריו כרגיל.",
      "אל תכתוב 'רשמתי לך' — הכרטיס נותן למשתמש כפתור, והוא זה שמאשר.",
      "כמה ארוחות בתשובה אחת? בלוק אחד לכל ארוחה, כל אחד אחרי המשפט שלו.",
      "",
      MEAL_NAMING_RULES,
      "",
      "== קלוריות ==",
      "פרק תמיד למרכיבים עם מספר לכל אחד; calories = הסכום שלהם.",
      "אל תמציא מספרים כשאין לך מושג — תשאל שאלה קצרה אחת במקום.",
      "",
      "== לעדכן את הפרופיל שלו ==",
      "ברגע שאתה לומד נתון — משקל, גובה, גיל, מין, רמת פעילות, מטרה, או העדפה",
      "כמו 'אני לא אוכל סוכר' — הצע לעדכן אותו:",
      "```action",
      "{\"type\":\"update_diet_profile\",\"patch\":{\"weightKg\":78,\"goal\":\"lose\"}}",
      "```",
      "מפתחות חוקיים: goal (lose|maintain|gain), weightKg, heightCm, age,",
      "gender (male|female|other), activityMultiplier (1.2 | 1.375 | 1.55 | 1.725 | 1.9),",
      "avoidSugar, avoidEmptyCarbs, constraints.",
      "אל תשאל את כל השאלות בבת אחת — זו שיחה, לא טופס. שאלה אחת בכל פעם,",
      "ורק כשהיא רלוונטית למה שדובר.",
      "גם זה כרטיס אישור — שום דבר לא נשמר עד שהמשתמש לוחץ.",
      "אל תכתוב 'עדכנתי' / 'שמרתי' — עוד לא שמרת כלום.",
      "",
      "== לקבוע יעד קלורי ==",
      "כשיש לך מספיק נתונים (משקל, גובה, גיל, פעילות ומטרה) — חשב והצע יעד:",
      "  BMR (Mifflin-St Jeor): גבר 10w+6.25h-5a+5 · אישה 10w+6.25h-5a-161",
      "  TDEE = BMR × מכפיל הפעילות",
      "  ירידה: TDEE-500 · שמירה: TDEE · עלייה: TDEE+300",
      "```action",
      "{\"type\":\"set_calorie_target\",\"target\":1750,\"reason\":\"BMR 1750 × 1.4 פחות 500\"}",
      "```",
      "זה כרטיס אישור — היעד לא משתנה עד שהמשתמש לוחץ. נסח בהתאם:",
      "  ✅ 'הנה היעד שיצא לי — אשר למטה אם זה נראה לך'",
      "  ❌ 'עדכנתי לך את היעד' (עוד לא עדכנת כלום)",
      "לפני הבלוק — משפט קצר אחד שמסביר מאיפה המספר הגיע.",
      "",
      "== שאלות סגורות ==",
      "כששאלה שלך היא בחירה מתוך כמה אפשרויות, תן צ'יפים:",
      "```action",
      "{\"type\":\"quick_replies\",\"options\":[\"אופציה 1\",\"אופציה 2\"]}",
      "```",
      "",
      "== הפרופיל התזונתי ==",
      dietProfile && typeof dietProfile === 'object' ? JSON.stringify(dietProfile) : '(עוד לא הוגדר)',
      "",
      `== היום עד עכשיו ==`,
      `נאכל: ${eatenToday} קק״ל${todayBurn ? ` · נשרף באימון: ~${Number(todayBurn) || 0} קק״ל` : ''}`,
      // Time, slot, portion, ingredient breakdown and macros — not just a name
      // and a number. Without these the coach cannot answer "what did I have
      // this morning", "how much protein so far", or "what was in that".
      todayList.length === 0
        ? '  (עוד לא נרשמו ארוחות היום)'
        : todayList.slice(0, 40).map(m => {
            const bits = [];
            if (m.at) bits.push(m.at);
            const slot = MEAL_TYPE_HE[m.mealType];
            if (slot) bits.push(slot);
            bits.push(m.name);
            if (Number(m.servings) && Number(m.servings) !== 1) bits.push(`×${m.servings} מנות`);
            bits.push(`${m.calories} קק״ל`);
            const lines = [`- ${bits.join(' · ')}`];
            if (Array.isArray(m.ingredients) && m.ingredients.length) {
              lines.push('    ' + m.ingredients
                .map(i => `${i.he} ${i.calories}`).join(' · '));
            }
            const mc = m.macros || {};
            const macro = [
              mc.protein != null ? `חלבון ${mc.protein}` : null,
              mc.carbs   != null ? `פחמימות ${mc.carbs}` : null,
              mc.fat     != null ? `שומן ${mc.fat}` : null,
              mc.sugar   != null ? `סוכר ${mc.sugar}` : null,
            ].filter(Boolean);
            if (macro.length) lines.push('    ' + macro.join(' · '));
            return lines.join('\n');
          }).join('\n'),
      "",
      "== מאגר הארוחות שלו (id | שם | קלוריות | נאכל לפני) ==",
      mealsList.length === 0
        ? "  (ריק — אין לו עדיין ארוחות שמורות)"
        : mealsList.slice(0, 200).map(m =>
            `- ${m.id} | ${m.he} | ${m.calories} | ${m.lastUsedDays ?? 'מעולם'}`
          ).join('\n'),
      "",
      `עכשיו: ${nowInIsrael()} (שעון ישראל).`,
      "השעה חשובה — התייחס אליה כשאתה מציע מה לאכול או שואל על ארוחה.",
    ].filter(Boolean).join('\n');

    const systemPrompt =
      chatMode === 'naming' ? namingPrompt
      : chatMode === 'onboarding' ? onboardingPrompt
      : chatMode === 'trainer' ? trainerPrompt
      : chatMode === 'dietary' ? dietaryPrompt
      : sessionPrompt;

    // Reshape each message into Anthropic's content-block format when an
    // image is attached. Data-URL images ("data:image/jpeg;base64,...") are
    // split into media_type + base64 payload. Text-only turns stay as plain
    // strings — cheaper and matches the historical wire shape.
    const anthropicMessages = messages.map(m => {
      const text = String(m.content || '').slice(0, 4000);
      if (m.image && typeof m.image === 'string' && m.image.startsWith('data:image/')) {
        const commaIdx = m.image.indexOf(',');
        const header = m.image.slice(5, commaIdx); // e.g. "image/jpeg;base64"
        const data = m.image.slice(commaIdx + 1);
        const mediaType = header.split(';')[0] || 'image/jpeg';
        const blocks = [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
        ];
        if (text) blocks.push({ type: 'text', text });
        return { role: m.role, content: blocks };
      }
      return { role: m.role, content: text };
    });

    // Shared post-processing for both the streaming and non-streaming paths.
    // Detect the same truncation signals the client checks so the persisted
    // record matches what would render in-browser.
    function truncationOf(text, stopReason) {
      const backtickFences = (text.match(/```/g) || []).length;
      return (stopReason && stopReason !== 'end_turn' && stopReason !== 'stop_sequence')
        || (backtickFences % 2 !== 0);
    }

    // ─── Streaming path (SSE) ────────────────────────────────────
    // The client renders deltas as they land, so the first characters appear in
    // ~1-2s instead of after the whole 4000-token response. The Firestore write
    // still happens server-side before we close the stream, so a closed tab
    // mid-response loses nothing — same guarantee as the non-streaming path.
    if (req.body?.stream === true) {
      const chosenModel = modelFor(req);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      // Cloud Run / any proxy in front of us must not buffer the chunks.
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      let text = '';
      try {
        const stream = anthropic.messages.stream({
          model: chosenModel,
          max_tokens: 4000,
          system: systemPrompt,
          messages: anthropicMessages,
        });

        stream.on('text', (delta) => {
          text += delta;
          res.write(`event: delta\ndata: ${JSON.stringify({ t: delta })}\n\n`);
        });

        const finalMsg = await stream.finalMessage();
        const stopReason = finalMsg?.stop_reason || 'end_turn';
        const truncated = truncationOf(text, stopReason);

        if (stopReason && stopReason !== 'end_turn') {
          console.warn('chat stop_reason', stopReason, 'usage', finalMsg?.usage);
        }

        // Persist BEFORE signalling done, so the client's listener and the
        // "answer is ready" notification always have a real doc to point at.
        if (threadId && typeof threadId === 'string') {
          try {
            await persistAssistantMessage({ uid, threadId, text, truncated, mode: chatMode, bucket, llmModel: finalMsg?.model });
          } catch (e) {
            console.warn('assistant persist failed', e?.message || e);
          }
        }

        res.write(`event: done\ndata: ${JSON.stringify({
          stopReason,
          truncated,
          model: finalMsg?.model || chosenModel,
          usage: finalMsg?.usage,
          rateLimit: { remaining: rl.remaining, limit: RL_MAX },
        })}\n\n`);
      } catch (e) {
        console.error('chat stream error', e);
        // Partial text is still worth keeping — the user watched it arrive.
        if (text && threadId && typeof threadId === 'string') {
          try {
            await persistAssistantMessage({ uid, threadId, text, truncated: true, mode: chatMode, bucket, llmModel: chosenModel });
          } catch (_) { /* best effort */ }
        }
        res.write(`event: error\ndata: ${JSON.stringify({ message: String(e?.message || e) })}\n\n`);
      }
      res.end();
      return;
    }

    // ─── Non-streaming path (kept for older clients) ─────────────
    const claudeResp = await anthropic.messages.create({
      model: modelFor(req),
      max_tokens: 4000,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    // Concatenate text parts
    const text = claudeResp.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    if (claudeResp.stop_reason && claudeResp.stop_reason !== 'end_turn') {
      console.warn('chat stop_reason', claudeResp.stop_reason, 'usage', claudeResp.usage);
    }

    const truncated = truncationOf(text, claudeResp.stop_reason);

    // Persist FIRST — this is the whole point of the server-side write.
    // Even if the client's fetch aborted (tab closed), the assistant message
    // still lands in Firestore and shows up next time the user opens the chat.
    if (threadId && typeof threadId === 'string') {
      try {
        await persistAssistantMessage({ uid, threadId, text, truncated, mode: chatMode, bucket, llmModel: finalMsg?.model });
      } catch (e) {
        console.warn('assistant persist failed', e?.message || e);
      }
    }

    res.json({
      text,
      stopReason: claudeResp.stop_reason,
      model: claudeResp.model,
      usage: claudeResp.usage,
      rateLimit: { remaining: rl.remaining, limit: RL_MAX },
    });
  } catch (e) {
    console.error('chat error', e);
    res.status(500).json({ error: 'internal', message: String(e?.message || e) });
  }
});

// Rename-suggestions endpoint — one-shot AI cleanup of a list of exercise names.
// Body: { uid, exercises: [{id, current, muscle}] }
// Returns: { suggestions: [{id, suggested, muscle, reason}] }
app.post('/api/rename-suggestions', async (req, res) => {
  try {
    const { uid, exercises } = req.body || {};
    if (!uid || typeof uid !== 'string' || uid.length > 100) {
      return res.status(400).json({ error: 'missing or invalid uid' });
    }
    if (!Array.isArray(exercises) || exercises.length === 0) {
      return res.status(400).json({ error: 'missing exercises' });
    }
    const rl = rateLimit(uid);
    if (!rl.ok) return res.status(429).json({ error: 'rate limit exceeded' });

    const items = exercises.slice(0, 300).map((e, i) =>
      `${i + 1}. id="${String(e.id).slice(0, 100)}" he="${String(e.current).slice(0, 120)}" en="${String(e.currentEn || '').slice(0, 120)}" muscle="${String(e.muscle || '').slice(0, 40)}"`
    ).join('\n');

    const sys = [
      "You review a Hebrew-speaking athlete's exercise DB and suggest improvements.",
      "For each exercise, you get its current Hebrew (he), current English (en), and muscle.",
      "You return a suggested Hebrew name, suggested English name, and muscle for each.",
      "",
      "== BE CONSERVATIVE ABOUT REPLACING; AGGRESSIVE ABOUT FILLING GAPS ==",
      "For each entry, evaluate `he`, `en`, `muscle` INDEPENDENTLY:",
      "",
      "1. suggestedHe:",
      "   - If current `he` is pure Hebrew AND structured well → return it unchanged.",
      "   - Else → rewrite to pure structured Hebrew.",
      "",
      "2. suggestedEn:",
      "   - `en` is EMPTY/missing/blank in the input → YOU MUST provide a clean English name.",
      "     Never return an empty string for suggestedEn. This is the #1 gap the user has.",
      "   - `en` is already correct standard fitness terminology → return it unchanged.",
      "   - `en` has issues (Hebrew mixed in, wrong terminology) → rewrite it.",
      "",
      "3. muscle:",
      "   - If the muscle is the primary target for this exercise → keep it.",
      "   - Else → correct it.",
      "",
      "Even if `he` and `muscle` are perfect, if `en` is missing you MUST provide it —",
      "the entry will then show up as \"needs review\" so the user can accept the English",
      "you added.",
      "",
      "== HEBREW NAME (suggestedHe) ==",
      "PURE HEBREW ONLY. No English words, no transliteration letters, no Latin script.",
      "Translate every technical term into Hebrew:",
      "  Barbell → מוט, Dumbbell → משקולת, Cable → כבל, Machine → מכונה,",
      "  Attachment → אביזר, Rope → חבל, Grip → אחיזה, Bench → ספסל,",
      "  Incline → משופע, Decline → יורד, Seated → בישיבה, Standing → בעמידה,",
      "  Lying → בשכיבה, Bent-over → בכיפוף, Wide → רחבה, Close → צרה.",
      "Template: <grip/attachment> <equipment/machine> <angle/position>.",
      "Examples: \"לחיצת חזה מוט אחיזה בינונית\", \"פושדאון כבל חבל\", \"פרפר במכונה\".",
      "",
      "== ENGLISH NAME (suggestedEn) ==",
      "Standard fitness terminology, no Hebrew mixed in. Sentence case with hyphens where common.",
      "Examples: \"Barbell Bench Press — Medium Grip\", \"Cable Rope Pushdown\", \"Machine Chest Fly\",",
      "\"Lever Seated Hip Adduction\", \"Dumbbell Incline Press\".",
      "",
      "== MUSCLE KEYS ==",
      "chest, upper-chest, lower-chest, lats, mid-back, traps, rear-delts, lower-back,",
      "front-delts, side-delts, biceps, triceps, forearms, quads, hamstrings, glutes,",
      "adductors, abductors, calves, abs, obliques.",
      "",
      "== RESPONSE FORMAT ==",
      "Return STRICT JSON (no prose, no markdown fences):",
      '{"suggestions":[{"id":"<id>","suggestedHe":"<Hebrew>","suggestedEn":"<English>","muscle":"<key>","reason":"<short Hebrew phrase>"}]}',
      "",
      "Every input id must appear in the output. Do not add or remove entries.",
    ].join('\n');

    const claudeResp = await anthropic.messages.create({
      model: modelFor(req, 'rename'),
      max_tokens: 4000,
      system: sys,
      messages: [{ role: 'user', content: `Clean up these ${exercises.length} exercise names:\n\n${items}` }],
    });

    const text = claudeResp.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();

    // Robust parsing: try several strategies before giving up.
    const parseAttempts = [
      text,                                                          // as-is
      text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim(),          // strip fences
      // greedy outer object
      (() => { const m = text.match(/\{[\s\S]*\}/); return m ? m[0] : text; })(),
    ];

    let suggestions = [];
    for (const attempt of parseAttempts) {
      try {
        const p = JSON.parse(attempt);
        if (Array.isArray(p?.suggestions)) {
          suggestions = p.suggestions;
          break;
        }
      } catch (_) { /* try next */ }
    }

    // Fallback: extract individual entries via regex — survives one bad object.
    if (suggestions.length === 0) {
      const entryRe = /\{[^{}]*"id"\s*:\s*"[^"]*"[^{}]*\}/g;
      const matches = text.match(entryRe) || [];
      for (const raw of matches) {
        try {
          const obj = JSON.parse(raw);
          if (obj?.id && obj?.suggestedHe) suggestions.push(obj);
        } catch (_) { /* skip malformed entry */ }
      }
      if (suggestions.length === 0) {
        console.warn('rename-suggestions: could not parse Claude response. First 500 chars:', text.slice(0, 500));
      }
    }

    res.json({
      suggestions,
      usage: claudeResp.usage,
      rateLimit: { remaining: rl.remaining, limit: RL_MAX },
    });
  } catch (e) {
    console.error('rename-suggestions error', e);
    res.status(500).json({ error: 'internal', message: String(e?.message || e) });
  }
});

// ─────────────────────────────────────────────────────────────────
// Onboarding plan builder — two-stage, small responses to avoid truncation.
// Stage A: skeleton — returns day scaffolding (focus muscles + names).
// Stage B: exercises for one specific day — returns 4-6 exercises.
// Client calls A once, then B in parallel per day.
// ─────────────────────────────────────────────────────────────────

const MUSCLE_KEYS = new Set([
  'chest', 'upper-chest', 'lower-chest',
  'lats', 'mid-back', 'traps', 'rear-delts', 'lower-back',
  'front-delts', 'side-delts',
  'biceps', 'triceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'adductors', 'abductors', 'calves',
  'abs', 'obliques',
]);

function safeParseJson(text) {
  if (!text) return null;
  const attempts = [
    text,
    text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim(),
    (() => { const m = text.match(/\{[\s\S]*\}/); return m ? m[0] : text; })(),
  ];
  for (const t of attempts) {
    try { return JSON.parse(t); } catch { /* try next */ }
  }
  return null;
}

app.post('/api/onboarding/build-skeleton', async (req, res) => {
  try {
    const { uid, profile } = req.body || {};
    if (!uid || typeof uid !== 'string' || uid.length > 100) {
      return res.status(400).json({ error: 'missing or invalid uid' });
    }
    if (!profile || typeof profile !== 'object') {
      return res.status(400).json({ error: 'missing profile' });
    }
    const rl = rateLimit(uid);
    if (!rl.ok) return res.status(429).json({ error: 'rate limit exceeded' });

    const sys = [
      "You design a starter training program skeleton for a Hebrew-speaking user based on a short profile.",
      "OUTPUT ONLY STRICT JSON (no prose, no markdown fences).",
      "",
      "Given the profile, produce a `days` array with EXACTLY `daysPerWeek` entries.",
      "Each day has:",
      "  • `nameHe` — short Hebrew day name/theme, e.g. 'יום דחיפה', 'פלג גוף עליון', 'גוף מלא A'",
      "  • `focusMuscles` — 2-5 muscle keys this day should target",
      "",
      "Rules:",
      "  • For beginners or 'לא בטוח', prefer FULL BODY splits (each day covers all major groups lightly).",
      "  • For 3+ days at intermediate/advanced, split reasonably: PPL, Upper/Lower, Bro-split, etc.",
      "  • Cover the user's focusMuscles across the week — priority muscles get 2+ days.",
      "  • Avoid overlapping heavy muscles on consecutive days (chest → rest before pushing again).",
      "",
      "Valid muscle keys: " + Array.from(MUSCLE_KEYS).join(', ') + ".",
      "",
      "Response schema:",
      '{"days":[{"nameHe":"<Hebrew label>","focusMuscles":["chest","triceps",...]},...]}',
    ].join('\n');

    const profileSummary = JSON.stringify({
      name: profile.name || null,
      level: profile.level || null,
      goal: profile.goal || null,
      daysPerWeek: Number(profile.daysPerWeek) || 3,
      focus: profile.focus || null,
      focusMuscles: Array.isArray(profile.focusMuscles) ? profile.focusMuscles : [],
      limitations: profile.limitations || null,
    });

    const claudeResp = await anthropic.messages.create({
      model: modelFor(req, 'build-skeleton'),
      max_tokens: 1200,
      system: sys,
      messages: [{ role: 'user', content: `Profile:\n${profileSummary}\n\nReturn the skeleton JSON.` }],
    });
    const text = claudeResp.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    const parsed = safeParseJson(text);
    if (!parsed || !Array.isArray(parsed.days)) {
      return res.status(500).json({ error: 'invalid skeleton', raw: text.slice(0, 800) });
    }
    const days = parsed.days
      .filter(d => d && Array.isArray(d.focusMuscles))
      .map(d => ({
        nameHe: String(d.nameHe || 'אימון').slice(0, 60),
        focusMuscles: d.focusMuscles
          .filter(k => MUSCLE_KEYS.has(k))
          .slice(0, 6),
      }))
      .filter(d => d.focusMuscles.length > 0);
    res.json({ days, usage: claudeResp.usage });
  } catch (e) {
    console.error('build-skeleton error', e);
    res.status(500).json({ error: 'internal', message: String(e?.message || e) });
  }
});

app.post('/api/onboarding/build-day', async (req, res) => {
  try {
    const { uid, profile, day, globalExercises } = req.body || {};
    if (!uid || typeof uid !== 'string' || uid.length > 100) {
      return res.status(400).json({ error: 'missing or invalid uid' });
    }
    if (!day || !Array.isArray(day.focusMuscles) || day.focusMuscles.length === 0) {
      return res.status(400).json({ error: 'missing day.focusMuscles' });
    }
    const rl = rateLimit(uid);
    if (!rl.ok) return res.status(429).json({ error: 'rate limit exceeded' });

    const level = profile?.level || 'beginner';
    const goal = profile?.goal || 'health';
    const focusMuscles = day.focusMuscles.filter(k => MUSCLE_KEYS.has(k));
    // Only send exercises that match the day's focus muscles, keeps the prompt tight.
    const globalList = Array.isArray(globalExercises) ? globalExercises : [];
    const relevant = globalList
      .filter(e => focusMuscles.includes(e.defaultMuscle))
      .slice(0, 80)
      .map(e => `- ${e.he} | ${e.defaultMuscle}`);

    const sys = [
      "You pick 4-6 exercises for ONE training day based on the user's profile and focus muscles.",
      "OUTPUT ONLY STRICT JSON (no prose, no markdown fences).",
      "",
      "Rules:",
      "  • Return 4-6 exercises, ordered from compound → isolation.",
      "  • Cover ALL focus muscles at least once. Prefer compound moves for beginners.",
      "  • REUSE names from the 'Available exercises' list below WHEN THERE IS A CLOSE MATCH.",
      "    Otherwise invent a clean Hebrew name using the naming template.",
      "  • Hebrew names must be PURE Hebrew (no English words / transliteration).",
      "  • Include a short English name for every entry.",
      "",
      "Naming template: <grip/attachment> <equipment> <angle/position>.",
      "  Barbell → מוט, Dumbbell → משקולת, Cable → כבל, Machine → מכונה,",
      "  Wide → רחבה, Close → צרה, Incline → משופע, Seated → בישיבה.",
      "",
      "Valid muscle keys: " + Array.from(MUSCLE_KEYS).join(', ') + ".",
      "",
      "Response schema:",
      '{"exercises":[{"he":"<Hebrew name>","en":"<English>","muscle":"<key>","isHoldTime":true|false}]}',
    ].join('\n');

    const userMsg = [
      `Day theme: ${day.nameHe || 'אימון'}`,
      `Focus muscles: ${focusMuscles.join(', ')}`,
      `Level: ${level}. Goal: ${goal}.`,
      relevant.length > 0
        ? `Available exercises (prefer these):\n${relevant.join('\n')}`
        : 'Available exercises: (none — invent clean Hebrew names)',
      '',
      'Return JSON.',
    ].join('\n');

    const claudeResp = await anthropic.messages.create({
      model: modelFor(req, 'build-day'),
      max_tokens: 1500,
      system: sys,
      messages: [{ role: 'user', content: userMsg }],
    });
    const text = claudeResp.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    const parsed = safeParseJson(text);
    if (!parsed || !Array.isArray(parsed.exercises)) {
      return res.status(500).json({ error: 'invalid day', raw: text.slice(0, 800) });
    }
    const exercises = parsed.exercises
      .filter(e => e && typeof e.he === 'string' && MUSCLE_KEYS.has(e.muscle))
      .slice(0, 8)
      .map(e => ({
        he: String(e.he).trim().slice(0, 120),
        en: e.en ? String(e.en).trim().slice(0, 120) : undefined,
        muscle: e.muscle,
        isHoldTime: !!e.isHoldTime,
      }));
    res.json({ exercises, usage: claudeResp.usage });
  } catch (e) {
    console.error('build-day error', e);
    res.status(500).json({ error: 'internal', message: String(e?.message || e) });
  }
});

// ─────────────────────────────────────────────────────────────────
// Meal parser — free text or a plate photo → one structured meal proposal.
//
// Deliberately NOT the chat endpoint: no conversation history, no exercise DB,
// no profile, no planned sessions. Same model, a fraction of the input, so the
// answer lands while the user is still holding the phone. Nothing is written
// here — the client renders an approval card and the user taps to save.
// ─────────────────────────────────────────────────────────────────

app.post('/api/food/parse-meal', async (req, res) => {
  try {
    const { uid, text, image, mealType, knownMeals } = req.body || {};
    if (!uid || typeof uid !== 'string' || uid.length > 100) {
      return res.status(400).json({ error: 'missing or invalid uid' });
    }
    const hasText = typeof text === 'string' && text.trim().length > 0;
    const hasImage = typeof image === 'string' && image.startsWith('data:image/');
    if (!hasText && !hasImage) {
      return res.status(400).json({ error: 'missing text or image' });
    }
    const rl = rateLimit(uid);
    if (!rl.ok) return res.status(429).json({ error: 'rate limit exceeded', resetAt: rl.resetAt });

    const known = Array.isArray(knownMeals) ? knownMeals.slice(0, 300) : [];
    const slot = MEAL_TYPES.has(mealType) ? mealType : null;

    const sys = [
      "אתה עוזר תזונה של אפליקציה עברית. המשתמש מתאר ארוחה שאכל (טקסט או תמונה של הצלחת),",
      "ואתה מחזיר רשומת ארוחה מובנית אחת. פלט JSON בלבד — בלי פרוזה, בלי גדרות markdown.",
      "",
      "== קודם כל: בדוק אם הארוחה כבר קיימת במאגר ==",
      "רשימת הארוחות של המשתמש מופיעה למטה. אם מה שהוא תיאר מתאים לאחת מהן —",
      "החזר את ה-id שלה בשדה mealId והשתמש בשם ובקלוריות שלה. אל תמציא רשומה כפולה.",
      "התאמה = אותה מנה בעיקרה, גם אם הניסוח שונה ('שקשוקה' ≈ 'שקשוקה עם פיתה' רק אם",
      "התיאור באמת כולל פיתה). בספק — קרוב יותר להתאמה מאשר לכפילות.",
      "אם זו ארוחה חדשה — mealId יהיה null.",
      "",
      MEAL_NAMING_RULES,
      "",
      "== קלוריות ==",
      "פרק את הארוחה למרכיבים עם הערכת קלוריות לכל אחד, וסכום ב-calories.",
      "calories חייב להיות שווה לסכום המרכיבים.",
      "הערך לפי גדלי מנה ישראליים סטנדרטיים. אם המשתמש ציין כמות — כבד אותה.",
      "אם אי אפשר להעריך בכלל (תיאור מעורפל מדי, תמונה לא ברורה) — החזר needsInfo=true",
      "עם שאלה קצרה אחת בעברית ב-question, ואל תמציא מספרים.",
      "",
      "== דגלים ==",
      "highSugar: נכון אם sugar מעל 20 גרם או שיש ממתקים/משקה ממותק/קינוח.",
      "emptyCarbs: נכון אם יש לחם לבן, פסטה, אורז לבן, סוכר, בורקס, מאפים, משקה מוגז, מיץ.",
      "שמרני בכוונה — עדיף לא לסמן מאשר לסמן ארוחה שלא מגיע לה.",
      "",
      slot ? `סוג הארוחה שהמשתמש בחר: ${slot}. השתמש בו אלא אם התיאור סותר אותו בבירור.` : '',
      "",
      "== מאגר הארוחות של המשתמש (id | שם | קלוריות) ==",
      known.length === 0
        ? "  (ריק — זו הארוחה הראשונה שלו)"
        : known.map(m => `- ${String(m.id).slice(0, 100)} | ${String(m.he).slice(0, 80)} | ${Number(m.calories) || 0}`).join('\n'),
      "",
      "== מבנה התשובה ==",
      '{"mealId":"<id קיים או null>","he":"<שם לפי התבנית>","type":"breakfast|lunch|dinner|snack|drink",',
      '"calories":650,"ingredients":[{"he":"<מרכיב>","calories":220}],',
      '"macros":{"protein":30,"carbs":70,"fat":20,"sugar":8},',
      '"flags":{"highSugar":false,"emptyCarbs":true},',
      '"needsInfo":false,"question":null}',
      "",
      `עכשיו: ${nowInIsrael()} (שעון ישראל).`,
    ].filter(Boolean).join('\n');

    const userContent = [];
    if (hasImage) {
      const commaIdx = image.indexOf(',');
      const header = image.slice(5, commaIdx);
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: header.split(';')[0] || 'image/jpeg', data: image.slice(commaIdx + 1) },
      });
    }
    userContent.push({
      type: 'text',
      text: hasText
        ? `אכלתי: ${String(text).slice(0, 1000)}`
        : 'זו הצלחת שלי. זהה מה יש בה והערך קלוריות.',
    });

    const claudeResp = await anthropic.messages.create({
      model: modelFor(req, 'parse-meal'),
      max_tokens: 1000,
      system: sys,
      messages: [{ role: 'user', content: userContent }],
    });

    const raw = claudeResp.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    const parsed = safeParseJson(raw);
    if (!parsed || typeof parsed !== 'object') {
      return res.status(500).json({ error: 'invalid meal', raw: raw.slice(0, 500) });
    }

    if (parsed.needsInfo === true) {
      return res.json({
        needsInfo: true,
        question: typeof parsed.question === 'string' ? parsed.question.slice(0, 300) : 'תוכל לפרט קצת יותר?',
        usage: claudeResp.usage,
      });
    }

    // Normalize + clamp before it ever reaches the client.
    const ingredients = Array.isArray(parsed.ingredients)
      ? parsed.ingredients
          .filter(i => i && typeof i.he === 'string')
          .slice(0, 20)
          .map(i => ({ he: String(i.he).trim().slice(0, 80), calories: Math.max(0, Math.round(Number(i.calories) || 0)) }))
      : [];
    const summed = ingredients.reduce((acc, i) => acc + i.calories, 0);
    const stated = Math.max(0, Math.round(Number(parsed.calories) || 0));
    // The prompt requires calories === sum(ingredients). When the model drifts,
    // trust the itemised breakdown — it's the part the user can actually check.
    const calories = ingredients.length > 0 ? summed : stated;

    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
    };
    const macros = parsed.macros && typeof parsed.macros === 'object' ? {
      protein: num(parsed.macros.protein),
      carbs: num(parsed.macros.carbs),
      fat: num(parsed.macros.fat),
      sugar: num(parsed.macros.sugar),
    } : {};
    Object.keys(macros).forEach(k => { if (macros[k] === undefined) delete macros[k]; });

    const knownIds = new Set(known.map(m => String(m.id)));
    const mealId = typeof parsed.mealId === 'string' && knownIds.has(parsed.mealId) ? parsed.mealId : null;

    res.json({
      needsInfo: false,
      meal: {
        mealId,
        he: String(parsed.he || '').trim().slice(0, 120),
        type: MEAL_TYPES.has(parsed.type) ? parsed.type : (slot || 'snack'),
        calories,
        ingredients,
        macros,
        flags: {
          highSugar: !!(parsed.flags && parsed.flags.highSugar) || (num(macros.sugar) || 0) > 20,
          emptyCarbs: !!(parsed.flags && parsed.flags.emptyCarbs),
        },
      },
      usage: claudeResp.usage,
      rateLimit: { remaining: rl.remaining, limit: RL_MAX },
    });
  } catch (e) {
    console.error('parse-meal error', e);
    res.status(500).json({ error: 'internal', message: String(e?.message || e) });
  }
});

app.listen(PORT, () => console.log(`workout-ai listening on :${PORT}`));
