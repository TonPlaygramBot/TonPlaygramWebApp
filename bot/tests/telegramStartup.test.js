import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TELEGRAM_WEBHOOK_PATH_PREFIX,
  getTelegramWebhookConfig,
  isTelegramBotEnabled,
  startTelegramBot
} from '../telegramStartup.js';

test('disables the shared Telegram bot in Render pull-request previews', async () => {
  const calls = [];
  const bot = {
    telegram: {
      setWebhook: async () => calls.push('setWebhook'),
      deleteWebhook: async () => calls.push('deleteWebhook')
    },
    launch: async () => calls.push('launch')
  };
  const env = {
    BOT_TOKEN: '123:production-token',
    RENDER_EXTERNAL_URL: 'https://preview.onrender.com',
    IS_PULL_REQUEST: 'true'
  };

  assert.equal(isTelegramBotEnabled(env), false);
  assert.deepEqual(await startTelegramBot(bot, env), {
    mode: 'disabled',
    reason: 'pull-request-preview'
  });
  assert.deepEqual(calls, []);
});

test('keeps the Telegram bot enabled outside pull-request previews', () => {
  assert.equal(isTelegramBotEnabled({}), true);
  assert.equal(isTelegramBotEnabled({ IS_PULL_REQUEST: 'false' }), true);
});

test('uses a stable webhook on Render so deploy instances do not compete for polling', () => {
  const config = getTelegramWebhookConfig({
    BOT_TOKEN: '123:test-token',
    RENDER_EXTERNAL_URL: 'https://tonplaygram.onrender.com/'
  });

  assert.match(config.path, new RegExp(`^${TELEGRAM_WEBHOOK_PATH_PREFIX}/[a-f0-9]{32}$`));
  assert.equal(config.url, `https://tonplaygram.onrender.com${config.path}`);
  assert.equal(config.url.includes('test-token'), false);
});

test('builds the webhook URL from the hostname provided by Render', () => {
  const config = getTelegramWebhookConfig({
    BOT_TOKEN: '123:test-token',
    RENDER_EXTERNAL_HOSTNAME: 'tonplaygram-bot.onrender.com'
  });

  assert.equal(config.url, `https://tonplaygram-bot.onrender.com${config.path}`);
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
