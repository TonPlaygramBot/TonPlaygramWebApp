import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals';

jest.mock('../webapp/src/utils/api.js', () => ({ API_BASE_URL: 'https://app.example.test' }));

describe('Socket.IO verified sessions', () => {
  const originalWindow = global.window;
  let listeners;
  let values;
  beforeEach(() => {
    jest.resetModules();
    jest.doMock(require.resolve('socket.io-client', { paths: [process.cwd() + '/webapp'] }), () => ({ io: jest.fn((_url, options) => ({
      auth: options.auth, connected: true, disconnect: jest.fn(), connect: jest.fn()
    })) }));
    listeners = new Map();
    values = new Map();
    global.window = {
      location: { origin: 'https://app.example.test', protocol: 'https:' },
      localStorage: { getItem: (key) => values.get(key) || null },
      addEventListener: (name, listener) => listeners.set(name, listener)
    };
  });
  afterEach(() => { global.window = originalWindow; });

  test('initial connection includes the server-issued bearer token', async () => {
    values.set('tpgSessionToken', 'verified-session');
    const { socket } = await import('../webapp/src/utils/socket.js');
    const handshake = jest.fn();
    socket.auth(handshake);
    expect(handshake).toHaveBeenCalledWith({ token: 'verified-session' });
  });

  test('session refresh and sign-out reconnect with the new credential state', async () => {
    values.set('tpgSessionToken', 'first-session');
    const { socket, refreshSocketAuthIdentity } = await import('../webapp/src/utils/socket.js');
    refreshSocketAuthIdentity();
    values.set('tpgSessionToken', 'second-session');
    listeners.get('accountSessionUpdated')();
    expect(socket.auth.token).toBe('second-session');
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(socket.connect).toHaveBeenCalledTimes(1);
    values.delete('tpgSessionToken');
    listeners.get('accountSessionUpdated')();
    expect(socket.auth.token).toBeUndefined();
    expect(socket.disconnect).toHaveBeenCalledTimes(2);
  });
});
