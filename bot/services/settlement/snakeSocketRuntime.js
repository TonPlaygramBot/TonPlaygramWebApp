import { snakeJournalRulesHash } from './snakeDurableRules.js';
import { verifySocialCredentials } from '../../middleware/socialAuth.js';
import { gameOfferTerms } from './gameStakeConsent.js';
function need(ok, code) { if (!ok) throw new Error(code); }
const id = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(value);
const PUBLIC_ERRORS = new Set(['paid_play_unavailable', 'invalid_request', 'request_in_progress', 'reauthentication_required', 'authentication_changed', 'seat_required', 'round_not_started', 'not_your_turn', 'roll_cooldown', 'stale_game_version', 'client_outcome_not_accepted', 'offer_changed', 'consent_expired']);

/**
 * UNWIRED socket adapter. Importing this file attaches nothing. Readiness defaults
 * CLOSED, must be server-owned, and cannot be set by any event payload. No legacy
 * register/rooms/balance routes are used as fallback or identity evidence.
 */
export function createSnakeSocketRuntime({ io, users, offers, escrowMatches, receipts, producer, coordinator, moves, assetId,
  readiness = async () => null, verifyCredentials = verifySocialCredentials, now = Date.now }) {
  need(io?.sockets?.sockets && users && offers && escrowMatches && receipts && producer && coordinator && moves && typeof assetId === 'string' && assetId, 'runtime_dependencies_required');
  const bindings = new Map();
  const subscriptions = new Map();
  const controls = new Map();
  function revoke(socketId) {
    bindings.delete(socketId);
    for (const [matchId, members] of subscriptions) { members.delete(socketId); if (!members.size) subscriptions.delete(matchId); }
    const control = controls.get(socketId); if (control) control.generation++;
  }
  async function ready() {
    // Evidence must come from a trusted cutover verifier, not an environment
    // switch or legacy transaction sums. Shape checks are NOT proof by themselves.
    const gate = await readiness({ assetId });
    need(gate?.status === 'verified' && gate.assetId === assetId && id(gate.ledgerGeneration) && id(gate.cutoverId) &&
      /^[a-f0-9]{64}$/.test(gate.writerPolicyHash || '') && Number.isSafeInteger(gate.expiresAt) && gate.expiresAt > now(), 'paid_play_unavailable');
  }
  async function identity(credentials) {
    let claims;
    try { claims = await verifyCredentials({ initData: credentials?.initData || '', googleIdToken: credentials?.googleIdToken || '' }); }
    catch { throw new Error('reauthentication_required'); }
    need((claims.telegramId != null || claims.googleId) && Number.isFinite(claims.expiresAt) && claims.expiresAt > now(), 'reauthentication_required');
    const selector = { ...(claims.telegramId != null ? { telegramId: claims.telegramId } : {}), ...(claims.googleId ? { googleId: claims.googleId } : {}) };
    const found = await users.find(selector).limit(2).toArray();
    need(found.length === 1 && !found[0].isBanned && id(found[0].tpcAccountNumber), 'reauthentication_required');
    const user = found[0]; const canonical = await users.find({ tpcAccountNumber: user.tpcAccountNumber }).limit(2).toArray();
    need(canonical.length === 1 && String(canonical[0]._id) === String(user._id) && !canonical[0].isBanned && Object.entries(selector).every(([key, value]) => canonical[0][key] === value) && claims.expiresAt > now(), 'reauthentication_required');
    return { userId: String(user._id), accountId: user.tpcAccountNumber, expiresAt: claims.expiresAt, selector };
  }
  async function stillEligible(binding, matchId) {
    if (!binding || binding.expiresAt <= now()) return false;
    const found = await users.find({ tpcAccountNumber: binding.accountId, ...binding.selector }).limit(2).toArray();
    if (found.length !== 1 || String(found[0]._id) !== binding.userId || found[0].isBanned) return false;
    const canonical = await users.find({ tpcAccountNumber: binding.accountId }).limit(2).toArray();
    if (canonical.length !== 1 || String(canonical[0]._id) !== binding.userId || canonical[0].isBanned || !Object.entries(binding.selector).every(([key, value]) => canonical[0][key] === value)) return false;
    const match = await escrowMatches.findOne({ _id: matchId });
    return binding.expiresAt > now() && match?.gameType === 'snake' && match.assetId === assetId && match.reservations?.some(r => r.accountId === binding.accountId);
  }
  async function publicState(matchId) {
    const match = await escrowMatches.findOne({ _id: matchId });
    need(match?.gameType === 'snake' && match.assetId === assetId, 'seat_required');
    const receipt = await receipts.findOne({ _id: `game-settlement:${matchId}` });
    if (receipt) {
      need(receipt.matchId === matchId && receipt.assetId === assetId && receipt.plan?.matchId === matchId &&
        receipt.plan.settlementKey === match.settlementKey && receipt.decision?.decisionId === match.result?.decisionId &&
        (receipt.plan.kind === 'winner' ? match.status === 'settled' : receipt.plan.kind === 'cancel_before_start' && match.status === 'refunded'), 'settlement_receipt_inconsistent');
    } else need(!['settled', 'refunded'].includes(match.status), 'settlement_receipt_missing');
    if (match.startedAt === null) {
      return { matchId, started: false, version: 0, finished: false, payoutStatus: receipt ? 'refunded' : 'not_due',
        ...(receipt ? { refundUnits: receipt.plan.transfers[0]?.units } : {}) };
    }
    const state = await moves.recover(matchId); const order = state.initial.turnOrder;
    if (receipt) need(state.current.finished && receipt.plan.kind === 'winner' && receipt.decision.journalHash === state.lastHash && order.includes(receipt.decision.winnerAccountId), 'settlement_result_inconsistent');
    return { matchId, started: true, version: state.version, board: state.initial.board, currentSeat: state.current.currentTurn, finished: state.current.finished,
      players: state.current.players.map((p, seat) => ({ seat, position: p.position, isActive: p.isActive })), diceCells: state.current.diceCells,
      payoutStatus: receipt ? 'settled' : state.current.finished ? 'pending' : 'not_due',
      ...(receipt ? { winnerSeat: order.indexOf(receipt.decision.winnerAccountId), prizeUnits: receipt.plan.transfers.find(t => t.kind === 'prize')?.units } : {}) };
  }
  async function deliver(matchId, payload) {
    // Never io.to(matchId)/socket room broadcasts: legacy APIs allow joining
    // arbitrary room IDs. Only direct sends to our verified membership registry.
    for (const socketId of [...(subscriptions.get(matchId) || [])]) {
      const socket = io.sockets.sockets.get(socketId); const binding = bindings.get(socketId);
      if (!socket?.connected || !await stillEligible(binding, matchId)) { subscriptions.get(matchId)?.delete(socketId); continue; }
      if (bindings.get(socketId) !== binding || binding.expiresAt <= now()) continue; // account switch during DB await
      socket.emit('snake:v1:state', payload);
    }
  }
  async function broadcastCommitted(matchId) {
    const payload = await publicState(matchId); await deliver(matchId, payload); return payload;
  }
  function attach(socket) {
    need(!controls.has(socket.id), 'socket_already_attached');
    const control = { generation: 0, busy: false }; controls.set(socket.id, control);
    socket.on('snake:v1:logout', acknowledge => { revoke(socket.id); if (typeof acknowledge === 'function') acknowledge({ ok: true }); });
    socket.on('disconnect', () => { revoke(socket.id); controls.delete(socket.id); });
    function event(name, fields, action) {
      socket.on(name, async (payload = {}, acknowledge) => {
        const ack = typeof acknowledge === 'function' ? acknowledge : () => {};
        if (control.busy) { ack({ ok: false, error: 'request_in_progress' }); return; }
        control.busy = true; let generation = control.generation;
        try {
          need(payload && typeof payload === 'object' && !Array.isArray(payload) && Object.keys(payload).every(k => fields.includes(k)) && id(payload.matchId), 'invalid_request');
          await ready();
          const binding = await identity(payload.credentials);
          need(socket.connected && control.generation === generation, 'authentication_changed');
          if (bindings.get(socket.id)?.userId !== binding.userId) { revoke(socket.id); generation = control.generation; }
          bindings.set(socket.id, binding);
          const result = await action(payload, binding);
          if (socket.connected && control.generation === generation && bindings.get(socket.id) === binding) ack({ ok: true, ...result });
        } catch (error) {
          const canRespond = socket.connected && control.generation === generation;
          if (['reauthentication_required', 'authentication_changed'].includes(error.message)) revoke(socket.id);
          if (canRespond) ack({ ok: false, error: PUBLIC_ERRORS.has(error.message) ? error.message : 'temporarily_unavailable' });
        } finally { control.busy = false; }
      });
    }
    event('snake:v1:offer', ['matchId', 'credentials'], async (payload, binding) => {
      const offer = await offers.findOne({ _id: payload.matchId });
      need(offer?.gameType === 'snake' && offer.assetId === assetId && offer.accountIds?.includes(binding.accountId), 'seat_required');
      const { terms, termsHash } = gameOfferTerms(offer);
      need(offer.board && snakeJournalRulesHash(terms.rulesVersion, offer.board) === terms.rulesHash, 'offer_changed');
      // Seat numbers instead of canonical/private account IDs in public payloads.
      return { offer: { matchId: terms.matchId, offerId: terms.offerId, revision: terms.revision, termsHash, assetId: terms.assetId, stakeUnits: terms.stakeUnits,
        feeUnits: terms.feePolicy.units, feePolicy: { policyId: terms.feePolicy.policyId, totalRoundUnits: terms.feePolicy.units }, board: { snakes: offer.board.snakes, ladders: offer.board.ladders, diceCells: offer.board.diceCells }, rulesVersion: terms.rulesVersion, rulesHash: terms.rulesHash, expiresAt: terms.expiresAt,
        seatCount: terms.accountIds.length, ownSeat: terms.turnOrder.indexOf(binding.accountId), turnOrder: terms.turnOrder.map((_, seat) => seat) } };
    });
    event('snake:v1:accept', ['matchId', 'termsHash', 'credentials'], async payload => {
      need(typeof payload.termsHash === 'string' && /^[a-f0-9]{64}$/.test(payload.termsHash), 'invalid_request');
      const consent = await producer.accept({ matchId: payload.matchId, presentedTermsHash: payload.termsHash, credentials: payload.credentials });
      return { accepted: true, matchId: payload.matchId, termsHash: consent.termsHash, expiresAt: consent.expiresAt };
    });
    event('snake:v1:sync', ['matchId', 'credentials'], async (payload, binding) => {
      need(await stillEligible(binding, payload.matchId), 'seat_required');
      const state = await publicState(payload.matchId);
      const members = subscriptions.get(payload.matchId) || new Set(); members.add(socket.id); subscriptions.set(payload.matchId, members);
      return { state };
    });
    event('snake:v1:roll', ['matchId', 'requestId', 'expectedVersion', 'credentials'], async (payload, binding) => {
      need(await stillEligible(binding, payload.matchId), 'seat_required');
      need(id(payload.requestId) && Number.isSafeInteger(payload.expectedVersion) && payload.expectedVersion >= 0, 'invalid_request');
      const committed = await moves.roll({ matchId: payload.matchId, requestId: payload.requestId, expectedVersion: payload.expectedVersion, credentials: payload.credentials });
      let settlementPending = false;
      if (committed.move.result.finished) {
        try { await coordinator.finish(payload.matchId); } catch { settlementPending = true; }
      }
      // A notification failure must not turn a committed move into a failed roll.
      let state;
      try { state = await broadcastCommitted(payload.matchId); } catch { /* reconnect/sync can recover committed state */ }
      return { matchId: payload.matchId, requestId: payload.requestId, moveCommitted: true, sequence: committed.move.sequence, duplicate: committed.duplicate,
        ...(state ? { payoutStatus: state.payoutStatus, state } : settlementPending ? { payoutStatus: 'pending' } : {}) };
    });
  }
  return {
    attach, revoke,
    // Server worker methods only, deliberately not registered as socket events.
    async reserveAndStart(matchId) {
      need(id(matchId), 'invalid_request'); await ready();
      const existing = await escrowMatches.findOne({ _id: matchId });
      if (existing?.assetId === assetId && ['settled', 'refunded'].includes(existing.status)) return { matchId, started: false, terminal: true };
      if (existing?.assetId === assetId && existing.startedAt) {
        const state = await moves.recover(matchId);
        return { matchId, started: true, recovered: true, version: state.version };
      }
      await producer.reserve(matchId);
      const offer = await offers.findOne({ _id: matchId });
      try {
        need(offer?.gameType === 'snake' && offer.assetId === assetId && offer.board, 'invalid_request');
        await coordinator.start(matchId, offer.board, offer.turnOrder);
      }
      catch (error) {
        // Pre-start refund checks durable state and cannot refund a started round,
        // even if a start's commit acknowledgement was lost.
        try { await coordinator.refundBeforeStart(matchId); } catch { /* reconciliation worker must inspect durable state */ }
        throw error;
      }
      let notificationPending = false;
      try { await broadcastCommitted(matchId); } catch { notificationPending = true; }
      return { matchId, started: true, notificationPending };
    },
    async retryFinishedSettlement(matchId) {
      need(id(matchId), 'invalid_request'); await ready();
      const state = await moves.recover(matchId); need(state.current.finished, 'game_not_finished');
      await coordinator.finish(matchId);
      let notificationPending = false; try { await broadcastCommitted(matchId); } catch { notificationPending = true; }
      return { matchId, settled: true, notificationPending };
    }
  };
}
