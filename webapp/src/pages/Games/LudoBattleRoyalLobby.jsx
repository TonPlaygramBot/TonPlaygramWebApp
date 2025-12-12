import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import RoomSelector from '../../components/RoomSelector.jsx';
import TableSelector from '../../components/TableSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { seedFlags } from '../../utils/aiFlagDefaults.js';
import {
  addTransaction,
  getAccountBalance,
  getOnlineCount,
  pingOnline
} from '../../utils/api.js';
import { ensureAccountId, getTelegramId, getTelegramPhotoUrl } from '../../utils/telegram.js';

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
  const [aiCount, setAiCount] = useState(1);
  const [aiType, setAiType] = useState('flags');
  const [flags, setFlags] = useState([]);
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [online, setOnline] = useState(0);

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    let interval;
    ensureAccountId()
      .then((playerId) => {
        if (cancelled) return;
        const run = () => {
          const status = localStorage.getItem('onlineStatus') || 'online';
          pingOnline(playerId, status).catch(() => {});
          getOnlineCount()
            .then((d) => setOnline(d.count))
            .catch(() => {});
        };
        run();
        interval = setInterval(run, 30000);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const updatePhoto = () => {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    };
    window.addEventListener('profilePhotoUpdated', updatePhoto);
    return () => window.removeEventListener('profilePhotoUpdated', updatePhoto);
  }, []);

  useEffect(() => {
    if (table?.id !== 'practice') return;
    const count = flagPickerCount || 1;
    if (flags.length === count && aiType === 'flags') return;
    setFlags(seedFlags(count, { includePlayer: false }));
    setAiType('flags');
    setAiCount((prev) => prev || 1);
  }, [table?.id, flagPickerCount, flags.length, aiType]);

  const selectAiType = (type) => {
    setAiType(type);
    if (type === 'flags') setShowFlagPicker(true);
    if (type !== 'flags') setFlags([]);
  };

  const openAiFlagPicker = () => {
    if (!aiCount) setAiCount(1);
    selectAiType('flags');
    setShowFlagPicker(true);
  };

  const startGame = async (flagOverride = flags) => {
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
    if (table?.capacity) params.set('capacity', String(table.capacity));
    if (stake.token) params.set('token', stake.token);
    if (stake.amount) params.set('amount', stake.amount);
    if (avatar) params.set('avatar', avatar);
    if (tgId) params.set('tgId', tgId);
    if (accountId) params.set('accountId', accountId);

    if (table?.id === 'practice') {
      const aiFlagSelection = flagOverride && flagOverride.length ? flagOverride : flags;
      params.set('ai', aiCount || 1);
      params.set('avatars', aiType || 'flags');
      if (aiFlagSelection.length) params.set('flags', aiFlagSelection.join(','));
    }

    if (DEV_ACCOUNT) params.set('dev', DEV_ACCOUNT);
    if (DEV_ACCOUNT_1) params.set('dev1', DEV_ACCOUNT_1);
    if (DEV_ACCOUNT_2) params.set('dev2', DEV_ACCOUNT_2);
    if (initData) params.set('init', encodeURIComponent(initData));

    navigate(`/games/ludobattleroyal?${params.toString()}`);
  };

  const disabled =
    !stake ||
    !stake.token ||
    !stake.amount ||
    (table?.id === 'practice' &&
      (!aiType || (aiType === 'flags' && flags.length !== (aiCount || 1))));

  const flagPickerCount = table?.id === 'practice' ? aiCount || 1 : Math.max(aiCount || 1, 1);

  return (
    <div className="relative p-4 space-y-4 text-text min-h-screen tetris-grid-bg">
      <h2 className="text-xl font-bold text-center">Ludo Battle Royal Lobby</h2>
      <p className="text-center text-sm">Online users: {online}</p>
      <div className="space-y-2">
        <h3 className="font-semibold">Select Table</h3>
        <TableSelector tables={TABLES} selected={table} onSelect={setTable} />
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Select Stake</h3>
        <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
        <p className="text-center text-subtext text-sm">Staking is handled via the on-chain contract.</p>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">AI Avatar Flags</h3>
        <p className="text-sm text-subtext text-center">
          Match the Snake &amp; Ladder lobby by picking worldwide flags for AI opponents.
        </p>
        <button
          type="button"
          onClick={openAiFlagPicker}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background/60 hover:border-primary text-sm text-left"
        >
          <div className="text-[11px] uppercase tracking-wide text-subtext">AI Flags</div>
          <div className="flex items-center gap-2 text-base font-semibold">
            <span className="text-lg">
              {flags.length ? flags.map((f) => FLAG_EMOJIS[f] || '').join(' ') : '🌐'}
            </span>
            <span>{flags.length ? 'Custom AI avatars' : 'Auto-pick from global flags'}</span>
          </div>
        </button>
      </div>

      {table?.id === 'practice' && (
        <div className="space-y-2">
          <h3 className="font-semibold">How many AI opponents?</h3>
          <div className="flex gap-2">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => setAiCount(n)}
                className={`lobby-tile ${aiCount === n ? 'lobby-selected' : ''}`}
              >
                {n}
              </button>
            ))}
          </div>
          <h3 className="font-semibold mt-2">AI Avatars</h3>
          <div className="flex gap-2">
            {['flags'].map((t) => (
              <button
                key={t}
                onClick={() => selectAiType(t)}
                className={`lobby-tile ${aiType === t ? 'lobby-selected' : ''}`}
              >
                Flags
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
        Start Game
      </button>

      <FlagPickerModal
        open={showFlagPicker}
        count={flagPickerCount}
        selected={flags}
        onSave={setFlags}
        onClose={() => setShowFlagPicker(false)}
        onComplete={(sel) => startGame(sel)}
      />
    </div>
  );
}
