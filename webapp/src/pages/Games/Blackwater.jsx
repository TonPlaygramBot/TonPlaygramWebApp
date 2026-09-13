import {BATTLEFIELD_MAPS} from '../../games/blackwater/shared/layout.mjs';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Game } from '../../games/blackwater/ui';
import { socket, refreshSocketAuthIdentity } from '../../utils/socket.js';
import { ensureAccountId } from '../../utils/telegram.js';

export default function Blackwater() {
  const [params] = useSearchParams(),
    navigate = useNavigate(),
    [engine, setEngine] = useState(null),
    [connection, setConnection] = useState('');
  const tableId = params.get('tableId') || '',
    mode = params.get('mode') === 'online' ? 'online' : 'ai',
    weaponIds = ['ar','smg','ak47','shotgun','mosin','uzi','sigsauer','smith'],
    weapon = weaponIds.includes(params.get('weapon')) ? params.get('weapon') : 'ar',
    mapIds = BATTLEFIELD_MAPS.map(map=>map.id),
    battlefieldMap = mapIds.includes(params.get('map')) ? params.get('map') : 'skanderbeg',
    difficulty = params.get('difficulty') === 'veteran' ? 'veteran' : 'recruit';
  const ready = useCallback((game) => setEngine(game), []);
  useEffect(() => {
    if (!engine || mode !== 'online') return;
    let active = true,
      joining = false,
      retry;
    if (!tableId) {
      setConnection('Choose an operation from the Tirana Streets lobby.');
      return;
    }
    const state = (data) => {
      if (active && data.tableId === tableId) engine.acceptOnlineState(data);
    };
    const disconnected = () => {
      if (active) {
        setConnection('Connection lost. Reconnecting…');
        engine.pause();
      }
    };
    const replaced = (data) => {
      if (active) {
        setConnection(data.error);
        engine.pause();
      }
    };
    const ack = (event, data) =>
      new Promise((resolve, reject) =>
        socket
          .timeout(6000)
          .emit(event, data, (err, response) =>
            err ? reject(new Error('Connection timed out.')) : resolve(response)
          )
      );
    async function join() {
      if (!active || joining || !socket.connected) return;
      joining = true;
      try {
        const accountId = String(await ensureAccountId());
        if (!active) return;
        const registered = await ack('register', {
          accountId,
          tpcAccountNumber: accountId,
          tpcAccountId: accountId,
          playerId: accountId
        });
        if (!registered?.success)
          throw new Error('Sign in to your TPG account to reconnect.');
        if (!active) return;
        if (!engine.online) {
          engine.weapon = weapon;
          engine.connectOnline({
            playerId: accountId,
            send: (input) => {
              if (active && socket.connected)
                socket.volatile.emit('blackwater:input', input);
            }
          });
        }
        const result = await ack('blackwater:join', { tableId, weapon });
        if (!active) return;
        if (!result?.ok)
          throw new Error(result?.error || 'Could not join this match.');
        engine.acceptOnlineState(result.state);
        engine.resume();
        setConnection('');
      } catch (e) {
        if (active) {
          setConnection(e.message);
          retry = setTimeout(join, 2000);
        }
      } finally {
        joining = false;
      }
    }
    socket.on('blackwater:state', state);
    socket.on('blackwater:replaced', replaced);
    socket.on('connect', join);
    socket.on('disconnect', disconnected);
    socket.on('connect_error', disconnected);
    refreshSocketAuthIdentity({}, { reconnect: true });
    socket.connect();
    void join();
    return () => {
      active = false;
      clearTimeout(retry);
      socket.off('blackwater:state', state);
      socket.off('blackwater:replaced', replaced);
      socket.off('connect', join);
      socket.off('disconnect', disconnected);
      socket.off('connect_error', disconnected);
      socket.emit('blackwater:suspend', {});
    };
  }, [engine, mode, tableId, weapon]);
  const exit = () => {
    if (mode === 'online') {
      socket.emit('blackwater:leave', {});
      try {
        sessionStorage.removeItem('blackwater-match');
      } catch {}
    }
    navigate('/games/tiranastreets/lobby');
  };
  return (
    <>
      <Game
        mode={mode}
        initialWeapon={weapon}
        initialDifficulty={difficulty}
        initialMap={battlefieldMap}
        onExit={exit}
        onEngine={ready}
      />
      {connection ? (
        <div
          role="status"
          className="fixed inset-x-4 top-20 z-[110] mx-auto max-w-md rounded-xl border border-amber-300/30 bg-slate-950/95 p-4 text-sm text-white"
        >
          <p>{connection}</p>
          <button className="mt-3 underline" onClick={exit}>
            Return to Tirana Streets lobby
          </button>
        </div>
      ) : null}
    </>
  );
}
