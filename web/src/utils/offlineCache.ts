import type { CopulaState } from "../types";

const DB_NAME = "CopulaOfflineDB";
const DB_VERSION = 1;

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("stateCache")) {
        db.createObjectStore("stateCache");
      }
      if (!db.objectStoreNames.contains("syncQueue")) {
        db.createObjectStore("syncQueue", { keyPath: "id", autoIncrement: true });
      }
    };
  });
}

export async function getCachedState(): Promise<CopulaState | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("stateCache", "readonly");
      const store = transaction.objectStore("stateCache");
      const request = store.get("state");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  } catch (err) {
    console.error("Failed to get cached state:", err);
    return null;
  }
}

export async function saveCachedState(state: CopulaState): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("stateCache", "readwrite");
      const store = transaction.objectStore("stateCache");
      const request = store.put(state, "state");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.error("Failed to cache state:", err);
  }
}

export interface SyncItem {
  id?: number;
  action: string;
  args: any[];
  timestamp: number;
}

export async function getSyncQueue(): Promise<SyncItem[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("syncQueue", "readonly");
      const store = transaction.objectStore("syncQueue");
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  } catch (err) {
    console.error("Failed to get sync queue:", err);
    return [];
  }
}

export async function addToSyncQueue(action: string, args: any[]): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("syncQueue", "readwrite");
      const store = transaction.objectStore("syncQueue");
      const request = store.add({ action, args, timestamp: Date.now() });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.error("Failed to add to sync queue:", err);
  }
}

export async function removeSyncQueueItem(id: number): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("syncQueue", "readwrite");
      const store = transaction.objectStore("syncQueue");
      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.error("Failed to delete sync item:", err);
  }
}
