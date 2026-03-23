import type { Socket } from 'socket.io';

export interface SocketAuthUser {
  id: string;
  canonicalUserId: string;
  username: string;
  tpcAccountNumber?: string;
}

export function extractSocketUser(socket: Socket): SocketAuthUser | null {
  const token = socket.handshake.auth.token as string | undefined;
  const authTPC = socket.handshake.auth.tpcAccountNumber as string | undefined;
  if (!token) {
    return null;
  }

  const [id, username, tokenTPC] = token.split(':');
  if (!id || !username) {
    return null;
  }

  const tpcAccountNumber = authTPC || tokenTPC;
  const canonicalUserId = tpcAccountNumber || id;

  return { id, canonicalUserId, username, tpcAccountNumber };
}
