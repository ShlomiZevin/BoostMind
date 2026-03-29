import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

interface BoardSummary {
  id: string;
  title: string;
  subtitle: string;
  updatedAt: any;
  sceneCount: number;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function Dashboard({ onOpen }: { onOpen: (id: string) => void }) {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [deleteModal, setDeleteModal] = useState<BoardSummary | null>(null);

  useEffect(() => {
    loadBoards();
  }, []);

  async function loadBoards() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'storyboards'));
      const list: BoardSummary[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({
          id: d.id,
          title: data.title || 'ללא שם',
          subtitle: data.subtitle || '',
          updatedAt: data.updatedAt,
          sceneCount: data.scenes?.length || 0,
        });
      });
      // Sort by updatedAt desc
      list.sort((a, b) => {
        const ta = a.updatedAt?.seconds || 0;
        const tb = b.updatedAt?.seconds || 0;
        return tb - ta;
      });
      setBoards(list);
    } catch (err) {
      console.error('Failed to load boards:', err);
    }
    setLoading(false);
  }

  async function createBoard() {
    if (!newTitle.trim()) return;
    const id = `sb_${generateId()}`;
    const newBoard = {
      id,
      title: newTitle.trim(),
      subtitle: '',
      description: '',
      speakers: [
        { id: 'speaker1', name: 'דובר 1', color: '#7C3AED', bgColor: '#F5F0FF' },
        { id: 'direction', name: 'בימוי', color: '#E97316', bgColor: '#FFF7ED' },
      ],
      columns: [{ id: 'text', name: 'טקסט', width: '1fr' }],
      timing: { wordsPerSecond: 3, minDialogueSec: 1, minDirectionSec: 2 },
      scenes: [
        {
          id: `s_${generateId()}`,
          title: 'סצנה 1',
          lines: [{ id: `l_${generateId()}`, type: 'dialogue', speaker: 'speaker1', text: '' }],
        },
      ],
      comments: [],
      versions: [],
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'storyboards', id), newBoard);
    setNewTitle('');
    setCreating(false);
    onOpen(id);
  }

  async function handleDelete() {
    if (!deleteModal) return;
    await deleteDoc(doc(db, 'storyboards', deleteModal.id));
    setDeleteModal(null);
    loadBoards();
  }

  return (
    <div className="dashboard">
      <div className="dash-header">
        <h1>📋 הסטוריבורדים שלי</h1>
        {creating ? (
          <div className="dash-create-row">
            <input
              autoFocus
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="שם לסטוריבורד..."
              onKeyDown={e => {
                if (e.key === 'Enter') createBoard();
                if (e.key === 'Escape') setCreating(false);
              }}
            />
            <button className="dash-create-btn" disabled={!newTitle.trim()} onClick={createBoard}>צור</button>
            <button className="dash-cancel-btn" onClick={() => setCreating(false)}>ביטול</button>
          </div>
        ) : (
          <button className="dash-new-btn" onClick={() => setCreating(true)}>+ סטוריבורד חדש</button>
        )}
      </div>

      {loading ? (
        <div className="dash-loading">טוען...</div>
      ) : boards.length === 0 ? (
        <div className="dash-empty">
          <p>אין סטוריבורדים עדיין</p>
          <p>לחץ על "+ סטוריבורד חדש" כדי להתחיל</p>
        </div>
      ) : (
        <div className="dash-grid">
          {boards.map(b => (
            <div key={b.id} className="dash-card" onClick={() => onOpen(b.id)}>
              <div className="dash-card-top">
                <h3>{b.title}</h3>
                {b.subtitle && <span className="dash-card-sub">{b.subtitle}</span>}
              </div>
              <div className="dash-card-bottom">
                <span>{b.sceneCount} סצנות</span>
                <span>{formatDate(b.updatedAt)}</span>
              </div>
              <button
                className="dash-card-delete"
                onClick={e => { e.stopPropagation(); setDeleteModal(b); }}
                title="מחק"
              >🗑️</button>
            </div>
          ))}
        </div>
      )}

      {/* Delete modal */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>מחיקת סטוריבורד</h3>
            <p>למחוק את <strong>"{deleteModal.title}"</strong>?</p>
            <p className="modal-sub">הפעולה בלתי הפיכה.</p>
            <div className="modal-buttons">
              <button className="btn btn-danger" onClick={handleDelete}>🗑️ מחק</button>
              <button className="btn btn-outline modal-cancel" onClick={() => setDeleteModal(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(ts: any): string {
  if (!ts?.seconds) return '';
  const d = new Date(ts.seconds * 1000);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}
