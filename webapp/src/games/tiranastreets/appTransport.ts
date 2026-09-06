import { ensureAccountId } from '../../utils/telegram.js';
import { socket, refreshSocketAuthIdentity } from '../../utils/socket.js';
import type { Transport, ResponseData } from './network';

export function createTiranaTransport(name: string): Transport {
  let accountId = '',
    connectionId = '',
    registration: Promise<void> | null = null;
  function ack<T>(event: string, payload: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        settled = true;
        reject(Error('City connection timed out. Please retry.'));
      }, 8500);
      socket.emit(
        event,
        payload,
        (r: { success: boolean; error?: string; data: T }) => {
          clearTimeout(timer);
          if (settled) {
            const late = (r?.data as ResponseData)?.room;
            if (
              r?.success &&
              late &&
              ['create', 'join'].includes(String(payload.action))
            )
              socket.emit(
                'tirana:request',
                { action: 'leave', roomId: late.id, accountId },
                () => {}
              );
            return;
          }
          settled = true;
          r?.success
            ? resolve(r.data)
            : reject(Error(r?.error || 'City service is unavailable.'));
        }
      );
    });
  }
  async function identify() {
    if (socket.connected && connectionId === socket.id && accountId) return;
    if (registration) return registration;
    registration = (async () => {
      accountId = String((await ensureAccountId()) || '');
      if (!accountId)
        throw Error(
          'Sign in to your TPG account to save a career or join a crew.'
        );
      refreshSocketAuthIdentity(
        { accountId },
        { reconnect: !socket.connected }
      );
      if (!socket.connected)
        await new Promise<void>((resolve, reject) => {
          const done = () => {
            clearTimeout(timer);
            socket.off('connect', done);
            resolve();
          };
          const timer = setTimeout(() => {
            socket.off('connect', done);
            reject(Error('The game server is unavailable. Try again shortly.'));
          }, 7000);
          socket.once('connect', done);
          socket.connect();
        });
      await ack('register', { tpcAccountNumber: accountId });
      connectionId = socket.id || '';
    })();
    try {
      await registration;
    } finally {
      registration = null;
    }
  }
  return async (action, payload = {}) => {
    await identify();
    return ack<ResponseData>('tirana:request', {
      ...payload,
      action,
      accountId,
      name
    });
  };
}
