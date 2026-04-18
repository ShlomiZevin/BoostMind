export type LibraryExercise = {
  name: string;
  nameHe: string;
  muscle: string;
  muscleHe: string;
  category: string;
  isUnilateral: boolean;
  isTimeBased: boolean;
};

export const EXERCISE_LIBRARY: LibraryExercise[] = [
  // === CHEST / חזה ===
  { name: "Barbell bench press", nameHe: "לחיצת חזה מוט", muscle: "Chest", muscleHe: "חזה", category: "chest", isUnilateral: false, isTimeBased: false },
  { name: "Incline barbell bench press", nameHe: "לחיצת חזה משופע מוט", muscle: "Upper chest", muscleHe: "חזה עליון", category: "chest", isUnilateral: false, isTimeBased: false },
  { name: "Decline barbell bench press", nameHe: "לחיצת חזה שיפוע שלילי מוט", muscle: "Lower chest", muscleHe: "חזה תחתון", category: "chest", isUnilateral: false, isTimeBased: false },
  { name: "Dumbbell bench press", nameHe: "לחיצת חזה משקולות", muscle: "Chest", muscleHe: "חזה", category: "chest", isUnilateral: false, isTimeBased: false },
  { name: "Incline dumbbell press", nameHe: "לחיצת חזה משופע משקולות", muscle: "Upper chest", muscleHe: "חזה עליון", category: "chest", isUnilateral: false, isTimeBased: false },
  { name: "Single-arm incline DB press", nameHe: "לחיצת חזה משופע משקולת יד אחת", muscle: "Upper chest", muscleHe: "חזה עליון", category: "chest", isUnilateral: true, isTimeBased: false },
  { name: "Machine chest press", nameHe: "לחיצת חזה במכונה", muscle: "Chest", muscleHe: "חזה", category: "chest", isUnilateral: false, isTimeBased: false },
  { name: "Cable fly", nameHe: "פרפר בכבל", muscle: "Chest", muscleHe: "חזה", category: "chest", isUnilateral: false, isTimeBased: false },
  { name: "Single-arm cable fly", nameHe: "פרפר בכבל יד אחת", muscle: "Chest isolation", muscleHe: "חזה בידוד", category: "chest", isUnilateral: true, isTimeBased: false },
  { name: "Pec-deck fly", nameHe: "פרפר במכונה", muscle: "Chest", muscleHe: "חזה", category: "chest", isUnilateral: false, isTimeBased: false },
  { name: "Dumbbell fly", nameHe: "פרפר משקולות", muscle: "Chest", muscleHe: "חזה", category: "chest", isUnilateral: false, isTimeBased: false },
  { name: "Push-up", nameHe: "שכיבות סמיכה", muscle: "Chest", muscleHe: "חזה", category: "chest", isUnilateral: false, isTimeBased: false },
  { name: "Dips (chest)", nameHe: "מתח מקבילים (חזה)", muscle: "Chest + triceps", muscleHe: "חזה + טריצפס", category: "chest", isUnilateral: false, isTimeBased: false },

  // === BACK / גב ===
  { name: "Pull-up", nameHe: "מתח", muscle: "Lats", muscleHe: "רחב הגב", category: "back", isUnilateral: false, isTimeBased: false },
  { name: "Chin-up", nameHe: "מתח אחיזה הפוכה", muscle: "Lats + biceps", muscleHe: "רחב הגב + ביצפס", category: "back", isUnilateral: false, isTimeBased: false },
  { name: "Assisted pull-up", nameHe: "מתח בעזרה", muscle: "Lats", muscleHe: "רחב הגב", category: "back", isUnilateral: false, isTimeBased: false },
  { name: "Lat pulldown wide grip", nameHe: "הורדת פולי רחבה", muscle: "Lats", muscleHe: "רחב הגב", category: "back", isUnilateral: false, isTimeBased: false },
  { name: "Lat pulldown close grip", nameHe: "הורדת פולי צרה", muscle: "Lats + mid-back", muscleHe: "רחב הגב + גב אמצעי", category: "back", isUnilateral: false, isTimeBased: false },
  { name: "Single-arm cable lat pulldown", nameHe: "הורדת פולי גבוה יד אחת", muscle: "Lats", muscleHe: "רחב הגב", category: "back", isUnilateral: true, isTimeBased: false },
  { name: "Barbell row", nameHe: "חתירת מוט", muscle: "Mid-back + lats", muscleHe: "גב אמצעי + רחב הגב", category: "back", isUnilateral: false, isTimeBased: false },
  { name: "Dumbbell row", nameHe: "חתירה משקולת", muscle: "Mid-back + lats", muscleHe: "גב אמצעי + רחב הגב", category: "back", isUnilateral: false, isTimeBased: false },
  { name: "Single-arm dumbbell row", nameHe: "חתירה משקולת יד אחת", muscle: "Lats + mid-back", muscleHe: "רחב הגב + גב אמצעי", category: "back", isUnilateral: true, isTimeBased: false },
  { name: "Chest-supported row", nameHe: "חתירה על ספסל (סיל רואו)", muscle: "Mid-back + rhomboids", muscleHe: "גב אמצעי + רומבואידים", category: "back", isUnilateral: false, isTimeBased: false },
  { name: "Seated cable row", nameHe: "חתירת כבל בישיבה", muscle: "Mid-back + lats", muscleHe: "גב אמצעי + רחב הגב", category: "back", isUnilateral: false, isTimeBased: false },
  { name: "Single-arm seated cable row", nameHe: "חתירת כבל בישיבה יד אחת", muscle: "Mid-back + lats", muscleHe: "גב אמצעי + רחב הגב", category: "back", isUnilateral: true, isTimeBased: false },
  { name: "T-bar row", nameHe: "חתירת טי-בר", muscle: "Mid-back", muscleHe: "גב אמצעי", category: "back", isUnilateral: false, isTimeBased: false },
  { name: "Straight-arm pulldown", nameHe: "פולי ידיים ישרות", muscle: "Lats isolation", muscleHe: "רחב הגב בידוד", category: "back", isUnilateral: false, isTimeBased: false },
  { name: "Deadlift", nameHe: "דדליפט", muscle: "Back + hamstrings + glutes", muscleHe: "גב + אחוריים + ישבן", category: "back", isUnilateral: false, isTimeBased: false },

  // === SHOULDERS / כתפיים ===
  { name: "Barbell overhead press", nameHe: "לחיצת כתפיים מוט", muscle: "Front delt", muscleHe: "כתף קדמית", category: "shoulders", isUnilateral: false, isTimeBased: false },
  { name: "Dumbbell shoulder press", nameHe: "לחיצת כתפיים משקולות", muscle: "Front + side delt", muscleHe: "כתף קדמית + צדדית", category: "shoulders", isUnilateral: false, isTimeBased: false },
  { name: "Single-arm DB shoulder press", nameHe: "לחיצת כתפיים משקולת יד אחת", muscle: "Front + side delt", muscleHe: "כתף קדמית + צדדית", category: "shoulders", isUnilateral: true, isTimeBased: false },
  { name: "Machine shoulder press", nameHe: "לחיצת כתפיים במכונה", muscle: "Front delt", muscleHe: "כתף קדמית", category: "shoulders", isUnilateral: false, isTimeBased: false },
  { name: "Arnold press", nameHe: "לחיצת ארנולד", muscle: "Front + side delt", muscleHe: "כתף קדמית + צדדית", category: "shoulders", isUnilateral: false, isTimeBased: false },
  { name: "Dumbbell lateral raise", nameHe: "הרחקה צידית משקולת", muscle: "Side delt", muscleHe: "כתף צדדית", category: "shoulders", isUnilateral: false, isTimeBased: false },
  { name: "Cable lateral raise", nameHe: "הרחקה צידית בכבל", muscle: "Side delt", muscleHe: "כתף צדדית", category: "shoulders", isUnilateral: false, isTimeBased: false },
  { name: "Single-arm cable lateral raise", nameHe: "הרחקה צידית בכבל יד אחת", muscle: "Side delt", muscleHe: "כתף צדדית", category: "shoulders", isUnilateral: true, isTimeBased: false },
  { name: "Front raise", nameHe: "הרמה קדמית", muscle: "Front delt", muscleHe: "כתף קדמית", category: "shoulders", isUnilateral: false, isTimeBased: false },
  { name: "Face pull", nameHe: "פייס פול", muscle: "Rear delt + upper traps", muscleHe: "כתף אחורית + טרפז עליון", category: "shoulders", isUnilateral: false, isTimeBased: false },
  { name: "Reverse pec-deck", nameHe: "פק-דק הפוך", muscle: "Rear delt", muscleHe: "כתף אחורית", category: "shoulders", isUnilateral: false, isTimeBased: false },
  { name: "Rear delt fly (dumbbell)", nameHe: "פרפר אחורי משקולות", muscle: "Rear delt", muscleHe: "כתף אחורית", category: "shoulders", isUnilateral: false, isTimeBased: false },
  { name: "Single-arm cable rear delt fly", nameHe: "פרפר אחורי בכבל יד אחת", muscle: "Rear delt", muscleHe: "כתף אחורית", category: "shoulders", isUnilateral: true, isTimeBased: false },
  { name: "Barbell upright row", nameHe: "חתירה זקופה מוט", muscle: "Side delt + traps", muscleHe: "כתף צדדית + טרפז", category: "shoulders", isUnilateral: false, isTimeBased: false },
  { name: "Barbell shrug", nameHe: "שראגים מוט", muscle: "Upper traps", muscleHe: "טרפז עליון", category: "shoulders", isUnilateral: false, isTimeBased: false },
  { name: "Dumbbell shrug", nameHe: "שראגים משקולות", muscle: "Upper traps", muscleHe: "טרפז עליון", category: "shoulders", isUnilateral: false, isTimeBased: false },

  // === TRICEPS / טריצפס ===
  { name: "Cable tricep pushdown", nameHe: "פושדאון כבל", muscle: "Triceps", muscleHe: "טריצפס", category: "triceps", isUnilateral: false, isTimeBased: false },
  { name: "Single-arm cable tricep pushdown", nameHe: "פושדאון כבל יד אחת", muscle: "Triceps", muscleHe: "טריצפס", category: "triceps", isUnilateral: true, isTimeBased: false },
  { name: "Overhead tricep extension (cable)", nameHe: "טריצפס מעל הראש בכבל", muscle: "Triceps (long head)", muscleHe: "טריצפס (ראש ארוך)", category: "triceps", isUnilateral: false, isTimeBased: false },
  { name: "Single-arm overhead tricep extension", nameHe: "טריצפס מעל הראש יד אחת", muscle: "Triceps (long head)", muscleHe: "טריצפס (ראש ארוך)", category: "triceps", isUnilateral: true, isTimeBased: false },
  { name: "Single-arm cable tricep kickback", nameHe: "קיקבק כבל יד אחת", muscle: "Triceps", muscleHe: "טריצפס", category: "triceps", isUnilateral: true, isTimeBased: false },
  { name: "Skull crusher", nameHe: "סקאל קראשר", muscle: "Triceps", muscleHe: "טריצפס", category: "triceps", isUnilateral: false, isTimeBased: false },
  { name: "Close-grip bench press", nameHe: "לחיצת חזה אחיזה צרה", muscle: "Triceps + chest", muscleHe: "טריצפס + חזה", category: "triceps", isUnilateral: false, isTimeBased: false },
  { name: "Dips (triceps)", nameHe: "מתח מקבילים (טריצפס)", muscle: "Triceps", muscleHe: "טריצפס", category: "triceps", isUnilateral: false, isTimeBased: false },
  { name: "Diamond push-up", nameHe: "שכיבות סמיכה יהלום", muscle: "Triceps", muscleHe: "טריצפס", category: "triceps", isUnilateral: false, isTimeBased: false },

  // === BICEPS / ביצפס ===
  { name: "Barbell curl", nameHe: "כפיפת מרפקים מוט", muscle: "Biceps", muscleHe: "ביצפס", category: "biceps", isUnilateral: false, isTimeBased: false },
  { name: "EZ-bar curl", nameHe: "כפיפת מרפקים מוט EZ", muscle: "Biceps", muscleHe: "ביצפס", category: "biceps", isUnilateral: false, isTimeBased: false },
  { name: "Dumbbell curl", nameHe: "כפיפת מרפקים משקולות", muscle: "Biceps", muscleHe: "ביצפס", category: "biceps", isUnilateral: false, isTimeBased: false },
  { name: "Single-arm dumbbell curl", nameHe: "כפיפת מרפקים משקולת יד אחת", muscle: "Biceps", muscleHe: "ביצפס", category: "biceps", isUnilateral: true, isTimeBased: false },
  { name: "Hammer curl", nameHe: "כפיפת פטיש", muscle: "Biceps + brachialis", muscleHe: "ביצפס + ברכיאליס", category: "biceps", isUnilateral: false, isTimeBased: false },
  { name: "Cable curl", nameHe: "כפיפת מרפקים בכבל", muscle: "Biceps", muscleHe: "ביצפס", category: "biceps", isUnilateral: false, isTimeBased: false },
  { name: "Single-arm cable curl", nameHe: "כפיפת מרפקים כבל יד אחת", muscle: "Biceps", muscleHe: "ביצפס", category: "biceps", isUnilateral: true, isTimeBased: false },
  { name: "Preacher curl", nameHe: "כפיפת מרפקים על ספסל סקוט", muscle: "Biceps", muscleHe: "ביצפס", category: "biceps", isUnilateral: false, isTimeBased: false },
  { name: "Concentration curl", nameHe: "כפיפת ריכוז", muscle: "Biceps", muscleHe: "ביצפס", category: "biceps", isUnilateral: true, isTimeBased: false },
  { name: "Incline dumbbell curl", nameHe: "כפיפת מרפקים משופע", muscle: "Biceps (long head)", muscleHe: "ביצפס (ראש ארוך)", category: "biceps", isUnilateral: false, isTimeBased: false },

  // === QUADS / קוודריצפס ===
  { name: "Back squat", nameHe: "סקוואט מוט", muscle: "Quads + glutes", muscleHe: "קוודריצפס + ישבן", category: "quads", isUnilateral: false, isTimeBased: false },
  { name: "Front squat", nameHe: "סקוואט קדמי", muscle: "Quads", muscleHe: "קוודריצפס", category: "quads", isUnilateral: false, isTimeBased: false },
  { name: "Goblet squat", nameHe: "סקוואט גביע", muscle: "Quads + glutes", muscleHe: "קוודריצפס + ישבן", category: "quads", isUnilateral: false, isTimeBased: false },
  { name: "Leg press", nameHe: "לג פרס", muscle: "Quads + glutes", muscleHe: "קוודריצפס + ישבן", category: "quads", isUnilateral: false, isTimeBased: false },
  { name: "Hack squat", nameHe: "האק סקוואט", muscle: "Quads", muscleHe: "קוודריצפס", category: "quads", isUnilateral: false, isTimeBased: false },
  { name: "Bulgarian split squat", nameHe: "סקוואט בולגרי", muscle: "Quads + glutes", muscleHe: "קוודריצפס + ישבן", category: "quads", isUnilateral: true, isTimeBased: false },
  { name: "Lunge", nameHe: "לאנג'", muscle: "Quads + glutes", muscleHe: "קוודריצפס + ישבן", category: "quads", isUnilateral: true, isTimeBased: false },
  { name: "Walking lunge", nameHe: "לאנג' הליכה", muscle: "Quads + glutes", muscleHe: "קוודריצפס + ישבן", category: "quads", isUnilateral: true, isTimeBased: false },
  { name: "Leg extension", nameHe: "לג אקסטנשן", muscle: "Quads", muscleHe: "קוודריצפס", category: "quads", isUnilateral: false, isTimeBased: false },
  { name: "Step-up", nameHe: "סטפ-אפ", muscle: "Quads + glutes", muscleHe: "קוודריצפס + ישבן", category: "quads", isUnilateral: true, isTimeBased: false },
  { name: "Sissy squat", nameHe: "סיסי סקוואט", muscle: "Quads", muscleHe: "קוודריצפס", category: "quads", isUnilateral: false, isTimeBased: false },

  // === HAMSTRINGS / אחוריים ===
  { name: "Romanian deadlift (RDL)", nameHe: "דדליפט רומני", muscle: "Hamstrings + glutes", muscleHe: "אחוריים + ישבן", category: "hamstrings", isUnilateral: false, isTimeBased: false },
  { name: "Single-leg RDL", nameHe: "דדליפט רומני רגל אחת", muscle: "Hamstrings + glutes", muscleHe: "אחוריים + ישבן", category: "hamstrings", isUnilateral: true, isTimeBased: false },
  { name: "Leg curl (lying)", nameHe: "ליג קרל שכיבה", muscle: "Hamstrings", muscleHe: "אחוריים של הירך", category: "hamstrings", isUnilateral: false, isTimeBased: false },
  { name: "Leg curl (seated)", nameHe: "ליג קרל ישיבה", muscle: "Hamstrings", muscleHe: "אחוריים של הירך", category: "hamstrings", isUnilateral: false, isTimeBased: false },
  { name: "Nordic hamstring curl", nameHe: "נורדיק קרל", muscle: "Hamstrings", muscleHe: "אחוריים של הירך", category: "hamstrings", isUnilateral: false, isTimeBased: false },
  { name: "Good morning", nameHe: "גוד מורנינג", muscle: "Hamstrings + lower back", muscleHe: "אחוריים + גב תחתון", category: "hamstrings", isUnilateral: false, isTimeBased: false },
  { name: "Glute-ham raise", nameHe: "הרמת ישבן-אחוריים", muscle: "Hamstrings + glutes", muscleHe: "אחוריים + ישבן", category: "hamstrings", isUnilateral: false, isTimeBased: false },

  // === GLUTES / ישבן ===
  { name: "Hip thrust", nameHe: "היפ ת'ראסט", muscle: "Glutes", muscleHe: "ישבן", category: "glutes", isUnilateral: false, isTimeBased: false },
  { name: "Single-leg hip thrust", nameHe: "היפ ת'ראסט רגל אחת", muscle: "Glutes", muscleHe: "ישבן", category: "glutes", isUnilateral: true, isTimeBased: false },
  { name: "Glute bridge", nameHe: "גשר ישבן", muscle: "Glutes", muscleHe: "ישבן", category: "glutes", isUnilateral: false, isTimeBased: false },
  { name: "Cable kickback", nameHe: "קיקבק כבל לישבן", muscle: "Glutes", muscleHe: "ישבן", category: "glutes", isUnilateral: true, isTimeBased: false },
  { name: "Cable pull-through", nameHe: "משיכת כבל בין הרגליים", muscle: "Glutes + hamstrings", muscleHe: "ישבן + אחוריים", category: "glutes", isUnilateral: false, isTimeBased: false },

  // === CALVES / תאומים ===
  { name: "Standing calf raise", nameHe: "הרמת עקבים עמידה", muscle: "Calves", muscleHe: "תאומים", category: "calves", isUnilateral: false, isTimeBased: false },
  { name: "Single-leg calf raise", nameHe: "הרמת עקבים רגל אחת", muscle: "Calves", muscleHe: "תאומים", category: "calves", isUnilateral: true, isTimeBased: false },
  { name: "Seated calf raise", nameHe: "הרמת עקבים ישיבה", muscle: "Calves (soleus)", muscleHe: "תאומים (סוליאוס)", category: "calves", isUnilateral: false, isTimeBased: false },

  // === CORE / בטן ===
  { name: "Plank", nameHe: "פלאנק", muscle: "Core", muscleHe: "בטן", category: "core", isUnilateral: false, isTimeBased: true },
  { name: "Side plank", nameHe: "פלאנק צד", muscle: "Obliques", muscleHe: "בטן צדדית", category: "core", isUnilateral: true, isTimeBased: true },
  { name: "Plank + side plank", nameHe: "פלאנק + פלאנק צד", muscle: "Core + obliques", muscleHe: "בטן + בטן צדדית", category: "core", isUnilateral: true, isTimeBased: true },
  { name: "Cable wood chop", nameHe: "חיתוך עץ בכבל", muscle: "Obliques", muscleHe: "בטן צדדית", category: "core", isUnilateral: true, isTimeBased: false },
  { name: "Pallof press", nameHe: "Pallof press", muscle: "Core anti-rotation", muscleHe: "בטן אנטי-רוטציה", category: "core", isUnilateral: true, isTimeBased: false },
  { name: "Hanging leg raise", nameHe: "הרמת רגליים בתליה", muscle: "Core (lower abs)", muscleHe: "בטן תחתונה", category: "core", isUnilateral: false, isTimeBased: false },
  { name: "Cable crunch", nameHe: "כפיפת בטן בכבל", muscle: "Core", muscleHe: "בטן", category: "core", isUnilateral: false, isTimeBased: false },
  { name: "Ab wheel rollout", nameHe: "גלגל בטן", muscle: "Core", muscleHe: "בטן", category: "core", isUnilateral: false, isTimeBased: false },
  { name: "Russian twist", nameHe: "טוויסט רוסי", muscle: "Obliques", muscleHe: "בטן צדדית", category: "core", isUnilateral: false, isTimeBased: false },
  { name: "Dead bug", nameHe: "דד באג", muscle: "Core", muscleHe: "בטן", category: "core", isUnilateral: false, isTimeBased: false },
  { name: "Bird dog", nameHe: "בירד דוג", muscle: "Core + lower back", muscleHe: "בטן + גב תחתון", category: "core", isUnilateral: true, isTimeBased: false },
  { name: "Suitcase carry", nameHe: "נשיאת מזוודה", muscle: "Core + grip + traps", muscleHe: "בטן + אחיזה + טרפז", category: "core", isUnilateral: true, isTimeBased: true },
  { name: "Farmer's walk", nameHe: "הליכת חקלאי", muscle: "Core + grip + traps", muscleHe: "בטן + אחיזה + טרפז", category: "core", isUnilateral: false, isTimeBased: true },
];

export const MUSCLE_CATEGORIES = [
  { id: "chest", name: "Chest", nameHe: "חזה" },
  { id: "back", name: "Back", nameHe: "גב" },
  { id: "shoulders", name: "Shoulders", nameHe: "כתפיים" },
  { id: "triceps", name: "Triceps", nameHe: "טריצפס" },
  { id: "biceps", name: "Biceps", nameHe: "ביצפס" },
  { id: "quads", name: "Quads", nameHe: "קוודריצפס" },
  { id: "hamstrings", name: "Hamstrings", nameHe: "אחוריים" },
  { id: "glutes", name: "Glutes", nameHe: "ישבן" },
  { id: "calves", name: "Calves", nameHe: "תאומים" },
  { id: "core", name: "Core", nameHe: "בטן" },
];

export function searchExercises(query: string): LibraryExercise[] {
  if (query.length < 3) return [];
  const q = query.toLowerCase();
  return EXERCISE_LIBRARY.filter(ex =>
    ex.name.toLowerCase().includes(q) ||
    ex.nameHe.includes(query) ||
    ex.muscle.toLowerCase().includes(q) ||
    ex.muscleHe.includes(query)
  );
}
