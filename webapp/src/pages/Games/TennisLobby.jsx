import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { ensureAccountId, getTelegramFirstName, getTelegramId, getTelegramPhotoUrl } from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';
import { runSimpleOnlineFlow } from '../../utils/simpleOnlineFlow.js';
import { socket } from '../../utils/socket.js';

export default function TennisLobby() {
  const navigate = useNavigate();
  useTelegramBackButton();
  const [mode, setMode] = useState('ai');
  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [avatar, setAvatar] = useState('');
  const [matching, setMatching] = useState(false);
  const [matchStatus, setMatchStatus] = useState('');
  const [matchError, setMatchError] = useState('');

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

  const startGame = async () => {
    if (mode === 'online') {
      await runSimpleOnlineFlow({
        gameType: 'tennis',
        stake,
        maxPlayers: 2,
        avatar,
        playerName: getTelegramFirstName() || 'Player',
        state: { setMatching, setMatchStatus, setMatchError },
        deps: { ensureAccountId, getAccountBalance, addTransaction, getTelegramId, socket },
        onMatched: ({ accountId, tableId }) => {
          const params = new URLSearchParams();
          params.set('mode', 'online');
          params.set('tableId', tableId);
          params.set('accountId', accountId);
          if (stake.token) params.set('token', stake.token);
          if (stake.amount) params.set('amount', String(stake.amount));
          if (avatar) params.set('avatar', avatar);
          params.set('name', getTelegramFirstName() || 'Player');
          navigate(`/games/tennis?${params.toString()}`);
        }
      });
      return;
    }

    const params = new URLSearchParams();
    params.set('mode', 'ai');
    if (avatar) params.set('avatar', avatar);
    params.set('name', getTelegramFirstName() || 'Player');
    navigate(`/games/tennis?${params.toString()}`);
  };

  return (
    <div className="relative min-h-screen bg-[#070b16] text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-60" />
      <div className="relative z-10 space-y-4 p-4 pb-8">
        <GameLobbyHeader slug="tennis" title="Tennis Lobby" badge="1v1 only" />
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#101828]/80 to-[#0b1324]/90 p-4 text-white/80">
          <p className="text-xs">Mode rules: AI is free, Online uses TPC streak stake.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setMode('ai')} className={`lobby-option-card ${mode === 'ai' ? 'lobby-option-card-active' : 'lobby-option-card-inactive'}`}>
              <p className="lobby-option-label">Vs AI</p><p className="lobby-option-subtitle">Free practice</p>
            </button>
            <button type="button" onClick={() => setMode('online')} className={`lobby-option-card ${mode === 'online' ? 'lobby-option-card-active' : 'lobby-option-card-inactive'}`}>
              <p className="lobby-option-label">Online 1v1</p><p className="lobby-option-subtitle">TPC streak match</p>
            </button>
          </div>
          {mode === 'online' && (
            <div className="mt-3">
              <label className="text-xs uppercase text-white/60">TPC Stake</label>
              <input type="number" min={1} value={stake.amount} onChange={(e) => setStake((s) => ({ ...s, amount: Number(e.target.value) || 0 }))} className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 p-2 text-white" />
            </div>
          )}
          <button type="button" onClick={startGame} disabled={matching} className="mt-4 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-black disabled:opacity-60">
            {matching ? 'Finding opponent...' : mode === 'online' ? 'Start Online 1v1' : 'Start Vs AI'}
          </button>
          {(matchStatus || matchError) && <p className="mt-2 text-xs text-white/70">{matchError || matchStatus}</p>}
        </div>
      </div>
    </div>
  );
}
