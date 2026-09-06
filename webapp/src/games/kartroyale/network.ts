import type { Socket } from 'socket.io-client';
import type { Racer } from './simulation.mjs';
export interface Room {
  code: string;
  hostId: string;
  trackId: string;
  status: 'waiting' | 'countdown' | 'racing' | 'finished';
  public: boolean;
  tableId?: string | null;
  stake?: number;
  token?: 'TPG' | null;
  settlement?: {
    status: 'pending' | 'paid' | 'refunded';
    winnerAccountId?: string | null;
    amount?: number;
    reason?: string;
  } | null;
  players: { id: string; name: string; ready: boolean; connected: boolean }[];
  racers: Racer[];
  elapsed: number;
  startsAt: number;
  serverNow: number;
  results: Racer[];
}
export interface Session {
  code: string;
  playerId: string;
  token: string;
  tableId?: string;
  accountId?: string;
}
interface Reply {
  ok: boolean;
  error?: string;
  code?: string;
  playerId?: string;
  token?: string;
  state?: Room;
}
export async function request(
  socket: Socket,
  event: string,
  data: object = {}
): Promise<Reply> {
  const accountId = (data as { accountId?: string }).accountId;
  if ((event === 'match' || event === 'resume') && accountId) {
    await new Promise<void>((resolve, reject) =>
      socket
        .timeout(8000)
        .emit(
          'register',
          { tpcAccountNumber: accountId },
          (error: Error | null, reply: { success?: boolean }) => {
            if (error || !reply?.success)
              reject(
                new Error(
                  'Sign in to the TPG account that owns this race seat.'
                )
              );
            else resolve();
          }
        )
    );
  }
  return new Promise((resolve, reject) =>
    socket
      .timeout(8000)
      .emit(`kart:${event}`, data, (error: Error | null, r: Reply) => {
        if (error)
          reject(
            new Error(
              'The race server did not respond. Check your connection and retry.'
            )
          );
        else if (!r?.ok)
          reject(new Error(r?.error || 'Unable to update the room.'));
        else resolve(r);
      })
  );
}
export function saveSession(s: Session | null) {
  try {
    if (s) sessionStorage.setItem('kartroyale.session', JSON.stringify(s));
    else sessionStorage.removeItem('kartroyale.session');
  } catch {}
}
export function loadSession(): Session | null {
  try {
    const s = JSON.parse(
      sessionStorage.getItem('kartroyale.session') || 'null'
    );
    return s &&
      typeof s.code === 'string' &&
      typeof s.playerId === 'string' &&
      typeof s.token === 'string'
      ? s
      : null;
  } catch {
    return null;
  }
}
