import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  ensureAccountId,
  getTelegramId,
  getTelegramPhotoUrl,
  getTelegramFirstName
} from '../../utils/telegram.js';
import { getAccountBalance, addTransaction, getOnlineUsers } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { resolveTableSize } from '../../config/poolRoyaleTables.js';
import PoolCareerMode from '../../components/PoolCareerMode.jsx';

export default function PoolRoyaleLobby() {
  const navigate = useNavigate();
  const { search } = useLocation();
  useTelegramBackButton();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [mode, setMode] = useState('ai');
  const [avatar, setAvatar] = useState('');
  const [variant, setVariant] = useState('uk');
  const searchParams = new URLSearchParams(search);
  const tableSize = resolveTableSize(searchParams.get('tableSize')).id;
  const [playType, setPlayType] = useState('regular');
  const [onlinePlayers, setOnlinePlayers] = useState([]);
  const [wheelIndex, setWheelIndex] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [matchedOpponent, setMatchedOpponent] = useState(null);
  const [matchStatus, setMatchStatus] = useState('');
  const [accountId, setAccountId] = useState('');
  const spinTimerRef = useRef(null);

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

  useEffect(() => {
    ensureAccountId()
      .then((id) => setAccountId(id))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (playType === 'training' && mode !== 'ai') {
      setMode('ai');
    }
  }, [playType, mode]);

  const arenaLabel = useMemo(
    () =>
      `Pool Arena · ${variant.toUpperCase()} · ${tableSize || 'std'} · ${
        stake.amount
      } ${stake.token}`,
    [variant, tableSize, stake.amount, stake.token]
  );

  useEffect(() => {
    if (mode !== 'online' || playType === 'training') return undefined;
    let cancelled = false;

    const load = () => {
      getOnlineUsers()
        .then((res) => {
          if (cancelled) return;
          const list = Array.isArray(res?.users) ? res.users : [];
          const normalized = list.map((u, index) => ({
            id: u.accountId || u.id || u.telegramId || `user-${index}`,
            name:
              u.nickname ||
              u.name ||
              u.firstName ||
              u.username ||
              `Player ${index + 1}`,
            stake: Number(u.preferredStake ?? u.stakeAmount ?? u.stake || stake.amount),
            mode: u.gameMode || u.mode || u.playType || 'regular',
            game: u.game || u.currentGame || u.currentTableId?.split('-')?.[0] || '',
            tableId: u.currentTableId || ''
          }));

          const filtered = normalized.filter((u) => {
            const stakeMatch = !u.stake || Number(u.stake) === Number(stake.amount);
            const gameMatch = !u.game || u.game === 'poolroyale' || u.game === 'pollroyale';
            const modeMatch = !u.mode || u.mode === playType || u.mode === 'regular';
            const notSelf = !accountId || String(u.id) !== String(accountId);
            return stakeMatch && gameMatch && modeMatch && notSelf;
          });
          setOnlinePlayers(filtered);
        })
        .catch(() => setOnlinePlayers([]));
    };

    load();
    const id = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [mode, playType, stake.amount, variant, tableSize, accountId]);

  useEffect(
    () => () => {
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    },
    []
  );

  const spinForOpponent = () => {
    if (!onlinePlayers.length) {
      setMatchStatus('Nuk ka lojtarë online me këto kritere ende.');
      setMatchedOpponent(null);
      return;
    }
    setSpinning(true);
    setMatchStatus('Duke përdorur rrotën e drejtë për të zgjedhur kundërshtarin...');
    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);

    const interval = setInterval(() => {
      setWheelIndex((prev) => (prev + 1) % onlinePlayers.length);
    }, 140);

    spinTimerRef.current = setTimeout(() => {
      clearInterval(interval);
      const candidates = onlinePlayers.filter(
        (p) => !accountId || String(p.id) !== String(accountId)
      );
      if (!candidates.length) {
        setSpinning(false);
        setMatchStatus('Nuk gjetëm kundërshtar me kriteret e dhomës.');
        setMatchedOpponent(null);
        return;
      }
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      const index = onlinePlayers.findIndex((p) => p.id === pick.id);
      if (index >= 0) setWheelIndex(index);
      setMatchedOpponent(pick);
      setSpinning(false);
      const table = pick.tableId || arenaLabel;
      setMatchStatus(`Lidhur me ${pick.name || pick.id}. Arena/Tabela: ${table}`);
    }, 2600);
  };

  useEffect(() => {
    setMatchedOpponent(null);
    setMatchStatus('');
  }, [mode, stake.amount, variant, tableSize, playType]);

  const startGame = async () => {
    if (mode === 'online' && !matchedOpponent) {
      setMatchStatus('Zgjidh një kundërshtar me rrotën para se të nisësh ndeshjen.');
      return;
    }
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
        await addTransaction(tgId, -stake.amount, 'stake', {
          game: 'poolroyale',
          players: 2,
          accountId
        });
      } catch {}
    } else {
      try {
        tgId = getTelegramId();
        accountId = await ensureAccountId();
      } catch {}
    }

    const params = new URLSearchParams();
    params.set('variant', variant);
    params.set('type', playType);
    if (playType !== 'training') params.set('mode', mode);
    const initData = window.Telegram?.WebApp?.initData;
    if (playType !== 'training') {
      if (stake.token) params.set('token', stake.token);
      if (stake.amount) params.set('amount', stake.amount);
    }
    if (avatar) params.set('avatar', avatar);
    if (tgId) params.set('tgId', tgId);
    if (accountId) params.set('accountId', accountId);
    if (tableSize) params.set('tableSize', tableSize);
    const name = getTelegramFirstName();
    if (name) params.set('name', name);
    if (mode === 'online' && matchedOpponent) {
      params.set('opponent', matchedOpponent.id);
      if (matchedOpponent.name) params.set('opponentName', matchedOpponent.name);
      params.set('arena', arenaLabel);
      if (matchedOpponent.tableId) params.set('matchTable', matchedOpponent.tableId);
    }
    const devAcc = import.meta.env.VITE_DEV_ACCOUNT_ID;
    const devAcc1 = import.meta.env.VITE_DEV_ACCOUNT_ID_1;
    const devAcc2 = import.meta.env.VITE_DEV_ACCOUNT_ID_2;
    if (devAcc) params.set('dev', devAcc);
    if (devAcc1) params.set('dev1', devAcc1);
    if (devAcc2) params.set('dev2', devAcc2);
    if (initData) params.set('init', encodeURIComponent(initData));
    navigate(`/games/pollroyale?${params.toString()}`);
  };

  const winnerParam = searchParams.get('winner');

  return (
    <div className="relative p-4 space-y-4 text-text min-h-screen tetris-grid-bg">
      {winnerParam && (
        <div className="text-center font-semibold">
          {winnerParam === '1' ? 'You won!' : 'CPU won!'}
        </div>
      )}
      <h2 className="text-xl font-bold text-center">Pool Royale Lobby</h2>
      <div className="space-y-2">
        <h3 className="font-semibold">Type</h3>
        <div className="flex gap-2">
          {[
            { id: 'regular', label: 'Regular' },
            { id: 'training', label: 'Training' }
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
          <div className="flex gap-2">
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
      <div className="space-y-2">
        <h3 className="font-semibold">Variant</h3>
        <div className="flex gap-2">
          {[
            { id: 'uk', label: '8 Pool UK' },
            { id: 'american', label: 'American' },
            { id: '9ball', label: '9-Ball' }
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setVariant(id)}
              className={`lobby-tile ${variant === id ? 'lobby-selected' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {playType !== 'training' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Stake</h3>
          <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
        </div>
      )}
      {mode === 'online' && playType !== 'training' && (
        <div className="space-y-3">
          <div className="lobby-tile w-full text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span>Account (TPC)</span>
              <span className="font-semibold">{accountId || 'Duke u ngarkuar...'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Arena &amp; Tabela</span>
              <span className="font-semibold text-right">{arenaLabel}</span>
            </div>
            <p className="text-xs text-subtext">
              Lojtarët filtrohen automatikisht sipas variantit, madhësisë së tavolinës dhe stake {stake.amount}{' '}
              {stake.token}.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Matchmaking Live</h3>
              <button
                onClick={spinForOpponent}
                disabled={spinning}
                className="px-3 py-1 bg-primary hover:bg-primary-hover rounded text-background disabled:opacity-60"
              >
                {spinning ? 'Duke u rrotulluar...' : 'Spin & Match'}
              </button>
            </div>
            <div className={`matchmaking-wheel ${spinning ? 'spinning' : ''}`}>
              <div className="flex flex-wrap gap-2 justify-center items-center">
                {onlinePlayers.length === 0 && (
                  <p className="text-xs text-center w-full">Nuk ka lojtarë në arenë me këto kushte ende.</p>
                )}
                {onlinePlayers.map((p, idx) => (
                  <div
                    key={`${p.id}-${idx}`}
                    className={`px-3 py-1 rounded-full border text-xs ${
                      idx === wheelIndex ? 'border-primary bg-primary/20' : 'border-border'
                    }`}
                  >
                    {p.name || p.id}
                  </div>
                ))}
              </div>
            </div>
            {matchedOpponent ? (
              <div className="lobby-tile w-full text-sm space-y-1">
                <p className="font-semibold">
                  Gati për lojë kundër {matchedOpponent.name || matchedOpponent.id}
                </p>
                <p className="text-xs text-subtext">
                  Tabela: {matchedOpponent.tableId || arenaLabel} · Stake: {stake.amount} {stake.token}
                </p>
              </div>
            ) : (
              <p className="text-xs text-subtext">Përdor rrotën për të gjetur kundërshtarin e radhës.</p>
            )}
            {matchStatus && <p className="text-xs text-primary">{matchStatus}</p>}
          </div>
        </div>
      )}
      <PoolCareerMode />
      <button
        onClick={startGame}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded"
      >
        START
      </button>
    </div>
  );
}
