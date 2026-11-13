import type { Client } from 'colyseus';

export interface PlayerAuth {
  accountId: string;
  name: string;
  avatar: string;
  balance: number;
}

const maskAccount = (value: string) => value.length <= 8 ? `${value.slice(0, 2)}••${value.slice(-2)}` : `${value.slice(0, 4)}••••${value.slice(-4)}`;

async function authenticateWithAccountServer(initData: string, accountId: string, sessionToken: string) {
  const base = String(process.env.ACCOUNT_API_URL || '').replace(/\/$/, '');
  if (!base) return null;
  const response = await fetch(`${base}/api/matchmaking/session`, {
    method: 'POST',
    signal: AbortSignal.timeout(5000),
    redirect: 'error',
    headers: { 'content-type': 'application/json', 'x-matchmaking-secret': String(process.env.MATCHMAKING_SERVICE_SECRET || '') },
    body: JSON.stringify({ initData, accountId, tpcAccountNumber: accountId, sessionToken })
  });
  const body = await response.json().catch(() => ({})) as any;
  if (!response.ok) throw new Error(String(body.error || `authentication_failed_${response.status}`));
  return body;
}

export async function authenticatePlayer(_client: Client, options: Record<string, unknown>): Promise<PlayerAuth> {
  // The canonical TPG account number is the primary real-time identity. Keep
  // accountId as a compatibility fallback for clients deployed before this field.
  const accountId = String(options.tpcAccountNumber || options.accountId || '').trim().slice(0, 80);
  const initData = String(options.initData || '');
  const sessionToken = typeof options.sessionToken === 'string' ? options.sessionToken : '';
  const authoritative = await authenticateWithAccountServer(initData, accountId, sessionToken);
  if (authoritative) {
    const accountId = String(authoritative.tpcAccountNumber || '');
    if (!accountId) throw new Error('tpc_account_missing');
    return { accountId, name: String(authoritative.name || `Player ${maskAccount(accountId)}`).slice(0, 40), avatar: String(authoritative.avatar || '').slice(0, 500), balance: Number(authoritative.balance) || 0 };
  }
  // Standalone development identities are opt-in and never usable in production.
  // Production resolves both identity and balance through the account backend.
  if (process.env.NODE_ENV === 'production' || process.env.AUTH_REQUIRED === 'true' || process.env.ALLOW_DEV_AUTH !== 'true') {
    throw new Error('auth_required');
  }
  const identity = accountId;
  if (!identity) throw new Error('missing_account');
  return {
    accountId: identity,
    name: String(options.name || `Player ${identity.slice(-4)}`).slice(0, 40),
    avatar: String(options.avatar || '').slice(0, 500),
    balance: Number(options.balance) || Number.MAX_SAFE_INTEGER
  };
}
