const DB_NAME = 'tonplaygram-highlights';
const STORE_NAME = 'highlights';
const DB_VERSION = 1;
const EXPIRATION_MS = 24 * 60 * 60 * 1000;

const hasIndexedDb = typeof indexedDB !== 'undefined';

const openDb = () =>
  new Promise((resolve, reject) => {
    if (!hasIndexedDb) {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error('Unable to open highlights storage'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });

const storeDataUrl = async (record) => {
  const existing = JSON.parse(window.localStorage.getItem(STORE_NAME) || '[]');
  const filtered = existing.filter((entry) => entry.expiresAt > Date.now());
  filtered.push(record);
  window.localStorage.setItem(STORE_NAME, JSON.stringify(filtered));
  return record;
};

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Failed to read highlight blob'));
    reader.readAsDataURL(blob);
  });

const dataUrlToBlob = async (dataUrl) => {
  const response = await fetch(dataUrl);
  return response.blob();
};

export async function saveHighlightClip({ game, blob, quality = 'hd', createdAt = Date.now(), metadata = {} }) {
  const record = {
    game,
    quality,
    createdAt,
    expiresAt: createdAt + EXPIRATION_MS,
    metadata,
  };

  if (!blob) throw new Error('No highlight data provided');

  if (hasIndexedDb) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.add({ ...record, blob });
      tx.oncomplete = () => resolve({ ...record, id: request.result, blob });
      tx.onerror = () => reject(tx.error || new Error('Failed to persist highlight'));
    });
  }

  const dataUrl = await blobToDataUrl(blob);
  return storeDataUrl({ ...record, id: `${Date.now()}`, dataUrl });
}

export async function getActiveHighlights() {
  const now = Date.now();
  if (hasIndexedDb) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = async () => {
        const all = request.result || [];
        const valid = all.filter((entry) => entry.expiresAt > now);
        const expiredIds = all.filter((entry) => entry.expiresAt <= now).map((entry) => entry.id);
        if (expiredIds.length) {
          expiredIds.forEach((id) => store.delete(id));
        }
        resolve(valid);
      };
      request.onerror = () => reject(request.error || new Error('Failed to read highlights'));
    });
  }

  const stored = JSON.parse(window.localStorage.getItem(STORE_NAME) || '[]');
  const valid = stored.filter((entry) => entry.expiresAt > now);
  const expired = stored.filter((entry) => entry.expiresAt <= now);
  if (expired.length) {
    window.localStorage.setItem(STORE_NAME, JSON.stringify(valid));
  }
  const mapped = await Promise.all(
    valid.map(async (entry) => ({ ...entry, blob: await dataUrlToBlob(entry.dataUrl) }))
  );
  return mapped;
}

export async function clearHighlight(id) {
  if (id == null) return;
  if (hasIndexedDb) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to delete highlight'));
    });
  }
  const stored = JSON.parse(window.localStorage.getItem(STORE_NAME) || '[]');
  const filtered = stored.filter((entry) => entry.id !== id);
  window.localStorage.setItem(STORE_NAME, JSON.stringify(filtered));
}
