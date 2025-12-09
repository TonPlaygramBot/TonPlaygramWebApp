import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import TableSelector from '../../components/TableSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  ensureAccountId,
  getTelegramId,
  getTelegramPhotoUrl,
  getTelegramFirstName
} from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { resolveTableSize, TABLE_SIZE_LIST } from '../../config/snookerClubTables.js';
import { socket } from '../../utils/socket.js';

export default function SnookerClubLobby() {
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
  const variant = 'uk';
  const [playType, setPlayType] = useState(initialPlayType);
  const [players, setPlayers] = useState(8);
  const [trainingVariant, setTrainingVariant] = useState('uk');
  const [trainingMode, setTrainingMode] = useState('solo');
  const [trainingRulesEnabled, setTrainingRulesEnabled] = useState(true);
  const [tableSize, setTableSize] = useState(() => resolveTableSize(searchParams.get('tableSize')).id);
  const [matching, setMatching] = useState(false);
  const [matchingError, setMatchingError] = useState('');
  const [matchPlayers, setMatchPlayers] = useState([]);
  const [matchTableId, setMatchTableId] = useState('');
  const [readyList, setReadyList] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const spinIntervalRef = useRef(null);

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

    if (mode === 'online' && playType === 'regular') {
      setMatchingError('');
      setIsSearching(true);
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
            setMatchingError(
              res?.message || 'Failed to join the online arena. Please retry.'
            );
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
    if (initData) params.set('init', encodeURIComponent(initData));

    if (playType === 'tournament') {
      window.location.href = `/pool-royale-bracket.html?${params.toString()}`;
      return;
    }

    const target = `/games/snookerclub?${params.toString()}`;
    window.location.href = target;
  };

  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) {
        clearInterval(spinIntervalRef.current);
      }
    };
  }, []);

  const tableOptions = useMemo(
    () => TABLE_SIZE_LIST.map((entry) => ({ id: entry.id, label: entry.label })),
    []
  );

  return (
    <div className="p-4 space-y-4 text-text">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="text-sm text-primary"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
        <h2 className="text-xl font-semibold">Snooker Club Lobby</h2>
        <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-surface">
          {avatar ? (
            <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-border" />
          )}
        </div>
      </div>

      <div className="space-y-4 bg-surface rounded-xl border border-border p-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <button
            type="button"
            className={`lobby-pill ${playType === 'regular' ? 'lobby-selected' : ''}`}
            onClick={() => setPlayType('regular')}
          >
            Staking
          </button>
          <button
            type="button"
            className={`lobby-pill ${playType === 'training' ? 'lobby-selected' : ''}`}
            onClick={() => setPlayType('training')}
          >
            Training
          </button>
          <button
            type="button"
            className={`lobby-pill ${playType === 'tournament' ? 'lobby-selected' : ''}`}
            onClick={() => setPlayType('tournament')}
          >
            Tournament
          </button>
        </div>

        <RoomSelector
          title="Mode"
          options={[
            { id: 'ai', label: 'VS AI' },
            { id: 'online', label: 'Online' },
            { id: 'local', label: 'Local Multiplayer' }
          ]}
          selected={mode}
          onChange={setMode}
        />

        <div className="space-y-2">
          <p className="text-sm font-semibold">Table</p>
          <TableSelector
            tables={tableOptions}
            selected={tableOptions.find((t) => t.id === tableSize)}
            onSelect={(t) => setTableSize(t.id)}
          />
        </div>

        {playType !== 'training' && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label className="flex flex-col">
              <span className="text-subtext text-xs">Token</span>
              <input
                value={stake.token}
                onChange={(e) => setStake((s) => ({ ...s, token: e.target.value }))}
                className="lobby-input"
              />
            </label>
            <label className="flex flex-col">
              <span className="text-subtext text-xs">Stake</span>
              <input
                type="number"
                value={stake.amount}
                onChange={(e) => setStake((s) => ({ ...s, amount: Number(e.target.value) }))}
                className="lobby-input"
              />
            </label>
          </div>
        )}

        {playType === 'tournament' && (
          <div className="space-y-1">
            <p className="text-sm">Players</p>
            <input
              type="number"
              className="lobby-input"
              min={4}
              max={32}
              value={players}
              onChange={(e) => setPlayers(Number(e.target.value))}
            />
          </div>
        )}

        {playType === 'training' && (
          <div className="space-y-2">
            <RoomSelector
              title="Training Mode"
              options={[
                { id: 'solo', label: 'Solo' },
                { id: 'ai', label: 'VS AI' }
              ]}
              selected={trainingMode}
              onChange={setTrainingMode}
            />
            <RoomSelector
              title="Rules"
              options={[
                { id: 'on', label: 'Follow Rules' },
                { id: 'off', label: 'Free Practice' }
              ]}
              selected={trainingRulesEnabled ? 'on' : 'off'}
              onChange={(val) => setTrainingRulesEnabled(val === 'on')}
            />
          </div>
        )}

        <button
          type="button"
          onClick={startGame}
          disabled={isSearching}
          className="w-full lobby-button"
        >
          {isSearching ? 'Finding Table…' : 'Start'}
        </button>

        {matching && (
          <div className="p-3 rounded-lg bg-surface/70 border border-border space-y-2">
            <p className="text-sm font-semibold">Matching…</p>
            <p className="text-xs text-subtext">
              Waiting for your opponent to confirm. Table {matchTableId || 'pending'}
            </p>
            {matchPlayers.length > 0 && (
              <ul className="text-xs list-disc list-inside text-subtext">
                {matchPlayers.map((p) => (
                  <li key={p.accountId || p.id}>{p.name || p.accountId}</li>
                ))}
              </ul>
            )}
            {readyList.length > 0 && (
              <p className="text-xs text-primary">Ready: {readyList.length}</p>
            )}
          </div>
        )}

        {matchingError && (
          <div className="text-xs text-red-400 bg-red-900/20 border border-red-700 rounded-lg p-2">
            {matchingError}
          </div>
        )}
      </div>
    </div>
  );
}
