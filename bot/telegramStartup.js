import { createHash } from 'crypto';

export const TELEGRAM_WEBHOOK_PATH_PREFIX = '/api/telegram/webhook';

export function isTelegramBotEnabled(env = process.env) {
  // Render copies secret environment variables into pull-request preview
  // services. A preview must never take ownership of the production bot's
  // webhook (or start a second getUpdates loop) merely because it inherited
  // BOT_TOKEN.
  return (
    String(env.IS_PULL_REQUEST || '')
      .trim()
      .toLowerCase() !== 'true'
  );
}

export function getTelegramWebhookConfig(env = process.env) {
  // Render exposes the public service address as a hostname (without a
  // protocol). Keep supporting RENDER_EXTERNAL_URL for other hosts and older
  // configurations, but prefer the explicit override when one is supplied.
  const renderHostname = String(env.RENDER_EXTERNAL_HOSTNAME || '').trim();
  const configuredUrl = String(
    env.TELEGRAM_WEBHOOK_URL ||
      env.RENDER_EXTERNAL_URL ||
      (renderHostname ? `https://${renderHostname}` : '')
  ).trim();
  const botToken = String(env.BOT_TOKEN || '').trim();

  if (!configuredUrl || !botToken || botToken === 'dummy') return null;

  const baseUrl = configuredUrl.replace(/\/+$/, '');
  const pathKey = createHash('sha256')
    .update(botToken)
    .digest('hex')
    .slice(0, 32);
  const path = `${TELEGRAM_WEBHOOK_PATH_PREFIX}/${pathKey}`;

  return { path, url: `${baseUrl}${path}` };
}

export function canUseTelegramPolling(env = process.env) {
  const explicitlyEnabled =
    String(env.TELEGRAM_UPDATE_MODE || '')
      .trim()
      .toLowerCase() === 'polling';
  if (explicitlyEnabled) return true;

  // Long polling is useful on a developer machine, but it is unsafe on a
  // hosted service: during a rolling deploy both the old and new instance can
  // call getUpdates, which Telegram rejects with HTTP 409. Hosted production
  // must use the single, stable webhook URL instead.
  const isHosted = Boolean(
    String(env.RENDER || '').trim() ||
    String(env.RENDER_SERVICE_ID || '').trim() ||
    String(env.RENDER_EXTERNAL_HOSTNAME || '').trim()
  );
  return env.NODE_ENV !== 'production' && !isHosted;
}

export async function startTelegramBot(bot, env = process.env) {
  if (!isTelegramBotEnabled(env)) {
    return { mode: 'disabled', reason: 'pull-request-preview' };
  }

  const webhook = getTelegramWebhookConfig(env);

  if (webhook) {
    await bot.telegram.setWebhook(webhook.url);
    return { mode: 'webhook', ...webhook };
  }

  if (!canUseTelegramPolling(env)) {
    throw new Error(
      'Telegram webhook URL is missing in hosted production. Set TELEGRAM_WEBHOOK_URL; refusing to start long polling because overlapping instances cause Telegram 409 conflicts.'
    );
  }

  await bot.telegram.deleteWebhook({ drop_pending_updates: true });
  await bot.launch({ dropPendingUpdates: true });
  return { mode: 'polling' };
}
