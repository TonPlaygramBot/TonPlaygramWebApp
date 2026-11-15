import { createIdentity, securityError } from './crypto.js';

const DATABASE = 'tonplaygram-secure-messages-v1';
let opening;
function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(securityError('STORAGE_UNAVAILABLE', 'This browser cannot safely store encryption keys. Enable site storage to continue.'));
  if (!opening) opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore('identities');
      database.createObjectStore('pins');
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); opening = undefined; };
      resolve(request.result);
    };
    request.onerror = () => { opening = undefined; reject(securityError('STORAGE_UNAVAILABLE', 'Encryption key storage is unavailable.')); };
    request.onblocked = () => { opening = undefined; reject(securityError('STORAGE_UNAVAILABLE', 'Close other TonPlaygram tabs, then try again.')); };
  });
  return opening;
}

async function read(storeName, key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(key);
    tx.oncomplete = () => resolve(request.result || null);
    tx.onerror = () => reject(securityError('STORAGE_UNAVAILABLE', 'Encryption key storage is unavailable.'));
  });
}

// Generation happens outside the transaction. Competing tabs then read and write
// in one serialized readwrite transaction, so only one identity becomes active.
async function insertIfMissing(storeName, key, candidate) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    let selected;
    request.onsuccess = () => {
      selected = request.result || candidate;
      if (!request.result) store.add(candidate, key);
    };
    tx.oncomplete = () => resolve(selected);
    tx.onabort = tx.onerror = () => reject(securityError('STORAGE_UNAVAILABLE', 'Encryption keys could not be saved. Messages were not sent.'));
  });
}
export const getStoredIdentity = (accountId) => read('identities', String(accountId));
export async function getOrCreateIdentity(accountId) {
  const existing = await getStoredIdentity(accountId);
  if (existing) return existing;
  const candidate = await createIdentity(accountId);
  return insertIfMissing('identities', String(accountId), candidate);
}
const pinId = (selfId, peerId) => JSON.stringify([String(selfId), String(peerId)]);
export async function getOrPinPeer(selfId, peerId, fingerprint) {
  return insertIfMissing('pins', pinId(selfId, peerId), {
    fingerprint, trustedFingerprints: [fingerprint], firstSeenAt: new Date().toISOString()
  });
}
export const getPeerPin = (selfId, peerId) => read('pins', pinId(selfId, peerId));
export async function acceptChangedPeerKey(selfId, peerId, fingerprint, expectedPrevious) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pins', 'readwrite');
    const store = tx.objectStore('pins');
    const request = store.get(pinId(selfId, peerId));
    let next;
    let changedElsewhere = false;
    request.onsuccess = () => {
      const old = request.result;
      if (old?.fingerprint !== expectedPrevious) { changedElsewhere = true; tx.abort(); return; }
      next = { ...old, fingerprint,
        trustedFingerprints: [...new Set([...(old.trustedFingerprints || []), fingerprint])],
        changedAt: new Date().toISOString() };
      store.put(next, pinId(selfId, peerId));
    };
    tx.oncomplete = () => resolve(next);
    tx.onabort = tx.onerror = () => reject(securityError(changedElsewhere ? 'KEY_CHANGED' : 'STORAGE_UNAVAILABLE', changedElsewhere ? 'The security key changed in another tab. Open this conversation again.' : 'The verified key could not be saved.'));
  });
}

const historicalKey = (accountId, fingerprint) => JSON.stringify(['identity', String(accountId), fingerprint]);
export async function getIdentityForFingerprint(accountId, fingerprint) {
  const active = await getStoredIdentity(accountId);
  if (active?.bundle.fingerprint === fingerprint) return active;
  return read('identities', historicalKey(accountId, fingerprint));
}
export async function stageReplacementIdentity(accountId, expectedFingerprint) {
  const key = JSON.stringify(['pending-replacement', String(accountId), expectedFingerprint]);
  const previous = await read('identities', key);
  const candidate = previous || await insertIfMissing('identities', key, await createIdentity(accountId));
  // Persist before publishing so an interrupted HTTP response cannot lose the key.
  await insertIfMissing('identities', historicalKey(accountId, candidate.bundle.fingerprint), candidate);
  return candidate;
}
export async function activateIdentity(identity) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('identities', 'readwrite');
    const store = tx.objectStore('identities');
    const request = store.get(identity.accountId);
    request.onsuccess = () => {
      const previous = request.result;
      if (previous) store.put(previous, historicalKey(previous.accountId, previous.bundle.fingerprint));
      store.put(identity, identity.accountId);
    };
    tx.oncomplete = () => resolve(identity);
    tx.onabort = tx.onerror = () => reject(securityError('STORAGE_UNAVAILABLE', 'The replacement encryption key could not be activated. Reopen this conversation to recover.'));
  });
}
