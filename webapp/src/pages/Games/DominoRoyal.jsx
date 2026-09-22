import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import DominoRoyalArena from './DominoRoyalArena.jsx';
import { socket } from '../../utils/socket.js';
import { ensureAccountId } from '../../utils/telegram.js';

export default function DominoRoyal() {
  useTelegramBackButton();
  const { search } = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const mode = params.get('mode');
    const tableId = params.get('tableId') || params.get('table');
    if (mode !== 'online' || !tableId) return undefined;

    let cancelled = false;
    let resolvedAccountId = (params.get('accountId') || '').trim();

    const syncRuntime = async () => {
      if (!resolvedAccountId) {
        resolvedAccountId = (await ensureAccountId().catch(() => '')) || '';
      }
      if (cancelled || !resolvedAccountId) return;
      socket.emit('register', { playerId: resolvedAccountId });
    };

    syncRuntime().catch(() => {});

    return () => {
      cancelled = true;
      if (resolvedAccountId) {
        socket.emit('leaveLobby', { accountId: resolvedAccountId, tableId });
      }
    };
  }, [search]);

  return (
    <div className="relative w-full h-screen">
      <DominoRoyalArena />
    </div>
  );
}
