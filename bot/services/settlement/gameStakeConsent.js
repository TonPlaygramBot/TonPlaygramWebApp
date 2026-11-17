import { createHash } from 'node:crypto';
import { verifySocialCredentials } from '../../middleware/socialAuth.js';

const ID = /^[A-Za-z0-9_.:-]{1,160}$/;
const validId = v => typeof v === 'string' && ID.test(v);
function requireValue(condition, code) { if (!condition) throw new Error(code); }

/** Trusted server offer. No fee/stake defaults; all economics must be explicit. */
export function gameOfferTerms(offer) {
  requireValue(offer && validId(offer.matchId) && validId(offer.offerId) && validId(offer.assetId) &&
    ['snake', 'poolroyale'].includes(offer.gameType), 'invalid_offer');
  requireValue(Number.isSafeInteger(offer.revision) && offer.revision >= 0 &&
    Number.isSafeInteger(offer.expiresAt) && offer.expiresAt > 0, 'invalid_offer_version');
  requireValue(typeof offer.stakeUnits === 'string' && /^[1-9][0-9]{0,15}$/.test(offer.stakeUnits) &&
    BigInt(offer.stakeUnits) <= BigInt(Number.MAX_SAFE_INTEGER), 'invalid_offer_stake');
  requireValue(Array.isArray(offer.accountIds) && offer.accountIds.length >= 2 &&
    offer.accountIds.length <= (offer.gameType === 'snake' ? 4 : 2), 'invalid_offer_roster');
  const accountIds = Array.from(offer.accountIds);
  requireValue(BigInt(offer.stakeUnits) * BigInt(accountIds.length) <= BigInt(Number.MAX_SAFE_INTEGER), 'offer_pot_unsafe');
  requireValue(accountIds.every(validId) && new Set(accountIds).size === accountIds.length, 'invalid_offer_roster');
  requireValue(typeof offer.rulesHash === 'string' && /^[a-f0-9]{64}$/.test(offer.rulesHash), 'invalid_offer_rules');
  requireValue(offer.feePolicy && validId(offer.feePolicy.policyId) && typeof offer.feePolicy.units === 'string' &&
    /^(0|[1-9][0-9]{0,15})$/.test(offer.feePolicy.units), 'invalid_offer_fee');
  const fee = BigInt(offer.feePolicy.units);
  requireValue(fee < BigInt(offer.stakeUnits) * BigInt(accountIds.length), 'invalid_offer_fee');
  requireValue(fee === 0n || (validId(offer.feePolicy.accountId) && !accountIds.includes(offer.feePolicy.accountId)), 'invalid_offer_fee_recipient');
  const terms = { version: 1, matchId: offer.matchId, offerId: offer.offerId, revision: offer.revision, assetId: offer.assetId,
    gameType: offer.gameType, stakeUnits: offer.stakeUnits, accountIds: accountIds.sort(), rulesHash: offer.rulesHash,
    feePolicy: { policyId: offer.feePolicy.policyId, units: offer.feePolicy.units, accountId: fee ? offer.feePolicy.accountId : null }, expiresAt: offer.expiresAt };
  return { terms, termsHash: createHash('sha256').update(JSON.stringify(terms)).digest('hex') };
}

/**
 * UNWIRED. Fresh signature verification + canonical account lookup, never legacy
 * socket.data.playerId or compatibility identity headers. Returns a receipt to
 * persist atomically against the still-current offer revision. Does NOT debit.
 */
export async function buildVerifiedStakeConsent({ offer, presentedTermsHash, credentials },
  { users, now = Date.now, verifyCredentials = verifySocialCredentials } = {}) {
  requireValue(users?.find, 'consent_identity_store_required');
  const { terms, termsHash } = gameOfferTerms(offer);
  requireValue(presentedTermsHash === termsHash && offer.status === 'offered', 'offer_changed');
  const claims = await verifyCredentials({ initData: credentials?.initData || '', googleIdToken: credentials?.googleIdToken || '' });
  requireValue(Number.isFinite(claims?.expiresAt) && claims.expiresAt > now(), 'credential_expired');
  requireValue(claims.telegramId != null || claims.googleId, 'signed_identity_required');
  const selector = { ...(claims.telegramId != null ? { telegramId: claims.telegramId } : {}), ...(claims.googleId ? { googleId: claims.googleId } : {}) };
  const found = await users.find(selector).limit(2).toArray();
  requireValue(found.length === 1 && !found[0].isBanned && validId(found[0].tpcAccountNumber), 'canonical_identity_required');
  const user = found[0];
  const canonical = await users.find({ tpcAccountNumber: user.tpcAccountNumber }).limit(2).toArray();
  requireValue(canonical.length === 1 && String(canonical[0]._id) === String(user._id), 'canonical_identity_ambiguous');
  requireValue(!canonical[0].isBanned && Object.entries(selector).every(([key, value]) => canonical[0][key] === value), 'identity_changed');
  requireValue(terms.accountIds.includes(user.tpcAccountNumber), 'seat_not_offered');
  const acceptedAt = now();
  requireValue(Number.isSafeInteger(acceptedAt) && acceptedAt > 0 && terms.expiresAt > acceptedAt && claims.expiresAt > acceptedAt, 'consent_expired');
  return Object.freeze({ version: 1, matchId: terms.matchId, offerId: terms.offerId, offerRevision: terms.revision,
    termsHash, accountId: user.tpcAccountNumber, userId: String(user._id), acceptedAt,
    expiresAt: Math.min(terms.expiresAt, claims.expiresAt) });
}

/** Trusted persisted receipts only. This is shape/lifecycle validation, not signature validation. */
export function requireCurrentConsents(offer, receipts, now) {
  const { terms, termsHash } = gameOfferTerms(offer);
  requireValue(offer.status === 'offered' && Number.isSafeInteger(now) && terms.expiresAt > now, 'offer_expired');
  requireValue(Array.isArray(receipts) && receipts.length === terms.accountIds.length, 'consents_incomplete');
  const accounts = new Set();
  for (const receipt of Array.from(receipts)) {
    requireValue(receipt && receipt.matchId === terms.matchId && receipt.offerId === terms.offerId && receipt.offerRevision === terms.revision &&
      receipt.termsHash === termsHash && terms.accountIds.includes(receipt.accountId) && !accounts.has(receipt.accountId) &&
      typeof receipt.userId === 'string' && receipt.userId && Number.isSafeInteger(receipt.acceptedAt) && receipt.acceptedAt <= now &&
      Number.isSafeInteger(receipt.expiresAt) && receipt.expiresAt > now && receipt.expiresAt <= terms.expiresAt,
    'consent_not_current');
    accounts.add(receipt.accountId);
  }
  return termsHash;
}
