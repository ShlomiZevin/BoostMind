import { useState, useRef } from 'react';
import { compressImage, type ExercisePhoto } from '../hooks/usePhotos';

type Props = {
  photos: ExercisePhoto[];
  onCapture: (base64: string) => void;
  onDelete: (photoId: string) => void;
};

export function PhotoPanel({ photos, onCapture, onDelete }: Props) {
  const [show, setShow] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    onCapture(compressed);
    setShow(true);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div>
      {/* Top row: camera + count/toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="btn-icon w-8 h-8 flex items-center justify-center shrink-0 text-sm"
          title="Snap weight setting"
        >📷</button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
        />
        {photos.length > 0 && (
          <button
            onClick={() => { setShow(!show); if (show) setExpanded(null); }}
            className="text-[10px] text-muted"
          >
            {photos.length} pic{photos.length > 1 ? 's' : ''} {show ? '▲' : '▼'}
          </button>
        )}
      </div>

      {/* Photo grid — when toggled open */}
      {show && photos.length > 0 && (
        <div className="mt-2">
          <div className="flex flex-wrap gap-2">
            {photos.map(p => (
              <div key={p.id} className="relative">
                <img
                  src={p.data}
                  alt="weight"
                  onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                  className={`rounded-lg object-cover cursor-pointer border transition-all ${
                    expanded === p.id
                      ? 'w-44 h-44 dark:border-emerald-500 border-emerald-400'
                      : 'w-14 h-14 dark:border-slate-700 border-slate-300 hover:opacity-80'
                  }`}
                />
                {/* Date label */}
                <div className={`text-[8px] text-muted-most text-center mt-0.5 ${expanded === p.id ? '' : 'w-14'}`}>
                  {new Date(p.timestamp).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                </div>
                {/* Delete on expanded */}
                {expanded === p.id && (
                  <div className="mt-1 text-center">
                    {confirmDel === p.id ? (
                      <span className="flex gap-2 justify-center">
                        <button onClick={() => { onDelete(p.id); setConfirmDel(null); setExpanded(null); }} className="text-[10px] text-red-500 font-bold">Delete</button>
                        <button onClick={() => setConfirmDel(null)} className="text-[10px] text-muted">Cancel</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDel(p.id)} className="text-[10px] text-red-500">Delete</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
