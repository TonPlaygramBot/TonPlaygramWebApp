const PREFIX = 'tpg-social-hub-v2:';
const CALL_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function read(accountId, suffix, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(`${PREFIX}${accountId}:${suffix}`) || 'null');
    return value ?? fallback;
  } catch { return fallback; }
}

function write(accountId, suffix, value) {
  if (!accountId) return;
  try { localStorage.setItem(`${PREFIX}${accountId}:${suffix}`, JSON.stringify(value)); } catch { /* Private browsing may deny storage. */ }
}

export function readHubPreferences(accountId) {
  const value = read(accountId, 'preferences', {});
  return {
    pins: Array.isArray(value.pins) ? value.pins.filter(id => typeof id === 'string').slice(0, 100) : [],
    timers: value.timers && typeof value.timers === 'object' ? value.timers : {}
  };
}

export function saveHubPreferences(accountId, preferences) { write(accountId, 'preferences', preferences); }

export function listLocalCalls(accountId, now = Date.now()) {
  const records = read(accountId, 'calls', []);
  const valid = (Array.isArray(records) ? records : []).filter(call =>
    typeof call?.roomId === 'string' && Number.isFinite(call.createdAt) && call.createdAt > now - CALL_RETENTION_MS
  ).slice(0, 100);
  write(accountId, 'calls', valid);
  return valid;
}

function notifyCalls() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('social-hub:calls-changed'));
}

// Device-only metadata. No media, SDP, ICE candidates, message text or tokens.
export function recordLocalCall(accountId, call, { direction = 'outgoing', status = 'ringing' } = {}) {
  if (!accountId || !call?.roomId) return;
  const calls = listLocalCalls(accountId);
  const previous = calls.find(item => item.roomId === call.roomId);
  const incoming = direction === 'incoming';
  const record = {
    roomId: String(call.roomId),
    peerId: String((incoming ? call.fromAccountId : call.toAccountId) || previous?.peerId || ''),
    name: String((incoming ? call.fromName : call.toName) || call.name || previous?.name || 'Friend').slice(0, 100),
    type: call.type === 'video' || previous?.type === 'video' ? 'video' : 'voice',
    direction: previous?.direction || direction,
    status,
    createdAt: previous?.createdAt || Date.now()
  };
  write(accountId, 'calls', [record, ...calls.filter(item => item.roomId !== record.roomId)].slice(0, 100));
  notifyCalls();
}

export function updateLocalCall(accountId, roomId, status) {
  const calls = listLocalCalls(accountId);
  if (!calls.some(call => call.roomId === roomId)) return;
  write(accountId, 'calls', calls.map(call => call.roomId === roomId ? { ...call, status } : call));
  notifyCalls();
}

export function clearLocalCalls(accountId, roomId) {
  write(accountId, 'calls', roomId ? listLocalCalls(accountId).filter(call => call.roomId !== roomId) : []);
  notifyCalls();
}

export function isMessageAlive(message, now = Date.now()) {
  return !message?.expiresAt || new Date(message.expiresAt).getTime() > now;
}

export function mergeMessages(previous, incoming, now = Date.now(), deleted = new Set()) {
  const records = new Map();
  for (const message of [...previous, ...incoming]) {
    if (!message?._id || deleted.has(String(message._id)) || !isMessageAlive(message, now)) continue;
    records.set(String(message._id), message);
  }
  return [...records.values()].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || String(a._id).localeCompare(String(b._id))
  );
}

export function belongsToConversation(message, context) {
  if (!context) return false;
  const from = String(message.from), to = String(message.to);
  return (from === String(context.selfId) && to === String(context.peerId)) ||
    (to === String(context.selfId) && from === String(context.peerId));
}
