import { afterEach, describe, expect, it } from 'vitest';
import { authenticatePlayer } from './auth.js';

describe('authenticatePlayer', () => {
  afterEach(() => { delete process.env.AUTH_REQUIRED; });

  it('uses the existing account identity in development mode', async () => {
    await expect(authenticatePlayer({} as never, { accountId: 'TPC-42', name: 'Ada' }))
      .resolves.toEqual({ accountId: 'TPC-42', name: 'Ada', avatar: '' });
  });

  it('rejects anonymous clients', async () => {
    await expect(authenticatePlayer({} as never, {})).rejects.toThrow('missing_account');
  });

  it('can require the production authentication payload', async () => {
    process.env.AUTH_REQUIRED = 'true';
    await expect(authenticatePlayer({} as never, { accountId: 'TPC-42' })).rejects.toThrow('auth_required');
  });
});
