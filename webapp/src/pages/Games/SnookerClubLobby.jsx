import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
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
          {[{ id: 'regular', label: 'Staking' }, { id: 'training', label: 'Training' }, { id: 'tournament', label: 'Tournament' }].map(
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

      {playType !== 'training' && (
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
      )}

      {playType === 'training' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Training options</h3>
          <div className="lobby-tile flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold">Opponent</p>
              <p className="text-xs text-subtext">Solo practice or alternate turns with the AI.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[{ id: 'solo', label: 'Solo' }, { id: 'ai', label: 'Vs AI' }].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTrainingMode(id)}
                    className={`lobby-tile ${trainingMode === id ? 'lobby-selected' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold">Rules</p>
              <p className="text-xs text-subtext">Play with standard fouls or open practice.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[{ id: 'on', label: 'Follow Rules' }, { id: 'off', label: 'Free Table' }].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTrainingRulesEnabled(id === 'on')}
                    className={`lobby-tile ${trainingRulesEnabled === (id === 'on') ? 'lobby-selected' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {playType !== 'training' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Stake</h3>
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
  );
}
