import test from 'node:test';
import assert from 'node:assert/strict';
import InfluencerTask from '../models/InfluencerTask.js';
import User from '../models/User.js';
import Message from '../models/Message.js';

test('influencer submissions keep admin notifications without inserting forged private conversations', async (t) => {
  const previousToken = process.env.BOT_TOKEN;
  const previousDeveloper = process.env.DEV_ACCOUNT_ID;
  process.env.BOT_TOKEN ||= '123456:test-only-token';
  process.env.DEV_ACCOUNT_ID = 'developer-account';
  t.after(() => {
    if (previousToken === undefined) delete process.env.BOT_TOKEN; else process.env.BOT_TOKEN = previousToken;
    if (previousDeveloper === undefined) delete process.env.DEV_ACCOUNT_ID; else process.env.DEV_ACCOUNT_ID = previousDeveloper;
  });
  const [{ default: router }, { default: bot }] = await Promise.all([
    import('../routes/influencer.js'), import('../bot.js')
  ]);
  const input = { telegramId: 8675309, videoUrl: 'https://example.test/submitted-video', platform: 'youtube' };
  const task = { _id: 'submitted-task', userId: String(input.telegramId), videoUrl: input.videoUrl, platform: input.platform };
  const createTask = t.mock.method(InfluencerTask, 'create', async () => task);
  t.mock.method(User, 'findOne', async () => ({ accountId: 'developer-account', telegramId: 123 }));
  const sendTelegram = t.mock.method(bot.telegram, 'sendMessage', async () => ({ message_id: 1 }));
  const createPrivateMessage = t.mock.method(Message, 'create', async () => {
    throw new Error('Submissions must never write private conversations');
  });
  const events = [];
  const io = { to: (socketId) => ({ emit: (event, value) => events.push({ socketId, event, value }) }) };
  const userSockets = new Map([['developer-account', new Set(['developer-socket'])]]);
  const req = { body: input, app: { get: (key) => ({ io, userSockets })[key] } };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  const handler = router.stack.find((layer) => layer.route?.path === '/submit').route.stack[0].handle;
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, task);
  assert.equal(createTask.mock.callCount(), 1);
  assert.equal(sendTelegram.mock.callCount(), 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'influencerSubmit');
  assert.equal(createPrivateMessage.mock.callCount(), 0);
});
