import { createHash } from 'node:crypto';
const id = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(value);
const STATES = new Set(['created', 'offered', 'reserved', 'playing', 'finished', 'settled', 'cancelled', 'refund_pending', 'refunded', 'disputed']);
const TERMINAL = new Set(['settled', 'cancelled', 'refunded']);
function requireValue(condition, code) { if (!condition) throw new Error(code); }

/** Pure lifecycle validation, NOT authorization or financial proof. Server records only. */
export function nextGameLifecycle(state, event) {
  requireValue(state && event && id(state.matchId) && event.matchId === state.matchId && id(event.eventId), 'invalid_lifecycle_identity');
  requireValue(STATES.has(state.status) && Number.isSafeInteger(state.version) && state.version >= 0 &&
    event.expectedVersion === state.version && Number.isSafeInteger(event.at) && Number.isSafeInteger(state.updatedAt) && event.at >= state.updatedAt,
  'lifecycle_version_conflict');
  requireValue(!TERMINAL.has(state.status), 'lifecycle_terminal');
  const next = { ...state, version: state.version + 1, updatedAt: event.at };
  requireValue(Number.isSafeInteger(next.version), 'lifecycle_version_overflow');
  const transition = (from, to) => { requireValue(from.includes(state.status), 'invalid_lifecycle_transition'); next.status = to; };
  switch (event.kind) {
    case 'offer':
      transition(['created'], 'offered'); requireValue(id(event.referenceId), 'missing_offer_reference'); next.offerId = event.referenceId; break;
    case 'reservation_committed':
      transition(['offered'], 'reserved'); requireValue(id(event.referenceId), 'missing_reservation_reference'); next.reservationId = event.referenceId; break;
    case 'start':
      transition(['reserved'], 'playing'); next.startedAt = event.at; break;
    case 'server_finish':
      transition(['playing'], 'finished'); requireValue(id(event.referenceId), 'missing_result_reference'); next.resultId = event.referenceId; break;
    case 'settlement_committed':
      transition(['finished'], 'settled'); requireValue(id(event.referenceId), 'missing_settlement_reference'); next.settlementId = event.referenceId; break;
    case 'cancel':
      next.status = ['created', 'offered'].includes(state.status) ? 'cancelled' : ['reserved', 'refund_pending'].includes(state.status) ? 'refund_pending' : 'disputed';
      break;
    case 'refund_committed':
      transition(['refund_pending'], 'refunded'); requireValue(id(event.referenceId), 'missing_refund_reference'); next.refundId = event.referenceId; break;
    case 'dispute':
      transition(['reserved', 'playing', 'finished', 'refund_pending', 'disputed'], 'disputed'); break;
    case 'disconnect':
    case 'reconnect':
      // Never delete a match, reset its round, invent a winner or release money.
      requireValue(id(event.accountId) && state.accountIds?.includes(event.accountId), 'lifecycle_participant_required');
      break;
    default: throw new Error('unknown_lifecycle_event');
  }
  return Object.freeze(next);
}

export function lifecycleCommandRecord(event) {
  // Pick an explicit schema; unknown caller fields cannot affect idempotency.
  const command = { matchId: event.matchId, eventId: event.eventId, expectedVersion: event.expectedVersion,
    at: event.at, kind: event.kind, referenceId: event.referenceId ?? null, accountId: event.accountId ?? null };
  const eventKey = createHash('sha256').update(JSON.stringify([command.matchId, command.eventId])).digest('hex');
  const commandHash = createHash('sha256').update(JSON.stringify(command)).digest('hex');
  return { command, eventKey, commandHash };
}

/** UNWIRED append-only transaction adapter. No external caller may choose internal events. */
export function createGameLifecycleJournal({ client, lifecycleMatches, journal }) {
  requireValue(client?.startSession && lifecycleMatches && journal, 'lifecycle_store_required');
  return async event => {
    requireValue(event && id(event.matchId) && id(event.eventId), 'invalid_lifecycle_identity');
    const { command, eventKey, commandHash } = lifecycleCommandRecord(event);
    const session = client.startSession(); let result;
    try {
      await session.withTransaction(async () => {
        result = undefined;
        const existing = await journal.findOne({ _id: eventKey }, { session });
        if (existing) {
          requireValue(existing.commandHash === commandHash && existing.matchId === command.matchId && existing.state?.matchId === command.matchId && existing.version === existing.state?.version, 'lifecycle_idempotency_conflict');
          result = { duplicate: true, state: existing.state }; return;
        }
        const state = await lifecycleMatches.findOne({ _id: command.matchId }, { session });
        const next = nextGameLifecycle(state, command);
        const { _id, ...fields } = next;
        const changed = await lifecycleMatches.updateOne({ _id: command.matchId, version: state.version, status: state.status }, { $set: fields }, { session });
        requireValue(changed.modifiedCount === 1, 'lifecycle_write_conflict');
        await journal.insertOne({ _id: eventKey, matchId: command.matchId, version: next.version, commandHash, command, state: next }, { session });
        result = { duplicate: false, state: next };
      }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
      requireValue(result, 'lifecycle_transaction_empty'); return result;
    } finally { await session.endSession(); }
  };
}
