import crypto from 'node:crypto';
import type { Client } from 'colyseus';

export interface PlayerAuth {
  accountId: string;
  name: string;
  avatar: string;
}

function validateTelegram(initData: string, botToken: string): Record<string, string> | null {
  const params = new URLSearchParams(initData);
  const suppliedHash = params.get('hash');
  if (!suppliedHash) return null;
  params.delete('hash');
  const check = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const actual = crypto.createHmac('sha256', secret).update(check).digest('hex');
  if (actual.length !== suppliedHash.length || !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(suppliedHash))) return null;
  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > 86_400) return null;
  return Object.fromEntries(params.entries());
}

export async function authenticatePlayer(_client: Client, options: Record<string, unknown>): Promise<PlayerAuth> {
  const accountId = String(options.accountId || '').trim().slice(0, 80);
  const initData = String(options.initData || '');
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  let telegramUser: { id?: number; first_name?: string; username?: string; photo_url?: string } | null = null;
  if (initData && botToken) {
    const validated = validateTelegram(initData, botToken);
    if (!validated) throw new Error('invalid_auth');
    try { telegramUser = JSON.parse(validated.user || 'null'); } catch { throw new Error('invalid_auth'); }
  } else if (process.env.AUTH_REQUIRED === 'true') {
    throw new Error('auth_required');
  }
  const identity = accountId || (telegramUser?.id ? String(telegramUser.id) : '');
  if (!identity) throw new Error('missing_account');
  return {
    accountId: identity,
    name: String(telegramUser?.first_name || telegramUser?.username || options.name || `Player ${identity.slice(-4)}`).slice(0, 40),
    avatar: String(telegramUser?.photo_url || options.avatar || '').slice(0, 500)
  };
}
