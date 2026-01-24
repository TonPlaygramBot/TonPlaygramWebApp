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
const FRAME_RATE_STORAGE_KEY = 'dominoRoyalFrameRate';
const DEFAULT_FRAME_RATE_ID = 'balanced60';

const CHESS_PLAYER_FLAG_KEY = 'chessBattleRoyalPlayerFlag';
const CHESS_AI_FLAG_KEY = 'chessBattleRoyalAiFlag';

const PLAYER_OPTIONS = [2, 3, 4];

export default function DominoRoyalLobby() {
  const navigate = useNavigate();
  useTelegramBackButton();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [mode, setMode] = useState('local');
  const [avatar, setAvatar] = useState('');
  const [playerCount, setPlayerCount] = useState(4);
  const [frameRateId, setFrameRateId] = useState(DEFAULT_FRAME_RATE_ID);
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [flags, setFlags] = useState([]);
  const [chessPlayerFlag, setChessPlayerFlag] = useState(null);
  const [chessAiFlag, setChessAiFlag] = useState(null);
  const startBet = stake.amount / 100;

  const maxPlayers = PLAYER_OPTIONS[PLAYER_OPTIONS.length - 1];
  const totalPlayers = Math.max(2, Math.min(maxPlayers, playerCount));
  const flagPickerCount = mode === 'local' ? totalPlayers : 1;

  const openAiFlagPicker = () => {
    setShowFlagPicker(true);
  };

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

  useEffect(() => {
    import('./DominoRoyal.jsx').catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const storedFrameRate = window.localStorage?.getItem(FRAME_RATE_STORAGE_KEY);
      if (storedFrameRate) {
        setFrameRateId(storedFrameRate);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const storedPlayer = window.localStorage?.getItem(CHESS_PLAYER_FLAG_KEY);
      const storedAi = window.localStorage?.getItem(CHESS_AI_FLAG_KEY);
      const playerIdx = FLAG_EMOJIS.indexOf(storedPlayer);
      const aiIdx = FLAG_EMOJIS.indexOf(storedAi);
      if (playerIdx >= 0) setChessPlayerFlag(playerIdx);
      if (aiIdx >= 0) setChessAiFlag(aiIdx);
    } catch {}
  }, []);

  useEffect(() => {
    if (mode !== 'local') return;
    if (flags.length === flagPickerCount) return;
    const defaultFlagIndex = Math.max(0, FLAG_EMOJIS.indexOf('🌐'));
    const playerIdx = chessPlayerFlag ?? defaultFlagIndex;
    const aiIdx = chessAiFlag ?? playerIdx;
    const seededFlags = Array.from({ length: flagPickerCount }, (_, seat) =>
      seat === 0 ? playerIdx : aiIdx
    );
    setFlags(seededFlags);
  }, [mode, flagPickerCount, flags.length, chessPlayerFlag, chessAiFlag]);

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
        game: 'domino',
        accountId,
      });
    } catch {}

    const params = new URLSearchParams();
    params.set('mode', mode);
    params.set('players', String(totalPlayers));
    if (stake.token) params.set('token', stake.token);
    if (stake.amount) params.set('amount', stake.amount);
    if (avatar) params.set('avatar', avatar);
    params.set('uhd', '1');
    const username = getTelegramUsername();
    if (username) params.set('username', username);
    const aiFlagSelection = flagOverride && flagOverride.length ? flagOverride : flags;
    if (mode === 'local') {
      params.set('avatars', 'flags');
      if (aiFlagSelection.length) params.set('flags', aiFlagSelection.join(','));
    }
    params.set('entry', 'hallway');
    if (tgId) params.set('tgId', tgId);
    if (accountId) params.set('accountId', accountId);
    const initData = window.Telegram?.WebApp?.initData;
    if (initData) params.set('init', encodeURIComponent(initData));
    if (DEV_ACCOUNT) params.set('dev', DEV_ACCOUNT);
    if (DEV_ACCOUNT_1) params.set('dev1', DEV_ACCOUNT_1);
    if (DEV_ACCOUNT_2) params.set('dev2', DEV_ACCOUNT_2);
    if (frameRateId) params.set('frameRateId', frameRateId);
    navigate(`/games/domino-royal?${params.toString()}`);
  };

  return (
    <div className="relative min-h-screen bg-[#070b16] text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-60" />
      <div className="relative z-10 space-y-4 p-4 pb-8">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#111827]/90 via-[#0f172a]/80 to-[#0b1324]/90 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-sky-200/70">Domino Battle Royal</p>
              <h2 className="text-2xl font-bold text-white">Modern Lobby</h2>
            </div>
            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/80">
              Double-six set
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1.2fr_1fr]">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1f2937]/90 to-[#0f172a]/90 p-4">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-400/40 via-sky-400/20 to-indigo-500/40 p-[1px]">
                  <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-2xl">
                    🀄
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Arena Warmup</p>
                  <p className="text-xs text-white/60">
                    Set your domino table while the match scene loads in the background.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Instant lobby</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Mobile first</span>
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
                  <p className="font-semibold">Seat ready</p>
                  <p className="text-xs text-white/50">Flags: {flags.length ? 'Custom' : 'Auto'}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-white/60">
                Your lobby choices persist into the domino match start.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-yellow-400/40 to-orange-500/40 p-[1px]">
              <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-xl">
                💰
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-white">Stake</h3>
              <p className="text-xs text-white/60">Lock your entry with TPC.</p>
            </div>
          </div>
          <div className="mt-3">
            <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
          </div>
          <p className="text-center text-white/60 text-xs">
            Start bet: {startBet.toLocaleString('en-US')} TPC • Pot max: {stake.amount.toLocaleString('en-US')} TPC
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Players</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Seats</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {PLAYER_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPlayerCount(value)}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left shadow transition ${
                  playerCount === value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-white/10 bg-black/30 text-white/80 hover:border-white/30'
                }`}
              >
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-slate-400/30 via-slate-500/10 to-transparent p-[1px]">
                  <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-xl">
                    <OptionIcon
                      src={getLobbyIcon('domino-royal', `players-${value}`)}
                      alt={`${value} players`}
                      fallback={`${value}`}
                      className="h-7 w-7"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{value} Players</span>
                    {playerCount === value && <span className="text-[10px] font-bold uppercase">Selected</span>}
                  </div>
                  <div className="text-xs text-white/60">Local table seats</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Mode</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Queue</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                id: 'local',
                label: 'Local (AI)',
                desc: 'Instant practice',
                accent: 'from-emerald-400/30 via-emerald-500/10 to-transparent',
                icon: '🤖',
                disabled: false
              },
              {
                id: 'online',
                label: 'Online',
                desc: 'Coming soon',
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
                  className={`group flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left shadow transition ${
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-white/10 bg-black/30 text-white/80 hover:border-white/30'
                  } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                  disabled={disabled}
                >
                  <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${accent} p-[1px]`}>
                    <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-2xl">
                      <OptionIcon
                        src={getLobbyIcon('domino-royal', `mode-${id}`)}
                        alt={label}
                        fallback={icon}
                        className="h-8 w-8"
                      />
                    </div>
                  </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-semibold">{label}</span>
                        {active && <span className="text-[10px] font-bold uppercase">Selected</span>}
                      </div>
                      <div className="text-xs text-white/60">{desc}</div>
                    </div>
                  </button>
                  {disabled && (
                    <span className="absolute inset-0 flex items-center justify-center text-xs text-white/80">
                      Under development
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-white/60 text-center">
            Local mode keeps the match offline while the arena loads instantly.
          </p>
        </div>

        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-400/40 to-indigo-500/40 p-[1px]">
              <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-xl">
                🧑‍🤝‍🧑
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-white">AI Avatar Flags</h3>
              <p className="text-xs text-white/60">
                Pick worldwide flags for AI opponents and your seat to keep the domino lobby consistent.
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

        <button
          onClick={startGame}
          disabled={mode === 'local' && flags.length !== flagPickerCount}
          className="w-full rounded-2xl bg-primary px-4 py-3 text-base font-semibold text-background shadow-[0_16px_30px_rgba(14,165,233,0.35)] transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
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
