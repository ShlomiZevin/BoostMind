const IMG = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

export type LibraryExercise = {
  name: string;
  nameHe: string;
  muscle: string;
  muscleHe: string;
  category: string;
  isUnilateral: boolean;
  isTimeBased: boolean;
  imageUrl?: string;
};

export const EXERCISE_LIBRARY: LibraryExercise[] = [
  // === CHEST / חזה ===
  { name: "Barbell bench press", nameHe: "לחיצת חזה מוט", muscle: "Chest", muscleHe: "חזה", category: "chest", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Barbell_Bench_Press_-_Medium_Grip/0.jpg` },
  { name: "Incline barbell bench press", nameHe: "לחיצת חזה משופע מוט", muscle: "Upper chest", muscleHe: "חזה עליון", category: "chest", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Barbell_Incline_Bench_Press_-_Medium_Grip/0.jpg` },
  { name: "Decline barbell bench press", nameHe: "לחיצת חזה שיפוע שלילי מוט", muscle: "Lower chest", muscleHe: "חזה תחתון", category: "chest", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Decline_Barbell_Bench_Press/0.jpg` },
  { name: "Dumbbell bench press", nameHe: "לחיצת חזה משקולות", muscle: "Chest", muscleHe: "חזה", category: "chest", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Dumbbell_Bench_Press/0.jpg` },
  { name: "Incline dumbbell press", nameHe: "לחיצת חזה משופע משקולות", muscle: "Upper chest", muscleHe: "חזה עליון", category: "chest", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Incline_Dumbbell_Press/0.jpg` },
  { name: "Single-arm incline DB press", nameHe: "לחיצת חזה משופע משקולת יד אחת", muscle: "Upper chest", muscleHe: "חזה עליון", category: "chest", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/One_Arm_Dumbbell_Bench_Press/0.jpg` },
  { name: "Machine chest press", nameHe: "לחיצת חזה במכונה", muscle: "Chest", muscleHe: "חזה", category: "chest", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Leverage_Chest_Press/0.jpg` },
  { name: "Cable fly", nameHe: "פרפר בכבל", muscle: "Chest", muscleHe: "חזה", category: "chest", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Cable_Crossover/0.jpg` },
  { name: "Single-arm cable fly", nameHe: "פרפר בכבל יד אחת", muscle: "Chest isolation", muscleHe: "חזה בידוד", category: "chest", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/Single-Arm_Cable_Crossover/0.jpg` },
  { name: "Pec-deck fly", nameHe: "פרפר במכונה", muscle: "Chest", muscleHe: "חזה", category: "chest", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Butterfly/0.jpg` },
  { name: "Dumbbell fly", nameHe: "פרפר משקולות", muscle: "Chest", muscleHe: "חזה", category: "chest", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Dumbbell_Flyes/0.jpg` },
  { name: "Push-up", nameHe: "שכיבות סמיכה", muscle: "Chest", muscleHe: "חזה", category: "chest", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Pushups/0.jpg` },
  { name: "Dips (chest)", nameHe: "מתח מקבילים (חזה)", muscle: "Chest + triceps", muscleHe: "חזה + טריצפס", category: "chest", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Dips_-_Chest_Version/0.jpg` },
  { name: "Single-arm incline cable fly", nameHe: "פרפר משופע בכבל יד אחת", muscle: "Upper chest", muscleHe: "חזה עליון", category: "chest", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/Incline_Cable_Flye/0.jpg` },

  // === BACK / גב ===
  { name: "Pull-up", nameHe: "מתח", muscle: "Lats", muscleHe: "רחב הגב", category: "back", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Pullups/0.jpg` },
  { name: "Chin-up", nameHe: "מתח אחיזה הפוכה", muscle: "Lats + biceps", muscleHe: "רחב הגב + ביצפס", category: "back", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Chin-Up/0.jpg` },
  { name: "Assisted pull-up", nameHe: "מתח בעזרה", muscle: "Lats", muscleHe: "רחב הגב", category: "back", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Band_Assisted_Pull-Up/0.jpg` },
  { name: "Lat pulldown wide grip", nameHe: "הורדת פולי רחבה", muscle: "Lats", muscleHe: "רחב הגב", category: "back", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Wide-Grip_Lat_Pulldown/0.jpg` },
  { name: "Lat pulldown close grip", nameHe: "הורדת פולי צרה", muscle: "Lats + mid-back", muscleHe: "רחב הגב + גב אמצעי", category: "back", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Close-Grip_Front_Lat_Pulldown/0.jpg` },
  { name: "Single-arm cable lat pulldown", nameHe: "הורדת פולי גבוה יד אחת", muscle: "Lats", muscleHe: "רחב הגב", category: "back", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/One_Arm_Lat_Pulldown/0.jpg` },
  { name: "Barbell row", nameHe: "חתירת מוט", muscle: "Mid-back + lats", muscleHe: "גב אמצעי + רחב הגב", category: "back", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Bent_Over_Barbell_Row/0.jpg` },
  { name: "Dumbbell row", nameHe: "חתירה משקולת", muscle: "Mid-back + lats", muscleHe: "גב אמצעי + רחב הגב", category: "back", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Bent_Over_Two-Dumbbell_Row/0.jpg` },
  { name: "Single-arm dumbbell row", nameHe: "חתירה משקולת יד אחת", muscle: "Lats + mid-back", muscleHe: "רחב הגב + גב אמצעי", category: "back", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/One-Arm_Dumbbell_Row/0.jpg` },
  { name: "Chest-supported row", nameHe: "חתירה על ספסל (סיל רואו)", muscle: "Mid-back + rhomboids", muscleHe: "גב אמצעי + רומבואידים", category: "back", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Incline_Bench_Pull/0.jpg` },
  { name: "Seated cable row", nameHe: "חתירת כבל בישיבה", muscle: "Mid-back + lats", muscleHe: "גב אמצעי + רחב הגב", category: "back", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Seated_Cable_Rows/0.jpg` },
  { name: "Single-arm seated cable row", nameHe: "חתירת כבל בישיבה יד אחת", muscle: "Mid-back + lats", muscleHe: "גב אמצעי + רחב הגב", category: "back", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/Seated_One-arm_Cable_Pulley_Rows/0.jpg` },
  { name: "T-bar row", nameHe: "חתירת טי-בר", muscle: "Mid-back", muscleHe: "גב אמצעי", category: "back", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/T-Bar_Row_with_Handle/0.jpg` },
  { name: "Straight-arm pulldown", nameHe: "פולי ידיים ישרות", muscle: "Lats isolation", muscleHe: "רחב הגב בידוד", category: "back", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Straight-Arm_Pulldown/0.jpg` },
  { name: "Deadlift", nameHe: "דדליפט", muscle: "Back + hamstrings + glutes", muscleHe: "גב + אחוריים + ישבן", category: "back", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Barbell_Deadlift/0.jpg` },

  // === SHOULDERS / כתפיים ===
  { name: "Barbell overhead press", nameHe: "לחיצת כתפיים מוט", muscle: "Front delt", muscleHe: "כתף קדמית", category: "shoulders", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Barbell_Shoulder_Press/0.jpg` },
  { name: "Dumbbell shoulder press", nameHe: "לחיצת כתפיים משקולות", muscle: "Front + side delt", muscleHe: "כתף קדמית + צדדית", category: "shoulders", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Dumbbell_Shoulder_Press/0.jpg` },
  { name: "Single-arm DB shoulder press", nameHe: "לחיצת כתפיים משקולת יד אחת", muscle: "Front + side delt", muscleHe: "כתף קדמית + צדדית", category: "shoulders", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/Dumbbell_One-Arm_Shoulder_Press/0.jpg` },
  { name: "Machine shoulder press", nameHe: "לחיצת כתפיים במכונה", muscle: "Front delt", muscleHe: "כתף קדמית", category: "shoulders", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Leverage_Shoulder_Press/0.jpg` },
  { name: "Arnold press", nameHe: "לחיצת ארנולד", muscle: "Front + side delt", muscleHe: "כתף קדמית + צדדית", category: "shoulders", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Arnold_Dumbbell_Press/0.jpg` },
  { name: "Dumbbell lateral raise", nameHe: "הרחקה צידית משקולת", muscle: "Side delt", muscleHe: "כתף צדדית", category: "shoulders", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Side_Lateral_Raise/0.jpg` },
  { name: "Cable lateral raise", nameHe: "הרחקה צידית בכבל", muscle: "Side delt", muscleHe: "כתף צדדית", category: "shoulders", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Cable_Seated_Lateral_Raise/0.jpg` },
  { name: "Single-arm cable lateral raise", nameHe: "הרחקה צידית בכבל יד אחת", muscle: "Side delt", muscleHe: "כתף צדדית", category: "shoulders", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/One-Arm_Side_Laterals/0.jpg` },
  { name: "Front raise", nameHe: "הרמה קדמית", muscle: "Front delt", muscleHe: "כתף קדמית", category: "shoulders", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Front_Dumbbell_Raise/0.jpg` },
  { name: "Face pull", nameHe: "פייס פול", muscle: "Rear delt + upper traps", muscleHe: "כתף אחורית + טרפז עליון", category: "shoulders", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Face_Pull/0.jpg` },
  { name: "Reverse pec-deck", nameHe: "פק-דק הפוך", muscle: "Rear delt", muscleHe: "כתף אחורית", category: "shoulders", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Reverse_Machine_Flyes/0.jpg` },
  { name: "Rear delt fly (dumbbell)", nameHe: "פרפר אחורי משקולות", muscle: "Rear delt", muscleHe: "כתף אחורית", category: "shoulders", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Seated_Bent-Over_Rear_Delt_Raise/0.jpg` },
  { name: "Single-arm cable rear delt fly", nameHe: "פרפר אחורי בכבל יד אחת", muscle: "Rear delt", muscleHe: "כתף אחורית", category: "shoulders", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/Cable_Rear_Delt_Fly/0.jpg` },
  { name: "Barbell upright row", nameHe: "חתירה זקופה מוט", muscle: "Side delt + traps", muscleHe: "כתף צדדית + טרפז", category: "shoulders", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Upright_Barbell_Row/0.jpg` },
  { name: "Barbell shrug", nameHe: "שראגים מוט", muscle: "Upper traps", muscleHe: "טרפז עליון", category: "shoulders", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Barbell_Shrug/0.jpg` },
  { name: "Dumbbell shrug", nameHe: "שראגים משקולות", muscle: "Upper traps", muscleHe: "טרפז עליון", category: "shoulders", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Dumbbell_Shrug/0.jpg` },

  // === TRICEPS / טריצפס ===
  { name: "Cable tricep pushdown", nameHe: "פושדאון כבל", muscle: "Triceps", muscleHe: "טריצפס", category: "triceps", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Triceps_Pushdown/0.jpg` },
  { name: "Single-arm cable tricep pushdown", nameHe: "פושדאון כבל יד אחת", muscle: "Triceps", muscleHe: "טריצפס", category: "triceps", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/Triceps_Pushdown_-_Rope_Attachment/0.jpg` },
  { name: "Overhead tricep extension (cable)", nameHe: "טריצפס מעל הראש בכבל", muscle: "Triceps (long head)", muscleHe: "טריצפס (ראש ארוך)", category: "triceps", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Cable_Rope_Overhead_Triceps_Extension/0.jpg` },
  { name: "Single-arm overhead tricep extension", nameHe: "טריצפס מעל הראש יד אחת", muscle: "Triceps (long head)", muscleHe: "טריצפס (ראש ארוך)", category: "triceps", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/Standing_One-Arm_Dumbbell_Triceps_Extension/0.jpg` },
  { name: "Single-arm cable tricep kickback", nameHe: "קיקבק כבל יד אחת", muscle: "Triceps", muscleHe: "טריצפס", category: "triceps", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/Tricep_Dumbbell_Kickback/0.jpg` },
  { name: "Skull crusher", nameHe: "סקאל קראשר", muscle: "Triceps", muscleHe: "טריצפס", category: "triceps", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/EZ-Bar_Skullcrusher/0.jpg` },
  { name: "Close-grip bench press", nameHe: "לחיצת חזה אחיזה צרה", muscle: "Triceps + chest", muscleHe: "טריצפס + חזה", category: "triceps", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Close-Grip_Barbell_Bench_Press/0.jpg` },
  { name: "Dips (triceps)", nameHe: "מתח מקבילים (טריצפס)", muscle: "Triceps", muscleHe: "טריצפס", category: "triceps", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Dips_-_Triceps_Version/0.jpg` },
  { name: "Diamond push-up", nameHe: "שכיבות סמיכה יהלום", muscle: "Triceps", muscleHe: "טריצפס", category: "triceps", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Push-Ups_-_Close_Triceps_Position/0.jpg` },
  { name: "Dips (chest + triceps)", nameHe: "מתח מקבילים (חזה + טריצפס)", muscle: "Chest + triceps", muscleHe: "חזה + טריצפס", category: "triceps", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Dips_-_Chest_Version/0.jpg` },

  // === BICEPS / ביצפס ===
  { name: "Barbell curl", nameHe: "כפיפת מרפקים מוט", muscle: "Biceps", muscleHe: "ביצפס", category: "biceps", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Barbell_Curl/0.jpg` },
  { name: "EZ-bar curl", nameHe: "כפיפת מרפקים מוט EZ", muscle: "Biceps", muscleHe: "ביצפס", category: "biceps", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/EZ-Bar_Curl/0.jpg` },
  { name: "Dumbbell curl", nameHe: "כפיפת מרפקים משקולות", muscle: "Biceps", muscleHe: "ביצפס", category: "biceps", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Dumbbell_Bicep_Curl/0.jpg` },
  { name: "Single-arm dumbbell curl", nameHe: "כפיפת מרפקים משקולת יד אחת", muscle: "Biceps", muscleHe: "ביצפס", category: "biceps", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/Dumbbell_Alternate_Bicep_Curl/0.jpg` },
  { name: "Hammer curl", nameHe: "כפיפת פטיש", muscle: "Biceps + brachialis", muscleHe: "ביצפס + ברכיאליס", category: "biceps", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Hammer_Curls/0.jpg` },
  { name: "Cable curl", nameHe: "כפיפת מרפקים בכבל", muscle: "Biceps", muscleHe: "ביצפס", category: "biceps", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Standing_Biceps_Cable_Curl/0.jpg` },
  { name: "Single-arm cable curl", nameHe: "כפיפת מרפקים כבל יד אחת", muscle: "Biceps", muscleHe: "ביצפס", category: "biceps", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/Standing_One-Arm_Cable_Curl/0.jpg` },
  { name: "Bilateral cable curl", nameHe: "כפיפת מרפקים בכבל", muscle: "Biceps", muscleHe: "ביצפס", category: "biceps", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Standing_Biceps_Cable_Curl/0.jpg` },
  { name: "Preacher curl", nameHe: "כפיפת מרפקים על ספסל סקוט", muscle: "Biceps", muscleHe: "ביצפס", category: "biceps", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Preacher_Curl/0.jpg` },
  { name: "Concentration curl", nameHe: "כפיפת ריכוז", muscle: "Biceps", muscleHe: "ביצפס", category: "biceps", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/Concentration_Curls/0.jpg` },
  { name: "Incline dumbbell curl", nameHe: "כפיפת מרפקים משופע", muscle: "Biceps (long head)", muscleHe: "ביצפס (ראש ארוך)", category: "biceps", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Incline_Dumbbell_Curl/0.jpg` },

  // === QUADS / קוודריצפס ===
  { name: "Back squat", nameHe: "סקוואט מוט", muscle: "Quads + glutes", muscleHe: "קוודריצפס + ישבן", category: "quads", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Barbell_Squat/0.jpg` },
  { name: "Back squat / Leg press", nameHe: "סקוואט מוט / לג פרס", muscle: "Quads + glutes", muscleHe: "קוודריצפס + ישבן", category: "quads", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Barbell_Squat/0.jpg` },
  { name: "Front squat", nameHe: "סקוואט קדמי", muscle: "Quads", muscleHe: "קוודריצפס", category: "quads", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Front_Barbell_Squat/0.jpg` },
  { name: "Goblet squat", nameHe: "סקוואט גביע", muscle: "Quads + glutes", muscleHe: "קוודריצפס + ישבן", category: "quads", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Goblet_Squat/0.jpg` },
  { name: "Leg press", nameHe: "לג פרס", muscle: "Quads + glutes", muscleHe: "קוודריצפס + ישבן", category: "quads", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Leg_Press/0.jpg` },
  { name: "Hack squat", nameHe: "האק סקוואט", muscle: "Quads", muscleHe: "קוודריצפס", category: "quads", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Hack_Squat/0.jpg` },
  { name: "Bulgarian split squat", nameHe: "סקוואט בולגרי", muscle: "Quads + glutes", muscleHe: "קוודריצפס + ישבן", category: "quads", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/Split_Squats/0.jpg` },
  { name: "Lunge", nameHe: "לאנג'", muscle: "Quads + glutes", muscleHe: "קוודריצפס + ישבן", category: "quads", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/Dumbbell_Lunges/0.jpg` },
  { name: "Walking lunge", nameHe: "לאנג' הליכה", muscle: "Quads + glutes", muscleHe: "קוודריצפס + ישבן", category: "quads", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/Bodyweight_Walking_Lunge/0.jpg` },
  { name: "Leg extension", nameHe: "לג אקסטנשן", muscle: "Quads", muscleHe: "קוודריצפס", category: "quads", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Leg_Extensions/0.jpg` },
  { name: "Step-up", nameHe: "סטפ-אפ", muscle: "Quads + glutes", muscleHe: "קוודריצפס + ישבן", category: "quads", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/Barbell_Step_Ups/0.jpg` },
  { name: "Sissy squat", nameHe: "סיסי סקוואט", muscle: "Quads", muscleHe: "קוודריצפס", category: "quads", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Weighted_Sissy_Squat/0.jpg` },

  // === HAMSTRINGS / אחוריים ===
  { name: "Romanian deadlift (RDL)", nameHe: "דדליפט רומני", muscle: "Hamstrings + glutes", muscleHe: "אחוריים + ישבן", category: "hamstrings", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Romanian_Deadlift/0.jpg` },
  { name: "Single-leg RDL", nameHe: "דדליפט רומני רגל אחת", muscle: "Hamstrings + glutes", muscleHe: "אחוריים + ישבן", category: "hamstrings", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/Kettlebell_One-Legged_Deadlift/0.jpg` },
  { name: "Leg curl (lying)", nameHe: "ליג קרל שכיבה", muscle: "Hamstrings", muscleHe: "אחוריים של הירך", category: "hamstrings", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Lying_Leg_Curls/0.jpg` },
  { name: "Leg curl (seated)", nameHe: "ליג קרל ישיבה", muscle: "Hamstrings", muscleHe: "אחוריים של הירך", category: "hamstrings", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Seated_Leg_Curl/0.jpg` },
  { name: "Leg curl", nameHe: "ליג קרל", muscle: "Hamstrings", muscleHe: "אחוריים של הירך", category: "hamstrings", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Lying_Leg_Curls/0.jpg` },
  { name: "Nordic hamstring curl", nameHe: "נורדיק קרל", muscle: "Hamstrings", muscleHe: "אחוריים של הירך", category: "hamstrings", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Natural_Glute_Ham_Raise/0.jpg` },
  { name: "Good morning", nameHe: "גוד מורנינג", muscle: "Hamstrings + lower back", muscleHe: "אחוריים + גב תחתון", category: "hamstrings", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Good_Morning/0.jpg` },
  { name: "Glute-ham raise", nameHe: "הרמת ישבן-אחוריים", muscle: "Hamstrings + glutes", muscleHe: "אחוריים + ישבן", category: "hamstrings", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Glute_Ham_Raise/0.jpg` },

  // === GLUTES / ישבן ===
  { name: "Hip thrust", nameHe: "היפ ת'ראסט", muscle: "Glutes", muscleHe: "ישבן", category: "glutes", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Barbell_Hip_Thrust/0.jpg` },
  { name: "Single-leg hip thrust", nameHe: "היפ ת'ראסט רגל אחת", muscle: "Glutes", muscleHe: "ישבן", category: "glutes", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/Single_Leg_Glute_Bridge/0.jpg` },
  { name: "Glute bridge", nameHe: "גשר ישבן", muscle: "Glutes", muscleHe: "ישבן", category: "glutes", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Barbell_Glute_Bridge/0.jpg` },
  { name: "Cable kickback", nameHe: "קיקבק כבל לישבן", muscle: "Glutes", muscleHe: "ישבן", category: "glutes", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/One-Legged_Cable_Kickback/0.jpg` },
  { name: "Cable pull-through", nameHe: "משיכת כבל בין הרגליים", muscle: "Glutes + hamstrings", muscleHe: "ישבן + אחוריים", category: "glutes", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Pull_Through/0.jpg` },

  // === CALVES / תאומים ===
  { name: "Standing calf raise", nameHe: "הרמת עקבים עמידה", muscle: "Calves", muscleHe: "תאומים", category: "calves", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Standing_Calf_Raises/0.jpg` },
  { name: "Single-leg calf raise", nameHe: "הרמת עקבים רגל אחת", muscle: "Calves", muscleHe: "תאומים", category: "calves", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/Standing_Dumbbell_Calf_Raise/0.jpg` },
  { name: "Seated calf raise", nameHe: "הרמת עקבים ישיבה", muscle: "Calves (soleus)", muscleHe: "תאומים (סוליאוס)", category: "calves", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Seated_Calf_Raise/0.jpg` },

  // === CORE / בטן ===
  { name: "Plank", nameHe: "פלאנק", muscle: "Core", muscleHe: "בטן", category: "core", isUnilateral: false, isTimeBased: true, imageUrl: `${IMG}/Plank/0.jpg` },
  { name: "Side plank", nameHe: "פלאנק צד", muscle: "Obliques", muscleHe: "בטן צדדית", category: "core", isUnilateral: true, isTimeBased: true, imageUrl: `${IMG}/Side_Bridge/0.jpg` },
  { name: "Plank + side plank", nameHe: "פלאנק + פלאנק צד", muscle: "Core + obliques", muscleHe: "בטן + בטן צדדית", category: "core", isUnilateral: true, isTimeBased: true, imageUrl: `${IMG}/Plank/0.jpg` },
  { name: "Cable wood chop", nameHe: "חיתוך עץ בכבל", muscle: "Obliques", muscleHe: "בטן צדדית", category: "core", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/Standing_Cable_Wood_Chop/0.jpg` },
  { name: "Pallof press", nameHe: "Pallof press", muscle: "Core anti-rotation", muscleHe: "בטן אנטי-רוטציה", category: "core", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/Pallof_Press/0.jpg` },
  { name: "Hanging leg raise", nameHe: "הרמת רגליים בתליה", muscle: "Core (lower abs)", muscleHe: "בטן תחתונה", category: "core", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Hanging_Leg_Raise/0.jpg` },
  { name: "Cable crunch", nameHe: "כפיפת בטן בכבל", muscle: "Core", muscleHe: "בטן", category: "core", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Cable_Crunch/0.jpg` },
  { name: "Ab wheel rollout", nameHe: "גלגל בטן", muscle: "Core", muscleHe: "בטן", category: "core", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Ab_Roller/0.jpg` },
  { name: "Russian twist", nameHe: "טוויסט רוסי", muscle: "Obliques", muscleHe: "בטן צדדית", category: "core", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Russian_Twist/0.jpg` },
  { name: "Dead bug", nameHe: "דד באג", muscle: "Core", muscleHe: "בטן", category: "core", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Dead_Bug/0.jpg` },
  { name: "Bird dog", nameHe: "בירד דוג", muscle: "Core + lower back", muscleHe: "בטן + גב תחתון", category: "core", isUnilateral: true, isTimeBased: false },
  { name: "Suitcase carry", nameHe: "נשיאת מזוודה", muscle: "Core + grip + traps", muscleHe: "בטן + אחיזה + טרפז", category: "core", isUnilateral: true, isTimeBased: true, imageUrl: `${IMG}/Farmers_Walk/0.jpg` },
  { name: "Farmer's walk", nameHe: "הליכת חקלאי", muscle: "Core + grip + traps", muscleHe: "בטן + אחיזה + טרפז", category: "core", isUnilateral: false, isTimeBased: true, imageUrl: `${IMG}/Farmers_Walk/0.jpg` },
  { name: "Weighted side bend on Roman chair", nameHe: "כפיפה צידית על ספסל גב עם משקל", muscle: "Obliques", muscleHe: "בטן צדדית", category: "core", isUnilateral: true, isTimeBased: false, imageUrl: `${IMG}/Dumbbell_Side_Bend/0.jpg` },
  { name: "Abs (your choice)", nameHe: "בטן (לבחירתך)", muscle: "Abs", muscleHe: "בטן", category: "core", isUnilateral: false, isTimeBased: false, imageUrl: `${IMG}/Crunches/0.jpg` },
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
