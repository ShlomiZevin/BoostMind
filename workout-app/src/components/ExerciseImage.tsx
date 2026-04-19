import { useState, useEffect, useRef } from 'react';

type Props = {
  imageUrl?: string;
  name: string;
};

export function ExerciseImage({ imageUrl, name }: Props) {
  const [show, setShow] = useState(false);
  const [frame, setFrame] = useState(0);
  const [hasSecondFrame, setHasSecondFrame] = useState(false);
  const intervalRef = useRef<number | null>(null);

  // Check if second frame exists
  useEffect(() => {
    if (!imageUrl) return;
    const url1 = imageUrl.replace('/0.jpg', '/1.jpg');
    const img = new Image();
    img.onload = () => setHasSecondFrame(true);
    img.onerror = () => setHasSecondFrame(false);
    img.src = url1;
  }, [imageUrl]);

  // Animate between frames
  useEffect(() => {
    if (show && hasSecondFrame && imageUrl) {
      intervalRef.current = window.setInterval(() => {
        setFrame(f => (f === 0 ? 1 : 0));
      }, 1200);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    } else {
      setFrame(0);
    }
  }, [show, hasSecondFrame, imageUrl]);

  if (!imageUrl) {
    // Fallback: Google search link
    return (
      <a
        href={`https://www.google.com/search?q=${encodeURIComponent(name + ' exercise form')}&tbm=isch`}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 w-8 h-8 flex items-center justify-center btn-icon text-sm"
        title="How to do this exercise"
      >?</a>
    );
  }

  const currentUrl = frame === 1 ? imageUrl.replace('/0.jpg', '/1.jpg') : imageUrl;

  return (
    <>
      <button
        onClick={() => setShow(true)}
        className="shrink-0 w-8 h-8 rounded-lg overflow-hidden border dark:border-slate-700 border-slate-300 hover:border-emerald-400 transition-colors"
        title="View exercise"
      >
        <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
      </button>

      {/* Fullscreen overlay */}
      {show && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center dark:bg-black/90 bg-black/80 p-4"
          onClick={() => setShow(false)}
        >
          <div className="max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <img
              src={currentUrl}
              alt={name}
              className="w-full rounded-xl"
            />
            <div className="text-center mt-3">
              <p className="text-white font-medium text-sm">{name}</p>
              {hasSecondFrame && (
                <p className="text-white/50 text-[10px] mt-1">Animating...</p>
              )}
            </div>
            <button
              onClick={() => setShow(false)}
              className="mt-4 w-full py-3 rounded-xl bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
