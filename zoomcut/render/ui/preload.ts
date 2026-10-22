// Every clip of a project, downloaded once when it opens and played from memory: the browser by itself fetches only
// a few seconds around the playhead, so a jump (or a clip whose moment comes) showed an empty frame until its part
// arrived. One file at a time (the page's own requests are never queued behind them). The server lets the browser
// keep versioned files, so opening the project again comes from the disk cache.
import { useEffect, useState } from 'react';
import { prefetch } from 'remotion';

export type Preload = { done: number; total: number; bytes: number; loading: boolean };

// the solo editor: url -> a blob: URL its <video> elements play from
export function usePreloaded(urls: string[]): [Record<string, string>, Preload] {
  const key = urls.join('|');
  const [blobs, setBlobs] = useState<Record<string, string>>({});
  const [st, setSt] = useState<Preload>({ done: 0, total: 0, bytes: 0, loading: false });
  useEffect(() => {
    let stop = false;
    const made: string[] = [];
    setBlobs({});
    if (!urls.length) { setSt({ done: 0, total: 0, bytes: 0, loading: false }); return; }
    setSt({ done: 0, total: urls.length, bytes: 0, loading: true });
    (async () => {
      let bytes = 0;
      for (let i = 0; i < urls.length && !stop; i++) {
        try {
          const r = await fetch(urls[i]);
          if (!r.ok || !r.body) continue;
          const reader = r.body.getReader(), parts: BlobPart[] = [];
          for (;;) {
            const { done, value } = await reader.read();
            if (done || stop) break;
            parts.push(value); bytes += value.length;
            setSt((s) => ({ ...s, bytes }));
          }
          if (stop) return;
          const u = URL.createObjectURL(new Blob(parts, { type: r.headers.get('content-type') || 'video/mp4' }));
          made.push(u);
          setBlobs((b) => ({ ...b, [urls[i]]: u }));
        } catch {}
        setSt((s) => ({ ...s, done: i + 1 }));
      }
      if (!stop) setSt((s) => ({ ...s, loading: false }));
    })();
    return () => { stop = true; for (const u of made) URL.revokeObjectURL(u); };
  }, [key]);
  return [blobs, st];
}

// the Zoom editor: Remotion's own prefetch - its <OffthreadVideo> / <Audio> / <Img> then play the downloaded copy
export function usePrefetched(urls: string[]): Preload {
  const key = urls.join('|');
  const [st, setSt] = useState<Preload>({ done: 0, total: 0, bytes: 0, loading: false });
  useEffect(() => {
    let stop = false;
    const frees: (() => void)[] = [];
    if (!urls.length) { setSt({ done: 0, total: 0, bytes: 0, loading: false }); return; }
    setSt({ done: 0, total: urls.length, bytes: 0, loading: true });
    (async () => {
      let base = 0;
      for (let i = 0; i < urls.length && !stop; i++) {
        let got = 0;
        try {
          const p = prefetch(urls[i], { method: 'blob-url', onProgress: (pr: { loadedBytes: number }) => { got = pr.loadedBytes; setSt((s) => ({ ...s, bytes: base + got })); } } as any);
          frees.push(p.free);
          await p.waitUntilDone();
        } catch {}
        base += got;
        setSt((s) => ({ ...s, done: i + 1 }));
      }
      if (!stop) setSt((s) => ({ ...s, loading: false }));
    })();
    return () => { stop = true; for (const f of frees) f(); };
  }, [key]);
  return st;
}
