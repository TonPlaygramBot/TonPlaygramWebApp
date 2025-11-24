import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  ensureAccountId,
  getTelegramId,
  getTelegramPhotoUrl,
  getTelegramFirstName
} from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { resolveTableSize } from '../../config/poolRoyaleTables.js';
import { socket } from '../../utils/socket.js';
import { getOnlineUsers } from '../../utils/api.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';

const PLAYER_FLAG_STORAGE_KEY = 'snookerPlayerFlag';
const AI_FLAG_STORAGE_KEY = 'snookerAiFlag';

export default function SnookerLobby() {
  const navigate = useNavigate();
  const { search } = useLocation();
  useTelegramBackButton();

  const searchParams = new URLSearchParams(search);
  const initialPlayType = (() => {
    const requestedType = searchParams.get('type');
    return requestedType === 'training' || requestedType === 'tournament'
      ? requestedType
      : 'regular';
  })();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [mode, setMode] = useState('ai');
  const [avatar, setAvatar] = useState('');
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [showAiFlagPicker, setShowAiFlagPicker] = useState(false);
  const [playerFlagIndex, setPlayerFlagIndex] = useState(null);
  const [aiFlagIndex, setAiFlagIndex] = useState(null);
  const [variant, setVariant] = useState('uk');
  const [playType, setPlayType] = useState(initialPlayType);
  const [players, setPlayers] = useState(8);
  const [trainingVariant, setTrainingVariant] = useState('uk');
  const [trainingMode, setTrainingMode] = useState('solo');
  const [trainingRulesEnabled, setTrainingRulesEnabled] = useState(true);
  const tableSize = resolveTableSize(searchParams.get('tableSize')).id;
  const [onlinePlayers, setOnlinePlayers] = useState([]);
  const [matching, setMatching] = useState(false);
  const [spinningPlayer, setSpinningPlayer] = useState('');
  const [matchPlayers, setMatchPlayers] = useState([]);
  const [matchTableId, setMatchTableId] = useState('');
  const [readyList, setReadyList] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [matchingError, setMatchingError] = useState('');
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
    if (playType !== 'training') return;
    setTrainingVariant((current) => current || variant);
  }, [playType, variant]);

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
            game: 'snooker',
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
          gameType: 'snooker',
          stake: stake.amount,
          maxPlayers: 2,
          token: stake.token,
          variant,
          tableSize,
          playType,
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
    const resolvedVariant = playType === 'training' ? trainingVariant : variant;
    params.set('variant', resolvedVariant);
    params.set('tableSize', tableSize);
    params.set('type', playType);
    params.set('mode', playType === 'training' ? trainingMode : mode);
    if (playType === 'training') {
      params.set('rules', trainingRulesEnabled ? 'on' : 'off');
    }
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
    const devAcc1 = import.meta.env.VITE_DEV_ACCOUNT_ID_1;
    const devAcc2 = import.meta.env.VITE_DEV_ACCOUNT_ID_2;
    if (devAcc) params.set('dev', devAcc);
    if (devAcc1) params.set('dev1', devAcc1);
    if (devAcc2) params.set('dev2', devAcc2);
    if (initData) params.set('init', encodeURIComponent(initData));

    if (playType === 'tournament') {
      window.location.href = `/pool-royale-bracket.html?${params.toString()}`;
      return;
    }

    navigate(`/games/snooker?${params.toString()}`);
  };

  useEffect(() => {
    let active = true;
    const loadOnline = () => {
      getOnlineUsers()
        .then((data) => {
          if (!active) return;
          const list = Array.isArray(data?.users)
            ? data.users
            : Array.isArray(data)
            ? data
            : [];
          setOnlinePlayers(list);
        })
        .catch(() => {});
    };
    loadOnline();
    const id = setInterval(loadOnline, 15000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const spinNames = ['Alex', 'Jordan', 'Casey', 'Taylor', 'Carmen', 'Reese'];
    const spin = () => {
      setSpinningPlayer(spinNames[Math.floor(Math.random() * spinNames.length)]);
    };
    spin();
    spinIntervalRef.current = setInterval(spin, 1200);
    return () => clearInterval(spinIntervalRef.current);
  }, []);

  const onlinePlayersDisplay = useMemo(() => {
    if (!Array.isArray(onlinePlayers) || onlinePlayers.length === 0) {
      return 'No players online';
    }
    const names = onlinePlayers.slice(0, 4).map((p) => p?.name || 'Player');
    if (onlinePlayers.length > 4) {
      names.push(`+${onlinePlayers.length - 4}`);
    }
    return names.join(' · ');
  }, [onlinePlayers]);

  const finalizeOnlineMatch = useCallback(
    (data) => {
      if (!data?.tableId || !Array.isArray(data.players) || !data.players.length) return;
      const ready = Array.isArray(data.ready) ? data.ready : [];
      setMatchPlayers(data.players);
      setReadyList(ready);
      if (!stakeChargedRef.current) {
        const me = data.players.find((p) => p.accountId === accountIdRef.current);
        if (me) {
          stakeChargedRef.current = true;
        }
      }
      const everyoneReady = ready.length >= data.players.length;
      if (everyoneReady) {
        const params = new URLSearchParams();
        params.set('variant', variant);
        params.set('tableSize', tableSize);
        params.set('type', playType);
        params.set('mode', 'online');
        params.set('token', stake.token);
        params.set('amount', stake.amount);
        params.set('tableId', data.tableId);
        params.set('slot', data.slot);
        const initData = window.Telegram?.WebApp?.initData;
        if (avatar) params.set('avatar', avatar);
        const name = getTelegramFirstName();
        if (name) params.set('name', name);
        if (selectedFlag) params.set('flag', selectedFlag);
        if (initData) params.set('init', encodeURIComponent(initData));
        window.location.href = `/games/snooker?${params.toString()}`;
      }
    },
    [avatar, playType, selectedFlag, stake.amount, stake.token, tableSize, variant]
  );

  useEffect(() => {
    const handleReady = (data) => {
      if (data?.tableId === matchTableId) {
        finalizeOnlineMatch(data);
      }
    };
    socket.on('tableReady', handleReady);
    return () => {
      socket.off('tableReady', handleReady);
    };
  }, [finalizeOnlineMatch, matchTableId]);

  const [aiLevel, setAiLevel] = useState('medium');

  const stakeOptions = [100, 500, 1000, 5000, 10000];
  const trainingModes = [
    { id: 'solo', label: 'Solo' },
    { id: 'ai', label: 'Vs AI' }
  ];

  return (
    <div className="relative p-4 space-y-4 text-text min-h-screen tetris-grid-bg">
      <h2 className="text-xl font-bold text-center">3D Snooker Lobby</h2>
      <p className="text-center text-sm text-subtext">
        Pool Royale-spec arena, lighting, cameras, and table setup for snooker play.
      </p>

      <div className="space-y-2">
        <h3 className="font-semibold">Type</h3>
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'regular', label: 'Regular' },
            { id: 'training', label: 'Training' },
            { id: 'tournament', label: 'Tournament' }
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setPlayType(id)}
              className={`lobby-tile ${playType === id ? 'lobby-selected' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {playType !== 'training' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Mode</h3>
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'ai', label: 'Vs AI' },
              { id: 'online', label: '1v1 Online' }
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={`lobby-tile ${mode === id ? 'lobby-selected' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {playType === 'training' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">Training options</h3>
            <div className="lobby-tile flex flex-col gap-4">
              <div>
                <p className="text-sm font-semibold">Mode</p>
                <p className="text-xs text-subtext">Regular table flow with Pool Royale cameras and lighting.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {trainingModes.map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => setTrainingMode(id)}
                      className={`lobby-tile ${trainingMode === id ? 'lobby-selected' : ''}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Apply rules</span>
                <label className="inline-flex items-center gap-2">
                  <span className="text-xs text-subtext">Off</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-success"
                    checked={trainingRulesEnabled}
                    onChange={(e) => setTrainingRulesEnabled(e.target.checked)}
                  />
                  <span className="text-xs text-subtext">On</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {playType === 'tournament' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Players</h3>
          <RoomSelector value={players} onChange={setPlayers} />
        </div>
      )}

      {playType !== 'training' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Stake</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {stakeOptions.map((amt) => (
              <button
                key={amt}
                onClick={() => setStake({ token: 'TPC', amount: amt })}
                className={`lobby-tile ${stake.amount === amt ? 'lobby-selected' : ''}`}
              >
                <div className="text-lg font-bold">TPC</div>
                <div className="text-sm">{amt.toLocaleString()}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="font-semibold">Your Flag & Avatar</h3>
        <div className="lobby-tile flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              className="text-2xl"
              onClick={() => setShowFlagPicker(true)}
              aria-label="Pick your flag"
            >
              {selectedFlag || '🌐'}
            </button>
            <div>
              <div className="text-sm font-semibold">Flag</div>
              <div className="text-xs text-subtext">Auto-detect & save</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <img
              src={avatar || '/assets/icons/profile.svg'}
              alt="avatar"
              className="h-10 w-10 rounded-full border border-white/50 object-cover"
            />
            <div>
              <div className="text-sm font-semibold">Your avatar</div>
              <div className="text-xs text-subtext">Your avatar will appear in the match intro.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">AI Avatar Flags</h3>
        <div className="lobby-tile flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              className="text-2xl"
              onClick={() => setShowAiFlagPicker(true)}
              aria-label="Pick AI flag"
            >
              {selectedAiFlag || '🌐'}
            </button>
            <div>
              <div className="text-sm font-semibold">AI Flag</div>
              <div className="text-xs text-subtext">Pick the country flag for the AI rival</div>
            </div>
          </div>
          <div className="text-xs text-subtext">Custom AI flag</div>
        </div>
      </div>

      {playType !== 'training' && mode === 'ai' && (
        <div className="space-y-2">
          <h3 className="font-semibold">AI Difficulty</h3>
          <div className="flex gap-2">
            {[
              { id: 'easy', label: 'Easy' },
              { id: 'medium', label: 'Medium' },
              { id: 'hard', label: 'Hard' }
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setAiLevel(id)}
                className={`lobby-tile ${aiLevel === id ? 'lobby-selected' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'online' && playType === 'regular' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Online Arena</h3>
          <div className="lobby-tile space-y-2">
            <div className="text-sm font-semibold">Players online</div>
            <div className="text-xs text-subtext">{onlinePlayersDisplay}</div>
            {matchingError && <div className="text-xs text-rose-400">{matchingError}</div>}
            {matching ? (
              <div className="space-y-2 text-xs">
                <div className="font-semibold">Waiting for players...</div>
                <div className="flex flex-wrap gap-2">
                  {matchPlayers.map((p, idx) => (
                    <div
                      key={p.accountId || idx}
                      className={`px-3 py-2 rounded-full border ${
                        readyList.includes(p.accountId) ? 'border-emerald-400 text-emerald-300' : 'border-white/30'
                      }`}
                    >
                      {p.playerName || 'Player'}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <button
                className="btn btn-primary w-full"
                onClick={startGame}
                disabled={isSearching}
              >
                {isSearching ? 'Searching…' : 'Find match'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center text-xs text-subtext">
        <div>Mode: {playType === 'training' ? 'Training' : mode === 'online' ? 'Online' : 'Vs AI'}</div>
        <div>Stake: {playType === 'training' ? 'Free play' : `TPC ${stake.amount.toLocaleString()}`}</div>
        <div>Table size: {tableSize}</div>
      </div>

      <button className="btn btn-primary w-full" onClick={startGame} disabled={isSearching || matching}>
        Start match
      </button>

      <FlagPickerModal
        open={showFlagPicker}
        onClose={() => setShowFlagPicker(false)}
        onSelect={(idx) => {
          setPlayerFlagIndex(idx);
          try {
            window.localStorage?.setItem(PLAYER_FLAG_STORAGE_KEY, FLAG_EMOJIS[idx]);
          } catch {}
        }}
      />

      <FlagPickerModal
        open={showAiFlagPicker}
        onClose={() => setShowAiFlagPicker(false)}
        onSelect={(idx) => {
          setAiFlagIndex(idx);
          try {
            window.localStorage?.setItem(AI_FLAG_STORAGE_KEY, FLAG_EMOJIS[idx]);
          } catch {}
        }}
      />
    </div>
  );
}
