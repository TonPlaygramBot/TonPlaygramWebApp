import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const AI_FLAG_STORAGE_KEY = 'tennisBattleRoyalAiFlag';
const PLAYER_FLAG_STORAGE_KEY = 'tennisBattleRoyalPlayerFlag';

export default function TennisBattleRoyalLobby() {
  useTelegramBackButton();
  const navigate = useNavigate();
  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [avatar, setAvatar] = useState('');
  const [loading, setLoading] = useState(false);
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [showAiFlagPicker, setShowAiFlagPicker] = useState(false);
  const [playerFlagIndex, setPlayerFlagIndex] = useState(null);
  const [aiFlagIndex, setAiFlagIndex] = useState(null);

  const selectedFlag = playerFlagIndex != null ? FLAG_EMOJIS[playerFlagIndex] : '';
  const selectedAiFlag = aiFlagIndex != null ? FLAG_EMOJIS[aiFlagIndex] : '';

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {
      setAvatar('');
    }
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
    if (loading) return;
    setLoading(true);
    try {
      const accountId = await ensureAccountId();
      const balance = await getAccountBalance(accountId);
      if ((balance.balance || 0) < stake.amount) {
        alert('Insufficient balance');
        setLoading(false);
        return;
      }

      const tgId = getTelegramId();
      await addTransaction(tgId, -stake.amount, 'stake', {
        game: 'tennis-battle-royal',
        mode: 'fundraising-ai',
        accountId
      });

      const params = new URLSearchParams();
      params.set('mode', 'fundraising-ai');
      params.set('token', stake.token);
      params.set('amount', stake.amount);
      const name = getTelegramFirstName();
      if (name) params.set('name', name);
      if (tgId) params.set('tgId', tgId);
      params.set('accountId', accountId);
      if (avatar) params.set('avatar', avatar);
      if (selectedFlag) params.set('flag', selectedFlag);
      if (selectedAiFlag) params.set('aiFlag', selectedAiFlag);

      navigate(`/games/tennisbattleroyal?${params.toString()}`);
    } catch (err) {
      console.error(err);
      alert('Unable to start fundraising match right now.');
      setLoading(false);
    }
  };

  const startTraining = () => {
    const params = new URLSearchParams();
    params.set('mode', 'training');
    const name = getTelegramFirstName();
    if (name) params.set('name', name);
    const tgId = getTelegramId();
    if (tgId) params.set('tgId', tgId);
    if (avatar) params.set('avatar', avatar);
    if (selectedFlag) params.set('flag', selectedFlag);
    if (selectedAiFlag) params.set('aiFlag', selectedAiFlag);
    navigate(`/games/tennisbattleroyal?${params.toString()}`);
  };

  return (
    <div className="relative p-4 space-y-4 text-text min-h-screen tetris-grid-bg">
      <h2 className="text-xl font-bold text-center">3D Tennis Battle Royal Lobby</h2>
      <p className="text-sm text-subtext text-center">
        For now the match runs as a Fundraising AI – stake TPC and rally to grow the community pot.
      </p>
      <div className="space-y-2">
        <h3 className="font-semibold">Modaliteti</h3>
        <div className="lobby-tile lobby-selected">Fundraising · Vs AI</div>
        <p className="text-xs text-subtext">
          The stadium reuses the stands, VIP rooms, and roof recreated from our Free Kick 3D experience.
        </p>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Stake</h3>
        <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Your Flag & Avatar</h3>
        <div className="rounded-xl border border-border bg-surface/60 p-3 space-y-2 shadow">
          <button
            type="button"
            onClick={() => setShowFlagPicker(true)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background/60 hover:border-primary text-sm text-left"
          >
            <div className="text-[11px] uppercase tracking-wide text-subtext">Flag</div>
            <div className="flex items-center gap-2 text-base font-semibold">
              <span className="text-lg">{selectedFlag || '🌐'}</span>
              <span>{selectedFlag ? 'Custom flag' : 'Auto-detect & save'}</span>
            </div>
          </button>
          {avatar && (
            <div className="flex items-center gap-3">
              <img
                src={avatar}
                alt="Your avatar"
                className="h-12 w-12 rounded-full border border-border object-cover"
              />
              <div className="text-sm text-subtext">The avatar and flag appear in the match intro.</div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">AI Avatar Flags</h3>
        <p className="text-sm text-subtext">
          Choose the AI opponent flag – identical to the Chess Battle Royal experience.
        </p>
        <button
          type="button"
          onClick={() => setShowAiFlagPicker(true)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background/60 hover:border-primary text-sm text-left"
        >
          <div className="text-[11px] uppercase tracking-wide text-subtext">AI Flag</div>
          <div className="flex items-center gap-2 text-base font-semibold">
            <span className="text-lg">{selectedAiFlag || '🌐'}</span>
            <span>{selectedAiFlag ? 'Custom AI flag' : 'Auto-pick for opponent'}</span>
          </div>
        </button>
      </div>

      <button
        onClick={startGame}
        disabled={loading}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded disabled:opacity-60"
      >
        {loading ? 'Preparing…' : 'Start Fundraising Rally'}
      </button>
      <div className="space-y-2 pt-3 border-t border-border/60">
        <h3 className="font-semibold">Training</h3>
        <p className="text-xs text-subtext">
          Play without a stake, learn swipe controls, and follow the in-game guide steps before challenging the AI.
        </p>
        <button
          onClick={startTraining}
          className="px-4 py-2 w-full bg-surface hover:bg-muted text-text rounded border border-border"
        >
          Start Training pa stake
        </button>
      </div>

      <FlagPickerModal
        open={showFlagPicker}
        count={1}
        selected={playerFlagIndex != null ? [playerFlagIndex] : []}
        onSave={(indices) => {
          const idx = indices?.[0] ?? null;
          setPlayerFlagIndex(idx);
          try {
            if (idx != null) {
              window.localStorage?.setItem(PLAYER_FLAG_STORAGE_KEY, FLAG_EMOJIS[idx]);
            }
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
            if (idx != null) {
              window.localStorage?.setItem(AI_FLAG_STORAGE_KEY, FLAG_EMOJIS[idx]);
            }
          } catch {}
        }}
        onClose={() => setShowAiFlagPicker(false)}
      />
    </div>
  );
}
