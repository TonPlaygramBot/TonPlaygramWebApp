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
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { resolveTableSize } from '../../config/poolRoyaleTables.js';
import { socket } from '../../utils/socket.js';
import { getOnlineUsers } from '../../utils/api.js';

const TRAINING_TASKS = [
  {
    description: 'Roll a single object ball that is already near the corner pocket – just tap to pot.',
    tip: 'Line up straight and use a soft stroke to sink the ball.',
    reward: 50
  },
  {
    description: 'Move the cue ball a few inches and pot a ball hanging over the middle pocket.',
    tip: 'Feather the cue to feel table speed before committing.',
    reward: 75
  },
  {
    description: 'Play a gentle follow (top spin) to hold shape for the next ball.',
    tip: 'Drag the spin marker slightly above center, aim straight, and push through.',
    reward: 100
  },
  {
    description: 'Stun the cue ball after potting to stay on the same line.',
    tip: 'Keep the spin marker at center ball and strike cleanly.',
    reward: 120
  },
  {
    description: 'Use a small draw (back spin) to pull back for an easy next shot.',
    tip: 'Set the spin marker just below center and reduce power.',
    reward: 150
  },
  {
    description: 'Pot two open balls in sequence without touching cushions.',
    tip: 'Prioritize straight pots and soft pace to keep control.',
    reward: 180
  },
  {
    description: 'Bank a ball cross-side with center-ball strike.',
    tip: 'Visualize the mirror angle and keep power moderate.',
    reward: 220
  },
  {
    description: 'Play a thin cut to the corner while avoiding a scratch.',
    tip: 'Aim for the far jaw and favor stun over follow.',
    reward: 260
  },
  {
    description: 'Run a three-ball pattern using only follow and stun.',
    tip: 'Alternate between soft top spin and stop shots to stay in line.',
    reward: 320
  },
  {
    description: 'Finish a mini-rack in under two minutes with clean position.',
    tip: 'Plan the order, use gentle spin, and avoid risky power shots.',
    reward: 500,
    nft: true
  }
];

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

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

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
            game: 'poolroyale',
            players: 2,
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

    if (mode === 'online') {
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
          gameType: 'poolroyale',
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
    const devAcc = import.meta.env.VITE_DEV_ACCOUNT_ID;
    const devAcc1 = import.meta.env.VITE_DEV_ACCOUNT_ID_1;
    const devAcc2 = import.meta.env.VITE_DEV_ACCOUNT_ID_2;
    if (devAcc) params.set('dev', devAcc);
    if (devAcc1) params.set('dev1', devAcc1);
    if (devAcc2) params.set('dev2', devAcc2);
    if (initData) params.set('init', encodeURIComponent(initData));
    if (playType === 'training' && TRAINING_TASKS[0]?.tip) {
      window.alert(`Training tip: ${TRAINING_TASKS[0].tip}`);
    }
    navigate(`/games/pollroyale?${params.toString()}`);
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

  const matchingCandidates = useMemo(() => {
    const base = (onlinePlayers || []).map((p) => ({
      id: p.accountId || p.playerId || p.id,
      name: p.username || p.name || p.telegramName || p.telegramId || p.accountId
    }));
    const lobbyEntries = (matchPlayers || []).map((p) => ({ id: p.id, name: p.name || p.id }));
    const merged = [...base, ...lobbyEntries].filter((p) => p.id);
    const seen = new Set();
    return merged.filter((p) => {
      const key = String(p.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [matchPlayers, onlinePlayers]);

  useEffect(() => {
    if (spinIntervalRef.current) {
      clearInterval(spinIntervalRef.current);
      spinIntervalRef.current = null;
    }
    if (!matching || matchingCandidates.length === 0) return undefined;
    setSpinningPlayer(matchingCandidates[0].name || 'Searching…');
    spinIntervalRef.current = setInterval(() => {
      const pick = matchingCandidates[Math.floor(Math.random() * matchingCandidates.length)];
      setSpinningPlayer(pick?.name || 'Searching…');
    }, 500);
    return () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    };
  }, [matching, matchingCandidates]);

  useEffect(() => {
    const tableId = matchTableId;
    if (!tableId) return undefined;

    const onUpdate = ({ tableId: incomingId, players, ready }) => {
      if (incomingId !== tableId) return;
      setMatchPlayers(players || []);
      setReadyList(ready || []);
    };

    const onStart = async ({ tableId: incomingId }) => {
      if (incomingId !== tableId) return;
      if (!stakeChargedRef.current && stake.amount && playType !== 'training') {
        const tgId = getTelegramId();
        const accountId = accountIdRef.current;
        try {
          await addTransaction(tgId, -stake.amount, 'stake', {
            game: 'poolroyale-online',
            players: 2,
            accountId,
            tableId
          });
        } catch {}
        stakeChargedRef.current = true;
      }
      const params = new URLSearchParams();
      params.set('variant', variant);
      params.set('type', playType);
      params.set('mode', 'online');
      params.set('tableId', tableId);
      if (stake.token) params.set('token', stake.token);
      if (stake.amount) params.set('amount', stake.amount);
      if (avatar) params.set('avatar', avatar);
      const tgId = getTelegramId();
      if (tgId) params.set('tgId', tgId);
      const accountId = accountIdRef.current;
      if (accountId) params.set('accountId', accountId);
      if (tableSize) params.set('tableSize', tableSize);
      const name = getTelegramFirstName();
      if (name) params.set('name', name);
      navigate(`/games/pollroyale?${params.toString()}`);
    };

    socket.on('lobbyUpdate', onUpdate);
    socket.on('gameStart', onStart);
    return () => {
      socket.off('lobbyUpdate', onUpdate);
      socket.off('gameStart', onStart);
    };
  }, [avatar, matchTableId, navigate, playType, stake, tableSize, variant]);

  useEffect(() => {
    const id = accountIdRef.current;
    const tableId = matchTableId;
    return () => {
      if (tableId && id) {
        socket.emit('leaveLobby', { accountId: id, tableId });
      }
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    };
  }, [matchTableId]);

  useEffect(() => {
    if (mode !== 'online') {
      setMatching(false);
      setMatchTableId('');
      setMatchPlayers([]);
      setReadyList([]);
      stakeChargedRef.current = false;
    }
  }, [mode]);

  const readyIds = useMemo(
    () => new Set((readyList || []).map((id) => String(id))),
    [readyList]
  );

  const careerRounds = useMemo(
    () =>
      TRAINING_TASKS.map((task, index) => ({
        level: index + 1,
        description: task.description,
        reward: task.reward,
        tip: task.tip,
        nft: Boolean(task.nft)
      })),
    []
  );

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
              <div key={id} className="relative">
                <button
                  onClick={() => setMode(id)}
                  className={`lobby-tile ${mode === id ? 'lobby-selected' : ''}`}
                >
                  {label}
                </button>
              </div>
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
      {mode === 'online' && (
        <div className="space-y-3 p-3 rounded-lg border border-border bg-surface/60">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Online Arena</h3>
              <p className="text-sm text-subtext">
                We match players by TPC account number, stake ({stake.amount} {stake.token}),
                and Pool Royale game type.
              </p>
            </div>
            <div className="text-xs text-subtext">{onlinePlayers.length} online</div>
          </div>
          {matchingError && (
            <div className="text-sm text-red-400">{matchingError}</div>
          )}
          {matching && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Spinning wheel</span>
                <span className="text-xs text-subtext">Searching for stake match…</span>
              </div>
              <div className="lobby-tile w-full flex items-center justify-between">
                <span>🎯 {spinningPlayer || 'Searching…'}</span>
                <span className="text-xs text-subtext">Stake {stake.amount} {stake.token}</span>
              </div>
              <div className="space-y-1">
                {matchPlayers.map((p) => (
                  <div
                    key={p.id}
                    className="lobby-tile w-full flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold">{p.name || `TPC ${p.id}`}</p>
                      <p className="text-xs text-subtext">Account #{p.id}</p>
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        readyIds.has(String(p.id)) ? 'text-emerald-400' : 'text-subtext'
                      }`}
                    >
                      {readyIds.has(String(p.id)) ? 'Ready' : 'Waiting'}
                    </span>
                  </div>
                ))}
                {matchPlayers.length === 0 && (
                  <div className="lobby-tile w-full text-sm text-subtext">
                    Waiting for another player in this pool arena…
                  </div>
                )}
              </div>
            </div>
          )}
          {!matching && (
            <div className="text-sm text-subtext">
              Start to join a 1v1 pool arena. We keep you at the same table until the match begins.
            </div>
          )}
        </div>
      )}
      <button
        onClick={startGame}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded"
        disabled={mode === 'online' && isSearching}
      >
        {mode === 'online' ? (matching ? 'Waiting for opponent…' : 'START ONLINE') : 'START'}
      </button>
      <div className="space-y-2">
        <h3 className="font-semibold">Training Ladder · 10 Rounds</h3>
        <p className="text-sm text-subtext">
          Start with simple one-ball pots, then layer in spin control, position play, and gentle banks.
          Each round explains the objective so new players learn step by step while still earning TPC.
        </p>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {careerRounds.map(({ level, description, reward, nft, tip }) => (
            <div key={level} className="lobby-tile w-full flex items-center justify-between">
              <div>
                <p className="font-semibold">Round {level}</p>
                <p className="text-sm text-subtext">{description}</p>
                {tip && <p className="text-xs text-amber-200 mt-1">Tip: {tip}</p>}
              </div>
              <div className="text-right text-sm">
                <div className="font-semibold">Reward: {reward} TPC</div>
                {nft && <div className="text-amber-300 text-xs">NFT gift unlocked</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
