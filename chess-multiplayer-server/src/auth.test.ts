import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticatePlayer } from './auth.js';

describe('authenticatePlayer', () => {
  beforeEach(() => { process.env.ALLOW_DEV_AUTH = 'true'; });
  afterEach(() => {
    delete process.env.ALLOW_DEV_AUTH;
    delete process.env.AUTH_REQUIRED;
    delete process.env.ACCOUNT_API_URL;
    delete process.env.MATCHMAKING_SERVICE_SECRET;
    vi.unstubAllGlobals();
  });

  it('uses the existing account identity in development mode', async () => {
    await expect(authenticatePlayer({} as never, { accountId: 'TPG-42', name: 'Ada' }))
      .resolves.toEqual({ accountId: 'TPG-42', name: 'Ada', avatar: '', balance: Number.MAX_SAFE_INTEGER });
  });

  it('rejects anonymous clients', async () => {
    await expect(authenticatePlayer({} as never, {})).rejects.toThrow('missing_account');
  });

  it('can require the production authentication payload', async () => {
    process.env.AUTH_REQUIRED = 'true';
    await expect(authenticatePlayer({} as never, { accountId: 'TPG-42' })).rejects.toThrow('auth_required');
  });

  it('rejects account IDs by default without the trusted backend', async () => {
    delete process.env.ALLOW_DEV_AUTH;
    await expect(authenticatePlayer({} as never, { accountId: 'victim', googleId: 'victim' }))
      .rejects.toThrow('auth_required');
  });

  it('does not enable development identities in production', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await expect(authenticatePlayer({} as never, { accountId: 'victim' })).rejects.toThrow('auth_required');
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
    }
  });

  it('resolves browser identities through the trusted account server', async () => {
    process.env.ACCOUNT_API_URL = 'https://accounts.example';
    process.env.MATCHMAKING_SERVICE_SECRET = 'shared-secret';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      tpcAccountNumber: 'TPG-900', name: 'Web player', balance: 500
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(authenticatePlayer({} as never, {
      accountId: 'legacy-account', googleId: 'google-42', sessionToken: 'signed-player-session'
    })).resolves.toMatchObject({ accountId: 'TPG-900', name: 'Web player', balance: 500 });
    expect(fetchMock).toHaveBeenCalledWith('https://accounts.example/api/matchmaking/session', expect.objectContaining({
      body: JSON.stringify({ initData: '', accountId: 'legacy-account', tpcAccountNumber: 'legacy-account', sessionToken: 'signed-player-session' })
    }));
  });

  it('does not fall back to client claims when the account server rejects a proof', async () => {
    process.env.ACCOUNT_API_URL = 'https://accounts.example';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'missing_account_authentication' }), { status: 401 })));
    await expect(authenticatePlayer({} as never, { accountId: 'victim', balance: 1000000 })).rejects.toThrow('missing_account_authentication');
  });

  it('uses the TPG account number before legacy account aliases', async () => {
    await expect(authenticatePlayer({} as never, {
      tpcAccountNumber: 'TPG-PRIMARY', accountId: 'legacy-account', name: 'Ada'
    })).resolves.toMatchObject({ accountId: 'TPG-PRIMARY' });
  });
});
