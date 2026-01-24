import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import RoomSelector from '../../components/RoomSelector.jsx';
import TableSelector from '../../components/TableSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import {
  addTransaction,
  getAccountBalance,
  getOnlineCount,
  pingOnline
} from '../../utils/api.js';
import { ensureAccountId, getTelegramId, getTelegramPhotoUrl } from '../../utils/telegram.js';
import OptionIcon from '../../components/OptionIcon.jsx';
import { getLobbyIcon } from '../../config/gameAssets.js';

const DEV_ACCOUNT = import.meta.env.VITE_DEV_ACCOUNT_ID;
const DEV_ACCOUNT_1 = import.meta.env.VITE_DEV_ACCOUNT_ID_1;
const DEV_ACCOUNT_2 = import.meta.env.VITE_DEV_ACCOUNT_ID_2;

const TABLES = [
  {
    id: 'practice',
    label: 'Practice (Solo)',
    capacity: 1,
    icon: getLobbyIcon('ludobattleroyal', 'table-1'),
    iconFallback: '🎯'
  },
  {
    id: 'duo',
    label: 'Duo Battle',
    capacity: 2,
    icon: getLobbyIcon('ludobattleroyal', 'table-2'),
    iconFallback: '👥'
  },
  {
    id: 'royale',
    label: 'Battle Royale (4 Players)',
    capacity: 4,
    icon: getLobbyIcon('ludobattleroyal', 'table-4'),
    iconFallback: '👑'
  }
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
  const [online, setOnline] = useState(null);

  useEffect(() => {
    import('./LudoBattleRoyal.jsx').catch(() => {});
  }, []);

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

  const buildAutoFlags = (count, selection = []) => {
    const desired = Math.max(1, count || 1);
    const pool = FLAG_EMOJIS.map((_, idx) => idx);
    const chosen = selection.filter((value) => Number.isFinite(value));
    const remaining = pool.filter((idx) => !chosen.includes(idx));
    while (chosen.length < desired) {
      if (!remaining.length) {
        chosen.push(Math.floor(Math.random() * FLAG_EMOJIS.length));
        continue;
      }
      const pickIndex = Math.floor(Math.random() * remaining.length);
      chosen.push(remaining.splice(pickIndex, 1)[0]);
    }
    return chosen.slice(0, desired);
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
      const aiSlotCount = aiCount || 1;
      const aiFlagSelection = flagOverride && flagOverride.length ? flagOverride : flags;
      const resolvedFlags = buildAutoFlags(aiSlotCount, aiFlagSelection);
      params.set('ai', aiSlotCount);
      params.set('avatars', aiType || 'flags');
      params.set('flags', resolvedFlags.join(','));
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
    (table?.id === 'practice' && !aiType);

  const flagPickerCount = table?.id === 'practice' ? aiCount || 1 : Math.max(aiCount || 1, 1);

  return (
    <div className="relative min-h-screen bg-[#070b16] text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-60" />
      <div className="relative z-10 space-y-4 p-4 pb-8">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#111827]/90 via-[#0f172a]/80 to-[#0b1324]/90 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-emerald-200/70">
                Ludo Battle Royal
              </p>
              <h2 className="text-2xl font-bold text-white">Modern Lobby</h2>
            </div>
            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/80">
              {online != null ? `${online} online` : 'Syncing…'}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1.2fr_1fr]">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1f2937]/90 to-[#0f172a]/90 p-4">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-400/40 via-sky-400/20 to-indigo-500/40 p-[1px]">
                  <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-2xl">
                    🎲
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Battle Queue</p>
                  <p className="text-xs text-white/60">
                    Configure your match while the arena loads in the background.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Instant lobby</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Touch ready</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">HDR arena</span>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#101828]/80 to-[#0b1324]/90 p-4">
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Player Profile</p>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-full border border-white/15 bg-white/5">
                  {avatar ? (
                    <img src={avatar} alt="Your avatar" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg">🙂</div>
                  )}
                </div>
                <div className="text-sm text-white/80">
                  <p className="font-semibold">Ready for battle</p>
                  <p className="text-xs text-white/50">
                    AI flags: {flags.length ? flags.map((f) => FLAG_EMOJIS[f] || '').join(' ') : 'Auto'}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-white/60">
                Your lobby settings carry over as soon as the match loads.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Select Table</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Tables</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
            <TableSelector tables={TABLES} selected={table} onSelect={setTable} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Select Stake</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">TPC</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
            <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
            <p className="text-center text-white/60 text-xs mt-3">
              Staking is handled via the on-chain contract.
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-400/40 to-indigo-500/40 p-[1px]">
              <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-xl">
                🧠
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-white">AI Avatar Flags</h3>
              <p className="text-xs text-white/60">
                Match the Snake &amp; Ladder lobby by picking worldwide flags for AI opponents.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openAiFlagPicker}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left text-sm text-white/80 transition hover:border-white/30"
          >
            <div className="text-[10px] uppercase tracking-[0.35em] text-white/60">AI Flags</div>
            <div className="mt-2 flex items-center gap-2 text-base font-semibold">
              <span className="text-lg">
                {flags.length ? flags.map((f) => FLAG_EMOJIS[f] || '').join(' ') : '🌐'}
              </span>
              <span>{flags.length ? 'Custom AI avatars' : 'Auto-pick from global flags'}</span>
            </div>
          </button>
        </div>

        {table?.id === 'practice' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Practice Settings</h3>
              <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Solo</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow space-y-3">
              <div>
                <h4 className="font-semibold text-white text-sm">How many AI opponents?</h4>
                <div className="mt-2 flex gap-2">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      onClick={() => setAiCount(n)}
                      className={`lobby-tile ${aiCount === n ? 'lobby-selected' : ''}`}
                    >
                      <span className="flex items-center gap-2">
                        <OptionIcon
                          src={getLobbyIcon('ludobattleroyal', `ai-${n}`)}
                          alt={`${n} AI`}
                          fallback="🤖"
                          className="h-5 w-5"
                        />
                        {n}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">AI Avatars</h4>
                <div className="mt-2 flex gap-2">
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
            </div>
          </div>
        )}

        <button
          onClick={startGame}
          disabled={disabled}
          className="w-full rounded-2xl bg-primary px-4 py-3 text-base font-semibold text-background shadow-[0_16px_30px_rgba(14,165,233,0.35)] transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
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
    </div>
  );
}
