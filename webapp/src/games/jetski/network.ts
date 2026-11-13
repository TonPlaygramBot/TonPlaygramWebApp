import type { Socket } from 'socket.io-client';
import type { Racer } from './simulation.mjs';
export interface Room {
  code: string;
  hostId: string;
  trackId: string;
  status: 'waiting' | 'countdown' | 'racing' | 'finished';
  public: boolean;
  players: {
    id: string;
    name: string;
    craftId: string;
    ready: boolean;
    connected: boolean;
  }[];
  racers: Racer[];
  results: Racer[];
  startsAt: number;
  elapsed: number;
  serverNow: number;
}
export interface Session {
  code: string;
  playerId: string;
  token: string;
}
export interface Services {
  socket: Socket;
  authorize: () => Promise<void>;
}
interface Reply {
  ok: boolean;
  error?: string;
  state?: Room;
  code?: string;
  playerId?: string;
  token?: string;
}
export function request(
  socket: Socket,
  event: string,
  data: object = {}
): Promise<Reply> {
  return new Promise((resolve, reject) =>
    socket
      .timeout(8000)
      .emit(`jetski:${event}`, data, (error: Error | null, r: Reply) => {
        if (error)
          reject(
            Error(
              'The race server did not respond. Check your connection and retry.'
            )
          );
        else if (!r?.ok)
          reject(Error(r?.error || 'Unable to update this room.'));
        else resolve(r);
      })
  );
}
export function saveSession(s: Session | null) {
  try {
    if (s) sessionStorage.setItem('jetskiroyal.session', JSON.stringify(s));
    else sessionStorage.removeItem('jetskiroyal.session');
  } catch {}
}
export function loadSession(): Session | null {
  try {
    const s = JSON.parse(
      sessionStorage.getItem('jetskiroyal.session') || 'null'
    );
    return /^[A-F0-9]{6}$/.test(s?.code) &&
      /^[a-f0-9]{48}$/.test(s?.token) &&
      typeof s?.playerId === 'string'
      ? s
      : null;
  } catch {
    return null;
  }
}
