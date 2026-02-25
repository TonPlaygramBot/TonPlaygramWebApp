import { useEffect } from 'react';
import { socket } from '../utils/socket.js';
import { ensureAccountId, getTelegramUsername } from '../utils/telegram.js';

export default function useOnlineRoomSync(search = '', fallbackName = 'Player') {
  useEffect(() => {
    const params = new URLSearchParams(search || '');
    const mode = params.get('mode');
    const tableId = params.get('tableId') || params.get('table') || '';
    if (mode !== 'online' || !tableId) return undefined;

    let cancelled = false;
    let accountId = (params.get('accountId') || '').trim();

    const sync = async () => {
      if (!accountId) {
        accountId = (await ensureAccountId().catch(() => '')) || '';
      }
      if (cancelled || !accountId) return;
      socket.emit('register', { playerId: accountId });
      socket.emit('joinRoom', {
        roomId: tableId,
        accountId,
        name: params.get('username') || getTelegramUsername() || fallbackName,
        avatar: params.get('avatar') || '',
      });
      socket.emit('confirmReady', { accountId, tableId });
    };

    sync().catch(() => {});

    return () => {
      cancelled = true;
      if (accountId) socket.emit('leaveLobby', { accountId, tableId });
    };
  }, [search, fallbackName]);
}
