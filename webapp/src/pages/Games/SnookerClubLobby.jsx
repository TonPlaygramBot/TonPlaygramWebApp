import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { ensureAccountId, getTelegramFirstName, getTelegramId, getTelegramPhotoUrl } from '../../utils/telegram.js';
import { addTransaction, getAccountBalance, getOnlineUsers } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { resolveSnookerTableSize, SNOOKER_TABLE_SIZE_LIST } from '../../config/snookerTables.js';
import { socket } from '../../utils/socket.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';

const PLAYER_FLAG_STORAGE_KEY = 'snookerClubPlayerFlag';
const AI_FLAG_STORAGE_KEY = 'snookerClubAiFlag';

export default function SnookerClubLobby() {
  const navigate = useNavigate();
  const { search } = useLocation();
  useTelegramBackButton();

  const searchParams = new URLSearchParams(search);
  const initialPlayType = (() => {
    const requestedType = searchParams.get('type');
    return requestedType === 'training' || requestedType === 'tournament' ? requestedType : 'regular';
  })();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [mode, setMode] = useState('ai');
  const [avatar, setAvatar] = useState('');
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [showAiFlagPicker, setShowAiFlagPicker] = useState(false);
  const [playerFlagIndex, setPlayerFlagIndex] = useState(null);
  const [aiFlagIndex, setAiFlagIndex] = useState(null);
  const [playType, setPlayType] = useState(initialPlayType);
  const [players, setPlayers] = useState(8);
  const [onlinePlayers, setOnlinePlayers] = useState([]);
  const [matching, setMatching] = useState(false);
  const [spinningPlayer, setSpinningPlayer] = useState('');
  const [matchingError, setMatchingError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [readyList, setReadyList] = useState([]);
  const [matchPlayers, setMatchPlayers] = useState([]);
  const [matchTableId, setMatchTableId] = useState('');
  const [tableSize, setTableSize] = useState(resolveSnookerTableSize(searchParams.get('tableSize')).id);

  const spinIntervalRef = useRef(null);
  const accountIdRef = useRef(null);
  const stakeChargedRef = useRef(false);

  const selectedFlag = playerFlagIndex != null ? FLAG_EMOJIS[playerFlagIndex] : '';
  const selectedAiFlag = aiFlagIndex != null ? FLAG_EMOJIS[aiFlagIndex] : '';

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage?.getItem(PLAYER_FLAG_STORAGE_KEY);
      const idx = FLAG_EMOJIS.indexOf(stored);
      if (idx >= 0) setPlayerFlagIndex(idx);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage?.getItem(AI_FLAG_STORAGE_KEY);
      const idx = FLAG_EMOJIS.indexOf(stored);
      if (idx >= 0) setAiFlagIndex(idx);
    } catch {}
  }, []);

  useEffect(() => {
    let active = true;
    getOnlineUsers('snookerclub')
      .then((res) => {
        if (active) setOnlinePlayers(res?.users || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!matching) return () => {};
    spinIntervalRef.current = setInterval(() => {
      setSpinningPlayer((curr) => {
        const fallback = 'Reds are getting racked...';
        if (!onlinePlayers.length) return fallback;
        const nextIndex = onlinePlayers.indexOf(curr);
        const idx = (nextIndex + 1) % onlinePlayers.length;
        return onlinePlayers[idx] || fallback;
      });
    }, 1200);
    return () => clearInterval(spinIntervalRef.current);
  }, [matching, onlinePlayers]);

  const startGame = async () => {
    let tgId;
    let accountId;
    if (playType !== 'training') {
      try {
        accountId = await ensureAccountId();
        const balRes = await getAccountBalance(accountId);
        if ((balRes.balance || 0) < stake.amount) {
          alert('Insufficient balance');
          return;
        }
        tgId = getTelegramId();
        if (mode !== 'online') {
          await addTransaction(tgId, -stake.amount, 'stake', {
            game: 'snookerclub',
            players: playType === 'tournament' ? players : 2,
            accountId
          });
        }
      } catch {}
    } else {
      try {
        tgId = getTelegramId();
        accountId = await ensureAccountId();
      } catch {}
    }

    accountIdRef.current = accountId;

    if (mode === 'online' && playType === 'regular') {
      setMatchingError('');
      setIsSearching(true);
      stakeChargedRef.current = false;
      if (!accountId) {
        setIsSearching(false);
        setMatchingError('Unable to resolve your TPC account.');
        return;
      }
      socket.emit('register', { playerId: accountId, accountId });
      socket.emit(
        'seatTable',
        {
          accountId,
          gameType: 'snookerclub',
          stake: stake.amount,
          maxPlayers: 2,
          token: stake.token,
          playType,
          tableSize,
          playerName: getTelegramFirstName() || `TPC ${accountId}`,
          avatar
        },
        (res) => {
          setIsSearching(false);
          if (res?.success) {
            setMatchTableId(res.tableId);
            setMatchPlayers(res.players || []);
            setReadyList(res.ready || []);
            socket.emit('confirmReady', {
              accountId,
              tableId: res.tableId
            });
            setMatching(true);
          } else {
            setMatchingError(res?.message || 'Failed to join the online arena. Please retry.');
          }
        }
      );
      return;
    }

    const params = new URLSearchParams();
    params.set('tableSize', tableSize);
    params.set('type', playType);
    params.set('mode', mode);
    if (playType !== 'training') {
      if (stake.token) params.set('token', stake.token);
      if (stake.amount) params.set('amount', stake.amount);
      if (playType === 'tournament') params.set('players', players);
    }
    const initData = window.Telegram?.WebApp?.initData;
    if (avatar) params.set('avatar', avatar);
    if (tgId) params.set('tgId', tgId);
    if (accountId) params.set('accountId', accountId);
    const name = getTelegramFirstName();
    if (name) params.set('name', name);
    if (selectedFlag) params.set('flag', selectedFlag);
    if (selectedAiFlag) params.set('aiFlag', selectedAiFlag);
    const devAcc = import.meta.env.VITE_DEV_ACCOUNT_ID;
    if (devAcc) params.set('dev', devAcc);
    if (initData) params.set('init', encodeURIComponent(initData));

    if (playType === 'tournament') {
      window.location.href = `/snooker-club-bracket.html?${params.toString()}`;
      return;
    }

    navigate(`/games/snookerclub?${params.toString()}`);
  };

  const closeMatchmaking = () => {
    setMatching(false);
    setMatchTableId('');
    setMatchPlayers([]);
    setReadyList([]);
    setSpinningPlayer('');
    setIsSearching(false);
  };

  const confirmReady = () => {
    const id = accountIdRef.current;
    if (id && matchTableId) {
      socket.emit('confirmReady', { tableId: matchTableId, accountId: id });
    }
  };

  const toggleReady = () => {
    const id = accountIdRef.current;
    if (!id || !matchTableId) return;
    const isReady = readyList.includes(id);
    socket.emit('toggleReady', { tableId: matchTableId, accountId: id, ready: !isReady });
  };

  const lobbyTitle = useMemo(() => {
    if (playType === 'training') return 'Snooker Club Training';
    if (playType === 'tournament') return 'Snooker Club Tournament';
    return 'Snooker Club';
  }, [playType]);

  return (
    <div className="p-4 space-y-4 text-text">
      <h1 className="text-2xl font-bold text-center">{lobbyTitle}</h1>
      <p className="text-center text-sm text-subtext">
        Choose your table size, mode, and stake to rack up a frame with the classic snooker markings.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3 bg-surface border border-border rounded-xl p-4 shadow">
          <h2 className="font-semibold text-lg">Match Setup</h2>
          <div className="space-y-2">
            <label className="text-sm font-medium">Table Size</label>
            <div className="grid grid-cols-2 gap-2">
              {SNOOKER_TABLE_SIZE_LIST.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    tableSize === entry.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary'
                  }`}
                  onClick={() => setTableSize(entry.id)}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Play Type</label>
            <div className="flex gap-2">
              {['regular', 'training', 'tournament'].map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${
                    playType === type
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary'
                  }`}
                  onClick={() => setPlayType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {playType === 'tournament' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Players</label>
              <RoomSelector value={players} onChange={setPlayers} min={4} max={16} step={2} />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Mode</label>
            <div className="flex gap-2">
              {['ai', 'online', 'local'].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${
                    mode === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary'
                  }`}
                  onClick={() => setMode(value)}
                >
                  {value === 'ai' ? 'vs AI' : value}
                </button>
              ))}
            </div>
          </div>

          {playType !== 'training' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">Token</label>
                <input
                  value={stake.token}
                  onChange={(e) => setStake((s) => ({ ...s, token: e.target.value }))}
                  className="w-full rounded border border-border bg-background px-2 py-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Stake</label>
                <input
                  type="number"
                  value={stake.amount}
                  onChange={(e) => setStake((s) => ({ ...s, amount: Number(e.target.value || 0) }))}
                  className="w-full rounded border border-border bg-background px-2 py-1"
                  min={0}
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 bg-surface border border-border rounded-xl p-4 shadow">
          <h2 className="font-semibold text-lg">Identity</h2>
          <div className="flex gap-3 items-center">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-border">
              {avatar ? <img src={avatar} alt="Avatar" className="w-full h-full object-cover" /> : null}
            </div>
            <div className="space-y-1 text-sm text-subtext">
              <p>Flag: {selectedFlag || 'None'}</p>
              <p>AI Flag: {selectedAiFlag || 'Default'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
              onClick={() => setShowFlagPicker(true)}
            >
              Choose Player Flag
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
              onClick={() => setShowAiFlagPicker(true)}
            >
              Choose AI Flag
            </button>
          </div>
          <div className="rounded-lg border border-dashed border-border p-3 text-sm text-subtext">
            Training mode keeps the classic markings without staking. Tournament auto-seats you into an arena separate from Pool
            Royale.
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between bg-surface border border-border rounded-xl p-4 shadow">
        <div>
          <p className="text-sm text-subtext">Online players</p>
          <p className="text-lg font-semibold">{onlinePlayers.length || 0}</p>
        </div>
        <button
          type="button"
          className="rounded-full bg-primary px-6 py-3 text-black font-semibold shadow-lg shadow-primary/40"
          onClick={startGame}
          disabled={isSearching}
        >
          {isSearching ? 'Searching...' : 'Start'}
        </button>
      </div>

      {matching && (
        <div className="rounded-xl border border-border bg-surface p-4 shadow space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Arena Matchmaking</h3>
            <button className="text-sm text-primary" onClick={closeMatchmaking} type="button">
              Cancel
            </button>
          </div>
          <p className="text-sm text-subtext">{spinningPlayer || 'Waiting for opponent...'}</p>
          <div className="text-sm text-subtext">Table ID: {matchTableId || 'pending'}</div>
          <div className="text-sm text-subtext">Ready: {readyList.length}</div>
          <div className="text-sm text-subtext">Players: {matchPlayers.length || 1}/2</div>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
              onClick={confirmReady}
            >
              Confirm Ready
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
              onClick={toggleReady}
            >
              Toggle Ready
            </button>
          </div>
          {matchingError && <p className="text-sm text-red-500">{matchingError}</p>}
        </div>
      )}

      {showFlagPicker && (
        <FlagPickerModal
          onClose={() => setShowFlagPicker(false)}
          onPick={(flagIndex) => {
            setPlayerFlagIndex(flagIndex);
            try {
              window.localStorage?.setItem(PLAYER_FLAG_STORAGE_KEY, FLAG_EMOJIS[flagIndex] || '');
            } catch {}
          }}
        />
      )}

      {showAiFlagPicker && (
        <FlagPickerModal
          onClose={() => setShowAiFlagPicker(false)}
          onPick={(flagIndex) => {
            setAiFlagIndex(flagIndex);
            try {
              window.localStorage?.setItem(AI_FLAG_STORAGE_KEY, FLAG_EMOJIS[flagIndex] || '');
            } catch {}
          }}
        />
      )}
    </div>
  );
}
