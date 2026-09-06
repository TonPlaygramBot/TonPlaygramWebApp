import { ensureAccountId } from '../../utils/telegram.js';
import { socket, refreshSocketAuthIdentity } from '../../utils/socket.js';
import type { GameServices, RoomSnapshot } from './career';
import type { Input } from './engine';

export function createAppTableTennisServices(
  character = 'athlete-male'
): GameServices & {
  dispose: () => void;
  activate: () => void;
} {
  let releaseTimer: ReturnType<typeof setTimeout> | undefined;
  let accountId = '',
    connectionId = '',
    joinedTable = '',
    disposed = false,
    registration: Promise<string> | null = null;
  const ack = <T>(
    event: string,
    payload: Record<string, unknown>
  ): Promise<T> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error('Connection timed out. Please retry.')),
        7000
      );
      socket.emit(
        event,
        payload,
        (r: { success: boolean; error?: string; data: T }) => {
          clearTimeout(timer);
          r?.success
            ? resolve(r.data)
            : reject(
                Error(
                  (r?.error || 'Game service unavailable').replaceAll('_', ' ')
                )
              );
        }
      );
    });
  async function identity() {
    if (disposed) throw Error('Game closed');
    if (socket.connected && connectionId === socket.id && accountId)
      return accountId;
    if (registration) return registration;
    registration = (async () => {
      accountId = String((await ensureAccountId()) || '');
      if (!accountId) throw Error('Sign in to your TPC account to continue.');
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
            reject(Error('Matchmaker unavailable. Please retry.'));
          }, 7000);
          socket.once('connect', done);
          socket.connect();
        });
      await ack('register', { tpcAccountNumber: accountId });
      connectionId = socket.id || '';
      return accountId;
    })();
    try {
      return await registration;
    } finally {
      registration = null;
    }
  }
  const careerAction = async <T>(
    action: string,
    body: Record<string, unknown> = {}
  ) => {
    const id = await identity();
    return ack<T>('tabletennisCareer', { accountId: id, action, ...body });
  };
  async function joinRoom(tableId: string) {
    if (!tableId)
      throw Error('Choose an online match in the Table Tennis Royal lobby.');
    const id = await identity();
    const r = await ack<RoomSnapshot>('tabletennisJoin', {
      accountId: id,
      tableId,
      character
    });
    if (disposed) {
      socket.emit('tabletennisLeave', { accountId: id, tableId, character });
      throw Error('Game closed');
    }
    joinedTable = tableId;
    return r;
  }
  async function leaveRoom(tableId: string) {
    if (joinedTable === tableId) joinedTable = '';
    if (accountId && socket.connected)
      await ack('tabletennisLeave', { accountId, tableId });
  }
  return {
    online: true,
    career: () => careerAction('get'),
    startCareer: () => careerAction('start'),
    finishCareer: (id, won, rally) =>
      careerAction('finish', { id, won, rally }),
    upgrade: (stat) => careerAction('upgrade', { stat }),
    createRoom: async () => {
      throw Error('Find an opponent in the Table Tennis Royal lobby.');
    },
    joinRoom,
    syncRoom: async (tableId: string, input: Input) => {
      const changed = !socket.connected || socket.id !== connectionId;
      await identity();
      if (changed) await joinRoom(tableId);
      return ack<RoomSnapshot>('tabletennisInput', {
        accountId,
        tableId,
        input
      });
    },
    leaveRoom,
    activate() {
      clearTimeout(releaseTimer);
      disposed = false;
    },
    dispose() {
      releaseTimer = setTimeout(() => {
        disposed = true;
        if (joinedTable && accountId && socket.connected)
          socket.emit('tabletennisLeave', { tableId: joinedTable, accountId });
        joinedTable = '';
      }, 0);
    }
  };
}
