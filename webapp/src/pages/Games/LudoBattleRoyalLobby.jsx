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
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';

const DEV_ACCOUNT = import.meta.env.VITE_DEV_ACCOUNT_ID;
const DEV_ACCOUNT_1 = import.meta.env.VITE_DEV_ACCOUNT_ID_1;
const DEV_ACCOUNT_2 = import.meta.env.VITE_DEV_ACCOUNT_ID_2;

const TABLES = [
  {
    id: 'players-2',
    label: '2 Players',
    capacity: 2,
    icon: getLobbyIcon('domino-royal', 'players-2'),
    iconFallback: '👥',
    subtitle: null
  },
  {
    id: 'players-3',
    label: '3 Players',
    capacity: 3,
    icon: getLobbyIcon('domino-royal', 'players-3'),
    iconFallback: '👥',
    subtitle: null
  },
  {
    id: 'players-4',
    label: '4 Players',
    capacity: 4,
    icon: getLobbyIcon('domino-royal', 'players-4'),
    iconFallback: '👑',
    subtitle: null
  }
];

export default function LudoBattleRoyalLobby() {
  useTelegramBackButton();
  const navigate = useNavigate();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [table, setTable] = useState(TABLES[0]);
  const [mode, setMode] = useState('local');
  const [avatar, setAvatar] = useState('');
  const [playerFlagIndex, setPlayerFlagIndex] = useState(null);
  const [flags, setFlags] = useState([]);
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [showAiFlagPicker, setShowAiFlagPicker] = useState(false);
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

  const selectedFlag = playerFlagIndex != null ? FLAG_EMOJIS[playerFlagIndex] : '';
  const opponentCount = Math.max((table?.capacity || 2) - 1, 1);
  const flagPickerCount = mode === 'local' ? opponentCount : 1;

  const openAiFlagPicker = () => {
    if (mode !== 'local') return;
    setShowAiFlagPicker(true);
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

  useEffect(() => {
    if (mode !== 'local') return;
    setFlags((prev) => {
      if (prev.length === flagPickerCount) return prev;
      return buildAutoFlags(flagPickerCount, prev);
    });
  }, [flagPickerCount, mode]);

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
    params.set('mode', mode);

    if (mode === 'local') {
      params.set('avatars', 'flags');
      const aiFlagSelection = flagOverride && flagOverride.length ? flagOverride : flags;
      if (aiFlagSelection.length) params.set('flags', aiFlagSelection.join(','));
    }

    if (DEV_ACCOUNT) params.set('dev', DEV_ACCOUNT);
    if (DEV_ACCOUNT_1) params.set('dev1', DEV_ACCOUNT_1);
    if (DEV_ACCOUNT_2) params.set('dev2', DEV_ACCOUNT_2);
    if (initData) params.set('init', encodeURIComponent(initData));

    navigate(`/games/ludobattleroyal?${params.toString()}`);
  };

  const disabled = !stake || !stake.token || !stake.amount;

  return (
    <div className="relative min-h-screen bg-[#070b16] text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-60" />
      <div className="relative z-10 space-y-4 p-4 pb-8">
        <GameLobbyHeader
          slug="ludobattleroyal"
          title="Ludo Battle Royal Lobby"
          badge={online != null ? `${online} online` : 'Syncing…'}
        />

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#101828]/80 to-[#0b1324]/90 p-4">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Identity</p>
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
                Player flag: {selectedFlag || 'Auto'} • AI flags:{' '}
                {flags.length ? flags.map((f) => FLAG_EMOJIS[f] || '').join(' ') : 'Auto'}
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={() => setShowFlagPicker(true)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80 transition hover:border-white/30"
            >
              <div className="text-[11px] uppercase tracking-wide text-white/50">Flag</div>
              <div className="flex items-center gap-2 text-base font-semibold">
                <span className="text-lg">{selectedFlag || '🌐'}</span>
                <span>{selectedFlag ? 'Custom flag' : 'Auto-detect & save'}</span>
              </div>
            </button>
            <button
              type="button"
              onClick={openAiFlagPicker}
              disabled={mode !== 'local'}
              className={`w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80 transition hover:border-white/30 ${
                mode !== 'local' ? 'opacity-60' : ''
              }`}
            >
              <div className="text-[11px] uppercase tracking-wide text-white/50">AI Flags</div>
              <div className="flex items-center gap-2 text-base font-semibold">
                <span className="text-lg">
                  {flags.length ? flags.map((f) => FLAG_EMOJIS[f] || '').join(' ') : '🌐'}
                </span>
                <span>{flags.length ? 'Custom AI flags' : 'Auto-pick opponents'}</span>
              </div>
            </button>
          </div>
          <p className="mt-3 text-xs text-white/60">Your lobby settings carry over as soon as the match loads.</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Match Mode</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Queue</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                id: 'local',
                label: 'Local vs AI',
                desc: `Vs ${opponentCount} player${opponentCount === 1 ? '' : 's'}`,
                iconKey: 'mode-ai',
                icon: '🤖'
              },
              {
                id: 'online',
                label: 'Online',
                desc: 'Live matchmaking',
                iconKey: 'mode-online',
                icon: '🌐'
              }
            ].map(({ id, label, desc, iconKey, icon }) => {
              const active = mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={`lobby-option-card ${
                    active ? 'lobby-option-card-active' : 'lobby-option-card-inactive'
                  }`}
                >
                  <div className="lobby-option-thumb bg-gradient-to-br from-emerald-400/30 via-sky-500/10 to-transparent">
                    <div className="lobby-option-thumb-inner">
                      <OptionIcon
                        src={getLobbyIcon('poolroyale', iconKey)}
                        alt={label}
                        fallback={icon}
                        className="lobby-option-icon"
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="lobby-option-label">{label}</p>
                    <p className="lobby-option-subtitle">{desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Vs how many players</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Players</span>
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

        <button
          onClick={startGame}
          disabled={disabled}
          className="w-full rounded-2xl bg-primary px-4 py-3 text-base font-semibold text-background shadow-[0_16px_30px_rgba(14,165,233,0.35)] transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          Start Game
        </button>

        <FlagPickerModal
          open={showFlagPicker}
          count={1}
          selected={playerFlagIndex != null ? [playerFlagIndex] : []}
          onSave={(selection) => setPlayerFlagIndex(selection?.[0] ?? null)}
          onClose={() => setShowFlagPicker(false)}
        />
        <FlagPickerModal
          open={showAiFlagPicker}
          count={flagPickerCount}
          selected={flags}
          onSave={setFlags}
          onClose={() => setShowAiFlagPicker(false)}
          onComplete={(sel) => startGame(sel)}
        />
      </div>
    </div>
  );
}
