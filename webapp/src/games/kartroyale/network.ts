import type { Socket } from 'socket.io-client';
import type { Racer } from './simulation.mjs';
export interface Room {
  code: string;
  hostId: string;
  trackId: string;
  status: 'waiting' | 'countdown' | 'racing' | 'finished';
  public: boolean;
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
}
interface Reply {
  ok: boolean;
  error?: string;
  code?: string;
  playerId?: string;
  token?: string;
  state?: Room;
}
export function request(
  socket: Socket,
  event: string,
  data: object = {}
): Promise<Reply> {
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
