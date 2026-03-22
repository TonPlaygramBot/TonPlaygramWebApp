import type { Socket } from 'socket.io';

export interface SocketAuthUser {
  id: string;
  username: string;
}

export function extractSocketUser(socket: Socket): SocketAuthUser | null {
  const token = socket.handshake.auth.token as string | undefined;
  if (!token) {
    return null;
  }

  const [id, username] = token.split(':');
  if (!id || !username) {
    return null;
  }

  return { id, username };
}
