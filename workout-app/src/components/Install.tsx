import { useMemo } from 'react';
import type { Route } from '../types';
import { TopBar } from './TopBar';
import { CloseAction } from './TopBarActions';

type Props = {
  navigate: (route: Route) => void;
};

type Platform = 'ios' | 'android' | 'desktop';

function detectPlatform(): Platform {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function Install({ navigate }: Props) {
  const platform = useMemo(detectPlatform, []);

  return (
    <div className="page-bg min-h-screen">
      <TopBar
        title="התקנה למסך הבית"
        accent="brand"
        tint="blue"
        actions={<CloseAction navigate={navigate} />}
      />
      <div className="p-4 pb-8 max-w-lg mx-auto space-y-4" dir="rtl">
        {/* Intro card */}
        <div className="card">
          <div className="flex items-start gap-3 text-right">
            <div className="w-12 h-12 rounded-2xl bg-blue-500 flex items-center justify-center shrink-0 text-white">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="3" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-base">מוסיפים למסך הבית — כמו אפליקציה אמיתית</div>
              <div className="text-xs text-muted mt-1 leading-relaxed">
                האפליקציה היא PWA — לא נמצאת בחנויות, אבל אפשר להוסיף אותה למסך הבית ולפתוח במסך מלא בלי סרגלי דפדפן.
                אייקון על המסך, טעינה מהירה, אופליין לחלק מהדברים.
              </div>
            </div>
          </div>
        </div>

        {/* iOS */}
        <section
          id="ios"
          className={`card !p-0 overflow-hidden ${platform === 'ios' ? 'ring-2 ring-blue-500/50' : ''}`}
        >
          <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
              </span>
              <div className="text-right">
                <div className="font-bold text-sm">iPhone / iPad</div>
                <div className="text-[11px] text-muted">Safari בלבד</div>
              </div>
            </div>
            {platform === 'ios' && (
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-blue-500 text-white uppercase tracking-widest">כרגע</span>
            )}
          </div>
          <ol className="p-4 space-y-3 text-sm">
            <Step
              n={1}
              title="פתחו את הדף ב-Safari"
              body="לא Chrome, לא אפליקציית סושיאל. חייבים את Safari (בגלל מגבלה של אפל)."
            />
            <Step
              n={2}
              title={<>לחצו על כפתור <ShareIcon /> שיתוף</>}
              body='במרכז הסרגל התחתון (או למעלה בדפדפן חדש) — מרובע עם חץ כלפי מעלה.'
            />
            <Step
              n={3}
              title={<>גללו וגעו ב-<span className="font-mono text-xs">"הוסף למסך הבית"</span></>}
              body="בתפריט השיתוף. אם לא רואים — גללו קצת למטה ברשימה."
            />
            <Step
              n={4}
              title='לחצו "הוסף"'
              body="בפינה הימנית העליונה. האייקון יופיע מיד על מסך הבית."
            />
          </ol>
        </section>

        {/* Android */}
        <section
          id="android"
          className={`card !p-0 overflow-hidden ${platform === 'android' ? 'ring-2 ring-blue-500/50' : ''}`}
        >
          <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M17.6 9.48l1.84-3.18a.5.5 0 0 0-.87-.5L16.7 9.03A11.05 11.05 0 0 0 12 8c-1.7 0-3.3.36-4.7 1.03L5.43 5.8a.5.5 0 0 0-.87.5L6.4 9.48A10.5 10.5 0 0 0 1 18h22a10.5 10.5 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" />
                </svg>
              </span>
              <div className="text-right">
                <div className="font-bold text-sm">Android</div>
                <div className="text-[11px] text-muted">Chrome / Edge / Samsung Internet</div>
              </div>
            </div>
            {platform === 'android' && (
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-blue-500 text-white uppercase tracking-widest">כרגע</span>
            )}
          </div>
          <ol className="p-4 space-y-3 text-sm">
            <Step
              n={1}
              title="פתחו את הדף ב-Chrome"
              body="או Edge / Samsung Internet — כל דפדפן מודרני עובד."
            />
            <Step
              n={2}
              title={<>לחצו על תפריט <MoreIcon /></>}
              body="שלוש הנקודות בפינה הימנית העליונה של הדפדפן."
            />
            <Step
              n={3}
              title={<>בחרו <span className="font-mono text-xs">"התקן אפליקציה"</span> או <span className="font-mono text-xs">"הוסף למסך הבית"</span></>}
              body='הכיתוב משתנה בין דפדפנים. שניהם עושים אותו דבר.'
            />
            <Step
              n={4}
              title='אשרו את ההתקנה'
              body="האייקון יופיע במגירת האפליקציות ובמסך הבית."
            />
          </ol>
        </section>

        {/* Desktop bonus */}
        <details className="card">
          <summary className="cursor-pointer text-sm font-semibold text-right">
            גם על המחשב? כן — Chrome / Edge
          </summary>
          <div className="text-xs text-muted mt-2 leading-relaxed text-right">
            בשורת הכתובת של הדפדפן יופיע אייקון קטן של התקנה (מסך עם חץ) — לחיצה עליו תתקין את האפליקציה כמו תוכנה רגילה.
            אם לא רואים — תפריט <span dir="ltr" className="font-mono">⋮</span> ← <span className="font-mono">Install app</span>.
          </div>
        </details>

        <div className="text-[11px] text-muted-most text-center py-4">
          זה עובד? האפליקציה תיפתח מהר, במסך מלא, בלי סרגלי הדפדפן — כמו כל אפליקציה אחרת.
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: React.ReactNode; body: string }) {
  return (
    <li className="flex items-start gap-3 text-right">
      <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">
        {n}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium flex items-center gap-1.5 flex-wrap justify-end">{title}</div>
        <div className="text-[11px] text-muted mt-0.5 leading-relaxed">{body}</div>
      </div>
    </li>
  );
}

function ShareIcon() {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 align-text-bottom">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
    </span>
  );
}
function MoreIcon() {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 align-text-bottom font-bold text-xs">
      ⋮
    </span>
  );
}
