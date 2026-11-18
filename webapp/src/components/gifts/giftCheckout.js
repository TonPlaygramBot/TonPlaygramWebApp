import { GIFT_BY_ID } from '../../utils/nftGifts.js';
export const formatGiftPrice = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uncertain = 'Delivery could not be confirmed. Retry this same request safely; do not start another purchase.';
/** Persist the intent BEFORE transmission. Reloads and explicit retries use the same server key. */
export function createGiftCheckout(send, options = {}) {
  let pending = false;
  const storage = () => options.storage || globalThis.sessionStorage;
  const key = from => `tpg:gift-intent:v1:${encodeURIComponent(from)}`;
  const recover = fromAccount => {
    const from = String(fromAccount || '').trim();
    if (!from) return null;
    try {
      const saved = storage().getItem(key(from));
      if (!saved) return null;
      const intent = JSON.parse(saved);
      if (intent.fromAccount !== from || !GIFT_BY_ID[intent.giftId] || typeof intent.toAccount !== 'string' || !intent.toAccount || !uuidPattern.test(intent.requestId)) throw new Error();
      return intent;
    } catch { throw new Error('Gift recovery storage is unavailable or invalid. No new gift was sent. Restore this browser session before purchasing.'); }
  };
  const checkout = async ({ fromAccount, toAccount, giftId }) => {
    if (pending) return { ignored: true };
    const from = String(fromAccount || '').trim(), to = String(toAccount || '').trim();
    if (!from || !to) throw new Error('Sign in and select a recipient before continuing.');
    if (!GIFT_BY_ID[giftId]) throw new Error('This gift is no longer available.');
    pending = true;
    let intent;
    try {
      intent = recover(from);
      if (intent && (intent.toAccount !== to || intent.giftId !== giftId)) {
        const error = new Error('Resolve your previous gift request before starting another purchase.');
        error.intent = intent; throw error;
      }
      if (!intent) {
        const requestId = options.uuid ? options.uuid() : globalThis.crypto?.randomUUID?.();
        if (!uuidPattern.test(requestId || '')) throw new Error('Secure gift checkout is unavailable in this browser. No gift was sent.');
        intent = { fromAccount: from, toAccount: to, giftId, requestId };
        try { storage().setItem(key(from), JSON.stringify(intent)); }
        catch { throw new Error('Could not save gift recovery details. No gift was sent.'); }
      }
      // Prices never enter the request; the server resolves the immutable catalog ID.
      const result = await send(from, to, giftId, intent.requestId);
      if (!result || typeof result !== 'object') throw new Error(uncertain);
      if (result.error || result.success === false) {
        // Only a durable terminal outcome can release an ambiguous previous attempt.
        const terminalRejection = result.requestId === intent.requestId && result.requestStatus === 'rejected';
        if (terminalRejection) {
          storage().removeItem(key(from)); intent = null;
        }
        const error = new Error(typeof result.error === 'string' ? result.error : uncertain);
        error.terminalRejection = terminalRejection;
        throw error;
      }
      const tx = result.transaction;
      if (result.requestId !== intent.requestId || !Number.isFinite(result.balance) || !tx || tx.type !== 'gift' || tx.token !== 'TPG' ||
          tx.status !== 'delivered' || tx.detail !== giftId || tx.toAccount !== to || tx.amount !== -GIFT_BY_ID[giftId].price) throw new Error(uncertain);
      storage().removeItem(key(from));
      return { result };
    } catch (error) {
      if (intent) error.intent = intent;
      throw error;
    } finally { pending = false; }
  };
  checkout.recover = recover;
  return checkout;
}
