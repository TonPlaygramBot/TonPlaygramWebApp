import { useState, useEffect, useRef } from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { FaUsers } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import TableSelector from '../../components/TableSelector.jsx';
import RoomSelector from '../../components/RoomSelector.jsx';
import LeaderPickerModal from '../../components/LeaderPickerModal.jsx';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import { LEADER_AVATARS } from '../../utils/leaderAvatars.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  getSnakeLobbies,
  getSnakeLobby,
  pingOnline,
  getOnlineCount,
  seatTable,
  unseatTable,
  getProfile,
  getAccountBalance,
  addTransaction,
} from '../../utils/api.js';
import { getPlayerId, ensureAccountId, getTelegramId } from '../../utils/telegram.js';
import { canStartGame } from '../../utils/lobby.js';
import { SNAKE_CONTRACT_ADDRESS } from '../../utils/constants.js';

export default function Lobby() {
  const { game } = useParams();
  const navigate = useNavigate();
  const walletAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  useTelegramBackButton(() => navigate('/games', { replace: true }));

  useEffect(() => {
    ensureAccountId().catch(() => {});
  }, []);

  useEffect(() => {
    const handlePop = (e) => {
      e.preventDefault();
      navigate('/games', { replace: true });
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [navigate]);

  const [tables, setTables] = useState([]);
  const [table, setTable] = useState(null);
  const [stake, setStake] = useState({ token: '', amount: 0 });
  const [players, setPlayers] = useState([]);
  const [aiCount, setAiCount] = useState(0);
  const [aiType, setAiType] = useState('');
  const [showLeaderPicker, setShowLeaderPicker] = useState(false);
  const [leaders, setLeaders] = useState([]);
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [flags, setFlags] = useState([]);
  const [online, setOnline] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const autoStartedRef = useRef(false);

  const selectAiType = (t) => {
    setAiType(t);
    if (t === 'leaders') setShowLeaderPicker(true);
    else if (t === 'flags') setShowFlagPicker(true);
    if (t !== 'leaders') setLeaders([]);
    if (t !== 'flags') setFlags([]);
  };

  useEffect(() => {
    try {
      const aid = getPlayerId();
      setPlayerName(String(aid));
    } catch {}
  }, []);

  useEffect(() => {
    if (game === 'snake') {
      let active = true;
      function load() {
        getSnakeLobbies()
          .then((data) => {
            if (active) setTables([{ id: 'single', label: 'Single Player vs AI' }, ...data]);
          })
          .catch(() => {});
      }
      load();
      const id = setInterval(load, 5000);
      return () => {
        active = false;
        clearInterval(id);
      };
    }
  }, [game]);

  useEffect(() => {
    let cancelled = false;
    let interval;
    ensureAccountId()
      .then((playerId) => {
        if (cancelled) return;
        function ping() {
          pingOnline(playerId).catch(() => {});
          getOnlineCount()
            .then((d) => setOnline(d.count))
            .catch(() => {});
        }
        ping();
        interval = setInterval(ping, 30000);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (game === 'snake' && table && table.id !== 'single') {
      let cancelled = false;
      let interval;
      let pid;
      ensureAccountId()
        .then((accountId) => {
          if (cancelled) return;
          pid = accountId;
          seatTable(pid, table.id, playerName).catch(() => {});
          interval = setInterval(() => {
            seatTable(pid, table.id, playerName).catch(() => {});
          }, 30000);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
        if (interval) clearInterval(interval);
        if (pid) unseatTable(pid, table.id).catch(() => {});
      };
    }
  }, [game, table, playerName]);

  useEffect(() => {
    if (game === 'snake' && table && table.id !== 'single') {
      let active = true;
      function loadPlayers() {
        getSnakeLobby(table.id)
          .then((data) => {
            if (active) setPlayers(data.players);
          })
          .catch(() => {});
      }
      loadPlayers();
      const id = setInterval(loadPlayers, 3000);
      return () => {
        active = false;
        clearInterval(id);
      };
    } else {
      setPlayers([]);
    }
  }, [game, table]);

  useEffect(() => {
    if (
      game === 'snake' &&
      table &&
      table.id !== 'single' &&
      players.length === table.capacity &&
      !autoStartedRef.current
    ) {
      autoStartedRef.current = true;
      startGame();
    } else if (
      game === 'snake' &&
      table &&
      table.id !== 'single' &&
      players.length < table.capacity
    ) {
      autoStartedRef.current = false;
    }
  }, [players, game, table]);


  const startGame = async (flagOverride = flags, leaderOverride = leaders) => {
    const params = new URLSearchParams();
    if (table) params.set('table', table.id);
    if (
      game === 'snake' &&
      (stake.token === 'TON' || stake.token === 'USDT') &&
      stake.amount > 0
    ) {
      if (!walletAddress) {
        tonConnectUI.openModal();
        return;
      }
      let messages;
      if (stake.token === 'TON') {
        messages = [
          {
            address: SNAKE_CONTRACT_ADDRESS,
            amount: String(stake.amount * 1e9),
          },
        ];
      } else {
        messages = [
          {
            address: SNAKE_CONTRACT_ADDRESS,
            amount: '2000000',
            payload: `USDT:${stake.amount}`,
          },
        ];
      }
      const tx = {
        validUntil: Math.floor(Date.now() / 1000) + 60,
        messages,
      };
      try {
        await tonConnectUI.sendTransaction(tx);
      } catch {
        alert('Transaction failed');
        return;
      }
    }

    if (game === 'snake' && table?.id === 'single') {
      localStorage.removeItem(`snakeGameState_${aiCount}`);
      params.set('ai', aiCount);
      params.set('avatars', aiType);
      params.set('token', 'TPC');
      if (aiType === 'leaders' && leaderOverride.length) {
        const ids = leaderOverride
          .map((l) => LEADER_AVATARS.indexOf(l))
          .filter((i) => i >= 0);
        if (ids.length) params.set('leaders', ids.join(','));
      } else if (aiType === 'flags' && flagOverride.length) {
        params.set('flags', flagOverride.join(','));
      }
      if (stake.amount) params.set('amount', stake.amount);
      try {
        const accountId = await ensureAccountId();
        const balRes = await getAccountBalance(accountId);
        if ((balRes.balance || 0) < stake.amount) {
          alert('Insufficient balance');
          return;
        }
        const tgId = getTelegramId();
        await addTransaction(tgId, -stake.amount, 'stake', {
          game: 'snake-ai',
          players: aiCount + 1,
        });
      } catch {}
    } else {
      if (stake.token) params.set('token', stake.token);
      if (stake.amount) params.set('amount', stake.amount);
    }

    navigate(`/games/${game}?${params.toString()}`);
  };

  const waitingForPlayers =
    game === 'snake' &&
    table &&
    table.id !== 'single' &&
    players.length < table.capacity;
  const disabled =
    !canStartGame(game, table, stake, aiCount, players.length) ||
    (game === 'snake' && table?.id === 'single' && !aiType) ||
    (game === 'snake' && table?.id === 'single' && aiType === 'leaders' && leaders.length !== aiCount) ||
    (game === 'snake' && table?.id === 'single' && aiType === 'flags' && flags.length !== aiCount);

  return (
    <div className="relative p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold text-center capitalize">{game} Lobby</h2>
      <p className="text-center text-sm">Online users: {online}</p>
      {game === 'snake' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Select Table</h3>
            {table && (
              <span className="flex items-center">
                <FaUsers
                  className={`ml-2 ${players.length > 0 ? 'text-green-500' : 'text-red-500'}`}
                />
                <span className="ml-1">{players.length}</span>
              </span>
            )}
          </div>
          <TableSelector tables={tables} selected={table} onSelect={setTable} />
        </div>
      )}
      {game === 'snake' && table && (
        <div className="space-y-1">
          <h3 className="font-semibold">
            Online Players ({players.length}/{table.capacity})
          </h3>
          <ul className="text-sm list-disc list-inside">
            {players.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="space-y-2">
        <h3 className="font-semibold">Select Stake</h3>
        <RoomSelector
          selected={stake}
          onSelect={setStake}
          tokens={table?.id === 'single' ? ['TPC'] : ['TPC', 'TON', 'USDT']}
        />
        <p className="text-center text-subtext text-sm">
          Staking is handled via the on-chain contract.
        </p>
      </div>
      {game === 'snake' && table?.id === 'single' && (
        <div className="space-y-2">
          <h3 className="font-semibold">How many AI opponents?</h3>
          <div className="flex gap-2">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => setAiCount(n)}
                className={`lobby-tile ${
                  aiCount === n ? 'lobby-selected' : ''
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <h3 className="font-semibold mt-2">AI Avatars</h3>
          <div className="flex gap-2">
            {['flags', 'leaders'].map((t) => (
              <button
                key={t}
                onClick={() => selectAiType(t)}
                className={`lobby-tile ${aiType === t ? 'lobby-selected' : ''}`}
              >
                {t === 'flags' ? 'Flags' : 'Leaders'}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={startGame}
        disabled={disabled}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded disabled:opacity-50"
      >
        {waitingForPlayers
          ? `Waiting for ${table.capacity - players.length} more player${
              table.capacity - players.length === 1 ? '' : 's'
            }...`
          : 'Start Game'}
      </button>
      <LeaderPickerModal
        open={showLeaderPicker}
        count={aiCount}
        selected={leaders}
        onSave={setLeaders}
        onClose={() => setShowLeaderPicker(false)}
        onComplete={(sel) => startGame(flags, sel)}
      />
      <FlagPickerModal
        open={showFlagPicker}
        count={aiCount}
        selected={flags}
        onSave={setFlags}
        onClose={() => setShowFlagPicker(false)}
        onComplete={(sel) => startGame(sel, leaders)}
      />
    </div>
  );
}
