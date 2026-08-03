import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const PORT = process.env.PORT || 8080;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('FATAL: ANTHROPIC_API_KEY not set');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const app = express();
app.use(cors({
  origin: [
    'https://boostmind-b052c.web.app',
    'https://boostmind-b052c.firebaseapp.com',
    'http://localhost:5173',
    'http://localhost:4173',
  ],
}));
app.use(express.json({ limit: '256kb' }));

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
    const { uid, messages, personalExercises, recentSets, sessionMuscles, mode, replaceContext } = req.body || {};
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
    const chatMode = mode === 'naming' ? 'naming' : 'session';

    // ─── Naming-mode system prompt ─────────────────────────────
    const namingPrompt = [
      "You are a naming consultant for a Hebrew-speaking athlete's exercise DB.",
      "The user wants your help to review, discuss, and rename exercises to be clearer.",
      "Reply in Hebrew unless the user writes in English. Be concise.",
      "",
      "== TASKS YOU HELP WITH ==",
      "- Review all names and flag ambiguous / poorly-named / duplicate entries",
      "- Suggest a better name for a specific exercise the user mentions",
      "- Discuss naming conventions (structured Hebrew template)",
      "- Propose adding a missing English name",
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
      "{\"type\":\"suggest_exercise\",\"name\":\"<Hebrew name>\",\"en\":\"<English name>\",\"muscle\":\"<muscle key>\",\"isNew\":true|false,\"howTo\":[\"<step 1>\",\"<step 2>\",\"<step 3>\"]}",
      "```",
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

    const systemPrompt = chatMode === 'naming' ? namingPrompt : sessionPrompt;

    const claudeResp = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) })),
    });

    // Concatenate text parts
    const text = claudeResp.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    res.json({
      text,
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

app.listen(PORT, () => console.log(`workout-ai listening on :${PORT}`));
