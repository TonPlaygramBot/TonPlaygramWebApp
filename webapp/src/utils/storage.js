let cachedAvailability;

function checkAvailability() {
  if (cachedAvailability !== undefined) {
    return cachedAvailability;
  }

  if (typeof window === 'undefined' || !('localStorage' in window)) {
    cachedAvailability = false;
    return cachedAvailability;
  }

  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    cachedAvailability = true;
  } catch (err) {
    cachedAvailability = false;
  }

  return cachedAvailability;
}

export function isLocalStorageAvailable() {
  return checkAvailability();
}

export function safeGetItem(key) {
  if (!checkAvailability()) {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    cachedAvailability = false;
    return null;
  }
}

export function safeSetItem(key, value) {
  if (!checkAvailability()) {
    return false;
  }
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err) {
    cachedAvailability = false;
    return false;
  }
}

export function safeRemoveItem(key) {
  if (!checkAvailability()) {
    return false;
  }
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (err) {
    cachedAvailability = false;
    return false;
  }
}
