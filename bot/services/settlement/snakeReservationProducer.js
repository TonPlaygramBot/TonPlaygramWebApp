import { fenceVerifiedGameAccount } from './gameFinancialFence.js';
import { createHash } from 'node:crypto';
import { buildVerifiedStakeConsent, gameOfferTerms, requireCurrentConsents } from './gameStakeConsent.js';
import { nextGameLifecycle, lifecycleCommandRecord } from './gameLifecycle.js';

function need(value, code) { if (!value) throw new Error(code); }
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const receiptKey = (matchId, accountId) => hash([matchId, accountId]);
function canonical(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
/** Exact attested snapshot binding, not a proof of legitimate historical funding. */
export function gameFundingFingerprint(user) {
  return hash(canonical({ userId: String(user._id), accountId: user.tpcAccountNumber, balance: user.balance, transactions: user.transactions }));
}
const txOptions = { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' };

/**
 * UNWIRED native Mongo adapters. No route/import activation. No audit issuer here:
 * a separately verified provenance migration must attest balances before reserve.
 */
export function createSnakeReservationProducer({ client, offers, consents, users, fundingAudits, accountLocks,
  escrowMatches, lifecycleMatches, journal, assetId, now = Date.now, verifyCredentials }) {
  need(client?.startSession && offers && consents && users && fundingAudits && accountLocks && escrowMatches && lifecycleMatches && journal && assetId, 'reservation_dependencies_required');
  async function transact(callback) {
    const session = client.startSession(); let result;
    try { await session.withTransaction(async () => { result = await callback(session); }, txOptions); return result; }
    finally { await session.endSession(); }
  }
  return {
    async accept({ matchId, presentedTermsHash, credentials }) {
      need(typeof matchId === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(matchId), 'invalid_match');
      // Fresh signature verification is repeated within the callback when Mongo
      // retries. No raw token or credential is persisted in receipts or logs.
      return transact(async session => {
        const offer = await offers.findOne({ _id: matchId }, { session });
        need(offer?.matchId === matchId && offer.gameType === 'snake' && offer.assetId === assetId, 'offer_not_supported');
        const receipt = await buildVerifiedStakeConsent({ offer, presentedTermsHash, credentials }, {
          users: { find: query => users.find(query, { session }) }, now, ...(verifyCredentials ? { verifyCredentials } : {})
        });
        const key = receiptKey(matchId, receipt.accountId);
        const old = await consents.findOne({ _id: key }, { session });
        need(!old || (old.matchId === receipt.matchId && old.accountId === receipt.accountId && old.userId === receipt.userId &&
          (old.termsHash === receipt.termsHash || (Number.isSafeInteger(old.offerRevision) && old.offerRevision < receipt.offerRevision))), 'consent_conflict');
        // Write the offer too: a concurrent cancellation/term change must conflict
        // with this acceptance transaction, not leave a receipt for an old offer.
        const changed = await offers.updateOne({ _id: matchId, status: 'offered', revision: offer.revision }, { $inc: { consentRevision: 1 } }, { session });
        need(changed.modifiedCount === 1, 'offer_changed');
        await consents.replaceOne({ _id: key }, { _id: key, ...receipt }, { session, upsert: true });
        return receipt;
      });
    },
    async reserve(matchId) {
      need(typeof matchId === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(matchId), 'invalid_match');
      return transact(async session => {
        const offer = await offers.findOne({ _id: matchId }, { session });
        need(offer?.matchId === matchId && offer.gameType === 'snake' && offer.assetId === assetId, 'offer_not_supported');
        const { terms, termsHash } = gameOfferTerms(offer);
        const existing = await escrowMatches.findOne({ _id: matchId }, { session });
        const lifecycle = await lifecycleMatches.findOne({ _id: matchId }, { session });
        if (existing) {
          need(existing.termsHash === termsHash && existing.assetId === assetId && existing.status === 'reserved' &&
            existing.startedAt === null && offer.status === 'reserved' && lifecycle?.status === 'reserved', 'reservation_already_advanced_or_conflicting');
          return { duplicate: true, match: existing };
        }
        const at = now();
        const accepted = await consents.find({ matchId }, { session }).toArray();
        requireCurrentConsents(offer, accepted, at);
        need(lifecycle?.status === 'offered' && lifecycle.offerId === terms.offerId && lifecycle.matchId === matchId &&
          hash([...lifecycle.accountIds].sort()) === hash(terms.accountIds), 'lifecycle_offer_mismatch');
        const amount = Number(terms.stakeUnits);
        const participants = [];
        for (const accountId of terms.accountIds) {
          const consent = accepted.find(r => r.accountId === accountId);
          const found = await users.find({ tpcAccountNumber: accountId }, { session }).limit(2).toArray();
          need(found.length === 1, 'canonical_account_missing_or_ambiguous'); const user = found[0];
          need(String(user._id) === consent.userId && !user.isBanned && consent.identity &&
            Object.keys(consent.identity).length > 0 && Object.entries(consent.identity).every(([k, v]) =>
              ['telegramId', 'googleId'].includes(k) && user[k] === v), 'consent_identity_changed');
          need(Number.isSafeInteger(user.balance) && user.balance >= amount && Array.isArray(user.transactions), 'insufficient_or_unsafe_balance');
          const audit = await fundingAudits.findOne({ _id: accountId }, { session });
          need(audit?.assetId === assetId && audit.userId === consent.userId && audit.status === 'verified' &&
            Number.isSafeInteger(audit.version) && audit.version >= 0 && audit.version < Number.MAX_SAFE_INTEGER && audit.fingerprint === gameFundingFingerprint(user) &&
            audit.availableUnits === String(user.balance), 'funding_provenance_required');
          const id = `snake-reserve:${receiptKey(matchId, accountId)}`;
          need(!user.transactions.some(t => t.transactionId === id), 'orphan_reservation_debit');
          participants.push({ accountId, user, consent, audit, id });
        }
        // A positive fee must have a real, unique destination before any stake
        // is held. Its identity/availability still needs rechecking at payout.
        if (BigInt(terms.feePolicy.units) > 0n) {
          const house = await users.find({ tpcAccountNumber: terms.feePolicy.accountId }, { session }).limit(2).toArray();
          need(house.length === 1 && !house[0].isBanned, 'fee_recipient_unavailable');
          const houseAudit = await fundingAudits.findOne({ _id: terms.feePolicy.accountId }, { session });
          need(Number.isSafeInteger(house[0].balance) && house[0].balance >= 0 && Array.isArray(house[0].transactions) &&
            houseAudit?.status === 'verified' && Number.isSafeInteger(houseAudit.version) && houseAudit.version >= 0 && houseAudit.version < Number.MAX_SAFE_INTEGER && houseAudit.assetId === assetId && houseAudit.userId === String(house[0]._id) &&
            houseAudit.availableUnits === String(house[0].balance) && houseAudit.fingerprint === gameFundingFingerprint(house[0]), 'fee_provenance_required');
          await fenceVerifiedGameAccount({ users, fundingAudits, user: house[0], audit: houseAudit, session });
        }
        const reservations = [];
        for (const p of participants) {
          await accountLocks.insertOne({ _id: p.accountId, matchId, assetId, userId: p.consent.userId, createdAt: at }, { session });
          const debit = { transactionId: p.id, amount: -amount, type: 'stake_reserve', token: 'TPG', status: 'reserved', game: 'snake', detail: matchId, players: terms.accountIds.length, date: new Date(at) };
          const changed = await users.updateOne({ _id: p.user._id, tpcAccountNumber: p.accountId, balance: p.user.balance,
            transactions: p.user.transactions, isBanned: { $ne: true }, ...p.consent.identity },
          { $inc: { balance: -amount }, $push: { transactions: debit } }, { session });
          need(changed.modifiedCount === 1, 'reservation_debit_conflict');
          const updated = { ...p.user, balance: p.user.balance - amount, transactions: [...p.user.transactions, debit] };
          const advanced = await fundingAudits.updateOne({ _id: p.accountId, version: p.audit.version, fingerprint: p.audit.fingerprint },
            { $set: { fingerprint: gameFundingFingerprint(updated), availableUnits: String(updated.balance) }, $inc: { version: 1 } }, { session });
          need(advanced.modifiedCount === 1, 'funding_audit_conflict');
          reservations.push({ accountId: p.accountId, receiptId: p.id, matchId, assetId, status: 'held', units: terms.stakeUnits });
        }
        // Time may advance while DB operations run. Abort, do not debit expired consent.
        requireCurrentConsents(offer, accepted, now());
        const match = { _id: matchId, matchId, roomId: terms.roomId, gameType: 'snake', assetId, termsHash,
          status: 'reserved', version: 0, startedAt: null, rulesHash: terms.rulesHash, feePolicy: terms.feePolicy, reservations, reservedAt: at };
        await escrowMatches.insertOne(match, { session });
        const changed = await offers.updateOne({ _id: matchId, status: 'offered', revision: offer.revision }, { $set: { status: 'reserved' } }, { session });
        need(changed.modifiedCount === 1, 'offer_reservation_conflict');
        const event = { matchId, eventId: `reserve:${hash(matchId)}`, kind: 'reservation_committed', referenceId: matchId,
          expectedVersion: lifecycle.version, at };
        const next = nextGameLifecycle(lifecycle, event); const { _id, ...fields } = next;
        const moved = await lifecycleMatches.updateOne({ _id: matchId, version: lifecycle.version, status: 'offered' }, { $set: fields }, { session });
        need(moved.modifiedCount === 1, 'lifecycle_reservation_conflict');
        const { command, eventKey, commandHash } = lifecycleCommandRecord(event);
        await journal.insertOne({ _id: eventKey, matchId, version: next.version, commandHash, command, state: next }, { session });
        return { duplicate: false, match };
      });
    }
  };
}
