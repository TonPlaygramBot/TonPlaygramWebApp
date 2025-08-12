import { Server as SocketIOServer } from 'socket.io';

let io = null;

export function initSocket(server, options) {
  io = new SocketIOServer(server, options);
  return io;
}

export function getIO() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}
