import React from 'react';
import { useNavigate } from 'react-router-dom';
import JetskiGame from '../../games/jetski/Game';
import { socket, refreshSocketAuthIdentity } from '../../utils/socket.js';
import { ensureAccountId } from '../../utils/telegram.js';
const services = {
  socket,
  authorize: async () => {
    const accountId = await ensureAccountId();
    if (!accountId)
      throw Error('Sign in to TonPlayGram to join an online race.');
    refreshSocketAuthIdentity({ accountId }, { reconnect: true });
    if (socket.connected) return;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(Error('Could not connect to the race server. Please retry.'));
      }, 8000);
      const connected = () => {
        cleanup();
        resolve();
      };
      const failed = () => {
        cleanup();
        reject(Error('Sign in again to connect to the race server.'));
      };
      function cleanup() {
        clearTimeout(timer);
        socket.off('connect', connected);
        socket.off('connect_error', failed);
      }
      socket.once('connect', connected);
      socket.once('connect_error', failed);
      socket.connect();
    });
  }
};
export default function JetSkiRoyal() {
  const navigate = useNavigate();
  return <JetskiGame services={services} onExit={() => navigate('/games')} />;
}
