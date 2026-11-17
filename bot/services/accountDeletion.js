import mongoose from 'mongoose';
import User from '../models/User.js';
import Message from '../models/Message.js';
import FriendRequest from '../models/FriendRequest.js';
import SocialIdentityKey from '../models/SocialIdentityKey.js';
import ActiveConnection from '../models/ActiveConnection.js';
import { identityOwnsUser } from '../middleware/accountIdentity.js';

const failure = (code, status) => Object.assign(new Error(code), { code, status });

// Deliberately limited to records whose ownership is unambiguous. External
// media, legacy wall/game records and financial retention need a separate plan.
export async function deleteAccountRecords(accountId, claims, {
  startSession = () => mongoose.startSession(),
  models = { User, Message, FriendRequest, SocialIdentityKey, ActiveConnection }
} = {}) {
  const session = await startSession();
  try {
    await session.withTransaction(async () => {
      const user = await models.User.findOne({ accountId }).session(session);
      if (!user) throw failure('account_not_found', 404);
      if (!identityOwnsUser(claims, user) ||
          (claims.googleId && claims.telegramId != null &&
           (claims.googleId !== user.googleId || claims.telegramId !== Number(user.telegramId)))) {
        throw failure('identity_mismatch', 403);
      }
      if (user.currentTableId || (user.transactions || []).some((tx) => tx?.status === 'pending')) {
        throw failure('account_has_pending_activity', 409);
      }
      const identities = [String(user.accountId)];
      if (Number.isSafeInteger(user.telegramId) && user.telegramId > 0) {
        identities.push(user.telegramId, String(user.telegramId));
      }
      // Legacy identifiers share one untagged namespace. Do not erase another
      // account's data when a numeric account ID aliases a Telegram ID.
      const numericIds = identities.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0);
      const collision = await models.User.findOne({
        _id: { $ne: user._id },
        $or: [{ accountId: { $in: identities.map(String) } }, { telegramId: { $in: numericIds } }]
      }).session(session);
      if (collision) throw failure('ambiguous_social_identity', 409);
      const participants = { $or: [{ from: { $in: identities } }, { to: { $in: identities } }] };
      // MongoDB transactions do not support parallel operations on one session.
      await models.Message.deleteMany(participants, { session });
      await models.FriendRequest.deleteMany(participants, { session });
      await models.SocialIdentityKey.deleteMany({ accountId: String(user.accountId) }, { session });
      await models.ActiveConnection.deleteMany({ userId: { $in: identities.map(String) } }, { session });
      await models.User.updateMany({ friends: { $in: identities } }, { $pull: { friends: { $in: identities } } }, { session });
      const result = await models.User.deleteOne({ _id: user._id }, { session });
      if (result.deletedCount !== 1) throw failure('account_changed_retry', 409);
    });
  } finally {
    await session.endSession();
  }
}
