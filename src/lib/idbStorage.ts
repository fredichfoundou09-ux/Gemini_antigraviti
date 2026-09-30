/**
 * Couche de stockage IndexedDB asynchrone haute capacité pour Sentinel ERP.
 * Permet de dépasser la limite des 5 Mo de localStorage sans bloquer le thread principal.
 */

const DB_NAME = "sentinel_erp_cache";
const DB_VERSION = 1;
const STORE_NAME = "keyval";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB non disponible dans cet environnement"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Enregistre une valeur dans IndexedDB.
 */
export async function idbSet<T>(key: string, value: T): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return;
  }
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Fallback silencieux si IndexedDB échoue
  }
}

/**
 * Récupère une valeur depuis IndexedDB.
 */
export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * Supprime une valeur d'IndexedDB.
 */
export async function idbDelete(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Ignore
  }
}

/**
 * Estimation de l'espace de stockage disponible et utilisé.
 */
export async function getStorageQuotaEstimate(): Promise<{ used: number; quota: number; percent: number } | null> {
  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percent = quota > 0 ? (used / quota) * 100 : 0;
      return { used, quota, percent };
    } catch {
      return null;
    }
  }
  return null;
}
