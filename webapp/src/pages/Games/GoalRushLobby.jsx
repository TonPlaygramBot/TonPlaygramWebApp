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
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#111827]/90 via-[#0f172a]/80 to-[#0b1324]/90 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-emerald-200/70">
                Goal Rush
              </p>
              <h2 className="text-2xl font-bold text-white">Modern Lobby</h2>
            </div>
            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/80">
              Pitch ready
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1.2fr_1fr]">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1f2937]/90 to-[#0f172a]/90 p-4">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-400/40 via-sky-400/20 to-indigo-500/40 p-[1px]">
                  <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-2xl">
                    🥅
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Match Setup</p>
                  <p className="text-xs text-white/60">
                    Configure your rush while the stadium loads in the background.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Quick kickoff</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Mobile ready</span>
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
                  <p className="font-semibold">{getTelegramFirstName() || 'Player'} locked in</p>
                  <p className="text-xs text-white/50">Flag: {selectedFlag || 'Auto'}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-white/60">
                Your lobby choices carry into the match intro.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Type</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Play</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'regular', label: 'Regular' },
                { id: 'training', label: 'Training' },
                { id: 'tournament', label: 'Tournament' }
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setPlayType(id)}
                  className={`lobby-tile ${playType === id ? 'lobby-selected' : ''}`}
                >
                  <span className="flex items-center gap-2">
                    <OptionIcon
                      src={getLobbyIcon('goalrush', `type-${id}`)}
                      alt={label}
                      fallback={id === 'regular' ? '🎯' : id === 'training' ? '🛠️' : '🏆'}
                      className="h-5 w-5"
                    />
                    {label}
                  </span>
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
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'ai', label: 'Vs AI' },
                  { id: 'online', label: '1v1 Online', disabled: true }
                ].map(({ id, label, disabled }) => (
                  <div key={id} className="relative">
                    <button
                      onClick={() => !disabled && setMode(id)}
                      className={`lobby-tile ${mode === id ? 'lobby-selected' : ''} ${
                        disabled ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      disabled={disabled}
                    >
                      <span className="flex items-center gap-2">
                        <OptionIcon
                          src={getLobbyIcon('goalrush', `mode-${id}`)}
                          alt={label}
                          fallback={id === 'ai' ? '🤖' : '🌐'}
                          className="h-5 w-5"
                        />
                        {label}
                      </span>
                    </button>
                    {disabled && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs bg-black/60 text-background">
                        Under development
                      </span>
                    )}
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
            <div className="flex flex-wrap gap-2">
              {[3, 5, 10].map((g) => (
                <button
                  key={g}
                  onClick={() => setGoal(g)}
                  className={`lobby-tile ${goal === g ? 'lobby-selected' : ''}`}
                >
                  <span className="flex items-center gap-2">
                    <OptionIcon
                      src={getLobbyIcon('goalrush', `target-${g}`)}
                      alt={`${g} goals`}
                      fallback="🥅"
                      className="h-5 w-5"
                    />
                    {g}
                  </span>
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
              <div className="flex flex-wrap gap-2">
                {[8, 16, 24].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlayers(p)}
                    className={`lobby-tile ${players === p ? 'lobby-selected' : ''}`}
                  >
                    {p}
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Your Flag & Avatar</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Identity</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
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
              <div className="mt-3 flex items-center gap-3">
                <img
                  src={avatar}
                  alt="Your avatar"
                  className="h-12 w-12 rounded-full border border-white/20 object-cover"
                />
                <div className="text-sm text-white/60">Your avatar will appear in the match intro.</div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-400/40 to-indigo-500/40 p-[1px]">
              <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-xl">
                🤝
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-white">AI Avatar Flags</h3>
              <p className="text-xs text-white/60">
                Pick the country flag for the AI rival so it matches the Chess Battle Royal lobby experience.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAiFlagPicker(true)}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left text-sm text-white/80 transition hover:border-white/30"
          >
            <div className="text-[10px] uppercase tracking-[0.35em] text-white/60">AI Flag</div>
            <div className="mt-2 flex items-center gap-2 text-base font-semibold">
              <span className="text-lg">{selectedAiFlag || '🌐'}</span>
              <span>{selectedAiFlag ? 'Custom AI flag' : 'Auto-pick for opponent'}</span>
            </div>
          </button>
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
