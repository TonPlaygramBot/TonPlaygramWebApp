import { test, jest, expect } from '@jest/globals';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import User from '../bot/models/User.js';
import registerMine from '../bot/commands/mine.js';
import registerTasks from '../bot/commands/tasks.js';

process.env.BOT_TOKEN = 'reward-guard-test-token';
process.env.AIRDROP_ADMIN_TOKENS = 'reward-admin-test-token';
import adsRouter from '../bot/routes/ads.js';
import referralRouter from '../bot/routes/referral.js';
import checkinRouter from '../bot/routes/checkin.js';
import miningRouter from '../bot/routes/mining.js';
import tasksRouter from '../bot/routes/tasks.js';
import watchRouter from '../bot/routes/watch.js';
import airdropRouter from '../bot/routes/airdrop.js';
import influencerRouter from '../bot/routes/influencer.js';
jest.mock('../bot/bot.js', () => ({ __esModule: true, default: { telegram: {} } }));
jest.mock('../bot/utils/notifications.js', () => ({ sendTPCNotification: jest.fn() }));
const routers = [['ads', adsRouter], ['referral', referralRouter], ['checkin', checkinRouter], ['mining', miningRouter], ['tasks', tasksRouter], ['watch', watchRouter], ['airdrop', airdropRouter], ['influencer', influencerRouter]];

function initData(id) {
  const params = new URLSearchParams({ user: JSON.stringify({ id }), auth_date: String(Math.floor(Date.now() / 1000)) });
  const data = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const key = crypto.createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN).digest();
  params.set('hash', crypto.createHmac('sha256', key).update(data).digest('hex'));
  return params.toString();
}

async function withApi(fn) {
  const app = express();
  app.use(express.json());
  for (const [name, router] of routers) app.use(`/${name}`, router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, body = { telegramId: 123 }, headers = { 'x-telegram-init-data': initData(123) }, method = 'POST') => fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  try { await fn(request); } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

const publicRewardPaths = ['/ads/watch', '/ads/quest-watch', '/watch/watch', '/referral/claim', '/mining/start', '/mining/stop', '/mining/claim', '/tasks/complete', '/tasks/verify-post'];

test('anonymous or forged-identity callers cannot reach reward handlers', async () => {
  await withApi(async request => {
    for (const path of [...publicRewardPaths, '/checkin/check-in', '/mining/status', '/ads/status', '/watch/list', '/referral/code', '/influencer/submit', '/influencer/mine']) {
      const response = await request(path, { telegramId: 123 }, { 'x-tpc-account-id': 'victim', 'x-google-id': 'victim-google' });
      assert.equal(response.status, 401, path);
    }
  });
});

test('verified users cannot award unverified rewards, including concurrent retries', async () => {
  const original = User.findOneAndUpdate;
  let databaseWrites = 0;
  User.findOneAndUpdate = async () => { databaseWrites++; throw new Error('reward must not write'); };
  try {
    await withApi(async request => {
      const responses = await Promise.all([...publicRewardPaths, ...publicRewardPaths].map(path => request(path, { telegramId: 123, code: 'invite', videoId: 'video', taskId: 'task', tweetUrl: 'https://example.com/status/1' })));
      for (const response of responses) {
        assert.equal(response.status, 403);
        assert.equal((await response.json()).code, 'reward_verification_required');
      }
    });
    assert.equal(databaseWrites, 0);
  } finally { User.findOneAndUpdate = original; }
});

test('authenticated users cannot select another Telegram account on reads or check-in', async () => {
  await withApi(async request => {
    for (const path of ['/checkin/check-in', '/mining/status', '/ads/status', '/watch/list', '/referral/code', '/influencer/mine']) {
      const response = await request(path, { telegramId: 456 });
      assert.equal(response.status, 403, path);
    }
  });
});

test('administrator credentials do not bypass unverified settlement gates', async () => {
  await withApi(async request => {
    for (const path of ['/airdrop/grant', '/airdrop/grant-all']) {
      const response = await request(path, { telegramId: 123, amount: 100 }, { authorization: 'Bearer reward-admin-test-token' });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).code, 'reward_verification_required');
    }
    const response = await request('/influencer/admin/task/verify', { status: 'approved', views: 100000 }, { authorization: 'Bearer reward-admin-test-token' }, 'PATCH');
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, 'reward_verification_required');
  });
});

test('mining status is read-only even when a mining session is due', async () => {
  const original = User.findOne;
  let saves = 0;
  User.findOne = async () => ({ telegramId: 123, isMining: true, lastMineAt: new Date(0), minedTPC: 25, balance: 75, save: async () => { saves++; } });
  try {
    await withApi(async request => {
      const response = await request('/mining/status');
      assert.equal(response.status, 200);
      expect(await response.json()).toEqual({ isMining: true, pending: 25, balance: 75 });
    });
    assert.equal(saves, 0);
  } finally { User.findOne = original; }
});

test('simultaneous daily check-ins award once without overwriting intervening debits', async () => {
  const originalFind = User.findOne;
  const originalUpdate = User.findOneAndUpdate;
  const state = { _id: 'user-123', accountId: 'account-123', telegramId: 123, balance: 1000, lastCheckIn: null, dailyStreak: 0, transactions: [] };
  let reads = 0;
  let writes = 0;
  let releaseReads;
  const bothRead = new Promise(resolve => { releaseReads = resolve; });
  User.findOne = async () => {
    const snapshot = { ...state };
    if (++reads === 2) releaseReads();
    await bothRead;
    return snapshot;
  };
  User.findOneAndUpdate = async (filter, update, options) => {
    assert.deepEqual(filter, { _id: state._id, lastCheckIn: null, isBanned: { $ne: true } });
    assert.equal(options.upsert, undefined);
    if (state.lastCheckIn !== null) return null;
    state.balance -= 75; // A concurrent authorized debit landed after the read.
    state.balance += update.$inc.balance;
    Object.assign(state, update.$set);
    state.transactions.push(update.$push.transactions);
    writes++;
    return { ...state };
  };
  try {
    await withApi(async request => {
      const responses = await Promise.all([request('/checkin/check-in'), request('/checkin/check-in')]);
      assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
      const success = responses.find(response => response.status === 200);
      expect(await success.json()).toEqual({ streak: 1, reward: 100, balance: 1025 });
    });
    assert.equal(writes, 1);
    assert.equal(state.transactions.length, 1);
  } finally { User.findOne = originalFind; User.findOneAndUpdate = originalUpdate; }
});

test('leaderboard requests do not ban guest accounts', async () => {
  const originalFind = User.find;
  const originalUpdate = User.updateMany;
  let updates = 0;
  const query = { sort: () => query, limit: () => query, select: () => query, lean: async () => [] };
  User.find = () => query;
  User.updateMany = async () => { updates++; };
  try {
    await withApi(async request => {
      const response = await request('/mining/leaderboard', {}, {});
      assert.equal(response.status, 200);
      expect(await response.json()).toEqual({ users: [], rank: null });
    });
    assert.equal(updates, 0);
  } finally { User.find = originalFind; User.updateMany = originalUpdate; }
});


test('Telegram commands cannot bypass the paused reward settlement routes', async () => {
  const handlers = new Map();
  const bot = { command: (name, handler) => handlers.set(name, handler) };
  registerMine(bot);
  registerTasks(bot);
  const original = User.findOneAndUpdate;
  let writes = 0;
  User.findOneAndUpdate = async () => { writes++; throw new Error('unexpected write'); };
  try {
    for (const command of ['/mine start', '/mine stop', '/mine claim', '/tasks complete arbitrary-task']) {
      const replies = [];
      const name = command.split(' ')[0].slice(1);
      await handlers.get(name)({ message: { text: command }, from: { id: 123 }, reply: text => replies.push(text) });
      assert.equal(replies.length, 1);
      assert.match(replies[0], /unavailable until verified settlement/);
    }
    assert.equal(writes, 0);
  } finally { User.findOneAndUpdate = original; }
});
