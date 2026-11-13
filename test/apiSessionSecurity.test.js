import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals';
import { webcrypto } from 'node:crypto';
import { createAccount, post, put, patch, sendTpc, sendAccountTpc } from '../webapp/src/utils/api.js';
import { getAccountSessionToken, clearAccountSessionToken } from '../webapp/src/utils/accountSession.js';
import { loadGoogleProfile, storeGoogleProfile } from '../webapp/src/utils/google.js';

jest.mock('../webapp/src/utils/nativeBridge', () => ({ getNativeBridgeHeaders: () => ({}) }));

class MemoryStorage {
  store = new Map();
  getItem(key) { return this.store.get(key) ?? null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
}

const ok = (body = {}) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });

describe('verified client sessions and safe request retries', () => {
  const originals = { window: global.window, localStorage: global.localStorage, fetch: global.fetch, crypto: global.crypto };
  beforeEach(() => {
    global.localStorage = new MemoryStorage();
    global.window = { localStorage: global.localStorage, dispatchEvent: jest.fn(), Telegram: null };
    global.fetch = jest.fn().mockResolvedValue(ok());
    Object.defineProperty(global, 'crypto', { value: webcrypto, configurable: true });
  });
  afterEach(() => {
    global.window = originals.window;
    global.localStorage = originals.localStorage;
    global.fetch = originals.fetch;
    Object.defineProperty(global, 'crypto', { value: originals.crypto, configurable: true });
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('public identity caches do not authenticate a request', async () => {
    localStorage.setItem('accountId', 'victim-account');
    localStorage.setItem('googleId', 'victim-google');
    localStorage.setItem('googleProfile', JSON.stringify({ id: 'victim-google' }));
    await post('/api/account/balance', { accountId: 'victim-account' });
    const { headers } = fetch.mock.calls[0][1];
    expect(headers.Authorization).toBeUndefined();
    expect(headers['X-Google-Id']).toBeUndefined();
    expect(headers['X-Tpc-Account-Id']).toBeUndefined();
    expect(loadGoogleProfile()).toBeNull();
  });

  test('forwards a raw Google credential and stores only the server session', async () => {
    localStorage.setItem('accountId', 'untrusted-old-id');
    fetch.mockResolvedValue(ok({ accountId: 'server-account', sessionToken: 'server-signed-session' }));
    await createAccount(undefined, { id: 'google-user', email: 'test@example.test' }, undefined, undefined, 'raw-google-id-token');
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.googleCredential).toBe('raw-google-id-token');
    expect(body.accountId).toBeUndefined();
    expect(getAccountSessionToken()).toBe('server-signed-session');
    expect(localStorage.getItem('accountId:google:google-user')).toBe('server-account');
    expect(localStorage.getItem('googleCredential')).toBeNull();
    await post('/api/account/balance', { accountId: 'server-account' });
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer server-signed-session');
  });

  test('does not persist rejected Google authentication or use cached profile as proof', async () => {
    fetch.mockResolvedValue({ ok: false, status: 401, text: async () => '{"error":"invalid Google credential"}' });
    const result = await createAccount(undefined, { id: 'claimed-id' }, undefined, undefined, 'bad-token');
    expect(result.error).toBeTruthy();
    expect(getAccountSessionToken()).toBe('');
    expect(localStorage.getItem('accountId')).toBeNull();
    fetch.mockClear();
    const legacyResult = await createAccount(undefined, { id: 'claimed-id' });
    expect(legacyResult.error).toMatch(/sign in with Google again/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('fresh guest creation never claims a cached public account number', async () => {
    localStorage.setItem('accountId', 'old-guest-account');
    await createAccount();
    expect(JSON.parse(fetch.mock.calls[0][1].body).accountId).toBeUndefined();
  });

  test('concurrent guest bootstrap requests share one server account creation', async () => {
    let finish;
    fetch.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const first = createAccount();
    const second = createAccount();
    expect(fetch).toHaveBeenCalledTimes(1);
    finish(ok({ accountId: 'single-guest', sessionToken: 'guest-session' }));
    expect(await first).toEqual(await second);
  });

  test('a new guest session cannot revive a cached Google sign-in', () => {
    localStorage.setItem('googleProfile', JSON.stringify({ id: 'old-google' }));
    localStorage.setItem('accountId', 'new-guest');
    localStorage.setItem('tpgSessionToken', 'new-guest-session');
    expect(loadGoogleProfile()).toBeNull();
    localStorage.setItem('accountId', 'verified-google-account');
    localStorage.setItem('tpgSessionToken', 'verified-google-session');
    storeGoogleProfile({ id: 'verified-google' });
    expect(loadGoogleProfile().id).toBe('verified-google');
    localStorage.setItem('accountId', 'another-guest');
    expect(loadGoogleProfile()).toBeNull();
  });

  test('Telegram login sends signed launch data and records canonical scoped account ID', async () => {
    window.Telegram = { WebApp: { initData: 'signed-launch-data' } };
    localStorage.setItem('accountId', 'stale-other-user');
    fetch.mockResolvedValue(ok({ accountId: 'telegram-account', sessionToken: 'verified-telegram-session' }));
    await createAccount(123);
    expect(fetch.mock.calls[0][1].headers['X-Telegram-Init-Data']).toBe('signed-launch-data');
    expect(JSON.parse(fetch.mock.calls[0][1].body).accountId).toBeUndefined();
    expect(localStorage.getItem('accountId:tg:123')).toBe('telegram-account');
  });

  test.each([post, put, patch])('does not retry an ambiguous mutation after a lost response', async (mutate) => {
    fetch.mockRejectedValue(new Error('response lost after commit'));
    const result = await mutate('/api/store/purchase', { item: 'table' });
    expect(result.error).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('transfer retries reuse one idempotency key and exact payload', async () => {
    jest.useFakeTimers();
    fetch.mockRejectedValueOnce(new Error('response lost')).mockImplementationOnce(async (_url, options) => ok({ transaction: { id: 'receipt' }, operationId: JSON.parse(options.body).operationId }));
    const promise = sendTpc('sender', 'receiver', 10, 'test');
    await jest.runAllTimersAsync();
    expect((await promise).transaction.id).toBe('receipt');
    expect(fetch).toHaveBeenCalledTimes(2);
    const first = fetch.mock.calls[0][1];
    const second = fetch.mock.calls[1][1];
    expect(first.headers['Idempotency-Key']).toMatch(/^[a-f0-9-]{36}$/);
    expect(JSON.parse(first.body).operationId).toBe(first.headers['Idempotency-Key']);
    expect(second.body).toBe(first.body);
    expect(second.headers['Idempotency-Key']).toBe(first.headers['Idempotency-Key']);
  });

  test('explicit transfer retry can reuse the original operation ID', async () => {
    await sendTpc('sender', 'receiver', 10, '', 'caller-operation-123456');
    expect(JSON.parse(fetch.mock.calls[0][1].body).operationId).toBe('caller-operation-123456');
  });

  test('ambiguous transfer failures preserve the operation across a later user retry', async () => {
    jest.useFakeTimers();
    fetch.mockRejectedValue(new Error('response lost'));
    const first = sendAccountTpc('sender-account', 'receiver-account', 10, 'same transfer');
    await jest.runAllTimersAsync();
    const failed = await first;
    expect(failed.error).toBeTruthy();
    const firstKey = failed.operationId;
    expect(firstKey).toBeTruthy();
    fetch.mockImplementation(async (_url, options) => ok({ transaction: { id: 'receipt' }, balance: 90, operationId: JSON.parse(options.body).operationId }));
    const retried = await sendAccountTpc('sender-account', 'receiver-account', 10, 'same transfer');
    expect(retried.transaction.id).toBe('receipt');
    const lastCall = fetch.mock.calls[fetch.mock.calls.length - 1];
    expect(lastCall[0]).toMatch(/\/api\/wallet\/send$/);
    expect(JSON.parse(lastCall[1].body).operationId).toBe(firstKey);
    expect(JSON.parse(lastCall[1].body)).toMatchObject({ fromAccountId: 'sender-account', toAccountId: 'receiver-account' });
    expect(JSON.parse(lastCall[1].body).fromId).toBeUndefined();
    await sendAccountTpc('sender-account', 'receiver-account', 10, 'same transfer');
    expect(JSON.parse(fetch.mock.calls[fetch.mock.calls.length - 1][1].body).operationId).not.toBe(firstKey);
  });

  test('an incomplete successful HTTP response retains the pending operation', async () => {
    fetch.mockResolvedValue(ok({}));
    const first = await sendTpc(1, 2, 10);
    expect(first.error).toMatch(/confirmation is missing/);
    const second = await sendTpc(1, 2, 10);
    expect(second.operationId).toBe(first.operationId);
  });

  test('does not send a transfer when its retry key cannot be persisted', async () => {
    window.localStorage.setItem = () => { throw new Error('storage unavailable'); };
    const result = await sendTpc('sender', 'receiver', 10);
    expect(result.error).toMatch(/browser storage/);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('sign-out removes the bearer credential', async () => {
    localStorage.setItem('tpgSessionToken', 'signed-session');
    clearAccountSessionToken();
    await post('/api/ping', {});
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
    expect(window.dispatchEvent).toHaveBeenCalled();
  });
});
