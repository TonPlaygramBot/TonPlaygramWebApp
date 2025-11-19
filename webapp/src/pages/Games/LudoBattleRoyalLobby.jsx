import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TableSelector from '../../components/TableSelector.jsx';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  ensureAccountId,
  getTelegramId,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';

const DEV_ACCOUNT = import.meta.env.VITE_DEV_ACCOUNT_ID;
const DEV_ACCOUNT_1 = import.meta.env.VITE_DEV_ACCOUNT_ID_1;
const DEV_ACCOUNT_2 = import.meta.env.VITE_DEV_ACCOUNT_ID_2;

const TABLES = [
  { id: 'practice', label: 'Practice (Solo)', capacity: 1 },
  { id: 'duo', label: 'Duo Battle', capacity: 2 },
  { id: 'royale', label: 'Battle Royale (4 Players)', capacity: 4 }
];

export default function LudoBattleRoyalLobby() {
  useTelegramBackButton();
  const navigate = useNavigate();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [table, setTable] = useState(TABLES[0]);
  const [avatar, setAvatar] = useState('');

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
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
        game: 'ludobattle',
        players: table.capacity,
        accountId
      });
    } catch {}

    const params = new URLSearchParams();
    const initData = window.Telegram?.WebApp?.initData;
    if (table?.id) params.set('table', table.id);
    if (stake.token) params.set('token', stake.token);
    if (stake.amount) params.set('amount', stake.amount);
    if (avatar) params.set('avatar', avatar);
    if (tgId) params.set('tgId', tgId);
    if (accountId) params.set('accountId', accountId);
    if (DEV_ACCOUNT) params.set('dev', DEV_ACCOUNT);
    if (DEV_ACCOUNT_1) params.set('dev1', DEV_ACCOUNT_1);
    if (DEV_ACCOUNT_2) params.set('dev2', DEV_ACCOUNT_2);
    if (initData) params.set('init', encodeURIComponent(initData));

    navigate(`/games/ludobattleroyal?${params.toString()}`);
  };

  return (
    <div className="relative p-4 space-y-4 text-text min-h-screen tetris-grid-bg">
      <h2 className="text-xl font-bold text-center">Ludo Battle Royal Lobby</h2>
      <div className="space-y-3">
        <div>
          <h3 className="font-semibold">Choose Table</h3>
          <TableSelector tables={TABLES} selected={table} onSelect={setTable} />
        </div>
        <div>
          <h3 className="font-semibold">Stake</h3>
          <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
        </div>
      </div>
      <button
        onClick={startGame}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded"
      >
        START
      </button>
    </div>
  );
}
