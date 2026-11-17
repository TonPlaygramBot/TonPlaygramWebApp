import { Router } from 'express';
import socialAuthenticate from '../middleware/socialAuth.js';
import { deliverGift, GiftDeliveryError } from '../utils/giftDelivery.js';

export function createGiftPurchaseRouter(deliver = deliverGift) {
  const router = Router();
  router.get('/', socialAuthenticate, (req, res) => res.json({
    accountId: req.socialUser.accountId,
    purchasingEnabled: !process.env.NFT_API_BASE_URL,
    ...process.env.NFT_API_BASE_URL ? { error: 'Gift purchasing is unavailable while NFT provider integration is being upgraded.' } : {}
  }));
  router.post('/', socialAuthenticate, async (req, res) => {
    const owner = req.socialUser;
    if (!owner?._id || req.body?.fromAccount !== owner.accountId) {
      return res.status(403).json({ error: 'forbidden', code: 'FORBIDDEN', rejected: false, requestId: req.body?.requestId });
    }
    try {
      const receipt = await deliver(req.body || {}, sender =>
        !sender.isBanned && String(sender._id) === String(owner._id) && sender.accountId === owner.accountId);
      return res.json(receipt);
    } catch (error) {
      if (error instanceof GiftDeliveryError) {
        return res.status(error.status).json({ error: error.message, code: error.code,
          rejected: error.rejected, requestId: req.body?.requestId });
      }
      console.error('Gift delivery could not be confirmed:', error.code || error.name);
      return res.status(503).json({ error: 'Delivery could not be confirmed. Resume this request to check safely.',
        code: 'DELIVERY_UNCONFIRMED', rejected: false, requestId: req.body?.requestId });
    }
  });
  return router;
}
export default createGiftPurchaseRouter();
