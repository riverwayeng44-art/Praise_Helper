import { SheetMusicData, ApiConfig } from '../types';

const DB_NAME = 'PraiseHelperDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';
const STATE_KEY = 'root_state';

export interface PersistentState {
  sheets: SheetMusicData[];
  showHighlights: boolean;
  theme: 'dark' | 'light';
  apiConfig: ApiConfig;
  lastSavedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 상태를 IndexedDB에 영구 저장 (용량 제한 없이 수백 MB 이미지도 안정적 저장)
 */
export async function saveAppState(state: PersistentState): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(state, STATE_KEY);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to save state to IndexedDB:', err);
  }
}

/**
 * 저장된 상태를 IndexedDB에서 복원
 */
export async function loadAppState(): Promise<PersistentState | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(STATE_KEY);

      req.onsuccess = () => {
        resolve(req.result || null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to load state from IndexedDB:', err);
    return null;
  }
}
