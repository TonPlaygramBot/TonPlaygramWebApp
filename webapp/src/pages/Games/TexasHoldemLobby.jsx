import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { ensureAccountId, getTelegramId, getTelegramPhotoUrl, getTelegramUsername } from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import OptionIcon from '../../components/OptionIcon.jsx';
import { getLobbyIcon } from '../../config/gameAssets.js';

const DEV_ACCOUNT = import.meta.env.VITE_DEV_ACCOUNT_ID;
const DEV_ACCOUNT_1 = import.meta.env.VITE_DEV_ACCOUNT_ID_1;
const DEV_ACCOUNT_2 = import.meta.env.VITE_DEV_ACCOUNT_ID_2;

const generateRandomFlags = (count, existing = []) => {
  const safeExisting = existing.filter((idx) => FLAG_EMOJIS[idx] !== undefined);
  const chosen = new Set(safeExisting);
  while (chosen.size < count && chosen.size < FLAG_EMOJIS.length) {
    chosen.add(Math.floor(Math.random() * FLAG_EMOJIS.length));
  }
  return Array.from(chosen).slice(0, count);
};

export default function TexasHoldemLobby() {
  const navigate = useNavigate();
  useTelegramBackButton();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [mode, setMode] = useState('local');
  const [avatar, setAvatar] = useState('');
  const [opponents, setOpponents] = useState(5);
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [flags, setFlags] = useState([]);
  const startBet = stake.amount / 100;

  const totalPlayers = Math.min(Math.max(2, opponents + 1), 6);
  const flagPickerCount = mode === 'local' ? totalPlayers : 1;

  const openAiFlagPicker = () => {
    setShowFlagPicker(true);
  };

  useEffect(() => {
    import('./TexasHoldem.jsx').catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

  useEffect(() => {
    if (mode !== 'local') return;
    setFlags((prev) => {
      const trimmed = prev.filter((idx) => FLAG_EMOJIS[idx] !== undefined).slice(0, flagPickerCount);
      if (trimmed.length === flagPickerCount) return trimmed;
      const autoFlags = generateRandomFlags(flagPickerCount, trimmed);
      return autoFlags;
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
        game: 'texasholdem',
        accountId,
      });
    } catch {}

    const params = new URLSearchParams();
    params.set('mode', mode);
    if (stake.token) params.set('token', stake.token);
    if (stake.amount) params.set('amount', stake.amount);
    params.set('players', totalPlayers);
    if (avatar) params.set('avatar', avatar);
    const username = getTelegramUsername();
    if (username) params.set('username', username);
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
    navigate(`/games/texasholdem?${params.toString()}`);
  };

  return (
    <div className="relative min-h-screen bg-[#070b16] text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-60" />
      <div className="relative z-10 space-y-4 p-4 pb-8">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#111827]/90 via-[#0f172a]/80 to-[#0b1324]/90 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-emerald-200/70">
                Texas Hold&apos;em
              </p>
              <h2 className="text-2xl font-bold text-white">Texas Hold&apos;em Lobby</h2>
            </div>
            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/80">
              Poker table ready
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-gradient-to-br from-[#101828]/80 to-[#0b1324]/90 p-4">
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
                <p className="font-semibold">Ready to shuffle</p>
                <p className="text-xs text-white/50">
                  AI flags: {flags.length ? flags.map((f) => FLAG_EMOJIS[f] || '').join(' ') : 'Auto'}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-white/60">
              Your lobby settings carry over as soon as the poker arena finishes loading.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#111827]/90 to-[#0f172a]/80 p-4 shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-200/70">Stake</p>
              <h3 className="text-lg font-semibold text-white">Pick your buy-in</h3>
            </div>
            <div className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
              Start bet: {startBet.toLocaleString('en-US')} TPC
            </div>
          </div>
          <div className="mt-4">
            <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
          </div>
          <p className="mt-3 text-xs text-white/60">
            Pot max: {stake.amount.toLocaleString('en-US')} TPC
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#111827]/90 to-[#0f172a]/80 p-4 shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-400/40 to-indigo-500/40 p-[1px]">
              <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-lg">
                <OptionIcon src="/assets/icons/profile.svg" alt="Opponents" fallback="🧑" className="h-6 w-6" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Opponents</h3>
              <p className="text-xs text-white/60">Choose how many players you want to face.</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }, (_, idx) => idx + 1).map((count) => {
              const isSelected = opponents === count;
              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => setOpponents(count)}
                  className={`lobby-option-card ${
                    isSelected ? 'lobby-option-card-active' : 'lobby-option-card-inactive'
                  }`}
                >
                  <div className="lobby-option-thumb lobby-option-thumb-sm bg-gradient-to-br from-emerald-400/30 via-sky-500/10 to-transparent">
                    <div className="lobby-option-thumb-inner">
                      <OptionIcon
                        src="/assets/icons/profile.svg"
                        alt={`${count} opponents`}
                        fallback="🧑"
                        className="lobby-option-icon lobby-option-icon-sm"
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="lobby-option-label lobby-option-label-sm">VS {count}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#111827]/90 to-[#0f172a]/80 p-4 shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-yellow-400/40 to-orange-500/40 p-[1px]">
              <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-lg">
                <OptionIcon
                  src={getLobbyIcon('texasholdem', 'mode-local')}
                  alt="Match mode"
                  fallback="⚙️"
                  className="h-6 w-6"
                />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Mode</h3>
              <p className="text-xs text-white/60">Local AI is ready, online tables are coming soon.</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { id: 'local', label: 'Local (AI)', iconKey: 'mode-ai' },
              { id: 'online', label: 'Online', iconKey: 'mode-online', disabled: true }
            ].map(({ id, label, iconKey, disabled }) => (
              <div key={id} className="relative">
                <button
                  onClick={() => !disabled && setMode(id)}
                  className={`lobby-option-card ${
                    mode === id ? 'lobby-option-card-active' : 'lobby-option-card-inactive'
                  } ${disabled ? 'lobby-option-card-disabled' : ''}`}
                  disabled={disabled}
                >
                  <div className="lobby-option-thumb bg-gradient-to-br from-yellow-400/30 via-orange-500/10 to-transparent">
                    <div className="lobby-option-thumb-inner">
                      <OptionIcon
                        src={getLobbyIcon('poolroyale', iconKey)}
                        alt={label}
                        fallback={id === 'local' ? '🤖' : '🌐'}
                        className="lobby-option-icon"
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="lobby-option-label">{label}</p>
                    {disabled && <p className="lobby-option-subtitle">Under development</p>}
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#111827]/90 to-[#0f172a]/80 p-4 shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-400/40 to-indigo-500/40 p-[1px]">
              <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-lg">
                🏳️
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">AI Avatar Flags</h3>
              <p className="text-xs text-white/60">
                Auto-filled with random worldwide flags—tap to customize or reshuffle before you start.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openAiFlagPicker}
            className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm text-white/80 transition hover:border-primary/70"
          >
            <div className="text-[11px] uppercase tracking-wide text-white/50">AI Flags</div>
            <div className="mt-1 flex items-center gap-2 text-base font-semibold text-white">
              <span className="text-lg">{flags.length ? flags.map((f) => FLAG_EMOJIS[f] || '').join(' ') : '🌐'}</span>
              <span>{flags.length ? 'Custom AI avatars' : 'Auto-pick from global flags'}</span>
            </div>
          </button>
        </div>

        <button
          onClick={startGame}
          disabled={mode === 'local' && flags.length !== flagPickerCount}
          className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-background shadow-[0_18px_30px_rgba(59,130,246,0.35)] transition hover:bg-primary-hover disabled:opacity-50"
        >
          START
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
