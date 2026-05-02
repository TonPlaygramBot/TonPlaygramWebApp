import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { ensureAccountId, getTelegramFirstName, getTelegramPhotoUrl } from '../../utils/telegram.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { runSimpleOnlineFlow } from '../../utils/simpleOnlineFlow.js';
import { socket } from '../../utils/socket.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';

function pickRandomFlags(count) {
  if (!count) return [];
  const available = FLAG_EMOJIS.map((_, idx) => idx);
  for (let i = available.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, count);
}

export default function TennisLobby() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('ai');
  const [avatar, setAvatar] = useState('');
  const [flags, setFlags] = useState(() => pickRandomFlags(1));
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [stake, setStake] = useState(100);
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
        stake: { token: 'TPC', amount: stake },
        maxPlayers: 2,
        avatar,
        playerName: getTelegramFirstName() || 'Player',
        state: { setMatching, setMatchStatus, setMatchError },
        deps: { ensureAccountId, getAccountBalance, addTransaction, socket },
        onMatched: ({ accountId, tableId }) => {
          const params = new URLSearchParams();
          params.set('mode', 'online');
          params.set('tableId', tableId);
          params.set('accountId', accountId);
          params.set('player', getTelegramFirstName() || 'You');
          params.set('opponent', 'Online rival');
          navigate(`/games/tennis?${params.toString()}`);
        }
      });
      return;
    }

    const params = new URLSearchParams();
    params.set('mode', 'ai');
    params.set('player', getTelegramFirstName() || 'You');
    params.set('opponent', 'AI Pro');
    if (avatar) params.set('avatar', avatar);
    if (flags.length) params.set('flags', flags.join(','));
    navigate(`/games/tennis?${params.toString()}`);
  };

  return (
    <div className="relative min-h-screen bg-[#070b16] text-text p-4 space-y-4">
      <GameLobbyHeader slug="tennis" title="Tennis Lobby" badge="1v1 only" />
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs text-white/60 uppercase tracking-[0.22em]">Glam Avatar</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-12 w-12 rounded-full overflow-hidden border border-white/20 bg-white/10">
            {avatar ? <img src={avatar} alt="avatar" className="h-full w-full object-cover" /> : <div className="h-full grid place-items-center">🙂</div>}
          </div>
          <div>
            <div className="font-semibold text-white">{getTelegramFirstName() || 'Player'}</div>
            <button type="button" className="text-xs text-cyan-300" onClick={() => setShowFlagPicker(true)}>
              World glam set: {flags.length ? flags.map((f) => FLAG_EMOJIS[f]).join(' ') : '🌍'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setMode('ai')} className={`lobby-option-card ${mode === 'ai' ? 'lobby-option-card-active' : 'lobby-option-card-inactive'}`}>
          <p className="lobby-option-label">Vs AI (Free)</p>
          <p className="lobby-option-subtitle">No TPC stake</p>
        </button>
        <button type="button" onClick={() => setMode('online')} className={`lobby-option-card ${mode === 'online' ? 'lobby-option-card-active' : 'lobby-option-card-inactive'}`}>
          <p className="lobby-option-label">Online 1v1</p>
          <p className="lobby-option-subtitle">TPC streak queue</p>
        </button>
      </div>

      {mode === 'online' && (
        <label className="block rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
          TPC stake
          <input type="number" min={1} step={10} value={stake} onChange={(e) => setStake(Math.max(1, Number(e.target.value) || 1))} className="mt-2 w-full rounded-lg bg-black/30 px-2 py-2" />
        </label>
      )}

      <button type="button" disabled={matching} onClick={startGame} className="w-full rounded-xl bg-cyan-500 text-black font-bold py-3 disabled:opacity-60">
        {matching ? (matchStatus || 'Matching...') : 'Start 1v1 Match'}
      </button>
      {matchError && <p className="text-sm text-red-300">{matchError}</p>}

      <FlagPickerModal isOpen={showFlagPicker} count={1} initialSelection={flags} onClose={() => setShowFlagPicker(false)} onConfirm={(s) => { setFlags(s); setShowFlagPicker(false); }} />
    </div>
  );
}
