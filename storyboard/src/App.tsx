import { useState } from 'react';
import { StoryboardProvider, useCtx } from './context/StoryboardContext';
import { Topbar } from './components/Topbar';
import { SceneInfo } from './components/SceneInfo';
import { SceneGroup } from './components/SceneGroup';
import { SpeakerManager } from './components/SpeakerManager';
import { ColumnManager } from './components/ColumnManager';
import { ApproverManager } from './components/ApproverManager';
import { ApprovalBar } from './components/ApprovalBar';
import { ReviewerIdentity } from './components/ReviewerIdentity';
import { TimingBar } from './components/TimingSettings';
import { Dashboard } from './components/Dashboard';
import { Prompter } from './components/Prompter';
import './app.css';

function StoryboardContent() {
  const { data, loaded } = useCtx();
  const [prompterOpen, setPrompterOpen] = useState(false);

  if (!loaded) {
    return <div className="loading">טוען...</div>;
  }

  return (
    <>
      {prompterOpen && <Prompter onClose={() => setPrompterOpen(false)} />}
      <Topbar onOpenPrompter={() => setPrompterOpen(true)} />
      <ReviewerIdentity />
      <div className="layout">
        <div className="main-content">
          <SceneInfo />
          <div className="managers-row">
            <SpeakerManager />
            <ColumnManager />
            <ApproverManager />
          </div>
          <ApprovalBar />
          <TimingBar />
          {data.scenes.map((scene, i) => (
            <SceneGroup key={scene.id} scene={scene} index={i} speakers={data.speakers} totalScenes={data.scenes.length} />
          ))}
        </div>
      </div>
    </>
  );
}

function getIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

export default function App() {
  const [boardId, setBoardId] = useState<string | null>(getIdFromUrl());

  function openBoard(id: string) {
    const params = new URLSearchParams(window.location.search);
    params.set('id', id);
    window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
    setBoardId(id);
  }

  function goHome() {
    window.history.pushState({}, '', window.location.pathname);
    setBoardId(null);
  }

  // Handle browser back/forward
  useState(() => {
    const handler = () => setBoardId(getIdFromUrl());
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  });

  // Review mode without id → redirect to default board
  const params = new URLSearchParams(window.location.search);
  const isReview = params.get('review') === 'true';
  if (isReview && !boardId) {
    params.set('id', 'wolt-storyboard-1');
    window.location.replace(`${window.location.pathname}?${params.toString()}`);
    return <div className="loading">מעביר...</div>;
  }

  if (!boardId) {
    return <Dashboard onOpen={openBoard} />;
  }

  return (
    <StoryboardProvider storyboardId={boardId} onGoHome={goHome}>
      <StoryboardContent />
    </StoryboardProvider>
  );
}
