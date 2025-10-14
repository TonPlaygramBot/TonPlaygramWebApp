const memoryStore = new Map();
let storageSupported;
const warned = new Set();

function logOnce(operation, key, error) {
  const token = `${operation}:${key}`;
  if (warned.has(token)) return;
  warned.add(token);
  console.warn(`localStorage ${operation} failed for key "${key}":`, error);
}

function hasStorage() {
  if (storageSupported !== undefined) return storageSupported;
  if (typeof window === 'undefined' || !window.localStorage) {
    storageSupported = false;
    return storageSupported;
  }
  try {
    const testKey = '__tonplay_safe_storage__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    storageSupported = true;
  } catch (error) {
    storageSupported = false;
    logOnce('probe', 'localStorage', error);
  }
  return storageSupported;
}

export function safeGetItem(key) {
  if (typeof key !== 'string') return null;
  if (hasStorage()) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      logOnce('get', key, error);
      storageSupported = false;
    }
  }
  return memoryStore.has(key) ? memoryStore.get(key) : null;
}

export function safeSetItem(key, value) {
  if (typeof key !== 'string') return;
  if (value == null) {
    safeRemoveItem(key);
    return;
  }
  const stringValue = String(value);
  if (hasStorage()) {
    try {
      window.localStorage.setItem(key, stringValue);
      return;
    } catch (error) {
      logOnce('set', key, error);
      storageSupported = false;
    }
  }
  memoryStore.set(key, stringValue);
}

export function safeRemoveItem(key) {
  if (typeof key !== 'string') return;
  if (hasStorage()) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      logOnce('remove', key, error);
      storageSupported = false;
    }
  }
  memoryStore.delete(key);
}
