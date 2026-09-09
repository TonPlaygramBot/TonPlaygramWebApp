import { GIFT_BY_ID } from '../../utils/nftGifts.js';
export const formatGiftPrice = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
/** UI-only duplicate-tap guard; server-side idempotency remains a separate concern. */
export function createGiftCheckout(send) {
  let pending = false;
  return async ({ fromAccount, toAccount, giftId }) => {
    if (pending) return { ignored: true };
    const from = String(fromAccount || '').trim(), to = String(toAccount || '').trim();
    if (!from || !to) throw new Error('Sign in and select a recipient before continuing.');
    if (!GIFT_BY_ID[giftId]) throw new Error('This gift is no longer available.');
    pending = true;
    try {
      // Prices are NEVER sent by the client; the server resolves the catalog ID.
      const result = await send(from, to, giftId);
      if (!result || typeof result !== 'object') throw new Error('Delivery could not be confirmed. Check your inventory and balance before trying again.');
      if (result.error || result.success === false) throw new Error(typeof result.error === 'string' ? result.error : 'The gift was not accepted.');
      return { result };
    } finally { pending = false; }
  };
}
