import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const PORT = process.env.PORT || 8080;
// Opus 5 for higher-quality Hebrew — the extra cost is worth it for the
// user-facing conversational modes. Override with CLAUDE_MODEL if needed.
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5';
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

async function persistAssistantMessage({ uid, threadId, text, truncated, mode, bucket }) {
  if (!uid || !threadId) return;
  const ts = Date.now();
  const msgId = `m_${ts}_assistant`;
  const enc = encodeURIComponent;
  // Message doc: brand-new id, full replace is fine.
  await fsPatch(
    `users/${enc(uid)}/chatThreads/${enc(threadId)}/messages/${enc(msgId)}`,
    { id: msgId, role: 'assistant', content: text || '', ts, truncated: !!truncated, mode: mode || 'session' },
  );
  // Thread doc: MERGE only — must not clobber title/ts written by the client.
  // Include `bucket` so a thread first surfaced by the server still lands in
  // the right list.
  try {
    await fsPatch(
      `users/${enc(uid)}/chatThreads/${enc(threadId)}`,
      { id: threadId, updatedAt: ts, bucket: bucket || 'coach' },
      { merge: true },
    );
  } catch (e) { /* thread bump is not fatal */ }
}

const app = express();
app.use(cors({
  origin: [
    'https://boostmind-b052c.web.app',
    'https://boostmind-b052c.firebaseapp.com',
    'http://localhost:5173',
    'http://localhost:4173',
  ],
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
    const chatMode = ['naming', 'onboarding', 'trainer'].includes(mode) ? mode : 'session';

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
      "This is their FIRST conversation. They know nothing yet. Your job is to make them feel in good hands.",
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

    const systemPrompt =
      chatMode === 'naming' ? namingPrompt
      : chatMode === 'onboarding' ? onboardingPrompt
      : chatMode === 'trainer' ? trainerPrompt
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

    const claudeResp = await anthropic.messages.create({
      model: CLAUDE_MODEL,
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

    // Detect the same truncation signals the client checks so the persisted
    // record matches what would render in-browser.
    const backtickFences = (text.match(/```/g) || []).length;
    const truncated =
      (claudeResp.stop_reason && claudeResp.stop_reason !== 'end_turn' && claudeResp.stop_reason !== 'stop_sequence')
      || (backtickFences % 2 !== 0);

    // Persist FIRST — this is the whole point of the server-side write.
    // Even if the client's fetch aborted (tab closed), the assistant message
    // still lands in Firestore and shows up next time the user opens the chat.
    if (threadId && typeof threadId === 'string') {
      try {
        await persistAssistantMessage({ uid, threadId, text, truncated, mode: chatMode, bucket });
      } catch (e) {
        console.warn('assistant persist failed', e?.message || e);
      }
    }

    res.json({
      text,
      stopReason: claudeResp.stop_reason,
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
      model: CLAUDE_MODEL,
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
      model: CLAUDE_MODEL,
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
      model: CLAUDE_MODEL,
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

app.listen(PORT, () => console.log(`workout-ai listening on :${PORT}`));
