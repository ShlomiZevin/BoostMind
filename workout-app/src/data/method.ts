import type { PlaceId } from '../places/registry';

// The method behind each place — what מצב actually believes about training and
// about eating. Two jobs, one text:
//
//   1. It is shown to the user ("העקרונות", from each place's settings), because a
//      coach that never states its principles just looks like it has opinions.
//   2. The same principles are written into that coach's system prompt on the
//      server, so it argues from them instead of improvising a philosophy per
//      answer.
//
// ⚠️ The server copy lives in `server/index.js` (trainerPrompt / dietaryPrompt,
// under "== התפיסה שאתה עובד לפיה =="). If you change a principle here, change
// it there too — otherwise the app teaches one thing and the coach another.

export type Principle = {
  /** Short enough to scan as a list. */
  title: string;
  /** Why it matters, in the coach's voice. Two or three lines, no lecturing. */
  body: string;
};

export type Method = {
  he: string;
  /** One line, the whole philosophy compressed. */
  essence: string;
  principles: Principle[];
};

export const METHOD: Record<PlaceId, Method> = {
  exercise: {
    he: 'העקרונות של מצב אימון',
    essence: 'לא כמה הרמת — כמה השריר באמת עבד, ובאיזה נפח לאורך השבוע.',
    principles: [
      {
        title: 'קשר מוח־שריר',
        body:
          'לפני כל סט, לדעת איזה שריר אמור לעבוד — ולהרגיש אותו עובד. אם אתה מרגיש ' +
          'את התרגיל בכל מקום חוץ מהשריר שהתכוונת אליו, המשקל גדול מדי או שהתנועה לא נכונה.',
      },
      {
        title: 'התנועה לפני המשקל',
        body:
          'טווח מלא, ירידה מבוקרת, בלי מומנטום ובלי לזרוק את המשקל. הירידה היא החלק ' +
          'שבונה — רוב האנשים ממהרים דווקא בה.',
      },
      {
        title: 'בלי אגו ליפטינג',
        body:
          'המשקל משרת את הטכניקה, לא הפוך. סט נקי עם פחות משקל שווה יותר מסט מכוער ' +
          'עם יותר. אף אחד לא מסתכל, והשריר לא יודע לספור קילוגרמים — הוא יודע מתח.',
      },
      {
        title: 'לדעת על מה אתה עובד',
        body:
          'כל תרגיל הוא בחירה של שריר. כשאתה יודע מה התרגיל אמור לעשות, אתה גם יודע ' +
          'מתי הוא לא עושה את זה — וזה מה שמאפשר לתקן במקום לחזור על טעות שבועות.',
      },
      {
        title: 'נפח שבועי, לא אימון בודד',
        body:
          'מה שמזיז את המחט זה כמה סטים איכותיים קיבל כל שריר במהלך השבוע. אימון אחד ' +
          'חזק לא מציל שבוע חסר, ואימון אחד חלש לא הורס אותו.',
      },
      {
        title: 'גיוון וסבב',
        body:
          'עוגנים קבועים שחוזרים אליהם תמיד, ומסביבם תרגילים שמתחלפים ותוקפים את השריר ' +
          'מזוויות שונות. ככה נמנעים מתקיעות בלי לאבד עקביות.',
      },
      {
        title: 'חימום, מתיחות והתאוששות',
        body:
          'שריר שלא התאושש לא גדל. מתיחות אחרי, שינה, וריווח בין אימונים לאותו שריר — ' +
          'זה חלק מהאימון, לא משהו שעושים אם נשאר זמן.',
      },
    ],
  },

  food: {
    he: 'העקרונות של מצב תזונה',
    essence: 'גירעון קלורי הוא המנוע, ושליטה בעקומת הגלוקוז היא מה שהופכת אותו לבר־קיימא.',
    principles: [
      {
        title: 'גירעון קלורי הוא המנוע',
        body:
          'ירידה במשקל היא לאכול פחות ממה ששורפים, לאורך זמן. זה הכול. למשוואה שני ' +
          'צדדים — פחות מצד האוכל, ויותר מצד התנועה — וביום אימון יש יותר מקום.',
      },
      {
        title: 'לשטח את עקומת הגלוקוז',
        body:
          'סוכר ופחמימות ריקות מקפיצים את הסוכר בדם ואז מפילים אותו. הנפילה הזו היא ' +
          'מה שמייצר את הדחף לנשנש שעה־שעתיים אחר כך. משטחים את העקומה — ולא צריך להילחם ברצון.',
      },
      {
        title: 'פחמימה אף פעם לא לבד',
        body:
          'חלבון, שומן או סיבים לפני הפחמימה באותה ארוחה. לחם לבד, פרי לבד או ממתק על ' +
          'בטן ריקה זו הקפיצה הכי חדה שיש — ואותו מאכל בדיוק, בתוך ארוחה, מתנהג אחרת לגמרי.',
      },
      {
        title: 'מתוק זה לא חטא — זה תזמון',
        body:
          'אין מאכלים אסורים. יש מאכלים שעולים יותר ויש רגעים שבהם הם עולים יותר. ' +
          'אחרי ארוחה במקום לפניה, ועם משהו לצידם — וזה כבר סיפור אחר.',
      },
      {
        title: 'חלבון הוא העוגן',
        body:
          'הוא משביע הכי הרבה זמן, שומר על השריר בזמן גירעון, וכמעט תמיד זה הרכיב ' +
          'שחסר. כשמתכננים ארוחה, מתחילים ממנו.',
      },
      {
        title: 'מתעדים כדי לדעת, לא כדי להישפט',
        body:
          'המספרים הם מידע, לא ציון. יום אחד גבוה לא הורס כלום, והנתון היחיד שמעניין ' +
          'הוא המגמה לאורך שבועות.',
      },
    ],
  },
};
