import { useState } from 'react';
import type { Route } from '../types';
import { TopBar } from './TopBar';
import { CloseAction } from './TopBarActions';
import { AnalyticsAdmin } from './AnalyticsAdmin';
import { MarketingChat } from './MarketingChat';

// Full-screen admin surface. Bookmarkable at #/admin so you can pull it up with
// one tap. Gated in AppShell to `user_6724`; anyone else hitting the URL gets
// redirected home.
//
// Two tabs, both admin-only:
//   דשבורד — the launch dashboard (AnalyticsAdmin owns all of its logic)
//   מאיה   — the marketing assistant, running on the same Cloud Run service

type Tab = 'dash' | 'maya';

export function AdminPage({ uid, navigate }: { uid: string; navigate: (r: Route) => void }) {
  const [tab, setTab] = useState<Tab>('dash');

  return (
    <div className="page-bg min-h-screen">
      <TopBar
        title={tab === 'dash' ? 'דשבורד השקה' : 'מאיה'}
        subtitle={tab === 'dash' ? 'visits · signups · funnel' : 'שיווק · מותג · קריאייטיב'}
        accent="brand"
        tint="violet"
        actions={<CloseAction navigate={navigate} />}
      />

      <div className="max-w-lg mx-auto px-4 pt-3" dir="rtl">
        <div className="flex gap-2">
          {([['dash', 'דשבורד'], ['maya', 'מאיה']] as [Tab, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                tab === k
                  ? 'bg-violet-600 text-white'
                  : 'dark:bg-slate-900 bg-white border border-subtle text-muted hover:text-main'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 pb-8 max-w-lg mx-auto">
        {tab === 'dash' ? <AnalyticsAdmin flat /> : <MarketingChat uid={uid} />}
      </div>
    </div>
  );
}
