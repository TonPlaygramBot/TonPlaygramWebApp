import { ensureAccountId } from '../../utils/telegram.js';
import { socket, refreshSocketAuthIdentity } from '../../utils/socket.js';
import type { BowlingServices, RoomSnapshot } from './types';

export function createAppBowlingServices(): BowlingServices {
  let accountId = '',
    connectionId = '',
    joinedTable = '',
    registration: Promise<void> | null = null;
  function ack<T>(event: string, payload: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!socket.connected) {
        reject(Error('Connection lost. Reconnecting…'));
        return;
      }
      const timer = setTimeout(
        () => reject(Error('Connection timed out. Restoring your match…')),
        6000
      );
      socket.emit(
        event,
        payload,
        (response: { success: boolean; error?: string; data: T }) => {
          clearTimeout(timer);
          response?.success
            ? resolve(response.data)
            : reject(Error(response?.error || 'Match service unavailable'));
        }
      );
    });
  }
  async function identity() {
    if (socket.connected && socket.id === connectionId && accountId) return;
    if (registration) return registration;
    registration = (async () => {
      accountId = String((await ensureAccountId()) || '');
      if (!accountId)
        throw Error('Sign in to your TPG account to play online.');
      refreshSocketAuthIdentity(
        { accountId },
        { reconnect: !socket.connected }
      );
      if (!socket.connected)
        await new Promise<void>((resolve, reject) => {
          const connected = () => {
            clearTimeout(timer);
            socket.off('connect', connected);
            resolve();
          };
          const timer = setTimeout(() => {
            socket.off('connect', connected);
            reject(Error('Cannot reach the game server. Retrying…'));
          }, 6000);
          socket.once('connect', connected);
          socket.connect();
        });
      await ack('register', { tpcAccountNumber: accountId });
      connectionId = socket.id || '';
      joinedTable = '';
    })();
    try {
      await registration;
    } finally {
      registration = null;
    }
  }
  async function join(tableId: string) {
    if (!tableId) throw Error('Choose a match in the Bowling Royal lobby.');
    await identity();
    const snapshot = await ack<RoomSnapshot>('bowlingJoin', {
      accountId,
      tableId
    });
    joinedTable = tableId;
    return snapshot;
  }
  async function request(
    event: string,
    tableId: string,
    body: Record<string, unknown> = {}
  ) {
    await identity();
    if (joinedTable !== tableId) await join(tableId);
    return ack<RoomSnapshot>(event, { accountId, tableId, ...body });
  }
  return {
    join,
    sync: (tableId) => request('bowlingSync', tableId),
    bowl: (tableId, turn, input) =>
      request('bowlingThrow', tableId, { turn, input }),
    leave: (tableId) => request('bowlingLeave', tableId)
  };
}
