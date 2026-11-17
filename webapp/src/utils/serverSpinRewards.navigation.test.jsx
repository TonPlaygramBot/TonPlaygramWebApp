import { beforeEach, expect, test, vi } from 'vitest';
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
  localStorage.setItem('server-spin-request:owner:spin', 'newer-request');
  resolve({ id: 'old', claimed: true, balance: 300 }); await claim;
  expect(localStorage.getItem('server-spin-request:owner:spin')).toBe('newer-request');
});
