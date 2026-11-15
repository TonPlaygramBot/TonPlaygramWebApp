import { randomUUID } from 'node:crypto';

// Ephemeral signaling metadata only. No audio, video, SDP or ICE is persisted.
export function createPrivateCallStore({ now = Date.now, uuid = randomUUID, onEnd = () => {}, ringingMs = 60000, maxCallMs = 4 * 60 * 60 * 1000 } = {}) {
  const calls = new Map();
  const byAccount = new Map();
  function close(roomId, reason = 'ended') {
    const call = calls.get(String(roomId));
    if (!call) return false;
    calls.delete(call.roomId);
    for (const id of [call.fromAccountId, call.toAccountId]) {
      if (byAccount.get(id) === call.roomId) byAccount.delete(id);
    }
    onEnd(call, reason);
    return true;
  }
  function get(roomId) {
    const call = calls.get(String(roomId));
    if (call && call.expiresAt <= now()) { close(call.roomId, 'expired'); return null; }
    return call || null;
  }
  function create(caller, target, type = 'voice') {
    sweep();
    const fromAccountId = String(caller?.accountId || '');
    const toAccountId = String(target?.accountId || '');
    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) throw new Error('Invalid call participants');
    if (byAccount.has(fromAccountId) || byAccount.has(toAccountId)) throw new Error('A participant is already in a call');
    const call = {
      roomId: `friend-call-${uuid()}`, fromAccountId, toAccountId,
      fromTelegramId: caller.telegramId, toTelegramId: target.telegramId,
      fromName: String(caller.nickname || caller.firstName || 'Player').slice(0, 60),
      toName: String(target.nickname || target.firstName || 'Player').slice(0, 60),
      fromPhoto: caller.photo || '', toPhoto: target.photo || '',
      type: type === 'video' ? 'video' : 'voice', state: 'ringing',
      createdAt: now(), expiresAt: now() + ringingMs
    };
    calls.set(call.roomId, call);
    byAccount.set(fromAccountId, call.roomId);
    byAccount.set(toAccountId, call.roomId);
    return { ...call };
  }
  function accept(roomId, accountId) {
    const call = get(roomId);
    if (!call || call.toAccountId !== String(accountId)) return null;
    if (call.state !== 'accepted') {
      call.state = 'accepted';
      call.expiresAt = now() + maxCallMs;
    }
    return { ...call };
  }
  function canJoin(roomId, accountId) {
    const call = get(roomId);
    return !!call && (call.fromAccountId === String(accountId) || (call.toAccountId === String(accountId) && call.state === 'accepted'));
  }
  function end(roomId, accountId, reason = 'ended') {
    const call = get(roomId);
    if (!call || ![call.fromAccountId, call.toAccountId].includes(String(accountId))) return false;
    if (reason === 'declined' && call.toAccountId !== String(accountId)) return false;
    return close(roomId, reason);
  }
  function endForAccount(accountId, reason = 'disconnected') {
    const roomId = byAccount.get(String(accountId));
    if (roomId) close(roomId, reason);
  }
  function sweep() { for (const id of calls.keys()) get(id); }
  return { create, get, accept, canJoin, end, endForAccount, sweep, size: () => calls.size };
}
