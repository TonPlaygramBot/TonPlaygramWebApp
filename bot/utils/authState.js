import { randomUUID } from 'crypto';

const stateStore = new Map();
const DEFAULT_TTL_MS = 10 * 60 * 1000;

function createState(provider, redirectUri) {
  const state = randomUUID();
  const expiresAt = Date.now() + DEFAULT_TTL_MS;
  stateStore.set(state, { provider, redirectUri, expiresAt });
  return { state, redirectUri, expiresAt };
}

function consumeState(state, provider) {
  const entry = stateStore.get(state);
  if (!entry) return null;
  stateStore.delete(state);
  if (entry.provider !== provider) return null;
  if (entry.expiresAt < Date.now()) return null;
  return entry;
}

function pruneExpired() {
  const now = Date.now();
  for (const [key, value] of stateStore.entries()) {
    if (value.expiresAt < now) {
      stateStore.delete(key);
    }
  }
}

function hasState(state) {
  pruneExpired();
  return stateStore.has(state);
}

export { createState, consumeState, hasState };
