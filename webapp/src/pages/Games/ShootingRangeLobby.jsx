import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';
import OptionIcon from '../../components/OptionIcon.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  ensureAccountId,
  getTelegramFirstName,
  getTelegramId,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { runSimpleOnlineFlow } from '../../utils/simpleOnlineFlow.js';

const PLAYER_FLAG_STORAGE_KEY = 'shootingRangePlayerFlag';
const AI_FLAG_STORAGE_KEY = 'shootingRangeAiFlag';

const RANGE_DISTANCES = [
  {
    id: 'standard',
    label: 'Closed-door lanes',
    desc: 'Indoor controlled-lighting precision bay',
    icon: '🎯'
  },
  {
    id: 'swat',
    label: 'SWAT building',
    desc: 'Empty rooms, doors, cover, no-shoot marks',
    icon: '🚪'
  },
  {
    id: 'nature',
    label: 'Nature range',
    desc: 'Outdoor forest lane with long sight lines',
    icon: '🌲'
  },
  {
    id: 'moving',
    label: 'Moving rails',
    desc: 'Motorized targets for tracking drills',
    icon: '🏃'
  }
];

export default function ShootingRangeLobby() {
  const navigate = useNavigate();
  const { search } = useLocation();
  useTelegramBackButton();

  const [mode, setMode] = useState('ai');
  const [players, setPlayers] = useState(4);
  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [distance, setDistance] = useState('standard');
  const [avatar, setAvatar] = useState('');
  const [playerFlagIndex, setPlayerFlagIndex] = useState(null);
  const [aiFlagIndex, setAiFlagIndex] = useState(null);
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [showAiFlagPicker, setShowAiFlagPicker] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matchStatus, setMatchStatus] = useState('');
  const [matchError, setMatchError] = useState('');

  const selectedFlag =
    playerFlagIndex != null ? FLAG_EMOJIS[playerFlagIndex] : '';
  const selectedAiFlag = aiFlagIndex != null ? FLAG_EMOJIS[aiFlagIndex] : '';

  useEffect(() => {
    import('./ShootingRange.tsx').catch(() => {});
  }, []);

  useEffect(() => {
    try {
      setAvatar(loadAvatar() || getTelegramPhotoUrl());
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

  const launchGame = ({ tableId = '', accountId = '' } = {}) => {
    const params = new URLSearchParams(search);
    params.set('mode', mode);
    params.set('players', String(players));
    params.set('distance', distance);
    if (avatar) params.set('avatar', avatar);
    if (selectedFlag) params.set('flag', selectedFlag);
    if (selectedAiFlag) params.set('aiFlag', selectedAiFlag);
    const name = getTelegramFirstName();
    if (name) params.set('name', name);
    if (tableId) params.set('tableId', tableId);
    if (accountId) params.set('accountId', accountId);
    if (mode === 'online') {
      params.set('token', stake.token);
      params.set('amount', String(stake.amount));
    }
    navigate(`/games/shootingrange?${params.toString()}`);
  };

  const startGame = async () => {
    if (mode === 'online') {
      await runSimpleOnlineFlow({
        gameType: 'shootingrange',
        stake,
        maxPlayers: players,
        avatar,
        playerName: getTelegramFirstName() || 'Player',
        matchMeta: { flag: selectedFlag, aiFlag: selectedAiFlag },
        state: { setMatching, setMatchStatus, setMatchError },
        onMatched: ({ accountId, tableId }) =>
          launchGame({ accountId, tableId })
      });
      return;
    }

    try {
      await ensureAccountId();
      getTelegramId();
    } catch {}
    launchGame();
  };

  return (
    <div className="relative min-h-screen bg-[#070b16] text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-60" />
      <div className="relative z-10 space-y-4 p-4 pb-8">
        <GameLobbyHeader
          slug="shootingrange"
          title="Shooting Range Lobby"
          badge="2-4 players"
        />

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#101828]/80 to-[#0b1324]/90 p-4">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">
            Player Profile
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-full border border-white/15 bg-white/5">
              {avatar ? (
                <img
                  src={avatar}
                  alt="Your avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg">
                  🙂
                </div>
              )}
            </div>
            <div className="text-sm text-white/80">
              <p className="font-semibold">
                {getTelegramFirstName() || 'Player'} ready
              </p>
              <p className="text-xs text-white/50">
                Flag: {selectedFlag || 'Auto'}
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setShowFlagPicker(true)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80 transition hover:border-white/30"
            >
              <div className="text-[11px] uppercase tracking-wide text-white/50">
                Your world flag
              </div>
              <div className="flex items-center gap-2 text-base font-semibold">
                <span className="text-lg">{selectedFlag || '🌐'}</span>
                <span>
                  {selectedFlag ? 'Custom flag' : 'Auto-detect & save'}
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setShowAiFlagPicker(true)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80 transition hover:border-white/30"
            >
              <div className="text-[11px] uppercase tracking-wide text-white/50">
                AI flag
              </div>
              <div className="flex items-center gap-2 text-base font-semibold">
                <span className="text-lg">{selectedAiFlag || '🌐'}</span>
                <span>
                  {selectedAiFlag ? 'Custom AI flag' : 'Auto-pick rival'}
                </span>
              </div>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Match Mode</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">
              Free or stake
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                id: 'ai',
                label: 'Vs AI',
                desc: 'Free practice match',
                icon: '🤖'
              },
              {
                id: 'online',
                label: 'Online',
                desc: 'TPC staking queue',
                icon: '⚔️'
              }
            ].map(({ id, label, desc, icon }) => {
              const active = mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={`lobby-option-card ${active ? 'lobby-option-card-active' : 'lobby-option-card-inactive'}`}
                >
                  <div className="lobby-option-thumb bg-gradient-to-br from-emerald-400/30 via-sky-400/20 to-transparent">
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Range Distance</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">
              4 ranges
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {RANGE_DISTANCES.map(({ id, label, desc, icon }) => {
              const active = distance === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDistance(id)}
                  className={`lobby-option-card ${active ? 'lobby-option-card-active' : 'lobby-option-card-inactive'}`}
                >
                  <div className="lobby-option-thumb bg-gradient-to-br from-cyan-400/30 via-blue-500/10 to-transparent">
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Players</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">
              2 to 4
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[2, 3, 4].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setPlayers(count)}
                className={`lobby-option-card ${players === count ? 'lobby-option-card-active' : 'lobby-option-card-inactive'}`}
              >
                <div className="lobby-option-thumb bg-gradient-to-br from-amber-400/30 via-rose-500/10 to-transparent">
                  <div className="lobby-option-thumb-inner">
                    <span className="text-2xl font-semibold">{count}</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="lobby-option-label">{count} Players</p>
                  <p className="lobby-option-subtitle">
                    {mode === 'ai' ? 'You + AI' : 'Online table'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {mode === 'online' ? (
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-400/40 to-blue-500/40 p-[1px]">
                <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-xl">
                  💎
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-white">Stake</h3>
                <p className="text-xs text-white/60">
                  Online Shooting Range uses the same TPC staking flow as other
                  games.
                </p>
              </div>
            </div>
            <div className="mt-3">
              <RoomSelector
                selected={stake}
                onSelect={setStake}
                tokens={['TPC']}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            Vs AI is free. Pick 2-4 total players and the remaining seats are
            filled by competitive AI shooters.
          </div>
        )}

        {(matchStatus || matchError) && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center text-sm text-white/70">
            <span className={matchError ? 'text-red-400' : ''}>
              {matchError || matchStatus}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={startGame}
          disabled={matching}
          className="w-full rounded-2xl bg-primary px-4 py-3 text-base font-semibold text-background shadow-[0_16px_30px_rgba(14,165,233,0.35)] transition hover:bg-primary-hover disabled:opacity-60"
        >
          {matching
            ? 'MATCHING…'
            : mode === 'online'
              ? 'START ONLINE'
              : 'START FREE VS AI'}
        </button>

        <FlagPickerModal
          open={showFlagPicker}
          count={1}
          selected={playerFlagIndex != null ? [playerFlagIndex] : []}
          onSave={(indices) => {
            const idx = indices?.[0] ?? null;
            setPlayerFlagIndex(idx);
            try {
              if (idx != null)
                window.localStorage?.setItem(
                  PLAYER_FLAG_STORAGE_KEY,
                  FLAG_EMOJIS[idx]
                );
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
              if (idx != null)
                window.localStorage?.setItem(
                  AI_FLAG_STORAGE_KEY,
                  FLAG_EMOJIS[idx]
                );
            } catch {}
          }}
          onClose={() => setShowAiFlagPicker(false)}
        />
      </div>
    </div>
  );
}
