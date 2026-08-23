import type { Route } from '../types';
import { TopBar } from './TopBar';
import { CloseAction } from './TopBarActions';
import { AnalyticsAdmin } from './AnalyticsAdmin';

// Full-screen launch dashboard. Bookmarkable at #/admin so you can pull it up
// with one tap during the day. Gated in AppShell to `user_6724`; anyone else
// hitting the URL gets redirected home.
//
// The heavy work (queries, layout, funnel, sources, user list) all lives in
// AnalyticsAdmin — this file only frames it with the app's TopBar and a page
// wrapper, so the two access points (Settings card + /admin route) render
// the exact same dashboard.

export function AdminPage({ navigate }: { uid: string; navigate: (r: Route) => void }) {
  return (
    <div className="page-bg min-h-screen">
      <TopBar
        title="דשבורד השקה"
        subtitle="visits · signups · funnel"
        accent="brand"
        tint="violet"
        actions={<CloseAction navigate={navigate} />}
      />
      <div className="p-4 pb-8 max-w-lg mx-auto">
        <AnalyticsAdmin flat />
      </div>
    </div>
  );
}
