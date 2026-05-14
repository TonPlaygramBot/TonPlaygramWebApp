import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';
import OptionIcon from '../../components/OptionIcon.jsx';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { getLobbyIcon } from '../../config/gameAssets.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { addTransaction, getAccountBalance } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { socket } from '../../utils/socket.js';
import {
  ensureAccountId,
  getTelegramId,
  getTelegramPhotoUrl,
  getTelegramUsername
} from '../../utils/telegram.js';

const PLAYER_OPTIONS = [1, 2, 3, 4, 5];
const BOWLING_PLAYER_FLAG_KEY = 'bowlingPlayerFlag';
const BOWLING_FLAGS_KEY = 'bowlingFlags';

export default function BowlingLobby() {
  const navigate = useNavigate();
  useTelegramBackButton();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [mode, setMode] = useState('local');
  const [playerCount, setPlayerCount] = useState(2);
  const [avatar, setAvatar] = useState('');
  const [flags, setFlags] = useState([]);
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const startBet = stake.amount / 100;
  const flagPickerCount = playerCount;

  const flagSummary = useMemo(
    () =>
      flags.length ? flags.map((f) => FLAG_EMOJIS[f] || '').join(' ') : '🌐',
    [flags]
  );

  useEffect(() => {
    try {
      setAvatar(loadAvatar() || getTelegramPhotoUrl());
      const storedFlags = JSON.parse(
        window.localStorage?.getItem(BOWLING_FLAGS_KEY) || '[]'
      );
      if (Array.isArray(storedFlags)) setFlags(storedFlags.slice(0, 5));
    } catch {}
  }, []);

  useEffect(() => {
    import('./BowlingRealistic.tsx').catch(() => {});
  }, []);

  const saveFlags = (nextFlags) => {
    const safeFlags = (nextFlags || []).slice(0, flagPickerCount);
    setFlags(safeFlags);
    try {
      window.localStorage?.setItem(
        BOWLING_FLAGS_KEY,
        JSON.stringify(safeFlags)
      );
      const firstFlag = FLAG_EMOJIS[safeFlags[0]];
      if (firstFlag)
        window.localStorage?.setItem(BOWLING_PLAYER_FLAG_KEY, firstFlag);
    } catch {}
  };

  const launchGame = ({ accountId = '', tgId = '', tableId = '' } = {}) => {
    const params = new URLSearchParams();
    params.set('mode', mode);
    params.set('players', String(playerCount));
    params.set('avatars', 'flags');
    if (flags.length)
      params.set('flags', flags.slice(0, flagPickerCount).join(','));
    if (avatar) params.set('avatar', avatar);
    if (mode === 'online') {
      params.set('token', stake.token);
      params.set('amount', String(stake.amount));
    }
    const username = getTelegramUsername();
    if (username) params.set('username', username);
    if (tgId) params.set('tgId', tgId);
    if (accountId) params.set('accountId', accountId);
    if (tableId) params.set('tableId', tableId);
    const initData = window.Telegram?.WebApp?.initData;
    if (initData) params.set('init', encodeURIComponent(initData));
    navigate(`/games/bowling?${params.toString()}`);
  };

  const startGame = async () => {
    let accountId = '';
    let tgId = '';
    try {
      accountId = await ensureAccountId();
      tgId = getTelegramId();
      if (mode === 'online') {
        const balRes = await getAccountBalance(accountId);
        if ((balRes.balance || 0) < stake.amount) {
          alert('Insufficient balance');
          return;
        }
        await addTransaction(tgId, -stake.amount, 'stake', {
          game: 'bowling',
          accountId
        });
      }
    } catch {}

    if (mode === 'online' && accountId) {
      socket.emit('register', { playerId: accountId });
      socket.emit(
        'seatTable',
        {
          accountId,
          gameType: 'bowling',
          stake: Number(stake.amount) || 0,
          maxPlayers: playerCount,
          playerName: getTelegramUsername() || 'Player',
          avatar,
          mode: 'online',
          token: stake.token
        },
        (res = {}) => {
          if (!res.success || !res.tableId) {
            alert('Unable to join Bowling online table. Please try again.');
            return;
          }
          socket.emit('confirmReady', { accountId, tableId: res.tableId });
          launchGame({ accountId, tgId, tableId: res.tableId });
        }
      );
      return;
    }

    launchGame({ accountId, tgId });
  };

  return (
    <div className="relative min-h-screen bg-[#070b16] text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-60" />
      <div className="relative z-10 space-y-4 p-4 pb-8">
        <GameLobbyHeader
          slug="bowling"
          title="Real Bowling Lobby"
          badge="1 lane · 1 Murlan table"
          description="Choose 1–5 bowlers, world-flag avatars, and online or AI play."
        />

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#101828]/80 to-[#0b1324]/90 p-4">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">
            Player Profile
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5 text-2xl">
              {flags.length ? (
                FLAG_EMOJIS[flags[0]] || '🌐'
              ) : avatar ? (
                <img
                  src={avatar}
                  alt="Your avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                '🌐'
              )}
            </div>
            <div className="text-sm text-white/80">
              <p className="font-semibold">Seat ready</p>
              <p className="text-xs text-white/50">Flags: {flagSummary}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowFlagPicker(true)}
            className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80 transition hover:border-white/30"
          >
            <div className="text-[11px] uppercase tracking-wide text-white/50">
              World Flag Avatars
            </div>
            <div className="flex items-center gap-2 text-base font-semibold">
              <span className="text-lg">{flagSummary}</span>
              <span>
                {flags.length
                  ? 'Custom flags selected'
                  : 'Auto-pick global flags'}
              </span>
            </div>
          </button>
        </div>

        {mode === 'local' ? (
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
            <h3 className="font-semibold text-white">AI Match</h3>
            <p className="text-xs text-white/60">
              Local games fill every extra chair with AI bowlers for free.
            </p>
          </div>
        ) : (
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
            <h3 className="font-semibold text-white">Online Stake</h3>
            <RoomSelector
              selected={stake}
              onSelect={setStake}
              tokens={['TPC']}
            />
            <p className="text-center text-xs text-white/60">
              Start bet: {startBet.toLocaleString('en-US')} TPC • Table stake:{' '}
              {stake.amount.toLocaleString('en-US')} TPC
            </p>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Match Mode</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">
              Online / AI
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                id: 'local',
                label: 'Vs AI',
                desc: 'Instant 1–5 player table',
                icon: '🤖'
              },
              {
                id: 'online',
                label: 'Online',
                desc: 'Hosted matchmaking',
                icon: '⚔️'
              }
            ].map(({ id, label, desc, icon }) => {
              const active = mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={`lobby-option-card ${
                    active
                      ? 'lobby-option-card-active'
                      : 'lobby-option-card-inactive'
                  }`}
                >
                  <div className="lobby-option-thumb bg-gradient-to-br from-sky-400/30 via-indigo-500/10 to-transparent">
                    <div className="lobby-option-thumb-inner">
                      <OptionIcon
                        src={getLobbyIcon('bowling', `mode-${id}`)}
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
            <h3 className="font-semibold text-white">Bowlers / Chairs</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">
              1–5
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {PLAYER_OPTIONS.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => {
                  setPlayerCount(count);
                  if (flags.length > count) saveFlags(flags.slice(0, count));
                }}
                className={`rounded-2xl border px-3 py-3 text-center font-black transition ${
                  playerCount === count
                    ? 'border-cyan-300 bg-cyan-300 text-slate-950'
                    : 'border-white/10 bg-white/5 text-white hover:border-white/30'
                }`}
              >
                {count}
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-white/60">
            The arena renders one bowling lane, one Murlan table, and exactly{' '}
            {playerCount} chair{playerCount === 1 ? '' : 's'}.
          </p>
        </div>

        <button
          type="button"
          onClick={startGame}
          className="w-full rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-400 to-indigo-400 px-4 py-4 text-base font-black uppercase tracking-[0.24em] text-slate-950 shadow-lg shadow-cyan-500/20"
        >
          Start Bowling
        </button>
      </div>

      <FlagPickerModal
        open={showFlagPicker}
        onClose={() => setShowFlagPicker(false)}
        count={flagPickerCount}
        selected={flags}
        onSave={saveFlags}
      />
    </div>
  );
}
