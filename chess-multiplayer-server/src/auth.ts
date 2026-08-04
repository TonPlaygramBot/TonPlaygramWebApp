import crypto from 'node:crypto';
import type { Client } from 'colyseus';

export interface PlayerAuth {
  accountId: string;
  name: string;
  avatar: string;
  balance: number;
}

const maskAccount = (value: string) => value.length <= 8 ? `${value.slice(0, 2)}••${value.slice(-2)}` : `${value.slice(0, 4)}••••${value.slice(-4)}`;

async function authenticateWithAccountServer(initData: string) {
  const base = String(process.env.ACCOUNT_API_URL || '').replace(/\/$/, '');
  if (!base) return null;
  const response = await fetch(`${base}/api/matchmaking/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-matchmaking-secret': String(process.env.MATCHMAKING_SERVICE_SECRET || '') },
    body: JSON.stringify({ initData })
  });
  const body = await response.json().catch(() => ({})) as any;
  if (!response.ok) throw new Error(String(body.error || `authentication_failed_${response.status}`));
  return body;
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
  const authoritative = await authenticateWithAccountServer(initData);
  if (authoritative) {
    const accountId = String(authoritative.tpcAccountNumber || '');
    if (!accountId) throw new Error('tpc_account_missing');
    return { accountId, name: String(authoritative.name || `Player ${maskAccount(accountId)}`).slice(0, 40), avatar: String(authoritative.avatar || '').slice(0, 500), balance: Number(authoritative.balance) || 0 };
  }
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
    avatar: String(telegramUser?.photo_url || options.avatar || '').slice(0, 500),
    balance: Number(options.balance) || Number.MAX_SAFE_INTEGER
  };
}
