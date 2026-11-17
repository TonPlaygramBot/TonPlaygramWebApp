/**
 * OFFLINE FOUNDATION ONLY. No route imports this module and it never moves funds.
 * Inputs MUST come from transactionally loaded, trusted server records, NOT a
 * request body. Validation here proves shape/arithmetic, not funding, authority,
 * on-chain finality, or idempotent execution. See docs/security/game-settlement-foundation.md.
 */
const GAMES = new Set(['snake', 'poolroyale']);
const MAX_UNITS = (1n << 120n) - 1n;
function requireValue(condition, code) {
  if (!condition) throw new Error(code);
}
function id(value, code) {
  requireValue(typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(value), code);
  return value;
}
function units(value) {
  requireValue(typeof value === 'string' && /^(0|[1-9][0-9]{0,36})$/.test(value), 'invalid_units');
  const parsed = BigInt(value);
  requireValue(parsed <= MAX_UNITS, 'invalid_units');
  return parsed;
}

export function buildReservedMatchSettlementPlan(snapshot, decision) {
  requireValue(snapshot && decision, 'missing_records');
  const matchId = id(snapshot.matchId, 'invalid_match');
  const assetId = id(snapshot.assetId, 'invalid_asset');
  requireValue(GAMES.has(snapshot.gameType), 'unsupported_game');
  requireValue(snapshot.status === 'reserved', 'match_not_reserved');
  requireValue(decision.matchId === matchId && decision.gameType === snapshot.gameType,
    'decision_match_mismatch');
  const decisionId = id(decision.decisionId, 'invalid_decision');
  requireValue(Array.isArray(snapshot.reservations) && snapshot.reservations.length >= 2 &&
    snapshot.reservations.length <= (snapshot.gameType === 'snake' ? 4 : 2), 'invalid_roster');
  const accounts = new Set();
  const receiptIds = new Set();
  let total = 0n;
  const reservations = Array.from(snapshot.reservations, (entry) => {
    requireValue(entry && typeof entry === 'object' && !Array.isArray(entry), 'invalid_reservation');
    const accountId = id(entry.accountId, 'invalid_account');
    const receiptId = id(entry.receiptId, 'invalid_receipt');
    requireValue(!accounts.has(accountId) && !receiptIds.has(receiptId), 'duplicate_reservation');
    requireValue(entry.matchId === matchId && entry.assetId === assetId && entry.status === 'held',
      'reservation_mismatch');
    const amount = units(entry.units);
    requireValue(amount > 0n, 'empty_reservation');
    accounts.add(accountId); receiptIds.add(receiptId); total += amount;
    requireValue(total <= MAX_UNITS, 'total_out_of_range');
    return { accountId, receiptId, units: amount.toString() };
  }).sort((a, b) => a.accountId < b.accountId ? -1 : a.accountId > b.accountId ? 1 : 0);

  // Unequal stakes need separately specified game economics, not an implicit bet.
  requireValue(new Set(reservations.map((r) => r.units)).size === 1, 'unequal_stakes');
  let transfers;
  let evidenceId = null;
  if (decision.kind === 'cancel_before_start') {
    requireValue(snapshot.startedAt === null, 'already_started');
    transfers = reservations.map((r) => ({ accountId: r.accountId, units: r.units, kind: 'refund' }));
  } else if (decision.kind === 'winner') {
    requireValue(typeof snapshot.startedAt === 'string' && Number.isFinite(Date.parse(snapshot.startedAt)),
      'not_started');
    requireValue(accounts.has(decision.winnerAccountId), 'winner_not_reserved');
    // This ID must reference a durable adjudicator result; a supplied ID is NOT proof.
    evidenceId = id(decision.evidenceId, 'missing_adjudication');
    requireValue(snapshot.feePolicy && typeof snapshot.feePolicy === 'object', 'missing_fee_policy');
    id(snapshot.feePolicy.policyId, 'missing_fee_policy');
    const fee = units(snapshot.feePolicy.units);
    requireValue(fee < total, 'fee_exceeds_pot');
    transfers = [{ accountId: decision.winnerAccountId, units: (total - fee).toString(), kind: 'prize' }];
    if (fee > 0n) {
      const recipient = id(snapshot.feePolicy.accountId, 'invalid_fee_recipient');
      requireValue(!accounts.has(recipient), 'fee_recipient_is_player');
      transfers.push({ accountId: recipient, units: fee.toString(), kind: 'fee' });
    }
  } else {
    throw new Error('unsupported_decision');
  }
  requireValue(transfers.reduce((sum, t) => sum + BigInt(t.units), 0n) === total, 'unbalanced_plan');
  return Object.freeze({
    version: 1,
    // Same key for winner AND cancellation. A durable unique receipt/CAS is still required.
    settlementKey: `game-settlement:${matchId}`,
    matchId, assetId, gameType: snapshot.gameType, decisionId, evidenceId,
    kind: decision.kind, totalUnits: total.toString(),
    reservationReceiptIds: Object.freeze(reservations.map((r) => r.receiptId)),
    transfers: Object.freeze(transfers.map(Object.freeze))
  });
}
