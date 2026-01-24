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

const AI_FLAG_STORAGE_KEY = 'goalRushAiFlag';
const PLAYER_FLAG_STORAGE_KEY = 'goalRushPlayerFlag';

export default function GoalRushLobby() {
  const navigate = useNavigate();
  const { search } = useLocation();
  useTelegramBackButton();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [mode, setMode] = useState('ai');
  const [goal, setGoal] = useState(3);
  const [avatar, setAvatar] = useState('');
  const [playType, setPlayType] = useState('regular');
  const [players, setPlayers] = useState(8);
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [showAiFlagPicker, setShowAiFlagPicker] = useState(false);
  const [playerFlagIndex, setPlayerFlagIndex] = useState(null);
  const [aiFlagIndex, setAiFlagIndex] = useState(null);

  const selectedFlag = playerFlagIndex != null ? FLAG_EMOJIS[playerFlagIndex] : '';
  const selectedAiFlag = aiFlagIndex != null ? FLAG_EMOJIS[aiFlagIndex] : '';

  useEffect(() => {
    import('./GoalRush.jsx').catch(() => {});
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
          game: 'goalrush',
          players: playType === 'tournament' ? players : 2,
          accountId,
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
    if (playType === 'tournament') {
      window.location.href = `/goal-rush-bracket.html?${params.toString()}`;
    } else {
      navigate(`/games/goalrush?${params.toString()}`);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#070b16] text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-60" />
      <div className="relative z-10 space-y-4 p-4 pb-8">
        <GameLobbyHeader slug="goalrush" title="Goal Rush Lobby" badge="Pitch ready" />

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
              <p className="font-semibold">{getTelegramFirstName() || 'Player'} ready</p>
              <p className="text-xs text-white/50">Flag: {selectedFlag || 'Auto'}</p>
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
              onClick={() => setShowAiFlagPicker(true)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80 transition hover:border-white/30"
            >
              <div className="text-[11px] uppercase tracking-wide text-white/50">AI Flag</div>
              <div className="flex items-center gap-2 text-base font-semibold">
                <span className="text-lg">{selectedAiFlag || '🌐'}</span>
                <span>{selectedAiFlag ? 'Custom AI flag' : 'Auto-pick opponent'}</span>
              </div>
            </button>
          </div>
          <p className="mt-3 text-xs text-white/60">Your lobby choices persist into the match intro.</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Type</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Play</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'regular', label: 'Regular', icon: '🥅' },
                { id: 'training', label: 'Training', icon: '🏟' },
                { id: 'tournament', label: 'Tournament', icon: '🏆' }
              ].map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => setPlayType(id)}
                  className={`lobby-option-card ${
                    playType === id ? 'lobby-option-card-active' : 'lobby-option-card-inactive'
                  }`}
                >
                  <div className="lobby-option-thumb bg-gradient-to-br from-emerald-400/30 via-emerald-500/10 to-transparent">
                    <div className="lobby-option-thumb-inner">
                      <OptionIcon
                        src={null}
                        alt={label}
                        fallback={icon}
                        className="lobby-option-icon"
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="lobby-option-label">{label}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {playType !== 'training' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Mode</h3>
              <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Queue</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'ai', label: 'Vs AI' },
                  { id: 'online', label: '1v1 Online', disabled: true }
                ].map(({ id, label, disabled }) => (
                  <div key={id} className="relative">
                    <button
                      onClick={() => !disabled && setMode(id)}
                      className={`lobby-option-card ${
                        mode === id ? 'lobby-option-card-active' : 'lobby-option-card-inactive'
                      } ${disabled ? 'lobby-option-card-disabled' : ''}`}
                      disabled={disabled}
                    >
                      <div className="lobby-option-thumb bg-gradient-to-br from-sky-400/30 via-indigo-500/10 to-transparent">
                        <div className="lobby-option-thumb-inner">
                          <OptionIcon
                            src={getLobbyIcon('poolroyale', `mode-${id}`)}
                            alt={label}
                            fallback={id === 'ai' ? '🤖' : '🌐'}
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
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Goals</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Target</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
            <div className="grid grid-cols-3 gap-3">
              {[3, 5, 10].map((g) => (
                <button
                  key={g}
                  onClick={() => setGoal(g)}
                  className={`lobby-option-card ${
                    goal === g ? 'lobby-option-card-active' : 'lobby-option-card-inactive'
                  }`}
                >
                  <div className="lobby-option-thumb bg-gradient-to-br from-amber-400/30 via-rose-500/10 to-transparent">
                    <div className="lobby-option-thumb-inner">
                      <OptionIcon
                        src={null}
                        alt={`${g} goals`}
                        fallback="🥅"
                        className="lobby-option-icon"
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="lobby-option-label">{g} Goals</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {playType === 'tournament' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Players</h3>
              <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Bracket</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow space-y-2">
              <div className="grid grid-cols-3 gap-3">
                {[8, 16, 24].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlayers(p)}
                    className={`lobby-option-card ${
                      players === p ? 'lobby-option-card-active' : 'lobby-option-card-inactive'
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
                ))}
              </div>
              <p className="text-xs text-white/60">Winner takes pot minus 10% developer fee.</p>
            </div>
          </div>
        )}

        {playType !== 'training' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Stake</h3>
              <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">TPC</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
              <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
            </div>
          </div>
        )}

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
