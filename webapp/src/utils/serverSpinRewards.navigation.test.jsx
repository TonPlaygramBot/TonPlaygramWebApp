import { beforeEach, expect, test, vi } from 'vitest';
import { rewardIdentity } from './rewardIdentity.js';
import { post } from './api.js';
import { startServerSpin, claimServerSpin, hasPendingServerSpin } from './serverSpinRewards.js';
vi.mock('./api.js', () => ({ post: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); localStorage.setItem('accountId', 'owner'); });
test('start retries reuse the same id and never transmit an amount or identity', async () => {
  post.mockImplementation(async (_path, body) => ({ id: body.requestId }));
  await startServerSpin('spin'); await startServerSpin('spin');
  const first = post.mock.calls[0][1]; expect(first).toEqual({ kind: 'spin', requestId: expect.any(String) });
  expect(post.mock.calls[1][1]).toEqual(first);
});
test('ambiguous claim failure keeps retry key; success clears it', async () => {
  post.mockResolvedValueOnce({ id: 'grant' }); await startServerSpin('spin');
  post.mockResolvedValueOnce({ error: 'network' }); await expect(claimServerSpin('spin', 'grant')).rejects.toThrow('network');
  expect(hasPendingServerSpin('spin')).toBe(true);
  post.mockResolvedValueOnce({ id: 'grant', claimed: true, balance: 300 }); await claimServerSpin('spin', 'grant');
  expect(hasPendingServerSpin('spin')).toBe(false);
  expect(post.mock.calls.at(-1)[1]).toEqual({ kind: 'spin', id: 'grant' });
});

test('a late claim response cannot erase a newer cross-tab request id', async () => {
  post.mockResolvedValueOnce({ id: 'old' }); await startServerSpin('spin');
  let resolve; post.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
  const claim = claimServerSpin('spin', 'old');
  localStorage.setItem(`server-spin-request:${rewardIdentity()}:spin`, 'newer-request');
  resolve({ id: 'old', claimed: true, balance: 300 }); await claim;
  expect(localStorage.getItem(`server-spin-request:${rewardIdentity()}:spin`)).toBe('newer-request');
});

test('Google identity change with stale accountId isolates keys and wallet events', async () => {
  localStorage.setItem('googleId', 'A');
  post.mockResolvedValueOnce({ id: 'old' }); await startServerSpin('spin');
  let resolve; post.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
  const oldClaim = claimServerSpin('spin', 'old');
  localStorage.setItem('googleId', 'B');
  post.mockResolvedValueOnce({ id: 'new' }); await startServerSpin('spin');
  const wallet = vi.fn(); window.addEventListener('walletBalanceUpdated', wallet);
  resolve({ id: 'old', claimed: true, balance: 999 }); await oldClaim;
  expect(wallet).not.toHaveBeenCalled(); expect(hasPendingServerSpin('spin')).toBe(true);
  window.removeEventListener('walletBalanceUpdated', wallet);
});

test('old claimed-but-response-lost UUID recovers once without erasing legacy owner key', async () => {
  const id = 'd5f1f140-c8dd-4d68-a83d-71548a477c28';
  const oldKey = 'server-spin-request:owner:spin'; localStorage.setItem(oldKey, id);
  expect(hasPendingServerSpin('spin')).toBe(true);
  post.mockResolvedValueOnce({ id, claimed: true, amount: 400, balance: 900 });
  const recovered = await startServerSpin('spin');
  expect(recovered.claimed).toBe(true);
  expect(post.mock.calls[0][1]).toEqual({ kind: 'spin', requestId: id });
  post.mockResolvedValueOnce({ id, claimed: true, balance: 900 }); await claimServerSpin('spin', id);
  expect(localStorage.getItem(oldKey)).toBe(id); expect(hasPendingServerSpin('spin')).toBe(false);
  post.mockImplementationOnce(async (_path, body) => ({ id: body.requestId }));
  await startServerSpin('spin'); expect(post.mock.calls.at(-1)[1].requestId).not.toBe(id);
});
test('legacy migration never replaces an existing new scoped request', async () => {
  localStorage.setItem('server-spin-request:owner:spin', 'd5f1f140-c8dd-4d68-a83d-71548a477c28');
  localStorage.setItem(`server-spin-request:${rewardIdentity()}:spin`, 'existing');
  post.mockResolvedValueOnce({ id: 'existing' }); await startServerSpin('spin');
  expect(post.mock.calls[0][1].requestId).toBe('existing');
  post.mockResolvedValueOnce({ id: 'existing', claimed: true, balance: 900 }); await claimServerSpin('spin', 'existing');
  expect(hasPendingServerSpin('spin')).toBe(false);
});
