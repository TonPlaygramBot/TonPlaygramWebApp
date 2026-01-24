import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  ensureAccountId,
  getTelegramId,
  getTelegramPhotoUrl,
  getTelegramFirstName
} from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import OptionIcon from '../../components/OptionIcon.jsx';
import { getLobbyIcon } from '../../config/gameAssets.js';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';

const AI_FLAG_STORAGE_KEY = 'airHockeyAiFlag';
const PLAYER_FLAG_STORAGE_KEY = 'airHockeyPlayerFlag';

export default function AirHockeyLobby() {
  const navigate = useNavigate();
  const { search } = useLocation();
  useTelegramBackButton();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [mode, setMode] = useState('ai');
  const [goal, setGoal] = useState(11);
  const [playType, setPlayType] = useState('regular');
  const [players, setPlayers] = useState(8);
  const [avatar, setAvatar] = useState('');
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [showAiFlagPicker, setShowAiFlagPicker] = useState(false);
  const [playerFlagIndex, setPlayerFlagIndex] = useState(null);
  const [aiFlagIndex, setAiFlagIndex] = useState(null);

  const selectedFlag = playerFlagIndex != null ? FLAG_EMOJIS[playerFlagIndex] : '';
  const selectedAiFlag = aiFlagIndex != null ? FLAG_EMOJIS[aiFlagIndex] : '';

  useEffect(() => {
    import('./AirHockey.jsx').catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage?.getItem(PLAYER_FLAG_STORAGE_KEY);
      const idx = FLAG_EMOJIS.indexOf(stored);
      if (idx >= 0) setPlayerFlagIndex(idx);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage?.getItem(AI_FLAG_STORAGE_KEY);
      const idx = FLAG_EMOJIS.indexOf(stored);
      if (idx >= 0) setAiFlagIndex(idx);
    } catch {}
  }, []);

  const startGame = async () => {
    let tgId;
    let accountId;
    if (playType !== 'training') {
      try {
        accountId = await ensureAccountId();
        const balRes = await getAccountBalance(accountId);
        if ((balRes.balance || 0) < stake.amount) {
          alert('Insufficient balance');
          return;
        }
        tgId = getTelegramId();
        await addTransaction(tgId, -stake.amount, 'stake', {
          game: 'airhockey',
          players: playType === 'tournament' ? players : 2,
          accountId
        });
      } catch {}
    } else {
      try {
        tgId = getTelegramId();
        accountId = await ensureAccountId();
      } catch {}
    }

    const params = new URLSearchParams(search);
    params.set('target', goal);
    params.set('type', playType);
    if (playType !== 'training') params.set('mode', mode);
    if (playType === 'tournament') params.set('players', players);
    const initData = window.Telegram?.WebApp?.initData;
    if (playType !== 'training') {
      if (stake.token) params.set('token', stake.token);
      if (stake.amount) params.set('amount', stake.amount);
    }
    if (avatar) params.set('avatar', avatar);
    if (selectedFlag) params.set('flag', selectedFlag);
    if (selectedAiFlag) params.set('aiFlag', selectedAiFlag);
    if (tgId) params.set('tgId', tgId);
    if (accountId) params.set('accountId', accountId);
    const name = getTelegramFirstName();
    if (name) params.set('name', name);
    const devAcc = import.meta.env.VITE_DEV_ACCOUNT_ID;
    const devAcc1 = import.meta.env.VITE_DEV_ACCOUNT_ID_1;
    const devAcc2 = import.meta.env.VITE_DEV_ACCOUNT_ID_2;
    if (devAcc) params.set('dev', devAcc);
    if (devAcc1) params.set('dev1', devAcc1);
    if (devAcc2) params.set('dev2', devAcc2);
    if (initData) params.set('init', encodeURIComponent(initData));
    navigate(`/games/airhockey?${params.toString()}`);
  };

  return (
    <div className="relative min-h-screen bg-[#070b16] text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-60" />
      <div className="relative z-10 space-y-4 p-4 pb-8">
        <GameLobbyHeader slug="airhockey" title="Air Hockey Lobby" badge="Fast load" />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Game Type</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Mode</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'regular', label: 'Regular', desc: 'Classic rink', icon: '🏒' },
              { id: 'training', label: 'Training', desc: 'Practice hits', icon: '🏟' },
              { id: 'tournament', label: 'Tournament', desc: 'Bracket battle', icon: '🏆' }
            ].map(({ id, label, desc, icon }) => {
              const active = playType === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPlayType(id)}
                  className={`lobby-option-card ${
                    active ? 'lobby-option-card-active' : 'lobby-option-card-inactive'
                  }`}
                >
                  <div className="lobby-option-thumb bg-gradient-to-br from-sky-400/30 via-indigo-400/20 to-transparent">
                    <div className="lobby-option-thumb-inner">
                      <OptionIcon
                        src=""
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

        {playType !== 'training' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Match Mode</h3>
              <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Queue</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'ai', label: 'Vs AI', desc: 'Instant practice', icon: '🤖' },
                  { id: 'online', label: '1v1 Online', desc: 'Coming soon', icon: '⚔️', disabled: true }
                ].map(({ id, label, desc, icon, disabled }) => {
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
                      <div className="lobby-option-thumb bg-gradient-to-br from-emerald-400/30 via-sky-400/20 to-transparent">
                        <div className="lobby-option-thumb-inner">
                          <OptionIcon
                            src={getLobbyIcon('poolroyale', `mode-${id}`)}
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
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Goal Target</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Score</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[11, 21, 31].map((g) => {
              const active = goal === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGoal(g)}
                  className={`lobby-option-card ${
                    active ? 'lobby-option-card-active' : 'lobby-option-card-inactive'
                  }`}
                >
                  <div className="lobby-option-thumb bg-gradient-to-br from-amber-400/30 via-rose-500/10 to-transparent">
                    <div className="lobby-option-thumb-inner">
                      <OptionIcon
                        src=""
                        alt={`First to ${g}`}
                        fallback="🥅"
                        className="lobby-option-icon"
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="lobby-option-label">First to {g}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {playType === 'tournament' && (
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-400/40 to-orange-500/40 p-[1px]">
                <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-xl">
                  🏆
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-white">Tournament Players</h3>
                <p className="text-xs text-white/60">Winner takes pot minus 10% developer fee.</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[8, 16, 24].map((p) => {
                const active = players === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlayers(p)}
                    className={`lobby-option-card ${
                      active ? 'lobby-option-card-active' : 'lobby-option-card-inactive'
                    }`}
                  >
                    <div className="lobby-option-thumb bg-gradient-to-br from-purple-400/30 via-indigo-500/10 to-transparent">
                      <div className="lobby-option-thumb-inner">
                        <span className="text-2xl font-semibold">{p}</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="lobby-option-label">{p} Players</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {playType !== 'training' && (
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-400/40 to-blue-500/40 p-[1px]">
                <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-xl">
                  💎
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-white">Stake</h3>
                <p className="text-xs text-white/60">Stake your TPC for ranked play.</p>
              </div>
            </div>
            <div className="mt-3">
              <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Identity</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Flags</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-400/40 to-indigo-500/40 p-[1px]">
                <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-xl">
                  👤
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-white">Player & AI Identity</h3>
                <p className="text-xs text-white/60">Set your flag, avatar, and AI rival flag in one place.</p>
              </div>
            </div>
            <div className="mt-3 grid gap-3">
              <button
                type="button"
                onClick={() => setShowFlagPicker(true)}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left text-sm text-white/80 transition hover:border-white/30"
              >
                <div className="text-[10px] uppercase tracking-[0.35em] text-white/60">Flag</div>
                <div className="mt-2 flex items-center gap-2 text-base font-semibold">
                  <span className="text-lg">{selectedFlag || '🌐'}</span>
                  <span>{selectedFlag ? 'Custom flag' : 'Auto-detect & save'}</span>
                </div>
              </button>
              {avatar && (
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <img
                    src={avatar}
                    alt="Your avatar"
                    className="h-12 w-12 rounded-full border border-white/20 object-cover"
                  />
                  <div className="text-sm text-white/60">Your avatar will appear in the match intro.</div>
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowAiFlagPicker(true)}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left text-sm text-white/80 transition hover:border-white/30"
              >
                <div className="text-[10px] uppercase tracking-[0.35em] text-white/60">AI Flag</div>
                <div className="mt-2 flex items-center gap-2 text-base font-semibold">
                  <span className="text-lg">{selectedAiFlag || '🌐'}</span>
                  <span>{selectedAiFlag ? 'Custom AI flag' : 'Auto-pick for opponent'}</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={startGame}
          className="w-full rounded-2xl bg-primary px-4 py-3 text-base font-semibold text-background shadow-[0_16px_30px_rgba(14,165,233,0.35)] transition hover:bg-primary-hover"
        >
          START
        </button>

        <FlagPickerModal
          open={showFlagPicker}
          count={1}
          selected={playerFlagIndex != null ? [playerFlagIndex] : []}
          onSave={(indices) => {
            const idx = indices?.[0] ?? null;
            setPlayerFlagIndex(idx);
            try {
              if (idx != null) window.localStorage?.setItem(PLAYER_FLAG_STORAGE_KEY, FLAG_EMOJIS[idx]);
            } catch {}
          }}
          onClose={() => setShowFlagPicker(false)}
        />

        <FlagPickerModal
          open={showAiFlagPicker}
          count={1}
          selected={aiFlagIndex != null ? [aiFlagIndex] : []}
          onSave={(indices) => {
            const idx = indices?.[0] ?? null;
            setAiFlagIndex(idx);
            try {
              if (idx != null) window.localStorage?.setItem(AI_FLAG_STORAGE_KEY, FLAG_EMOJIS[idx]);
            } catch {}
          }}
          onClose={() => setShowAiFlagPicker(false)}
        />
      </div>
    </div>
  );
}
