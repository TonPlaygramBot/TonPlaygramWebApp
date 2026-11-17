import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteAccountRecords } from '../services/accountDeletion.js';

function fixture(user = { _id: 'u1', accountId: 'owner', telegramId: 501, googleId: 'google-owner', transactions: [] }, failAt, collision = null) {
  const calls = [];
  const session = { async withTransaction(fn) { calls.push('start'); try { await fn(); calls.push('commit'); } catch (e) { calls.push('abort'); throw e; } }, async endSession() { calls.push('end'); } };
  const operation = (name) => async (...args) => { calls.push({ name, args }); assert.equal(args.at(-1).session, session); if (name === failAt) throw Error('database error'); return { deletedCount: 1 }; };
  const models = {
    User: { findOne(filter) { if (!filter.$or) assert.deepEqual(filter, { accountId: 'owner' }); return { session(s) { assert.equal(s, session); return Promise.resolve(filter.$or ? (typeof collision === 'function' ? collision(filter) : collision) : user); } }; }, deleteOne: operation('User.deleteOne'), updateMany: operation('User.updateMany') }
  };
  for (const name of ['Message', 'FriendRequest', 'SocialIdentityKey', 'ActiveConnection']) models[name] = { deleteMany: operation(name) };
  return { calls, deps: { models, startSession: async () => session } };
}

test('Google-only owner and Telegram owner can delete; all cleanup shares a transaction', async () => {
  for (const claims of [{ googleId: 'google-owner' }, { telegramId: 501 }]) {
    const { calls, deps } = fixture();
    await deleteAccountRecords('owner', claims, deps);
    assert.deepEqual(calls.filter((c) => typeof c === 'string'), ['start', 'commit', 'end']);
    assert.deepEqual(calls.filter((c) => c.name).map((c) => c.name), ['Message', 'FriendRequest', 'SocialIdentityKey', 'ActiveConnection', 'User.updateMany', 'User.deleteOne']);
    assert.deepEqual(calls[1].args[0], { $or: [{ from: { $in: ['owner', 501, '501'] } }, { to: { $in: ['owner', 501, '501'] } }] });
  }
});

test('Google-only account never queries a missing Telegram id or Google subject as a social identity', async () => {
  const { calls, deps } = fixture({ _id: 'u1', accountId: 'owner', googleId: 'google-owner' });
  await deleteAccountRecords('owner', { googleId: 'google-owner' }, deps);
  assert.deepEqual(calls[1].args[0].$or[0].from.$in, ['owner']);
});

test('wrong, empty, and mixed-account claims never mutate records', async () => {
  for (const claims of [{}, { googleId: 'other' }, { telegramId: 999 }, { telegramId: 501, googleId: 'other' }]) {
    const { calls, deps } = fixture();
    await assert.rejects(deleteAccountRecords('owner', claims, deps), { code: 'identity_mismatch' });
    assert.deepEqual(calls, ['start', 'abort', 'end']);
  }
});

test('missing accounts and pending activity stop before all writes', async () => {
  for (const [user, code] of [[null, 'account_not_found'], [{ accountId: 'owner', telegramId: 501, currentTableId: 'table' }, 'account_has_pending_activity'], [{ accountId: 'owner', telegramId: 501, transactions: [{ status: 'pending' }] }, 'account_has_pending_activity']]) {
    const { calls, deps } = fixture(user);
    await assert.rejects(deleteAccountRecords('owner', { telegramId: 501 }, deps), { code });
    assert.deepEqual(calls, ['start', 'abort', 'end']);
  }
});

test('cleanup failure propagates and aborts, never deletes user or reports success', async () => {
  const { calls, deps } = fixture(undefined, 'FriendRequest');
  await assert.rejects(deleteAccountRecords('owner', { telegramId: 501 }, deps), /database error/);
  assert.ok(!calls.some((c) => c.name === 'User.deleteOne'));
  assert.deepEqual(calls.slice(-2), ['abort', 'end']);
});

 test('legacy account/Telegram namespace collisions fail before destructive operations', async () => {
  const { calls, deps } = fixture(undefined, undefined, { accountId: '501', telegramId: 999 });
  await assert.rejects(deleteAccountRecords('owner', { telegramId: 501 }, deps), { code: 'ambiguous_social_identity' });
  assert.deepEqual(calls, ['start', 'abort', 'end']);
});

test('collision lookup checks both numeric account IDs and Telegram string aliases', async () => {
  for (const user of [
    { _id: 'u1', accountId: '501', googleId: 'google-owner' },
    { _id: 'u1', accountId: 'owner', telegramId: 501, googleId: 'google-owner' }
  ]) {
    let checked = false;
    const { calls, deps } = fixture(user, undefined, (filter) => {
      assert.equal(filter._id.$ne, 'u1');
      assert.ok(filter.$or[0].accountId.$in.includes('501'));
      assert.ok(filter.$or[1].telegramId.$in.includes(501));
      checked = true;
      return { _id: 'other' };
    });
    await assert.rejects(deleteAccountRecords('owner', { googleId: 'google-owner' }, deps), { code: 'ambiguous_social_identity' });
    assert.equal(checked, true);
    assert.deepEqual(calls, ['start', 'abort', 'end']);
  }
});
