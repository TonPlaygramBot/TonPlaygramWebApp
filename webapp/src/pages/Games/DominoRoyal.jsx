import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import DominoRoyalArena from './DominoRoyalArena.jsx';
import { socket } from '../../utils/socket.js';
import { ensureAccountId, getTelegramUsername } from '../../utils/telegram.js';

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
    window.__dominoRoyalSocketBridge = {
      emit(event, payload) {
        socket.emit(event, payload);
      },
      on(event, handler) {
        socket.on(event, handler);
      },
      off(event, handler) {
        socket.off(event, handler);
      }
    };

    const syncRuntime = async () => {
      if (!resolvedAccountId) {
        resolvedAccountId = (await ensureAccountId().catch(() => '')) || '';
      }
      if (cancelled || !resolvedAccountId) return;
      socket.emit('register', { playerId: resolvedAccountId });
      socket.emit('joinRoom', {
        roomId: tableId,
        accountId: resolvedAccountId,
        name: getTelegramUsername() || 'Player'
      });
      socket.emit('joinDominoTable', { tableId, accountId: resolvedAccountId });
      socket.emit('confirmReady', { accountId: resolvedAccountId, tableId });
    };

    syncRuntime().catch(() => {});

    return () => {
      cancelled = true;
      if (resolvedAccountId) {
        socket.emit('leaveLobby', { accountId: resolvedAccountId, tableId });
      }
      if (window.__dominoRoyalSocketBridge) {
        delete window.__dominoRoyalSocketBridge;
      }
    };
  }, [search]);

  return (
    <div className="relative w-full h-screen">
      <DominoRoyalArena />
    </div>
  );
}
