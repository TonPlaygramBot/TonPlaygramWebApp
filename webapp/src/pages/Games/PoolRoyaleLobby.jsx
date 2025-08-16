import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TableSelector from '../../components/TableSelector.jsx';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { pingOnline, getOnlineCount, getAccountBalance, addTransaction } from '../../utils/api.js';
import { ensureAccountId, getTelegramId, getTelegramFirstName, getTelegramPhotoUrl } from '../../utils/telegram.js';
import { loadAvatar, avatarToName } from '../../utils/avatarUtils.js';
import { getAIOpponentFlag } from '../../utils/aiOpponentFlag.js';

export default function PoolRoyaleLobby() {
  const navigate = useNavigate();
  useTelegramBackButton();

  const TABLES = [
    { id: 'single', label: 'Single Player vs AI', capacity: 1 },
    { id: '1v1', label: '1v1 Online', capacity: 2 }
  ];

  const [table, setTable] = useState(TABLES[0]);
  const [variant, setVariant] = useState('8ball');
  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [online, setOnline] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let id;
    ensureAccountId()
      .then(accountId => {
        if (cancelled || !accountId) return;
        function ping() {
          const status = localStorage.getItem('onlineStatus') || 'online';
          pingOnline(accountId, status).catch(() => {});
          getOnlineCount().then(d => setOnline(d.count)).catch(() => {});
        }
        ping();
        id = setInterval(ping, 30000);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (id) clearInterval(id);
    };
  }, []);

  const startGame = async () => {
    let tgId;
    let accountId;
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

    const params = new URLSearchParams();
    params.set('variant', variant);
    if (stake.token) params.set('token', stake.token);
    if (stake.amount) params.set('amount', stake.amount);
    const name = getTelegramFirstName() || 'Player';
    params.set('pname', name);
    const avatar = loadAvatar() || getTelegramPhotoUrl() || '';
    if (avatar) params.set('pavatar', avatar);
    if (table.id === 'single') {
      params.set('mode', 'ai');
      const flag = getAIOpponentFlag(avatar);
      params.set('aiflag', flag);
      params.set('ainame', avatarToName(flag));
    } else {
      params.set('mode', 'online');
    }
    if (tgId) params.set('tgId', tgId);
    if (accountId) params.set('accountId', accountId);
    navigate(`/games/poolroyale?${params.toString()}`);
  };

  const disabled = !stake.token || !stake.amount || !table || !variant;

  return (
    <div className="relative p-4 space-y-4 text-text min-h-screen tetris-grid-bg">
      <h2 className="text-xl font-bold text-center">8 Pool Royale Lobby</h2>
      <p className="text-center text-sm">Online users: {online}</p>
      <div className="space-y-2">
        <h3 className="font-semibold">Select Mode</h3>
        <TableSelector tables={TABLES} selected={table} onSelect={setTable} />
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Game Variant</h3>
        <div className="flex gap-2">
          {[{id:'8ball',label:'8 Ball'},{id:'9ball',label:'9 Ball'}].map(v => (
            <button key={v.id} onClick={()=>setVariant(v.id)} className={`lobby-tile ${variant===v.id ? 'lobby-selected' : ''}`}>
              {v.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Select Stake</h3>
        <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
      </div>
      <button onClick={startGame} disabled={disabled} className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded disabled:opacity-50">
        Start Game
      </button>
    </div>
  );
}
