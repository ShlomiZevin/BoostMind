import { useCallback } from 'react';
import {
  collection, doc, setDoc, getDocs, deleteDoc, query, where, orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { PROGRAM } from '../data/program';

export type ExercisePhoto = {
  id: string;
  exerciseId: string;
  programName: string;
  data: string; // base64 jpeg
  timestamp: number;
  note?: string;
};

function photosCol(uid: string) {
  return collection(db, 'users', uid, 'exercisePhotos');
}

// Compress image to small JPEG thumbnail
export function compressImage(file: File | Blob, maxWidth = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.6);
        resolve(base64);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function usePhotos(uid: string | null) {

  const savePhoto = useCallback(async (exerciseId: string, base64: string, note?: string) => {
    if (!uid) return;
    const id = `${exerciseId}_${Date.now()}`;
    const ref = doc(photosCol(uid), id);
    await setDoc(ref, {
      id,
      exerciseId,
      programName: PROGRAM.name,
      data: base64,
      timestamp: Date.now(),
      note: note || null,
    });
    return id;
  }, [uid]);

  const getPhotos = useCallback(async (exerciseId: string): Promise<ExercisePhoto[]> => {
    if (!uid) return [];
    const snap = await getDocs(photosCol(uid));
    return snap.docs
      .map(d => d.data() as ExercisePhoto)
      .filter(p => p.exerciseId === exerciseId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [uid]);

  const deletePhoto = useCallback(async (photoId: string) => {
    if (!uid) return;
    await deleteDoc(doc(photosCol(uid), photoId));
  }, [uid]);

  return { savePhoto, getPhotos, deletePhoto };
}
