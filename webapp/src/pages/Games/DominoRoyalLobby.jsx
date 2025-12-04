import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import RoomSelector from '../../components/RoomSelector.jsx';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { ensureAccountId, getTelegramId, getTelegramPhotoUrl, getTelegramUsername } from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';

const DEV_ACCOUNT = import.meta.env.VITE_DEV_ACCOUNT_ID;
const DEV_ACCOUNT_1 = import.meta.env.VITE_DEV_ACCOUNT_ID_1;
const DEV_ACCOUNT_2 = import.meta.env.VITE_DEV_ACCOUNT_ID_2;

const PLAYER_OPTIONS = [2, 3, 4];

export default function DominoRoyalLobby() {
  const navigate = useNavigate();
  useTelegramBackButton();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [mode, setMode] = useState('local');
  const [avatar, setAvatar] = useState('');
  const [playerCount, setPlayerCount] = useState(4);
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [flags, setFlags] = useState([]);
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
    navigate(`/games/domino-royal?${params.toString()}`);
  };

  return (
    <div className="relative p-4 space-y-4 text-text min-h-screen tetris-grid-bg">
      <h2 className="text-xl font-bold text-center">Domino Royal 3D Lobby</h2>
      <p className="text-center text-sm text-subtext">Double-six set • up to 4 players</p>
      <div className="space-y-2">
        <h3 className="font-semibold">Stake</h3>
        <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
        <p className="text-sm text-center">
          Start bet: {startBet.toLocaleString('en-US')} TPC • Pot max: {stake.amount.toLocaleString('en-US')} TPC
        </p>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Players</h3>
        <div className="flex gap-2">
          {PLAYER_OPTIONS.map((value) => (
            <button
              key={value}
              onClick={() => setPlayerCount(value)}
              className={`lobby-tile ${playerCount === value ? 'lobby-selected' : ''}`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Mode</h3>
        <div className="flex gap-2">
          {[
            { id: 'local', label: 'Local (AI)' },
            { id: 'online', label: 'Online', disabled: true }
          ].map(({ id, label, disabled }) => (
            <div key={id} className="relative">
              <button
                onClick={() => !disabled && setMode(id)}
                className={`lobby-tile ${mode === id ? 'lobby-selected' : ''} ${
                  disabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={disabled}
              >
                {label}
              </button>
              {disabled && (
                <span className="absolute inset-0 flex items-center justify-center text-xs bg-black bg-opacity-50 text-background">
                  Under development
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">AI Avatar Flags</h3>
        <p className="text-sm text-subtext text-center">
          Match the Snake &amp; Ladder lobby by picking worldwide flags for AI opponents and your seat.
        </p>
        <button
          type="button"
          onClick={openAiFlagPicker}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background/60 hover:border-primary text-sm text-left"
        >
          <div className="text-[11px] uppercase tracking-wide text-subtext">AI Flags</div>
          <div className="flex items-center gap-2 text-base font-semibold">
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
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded disabled:opacity-50"
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
  );
}
