import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  ensureAccountId,
  getTelegramFirstName,
  getTelegramId,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import { addTransaction, getAccountBalance } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import {
  resolveTableSize,
  TABLE_SIZE_LIST,
  DEFAULT_TABLE_SIZE_ID
} from '../../config/snookerClubTables.js';

const PLAYER_FLAG_STORAGE_KEY = 'snookerClubPlayerFlag';
const AI_FLAG_STORAGE_KEY = 'snookerClubAiFlag';

export default function SnookerClubLobby() {
  const navigate = useNavigate();
  const { search } = useLocation();
  useTelegramBackButton();

  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const initialPlayType = (() => {
    const requestedType = searchParams.get('type');
    return requestedType === 'training' || requestedType === 'tournament'
      ? requestedType
      : 'regular';
  })();

  const [tableSizeId, setTableSizeId] = useState(
    searchParams.get('tableSize') || DEFAULT_TABLE_SIZE_ID
  );
  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [mode, setMode] = useState('ai');
  const [avatar, setAvatar] = useState('');
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [showAiFlagPicker, setShowAiFlagPicker] = useState(false);
  const [playerFlagIndex, setPlayerFlagIndex] = useState(null);
  const [aiFlagIndex, setAiFlagIndex] = useState(null);
  const [playType, setPlayType] = useState(initialPlayType);
  const [players, setPlayers] = useState(8);
  const [trainingMode, setTrainingMode] = useState('solo');
  const [trainingRulesEnabled, setTrainingRulesEnabled] = useState(true);

  const selectedFlag = playerFlagIndex != null ? FLAG_EMOJIS[playerFlagIndex] : '';
  const selectedAiFlag = aiFlagIndex != null ? FLAG_EMOJIS[aiFlagIndex] : '';

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

  useEffect(() => {
    try {
      if (selectedFlag) {
        window.localStorage?.setItem(PLAYER_FLAG_STORAGE_KEY, selectedFlag);
      }
    } catch {}
  }, [selectedFlag]);

  useEffect(() => {
    try {
      if (selectedAiFlag) {
        window.localStorage?.setItem(AI_FLAG_STORAGE_KEY, selectedAiFlag);
      }
    } catch {}
  }, [selectedAiFlag]);

  useEffect(() => {
    if (playType !== 'training') return;
    setTrainingMode((current) => current || 'solo');
  }, [playType]);

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
        if (mode !== 'online') {
          await addTransaction(tgId, -stake.amount, 'stake', {
            game: 'snookerclub',
            players: playType === 'tournament' ? players : 2,
            accountId
          });
        }
      } catch {}
    } else {
      try {
        tgId = getTelegramId();
        accountId = await ensureAccountId();
      } catch {}
    }

    const params = new URLSearchParams();
    params.set('tableSize', resolveTableSize(tableSizeId).id);
    params.set('type', playType);
    params.set('mode', playType === 'training' ? trainingMode : mode);
    params.set('rules', trainingRulesEnabled ? 'on' : 'off');
    if (playType !== 'training') {
      if (stake.token) params.set('token', stake.token);
      if (stake.amount) params.set('amount', stake.amount);
      if (playType === 'tournament') params.set('players', players);
    }
    const initData = window.Telegram?.WebApp?.initData;
    if (avatar) params.set('avatar', avatar);
    if (tgId) params.set('tgId', tgId);
    if (accountId) params.set('accountId', accountId);
    const name = getTelegramFirstName();
    if (name) params.set('name', name);
    if (selectedFlag) params.set('flag', selectedFlag);
    if (selectedAiFlag) params.set('aiFlag', selectedAiFlag);
    const devAcc = import.meta.env.VITE_DEV_ACCOUNT_ID;
    const devAcc1 = import.meta.env.VITE_DEV_ACCOUNT_ID_1;
    const devAcc2 = import.meta.env.VITE_DEV_ACCOUNT_ID_2;
    if (devAcc) params.set('dev', devAcc);
    if (devAcc1) params.set('dev1', devAcc1);
    if (devAcc2) params.set('dev2', devAcc2);
    if (initData) params.set('init', encodeURIComponent(initData));

    navigate(`/games/snookerclub?${params.toString()}`);
  };

  return (
    <div className="relative p-4 space-y-4 text-text min-h-screen neon-grid-bg">
      <h2 className="text-xl font-bold text-center">Snooker Club Lobby</h2>
      <p className="text-center text-sm text-subtext">
        Choose the official 10 ft or 12 ft build, pick the arena mode, and jump into the
        dedicated snooker run without touching the Pool Royale tables.
      </p>

      <div className="space-y-2">
        <h3 className="font-semibold">Type</h3>
        <div className="flex gap-2">
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
              {label}
            </button>
          ))}
        </div>
      </div>

      {playType !== 'training' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Mode</h3>
          <div className="flex gap-2">
            {[{ id: 'ai', label: 'Vs AI' }, { id: 'online', label: 'Online' }].map(
              ({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setMode(id)}
                  className={`lobby-tile ${mode === id ? 'lobby-selected' : ''}`}
                >
                  {label}
                </button>
              )
            )}
          </div>
          <p className="text-xs text-subtext">
            Online stakes mirror Pool Royale but run on isolated snooker rooms.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="font-semibold">Table Size</h3>
        <div className="flex gap-2">
          {TABLE_SIZE_LIST.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTableSizeId(id)}
              className={`lobby-tile ${tableSizeId === id ? 'lobby-selected' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-subtext">
          Both builds reuse the Pool Royale cloth, chrome, and wood stacks with the snooker markings
          restored.
        </p>
      </div>

      {playType === 'tournament' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Players</h3>
          <div className="flex gap-2">
            {[8, 16, 24, 32].map((p) => (
              <button
                key={p}
                onClick={() => setPlayers(p)}
                className={`lobby-tile ${players === p ? 'lobby-selected' : ''}`}
              >
                {p}
              </button>
            ))}
          </div>
          <p className="text-xs">Winner takes pot minus 10% developer fee.</p>
        </div>
      )}

      {playType !== 'training' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Stake</h3>
          <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
        </div>
      )}

      {playType === 'training' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Training Setup</h3>
          <div className="flex gap-2">
            {[{ id: 'solo', label: 'Solo' }, { id: 'ai', label: 'Vs AI' }].map(
              ({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setTrainingMode(id)}
                  className={`lobby-tile ${trainingMode === id ? 'lobby-selected' : ''}`}
                >
                  {label}
                </button>
              )
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={trainingRulesEnabled}
              onChange={(e) => setTrainingRulesEnabled(e.target.checked)}
            />
            Keep full snooker rules during training
          </label>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="font-semibold">Flags</h3>
        <div className="flex gap-2">
          <button className="lobby-tile" onClick={() => setShowFlagPicker(true)}>
            Player {selectedFlag || '🇬🇧'}
          </button>
          <button className="lobby-tile" onClick={() => setShowAiFlagPicker(true)}>
            Opponent {selectedAiFlag || '🏴‍☠️'}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={startGame}
        className="w-full rounded-full bg-primary px-6 py-3 text-base font-semibold text-black shadow-lg shadow-primary/40"
      >
        Enter Snooker Club
      </button>

      {showFlagPicker && (
        <FlagPickerModal
          selectedIndex={playerFlagIndex}
          onSelect={(idx) => setPlayerFlagIndex(idx)}
          onClose={() => setShowFlagPicker(false)}
        />
      )}

      {showAiFlagPicker && (
        <FlagPickerModal
          selectedIndex={aiFlagIndex}
          onSelect={(idx) => setAiFlagIndex(idx)}
          onClose={() => setShowAiFlagPicker(false)}
        />
      )}
    </div>
  );
}
