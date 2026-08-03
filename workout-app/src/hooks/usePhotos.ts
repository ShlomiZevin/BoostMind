// Standalone image-compression helper.
// The old exercise-photo hook (that was tied to the program-day model) is gone;
// exercise-photo Firestore ops now live in useFirestore.

// Compress an image file to a base64 JPEG at a bounded width.
// Returns a data: URL string suitable for direct <img src> use.
export function compressImage(file: File | Blob, maxWidth = 640, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Read a file (image or video) as a base64 data URL, no processing.
export function readAsDataURL(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function isVideoFile(file: File | Blob): boolean {
  return (file as File).type?.startsWith?.('video/') ?? false;
}

// Firestore doc soft limit is ~1MB. Anything above ~700KB is risky as base64.
export const VIDEO_MAX_BYTES = 700 * 1024;

// Compress + prepare a media file for storage. Returns { dataUrl, kind }.
// Images: aggressive JPEG compression via compressImage.
// Videos: raw base64 read, capped at VIDEO_MAX_BYTES. Caller must handle rejection.
export async function prepareMedia(file: File): Promise<{ dataUrl: string; kind: 'image' | 'video' }> {
  if (isVideoFile(file)) {
    if (file.size > VIDEO_MAX_BYTES) {
      throw new Error(`הוידאו גדול מדי (${(file.size / 1024 / 1024).toFixed(1)}MB). מקסימום ${(VIDEO_MAX_BYTES / 1024 / 1024).toFixed(1)}MB. צלם קליפ קצר יותר.`);
    }
    const dataUrl = await readAsDataURL(file);
    return { dataUrl, kind: 'video' };
  }
  const dataUrl = await compressImage(file, 640, 0.72);
  return { dataUrl, kind: 'image' };
}

// Stable key for storing / looking up a photo by exercise name.
// Trims, lowercases, keeps Hebrew + word chars, collapses everything else to _.
export function exercisePhotoKey(exerciseName: string): string {
  return exerciseName
    .trim()
    .toLowerCase()
    .replace(/[^\w֐-׿]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
}
