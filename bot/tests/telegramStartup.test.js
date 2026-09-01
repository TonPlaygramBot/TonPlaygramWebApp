import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TELEGRAM_WEBHOOK_PATH_PREFIX,
  getTelegramWebhookConfig,
  startTelegramBot
} from '../telegramStartup.js';

test('uses a stable webhook on Render so deploy instances do not compete for polling', () => {
  const config = getTelegramWebhookConfig({
    BOT_TOKEN: '123:test-token',
    RENDER_EXTERNAL_URL: 'https://tonplaygram.onrender.com/'
  });

  assert.match(config.path, new RegExp(`^${TELEGRAM_WEBHOOK_PATH_PREFIX}/[a-f0-9]{32}$`));
  assert.equal(config.url, `https://tonplaygram.onrender.com${config.path}`);
  assert.equal(config.url.includes('test-token'), false);
});

test('prefers an explicitly configured public webhook URL', () => {
  const config = getTelegramWebhookConfig({
    BOT_TOKEN: '123:test-token',
    RENDER_EXTERNAL_URL: 'https://internal.onrender.com',
    TELEGRAM_WEBHOOK_URL: 'https://example.com/bot/'
  });

  assert.equal(config.url, `https://example.com/bot${config.path}`);
});

test('keeps polling for local development', async () => {
  const calls = [];
  const bot = {
    telegram: { deleteWebhook: async (options) => calls.push(['deleteWebhook', options]) },
    launch: async (options) => calls.push(['launch', options])
  };

  const result = await startTelegramBot(bot, { BOT_TOKEN: '123:test-token' });

  assert.deepEqual(result, { mode: 'polling' });
  assert.deepEqual(calls, [
    ['deleteWebhook', { drop_pending_updates: true }],
    ['launch', { dropPendingUpdates: true }]
  ]);
});

test('registers a webhook without starting Telegram long polling', async () => {
  const calls = [];
  const bot = {
    telegram: { setWebhook: async (url) => calls.push(['setWebhook', url]) },
    launch: async () => calls.push(['launch'])
  };

  const result = await startTelegramBot(bot, {
    BOT_TOKEN: '123:test-token',
    RENDER_EXTERNAL_URL: 'https://tonplaygram.onrender.com'
  });

  assert.equal(result.mode, 'webhook');
  assert.deepEqual(calls, [['setWebhook', result.url]]);
});
