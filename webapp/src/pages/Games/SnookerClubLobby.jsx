import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import RoomSelector from '../../components/RoomSelector.jsx';
import {
  ensureAccountId,
  getTelegramId,
  getTelegramPhotoUrl,
  getTelegramFirstName
} from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { resolveTableSize } from '../../config/snookerClubTables.js';
import { socket } from '../../utils/socket.js';
import { runPoolRoyaleOnlineFlow } from './poolRoyaleOnlineFlow.js';

export default function SnookerClubLobby() {
  const navigate = useNavigate();
  const { search } = useLocation();
  useTelegramBackButton();

  const searchParams = new URLSearchParams(search);
  const initialPlayType = (() => {
    const requestedType = searchParams.get('type');
    return requestedType === 'tournament' ? 'tournament' : 'regular';
  })();

  const MAX_PLAYERS = 2;
  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [mode, setMode] = useState('ai');
  const [avatar, setAvatar] = useState('');
  const variant = 'snooker';
  const [playType, setPlayType] = useState(initialPlayType);
  const [players, setPlayers] = useState(8);
  const [tableSize, setTableSize] = useState(() => resolveTableSize(searchParams.get('tableSize')).id);
  const [matching, setMatching] = useState(false);
  const [matchingError, setMatchingError] = useState('');
  const [matchStatus, setMatchStatus] = useState('');
  const [matchPlayers, setMatchPlayers] = useState([]);
  const [matchTableId, setMatchTableId] = useState('');
  const [readyList, setReadyList] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [spinningPlayer, setSpinningPlayer] = useState('');
  const spinIntervalRef = useRef(null);
  const accountIdRef = useRef(null);
  const matchPlayersRef = useRef([]);
  const pendingTableRef = useRef('');
  const cleanupRef = useRef(() => {});
  const stakeDebitRef = useRef(null);
  const matchTimeoutRef = useRef(null);
  const seatTimeoutRef = useRef(null);

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

  useEffect(() => {
    const syncAvatar = () => {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    };
    window.addEventListener('profilePhotoUpdated', syncAvatar);
    return () => window.removeEventListener('profilePhotoUpdated', syncAvatar);
  }, []);

  const promptAvatarRefresh = () => {
    const tg = window?.Telegram?.WebApp;
    if (tg?.showPopup) {
      tg.showPopup({
        title: 'Update avatar',
        message: 'Change your Telegram profile photo to refresh your lobby portrait.',
        buttons: [{ id: 'ok', type: 'default', text: 'Got it' }]
      });
      return;
    }
    alert('Change your Telegram profile photo to refresh your lobby portrait.');
  };

  const navigateToSnooker = ({ tableId: startedId, roster = [], accountId, currentTurn }) => {
    const selfId = accountId || accountIdRef.current;
    const selfEntry = roster.find((p) => String(p.id) === String(selfId));
    const opponentEntry = roster.find((p) => String(p.id) !== String(selfId));
    const starterId = currentTurn || roster?.[0]?.id || null;
    const selfIndex = roster.findIndex((p) => String(p.id) === String(selfId));
    const seat = selfIndex === 1 ? 'B' : 'A';
    const starterSeat = starterId && String(starterId) === String(selfId) ? seat : seat === 'A' ? 'B' : 'A';
    const friendlyName =
      selfEntry?.name ||
      getTelegramFirstName() ||
      getTelegramId() ||
      (selfId ? `TPC ${selfId}` : 'Player');
    const friendlyAvatar = selfEntry?.avatar || avatar;
    const opponentName =
      opponentEntry?.name ||
      opponentEntry?.username ||
      opponentEntry?.telegramName ||
      (opponentEntry?.id ? `TPC ${opponentEntry.id}` : '');
    const opponentAvatar = opponentEntry?.avatar || '';
    cleanupRef.current?.({ account: accountId, skipRefReset: true });
    const params = new URLSearchParams();
    params.set('variant', variant);
    params.set('type', playType);
    params.set('mode', 'online');
    params.set('tableId', startedId);
    params.set('tableSize', tableSize);
    if (stake.token) params.set('token', stake.token);
    if (stake.amount) params.set('amount', stake.amount);
    if (friendlyAvatar) params.set('avatar', friendlyAvatar);
    const tgId = getTelegramId();
    if (tgId) params.set('tgId', tgId);
    const resolvedAccountId = accountIdRef.current;
    if (resolvedAccountId) params.set('accountId', resolvedAccountId);
    params.set('seat', seat);
    params.set('starter', starterSeat);
    const name = (friendlyName || '').trim();
    if (name) params.set('name', name);
    if (opponentName) params.set('opponent', opponentName);
    if (opponentAvatar) params.set('opponentAvatar', opponentAvatar);
    navigate(`/games/snookerclub?${params.toString()}`);
  };

  const startGame = async () => {
    const isOnlineMatch = mode === 'online' && playType === 'regular';
    if (matching && isOnlineMatch) return;
    await cleanupRef.current?.();
    setMatchStatus('');
    setMatchingError('');
    let tgId;
    let accountId;

    if (isOnlineMatch) {
      const result = await runPoolRoyaleOnlineFlow({
        stake,
        variant,
        ballSet: 'snooker',
        playType,
        mode,
        tableSize,
        avatar,
        gameKey: 'snookerclub-online',
        gameType: 'snookerclub',
        maxPlayers: MAX_PLAYERS,
        state: {
          setMatchingError,
          setMatchStatus,
          setMatching,
          setIsSearching,
          setMatchPlayers,
          setReadyList,
          setMatchTableId,
          setSpinningPlayer
        },
        refs: {
          accountIdRef,
          matchPlayersRef,
          pendingTableRef,
          cleanupRef,
          spinIntervalRef,
          stakeDebitRef,
          matchTimeoutRef,
          seatTimeoutRef
        },
        deps: { ensureAccountId, getAccountBalance, addTransaction, getTelegramId, socket },
        onGameStart: navigateToSnooker
      });
      if (!result?.success) {
        return;
      }
      return;
    }

    try {
      tgId = getTelegramId();
      accountId = await ensureAccountId();
    } catch (error) {
      const message = 'Unable to verify your TPC account. Please retry.';
      setMatchingError(message);
      try {
        window?.Telegram?.WebApp?.showAlert?.(message);
      } catch {}
      console.error('[SnookerClubLobby] ensureAccountId failed', error);
      return;
    }

    accountIdRef.current = accountId;

    const params = new URLSearchParams();
    params.set('variant', variant);
    params.set('tableSize', tableSize);
    params.set('type', playType);
    params.set('mode', mode);
    if (playType === 'tournament') params.set('players', players);
    const initData = window.Telegram?.WebApp?.initData;
    if (avatar) params.set('avatar', avatar);
    if (tgId) params.set('tgId', tgId);
    if (accountId) params.set('accountId', accountId);
    const name = getTelegramFirstName();
    if (name) params.set('name', name);
    if (initData) params.set('init', encodeURIComponent(initData));

    if (playType === 'tournament') {
      window.location.href = `/pool-royale-bracket.html?${params.toString()}`;
      return;
    }

    const target = `/games/snookerclub?${params.toString()}`;
    window.location.href = target;
  };

  useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  useEffect(() => {
    if (matchPlayersRef.current !== matchPlayers) {
      matchPlayersRef.current = matchPlayers;
    }
  }, [matchPlayers]);

  useEffect(() => {
    if (spinIntervalRef.current) {
      clearInterval(spinIntervalRef.current);
      spinIntervalRef.current = null;
    }
    if (!matching || matchPlayers.length === 0) return undefined;
    setSpinningPlayer(matchPlayers[0]?.name || 'Searching…');
    spinIntervalRef.current = setInterval(() => {
      const pick = matchPlayers[Math.floor(Math.random() * matchPlayers.length)];
      setSpinningPlayer(pick?.name || 'Searching…');
    }, 500);
    return () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    };
  }, [matchPlayers, matching]);

  useEffect(() => {
    if (playType === 'tournament') {
      setMode('ai');
    }
  }, [playType]);

  useEffect(() => {
    if (mode !== 'online' || playType !== 'regular') {
      cleanupRef.current?.();
      setMatching(false);
      setMatchStatus('');
      setMatchPlayers([]);
      setReadyList([]);
      setIsSearching(false);
      setMatchTableId('');
    }
  }, [mode, playType]);

  const readyIds = useMemo(
    () => new Set((readyList || []).map((id) => String(id))),
    [readyList]
  );

  useEffect(() => {
    if (!matching) return;
    const selfId = accountIdRef.current;
    if (selfId && readyIds.has(String(selfId)) && readyIds.size >= MAX_PLAYERS) {
      setMatchStatus('All players ready. Launching match…');
    }
  }, [matching, readyIds, MAX_PLAYERS]);

  return (
    <div className="relative p-4 space-y-4 text-text min-h-screen tetris-grid-bg">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="text-sm text-primary"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
        <h2 className="text-xl font-bold text-center flex-1">Snooker Club Lobby</h2>
        <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-surface">
          {avatar ? (
            <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-border" />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Type</h3>
        <div className="flex gap-2 flex-wrap">
          {[{ id: 'regular', label: 'Staking' }, { id: 'tournament', label: 'Tournament' }].map(
            ({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPlayType(id)}
                className={`lobby-tile ${playType === id ? 'lobby-selected' : ''}`}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Mode</h3>
        <div className="flex gap-2 flex-wrap">
          {[{ id: 'ai', label: 'Vs AI' }, { id: 'online', label: 'Online' }, { id: 'local', label: 'Local Multiplayer' }].map(
            ({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={`lobby-tile ${mode === id ? 'lobby-selected' : ''}`}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      {mode === 'online' && playType === 'regular' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Stake</h3>
          <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
          <p className="text-center text-xs text-subtext">
            Online games use your TPC stake as escrow, while AI and local matches stay free.
          </p>
        </div>
      )}

      {playType === 'tournament' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Players</h3>
          <div className="flex gap-2 flex-wrap">
            {[8, 12, 16, 24, 32].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlayers(p)}
                className={`lobby-tile ${players === p ? 'lobby-selected' : ''}`}
              >
                {p}
              </button>
            ))}
          </div>
          <p className="text-xs text-subtext">Winner takes the pot minus developer fee.</p>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="font-semibold">Avatar</h3>
        <div className="lobby-tile flex items-center gap-3">
          <div className="h-12 w-12 rounded-full overflow-hidden border border-border bg-surface">
            {avatar ? (
              <img src={avatar} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-border" />
            )}
          </div>
          <div className="flex-1 text-sm">
            <p className="font-semibold">Match intro portrait</p>
            <p className="text-xs text-subtext">Updates when you change your Telegram photo.</p>
          </div>
          <button
            type="button"
            className="px-3 py-2 rounded-lg border border-border bg-background/60 text-sm"
            onClick={promptAvatarRefresh}
          >
            Change
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={startGame}
        disabled={isSearching}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded"
      >
        {isSearching ? 'Finding Table…' : 'Start'}
      </button>

      {matching && (
        <div className="p-3 rounded-lg bg-surface/70 border border-border space-y-2">
          <p className="text-sm font-semibold">Matching…</p>
          {matchStatus && <p className="text-xs text-subtext">{matchStatus}</p>}
          {spinningPlayer && (
            <div className="lobby-tile w-full flex items-center justify-between text-sm">
              <span>🎯 {spinningPlayer}</span>
              <span className="text-xs text-subtext">Stake {stake.amount} {stake.token}</span>
            </div>
          )}
          <p className="text-xs text-subtext">
            Waiting for your opponent to confirm. Table {matchTableId || 'pending'}
          </p>
          {matchPlayers.length > 0 && (
            <div className="space-y-1 text-xs text-subtext">
              {matchPlayers.map((p) => (
                <div
                  key={p.accountId || p.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-background/50 px-3 py-2"
                >
                  <span className="font-semibold">{p.name || p.accountId}</span>
                  <span className={readyIds.has(String(p.id || p.accountId)) ? 'text-emerald-400' : 'text-subtext'}>
                    {readyIds.has(String(p.id || p.accountId)) ? 'Ready' : 'Waiting'}
                  </span>
                </div>
              ))}
            </div>
          )}
          {readyList.length > 0 && (
            <p className="text-xs text-primary">
              Ready: {readyList.length} / {MAX_PLAYERS}
            </p>
          )}
        </div>
      )}

      {matchingError && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-700 rounded-lg p-2">
          {matchingError}
        </div>
      )}
    </div>
  );
}
