import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { ensureAccountId, getTelegramId, getTelegramPhotoUrl } from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import OptionIcon from '../../components/OptionIcon.jsx';
import { getLobbyIcon } from '../../config/gameAssets.js';

const DEV_ACCOUNT = import.meta.env.VITE_DEV_ACCOUNT_ID;
const DEV_ACCOUNT_1 = import.meta.env.VITE_DEV_ACCOUNT_ID_1;
const DEV_ACCOUNT_2 = import.meta.env.VITE_DEV_ACCOUNT_ID_2;

function pickRandomFlags(count) {
  if (!count) return [];
  const available = FLAG_EMOJIS.map((_, idx) => idx);
  for (let i = available.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, count);
}

export default function MurlanRoyaleLobby() {
  const navigate = useNavigate();
  useTelegramBackButton();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [mode, setMode] = useState('local');
  const [avatar, setAvatar] = useState('');
  const [gameType, setGameType] = useState('single');
  const [targetPoints, setTargetPoints] = useState(11);
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [flags, setFlags] = useState(() => pickRandomFlags(4));

  const flagPickerCount = mode === 'local' ? 4 : 1;

  const openAiFlagPicker = () => {
    setShowFlagPicker(true);
  };

  useEffect(() => {
    import('./MurlanRoyale.jsx').catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

  useEffect(() => {
    setFlags((prev) => {
      if (prev.length === flagPickerCount) return prev;
      return pickRandomFlags(flagPickerCount);
    });
  }, [flagPickerCount]);

  const startGame = async (flagOverride = flags) => {
    let tgId;
    let accountId;
    try {
      accountId = await ensureAccountId();
      if (mode !== 'local' && stake.amount > 0) {
        const balRes = await getAccountBalance(accountId);
        if ((balRes.balance || 0) < stake.amount) {
          alert('Insufficient balance');
          return;
        }
        tgId = getTelegramId();
        await addTransaction(tgId, -stake.amount, 'stake', {
          game: 'murlanroyale',
          accountId,
        });
      } else {
        tgId = getTelegramId();
      }
    } catch {}

    const params = new URLSearchParams();
    params.set('mode', mode);
    params.set('game', gameType);
    if (gameType === 'points') params.set('points', targetPoints);
    if (mode !== 'local' && stake.token) params.set('token', stake.token);
    if (mode !== 'local' && stake.amount) params.set('amount', stake.amount);
    if (avatar) params.set('avatar', avatar);
    const aiFlagSelection = flagOverride && flagOverride.length ? flagOverride : flags;
    if (mode === 'local') {
      params.set('avatars', 'flags');
      if (aiFlagSelection.length) params.set('flags', aiFlagSelection.join(','));
    }
    if (tgId) params.set('tgId', tgId);
    if (accountId) params.set('accountId', accountId);
    const initData = window.Telegram?.WebApp?.initData;
    if (initData) params.set('init', encodeURIComponent(initData));
    if (DEV_ACCOUNT) params.set('dev', DEV_ACCOUNT);
    if (DEV_ACCOUNT_1) params.set('dev1', DEV_ACCOUNT_1);
    if (DEV_ACCOUNT_2) params.set('dev2', DEV_ACCOUNT_2);
    navigate(`/games/murlanroyale?${params.toString()}`);
  };

  return (
    <div className="relative min-h-screen bg-[#070b16] text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-60" />
      <div className="relative z-10 space-y-4 p-4 pb-8">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#111827]/90 via-[#0f172a]/80 to-[#0b1324]/90 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-sky-200/70">Murlan Royale</p>
              <h2 className="text-2xl font-bold text-white">Murlan Royale Lobby</h2>
            </div>
            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/80">
              AI ready
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1.2fr_1fr]">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1f2937]/90 to-[#0f172a]/90 p-4">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-400/40 via-sky-400/20 to-indigo-500/40 p-[1px]">
                  <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-2xl">
                    🂠
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Royal Table</p>
                  <p className="text-xs text-white/60">
                    Keep the arena loading while you choose your Murlan settings.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Instant start</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Flag avatars</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">3D arena</span>
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
                  <p className="font-semibold">Seat ready</p>
                  <p className="text-xs text-white/50">
                    Flags: {flags.length ? flags.map((f) => FLAG_EMOJIS[f] || '').join(' ') : 'Auto'}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-white/60">
                Your choices load into the Murlan Royale match instantly.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Choose Mode</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Queue</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                id: 'local',
                label: 'Local (AI)',
                desc: 'Instant practice',
                accent: 'from-emerald-400/30 via-emerald-500/10 to-transparent',
                icon: '🤖'
              },
              {
                id: 'online',
                label: 'Online',
                desc: 'Stake & match',
                accent: 'from-indigo-400/30 via-sky-500/10 to-transparent',
                icon: '⚔️',
                disabled: true
              }
            ].map(({ id, label, desc, accent, icon, disabled }) => {
              const active = mode === id;
              return (
                <div key={id} className="relative">
                  <button
                    type="button"
                    onClick={() => !disabled && setMode(id)}
                    className={`lobby-option-card ${
                      active ? 'lobby-option-card-active' : 'lobby-option-card-inactive'
                    } ${disabled ? 'lobby-option-card-disabled' : ''}`}
                    disabled={disabled}
                  >
                    <div className={`lobby-option-thumb bg-gradient-to-br ${accent}`}>
                      <div className="lobby-option-thumb-inner">
                        <OptionIcon
                          src={getLobbyIcon('murlanroyale', `mode-${id}`)}
                          alt={label}
                          fallback={icon}
                          className="lobby-option-icon"
                        />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="lobby-option-label">{label}</p>
                      <p className="lobby-option-subtitle">{disabled ? 'Under development' : desc}</p>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-white/60 text-center">
            AI matches stay offline while the arena preloads. Online mode launches when staking is ready.
          </p>
        </div>

        {mode === 'local' ? (
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-400/40 to-sky-500/40 p-[1px]">
                <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-xl">
                  🎯
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-white">Stake</h3>
                <p className="text-xs text-white/60">Playing against AI is free — no stake required.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-yellow-400/40 to-orange-500/40 p-[1px]">
                <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-xl">
                  💰
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-white">Select Stake</h3>
                <p className="text-xs text-white/60">Stake your TPC to lock a table.</p>
              </div>
            </div>
            <div className="mt-3">
              <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Game Type</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Rules</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                id: 'single',
                label: 'Single Game',
                desc: 'Standard match',
                accent: 'from-purple-400/30 via-indigo-500/10 to-transparent',
                icon: '🎴'
              },
              {
                id: 'points',
                label: 'Points',
                desc: 'Race to target',
                accent: 'from-pink-400/30 via-fuchsia-500/10 to-transparent',
                icon: '🏁'
              }
            ].map(({ id, label, desc, accent, icon }) => {
              const active = gameType === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setGameType(id)}
                  className={`lobby-option-card ${
                    active ? 'lobby-option-card-active' : 'lobby-option-card-inactive'
                  }`}
                >
                  <div className={`lobby-option-thumb bg-gradient-to-br ${accent}`}>
                    <div className="lobby-option-thumb-inner">
                      <OptionIcon
                        src={getLobbyIcon('murlanroyale', `type-${id}`)}
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
          {gameType === 'points' && (
            <div className="grid grid-cols-3 gap-3">
              {[11, 21, 31].map((pts) => (
                <button
                  key={pts}
                  onClick={() => setTargetPoints(pts)}
                  className={`lobby-option-card ${
                    targetPoints === pts ? 'lobby-option-card-active' : 'lobby-option-card-inactive'
                  }`}
                >
                  <div className="lobby-option-thumb bg-gradient-to-br from-pink-400/30 via-fuchsia-500/10 to-transparent">
                    <div className="lobby-option-thumb-inner">
                      <OptionIcon
                        src={getLobbyIcon('murlanroyale', `points-${pts}`)}
                        alt={`${pts} points`}
                        fallback="🏁"
                        className="lobby-option-icon"
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="lobby-option-label">{pts} pts</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">AI Avatar Flags</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Identity</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
            <p className="text-xs text-white/60">
              Match the Snake &amp; Ladder lobby by picking worldwide flags for AI opponents and your seat.
            </p>
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
        </div>

        <button
          onClick={startGame}
          disabled={mode === 'local' && flags.length !== flagPickerCount}
          className="w-full rounded-2xl bg-primary px-4 py-3 text-base font-semibold text-background shadow-[0_16px_30px_rgba(14,165,233,0.35)] transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          Start Murlan Match
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
