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
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';

const DEV_ACCOUNT = import.meta.env.VITE_DEV_ACCOUNT_ID;
const DEV_ACCOUNT_1 = import.meta.env.VITE_DEV_ACCOUNT_ID_1;
const DEV_ACCOUNT_2 = import.meta.env.VITE_DEV_ACCOUNT_ID_2;
const FRAME_RATE_STORAGE_KEY = 'dominoRoyalFrameRate';
const DEFAULT_FRAME_RATE_ID = 'balanced60';

const CHESS_PLAYER_FLAG_KEY = 'chessBattleRoyalPlayerFlag';
const CHESS_AI_FLAG_KEY = 'chessBattleRoyalAiFlag';

const PLAYER_OPTIONS = [2, 3, 4];
const HUMAN_ICON_FALLBACK = '🧑‍🤝‍🧑';

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
      tgId = getTelegramId();
      if (mode !== 'local') {
        const balRes = await getAccountBalance(accountId);
        if ((balRes.balance || 0) < stake.amount) {
          alert('Insufficient balance');
          return;
        }
        await addTransaction(tgId, -stake.amount, 'stake', {
          game: 'domino',
          accountId,
        });
      }
    } catch {}

    const params = new URLSearchParams();
    params.set('mode', mode);
    params.set('players', String(totalPlayers));
    if (mode !== 'local' && stake.token) params.set('token', stake.token);
    if (mode !== 'local' && stake.amount) params.set('amount', stake.amount);
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
        <GameLobbyHeader
          slug="domino-royal"
          title="Domino Battle Royal Lobby"
          badge="Double-six set"
        />

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
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={openAiFlagPicker}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80 transition hover:border-white/30"
            >
              <div className="text-[11px] uppercase tracking-wide text-white/50">AI Flags</div>
              <div className="flex items-center gap-2 text-base font-semibold">
                <span className="text-lg">
                  {flags.length ? flags.map((f) => FLAG_EMOJIS[f] || '').join(' ') : '🌐'}
                </span>
                <span>{flags.length ? 'Custom AI avatars' : 'Auto-pick from global flags'}</span>
              </div>
            </button>
          </div>
          <p className="mt-3 text-xs text-white/60">Your lobby choices persist into the domino match start.</p>
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
                <p className="text-xs text-white/60">Local AI matches are free — no stake required.</p>
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
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Players</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Seats</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {PLAYER_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPlayerCount(value)}
                className={`lobby-option-card ${
                  playerCount === value ? 'lobby-option-card-active' : 'lobby-option-card-inactive'
                }`}
              >
                <div className="lobby-option-thumb bg-gradient-to-br from-slate-400/30 via-slate-500/10 to-transparent">
                  <div className="lobby-option-thumb-inner">
                    <OptionIcon
                      src={getLobbyIcon('domino-royal', `players-${value}`)}
                      alt={`${value} players`}
                      fallback={HUMAN_ICON_FALLBACK}
                      className="lobby-option-icon"
                    />
                  </div>
                </div>
                <div className="text-center">
                  <p className="lobby-option-label">{value} Players</p>
                  <p className="lobby-option-subtitle">Local table seats</p>
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
          <div className="grid grid-cols-3 gap-3">
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
                    className={`lobby-option-card ${
                      active ? 'lobby-option-card-active' : 'lobby-option-card-inactive'
                    } ${disabled ? 'lobby-option-card-disabled' : ''}`}
                    disabled={disabled}
                  >
                    <div className={`lobby-option-thumb bg-gradient-to-br ${accent}`}>
                      <div className="lobby-option-thumb-inner">
                        <OptionIcon
                          src={getLobbyIcon('domino-royal', `mode-${id}`)}
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
            Local mode keeps the match offline while the arena loads instantly.
          </p>
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
