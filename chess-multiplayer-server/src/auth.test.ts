import { afterEach, describe, expect, it, vi } from 'vitest';
import { authenticatePlayer } from './auth.js';

describe('authenticatePlayer', () => {
  afterEach(() => {
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

  it('resolves browser identities through the trusted account server', async () => {
    process.env.ACCOUNT_API_URL = 'https://accounts.example';
    process.env.MATCHMAKING_SERVICE_SECRET = 'shared-secret';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      tpcAccountNumber: 'TPG-900', name: 'Web player', balance: 500
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(authenticatePlayer({} as never, {
      accountId: 'legacy-account', googleId: 'google-42'
    })).resolves.toMatchObject({ accountId: 'TPG-900', name: 'Web player', balance: 500 });
    expect(fetchMock).toHaveBeenCalledWith('https://accounts.example/api/matchmaking/session', expect.objectContaining({
      body: JSON.stringify({ initData: '', accountId: 'legacy-account', tpcAccountNumber: 'legacy-account', googleId: 'google-42' })
    }));
  });

  it('uses the TPG account number before legacy account aliases', async () => {
    await expect(authenticatePlayer({} as never, {
      tpcAccountNumber: 'TPG-PRIMARY', accountId: 'legacy-account', name: 'Ada'
    })).resolves.toMatchObject({ accountId: 'TPG-PRIMARY' });
  });
});
