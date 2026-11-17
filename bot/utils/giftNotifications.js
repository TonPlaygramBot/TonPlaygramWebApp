import GiftDelivery from '../models/GiftDelivery.js';

/**
 * Postcommit outbox with an at-most-once transport attempt.
 * Telegram offers no idempotency key: never automatically reclaim attempting or
 * uncertain jobs. A crash/timeout may mean a notice was delivered; reconcile
 * manually rather than sending a duplicate. This does not affect the gift.
 */
export async function drainGiftNotifications(send, { DeliveryModel = GiftDelivery, limit = 10 } = {}) {
  if (typeof send !== 'function') throw new TypeError('Notification transport required');
  let attempted = 0;
  for (; attempted < Math.min(100, Math.max(0, limit)); attempted++) {
    const record = await DeliveryModel.findOneAndUpdate(
      { 'notification.state': 'pending' },
      { $set: { 'notification.state': 'attempting', 'notification.claimedAt': new Date() } },
      { new: true, sort: { createdAt: 1 }, writeConcern: { w: 'majority' } }
    ).lean();
    if (!record) break;
    const notice = record.notification;
    try {
      const result = await send(notice.telegramId,
        `🧧 You received ${notice.giftName} worth ${notice.price} TPG from ${notice.senderName}.`);
      await DeliveryModel.updateOne({ _id: record._id, 'notification.state': 'attempting' },
        { $set: { 'notification.state': 'sent', 'notification.sentAt': new Date(),
          'notification.messageId': String(result?.message_id || '') } }, { writeConcern: { w: 'majority' } });
    } catch {
      // Includes a successful send followed by a failed acknowledgement write.
      // If even this write fails, attempting remains durable and is not retried.
      await DeliveryModel.updateOne({ _id: record._id, 'notification.state': 'attempting' },
        { $set: { 'notification.state': 'uncertain' } }, { writeConcern: { w: 'majority' } }).catch(() => {});
    }
  }
  return attempted;
}
