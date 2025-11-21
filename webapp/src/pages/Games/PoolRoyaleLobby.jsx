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
      socket.emit('register', { playerId: accountId });
      socket.emit(
        'seatTable',
        {
          accountId,
          gameType: 'poolroyale',
          stake: stake.amount,
          maxPlayers: 2,
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
            setMatchingError('Failed to join the online arena. Please retry.');
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
      [
        'Pocket the cue ball softly to feel cloth speed.',
        'Complete a straight-in pot from the kitchen.',
        'Pot two object balls in a row without scratching.',
        'Play a gentle stun shot to hold the cue ball in place.',
        'Sink a long corner shot with a smooth follow-through.',
        'Clear three open balls with center-ball hits only.',
        'Use a simple stop shot to finish shape for the next ball.',
        'Make a cut shot to the middle pocket at medium pace.',
        'Run a mini pattern of four balls without bumping cushions.',
        'Finish a basic rack with no fouls.',
        'Control cue ball speed on a three-ball drill.',
        'Execute a gentle draw shot to pull back a table diamond.',
        'Bank an object ball cross-side with planned speed.',
        'Play a thin cut to the corner while avoiding the scratch.',
        'Run five balls using only center and stop shots.',
        'Break a mini-rack and pot any ball off the break.',
        'Hold white on the rail and pot a middle-pocket shot.',
        'Plan a three-ball pattern with one rail of position.',
        'Deliver a controlled lag to land within a hand span.',
        'Finish a practice rack in under two minutes.',
        'Break and run the first three balls of a rack.',
        'Pot from behind a blocker using slight swerve.',
        'Two-rail kick safe to touch an object ball.',
        'Complete a stop-draw-follow ladder of five shots.',
        'Play a defensive thin hit leaving cue ball on the rail.',
        'Bank two balls in one turn to opposite sides.',
        'Run half a rack with purposeful cue-ball zones.',
        'Deliver a controlled nine-ball style soft break.',
        'Play a jump over a chalk to pot a close ball.',
        'Close a rack with zero unforced errors.',
        'Break and clear four balls while keeping shape.',
        'Kick-safe using a diamond system reference.',
        'Draw two rails to land on a precise target zone.',
        'Navigate traffic with a three-rail positional route.',
        'Bank-kick combination to score a tough pot.',
        'Run a full practice rack under shot clock pressure.',
        'Execute a break-and-run of six balls.',
        'Lock down a safety leaving opponent snookered.',
        'Three-rail escape landing on the correct side of the ball.',
        'Run a rack alternating draw and follow for shape.',
        'Perform a power break keeping cue ball center-table.',
        'Clear a rack after a dry break from the opponent.',
        'Hit a jump-masse combo to save the rack.',
        'Back-to-back racks with no fouls or scratches.',
        'Force-follow three rails to perfect shape on the last two balls.',
        'Run-out after a clustered break by opening balls safely.',
        'Execute a precise two-way shot (make or lock safe).',
        'Complete a six-rail kick to contact a chosen ball.',
        'Win a simulated hill-hill rack with safety-first play.',
        'Dominate a full 50-shot drill without missing.'
      ].map((description, index) => {
        const level = index + 1;
        let reward = 100;
        if (level === 50) reward = 2000;
        else if (level >= 40) reward = 400;
        else if (level >= 30) reward = 300;
        else if (level >= 20) reward = 200;
        return {
          level,
          description,
          reward,
          nft: level % 10 === 0 || level === 50
        };
      }),
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
        <h3 className="font-semibold">Career Mode · 50 Rounds</h3>
        <p className="text-sm text-subtext">
          Climb from fundamentals to super pro drills. Every 10 levels award an NFT, and rewards scale with
          progress. Finish level 50 for a 2,000 TPC jackpot and a special NFT gift.
        </p>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {careerRounds.map(({ level, description, reward, nft }) => (
            <div key={level} className="lobby-tile w-full flex items-center justify-between">
              <div>
                <p className="font-semibold">Round {level}</p>
                <p className="text-sm text-subtext">{description}</p>
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
