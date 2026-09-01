import { createHash } from 'crypto';

export const TELEGRAM_WEBHOOK_PATH_PREFIX = '/api/telegram/webhook';

export function getTelegramWebhookConfig(env = process.env) {
  const configuredUrl = String(env.TELEGRAM_WEBHOOK_URL || env.RENDER_EXTERNAL_URL || '').trim();
  const botToken = String(env.BOT_TOKEN || '').trim();

  if (!configuredUrl || !botToken || botToken === 'dummy') return null;

  const baseUrl = configuredUrl.replace(/\/+$/, '');
  const pathKey = createHash('sha256').update(botToken).digest('hex').slice(0, 32);
  const path = `${TELEGRAM_WEBHOOK_PATH_PREFIX}/${pathKey}`;

  return { path, url: `${baseUrl}${path}` };
}

export async function startTelegramBot(bot, env = process.env) {
  const webhook = getTelegramWebhookConfig(env);

  if (webhook) {
    await bot.telegram.setWebhook(webhook.url);
    return { mode: 'webhook', ...webhook };
  }

  await bot.telegram.deleteWebhook({ drop_pending_updates: true });
  await bot.launch({ dropPendingUpdates: true });
  return { mode: 'polling' };
}
