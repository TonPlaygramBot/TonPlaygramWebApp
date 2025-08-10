import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { ensureAccountId, getTelegramId, getTelegramPhotoUrl } from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';

export default function AirHockeyLobby() {
  const navigate = useNavigate();
  useTelegramBackButton();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [mode, setMode] = useState('ai');
  const [difficulty, setDifficulty] = useState('normal');
  const [goal, setGoal] = useState(3);
  const [avatar, setAvatar] = useState('');

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

  const startGame = async () => {
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
      await addTransaction(tgId, -stake.amount, 'stake', { game: 'airhockey' });
    } catch {}

    const params = new URLSearchParams();
    params.set('mode', mode);
    params.set('target', goal);
    if (mode === 'ai') params.set('difficulty', difficulty);
    if (stake.token) params.set('token', stake.token);
    if (stake.amount) params.set('amount', stake.amount);
    if (avatar) params.set('avatar', avatar);
    if (tgId) params.set('tgId', tgId);
    if (accountId) params.set('accountId', accountId);
    const devAcc = import.meta.env.VITE_DEV_ACCOUNT_ID;
    if (devAcc) params.set('dev', devAcc);
    navigate(`/games/airhockey?${params.toString()}`);
  };

  return (
    <div className="relative p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold text-center">Air Hockey Lobby</h2>
      <div className="space-y-2">
        <h3 className="font-semibold">Mode</h3>
        <div className="flex gap-2">
          {[
            { id: 'ai', label: 'Vs AI' },
            { id: 'online', label: '1v1 Online' }
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`lobby-tile ${mode === id ? 'lobby-selected' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {mode === 'ai' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Difficulty</h3>
          <div className="flex gap-2">
            {[
              { id: 'easy', label: 'Easy' },
              { id: 'normal', label: 'Normal' },
              { id: 'hard', label: 'Hard' }
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setDifficulty(id)}
                className={`lobby-tile ${difficulty === id ? 'lobby-selected' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2">
        <h3 className="font-semibold">Goals</h3>
        <div className="flex gap-2">
          {[3, 5, 10].map(g => (
            <button
              key={g}
              onClick={() => setGoal(g)}
              className={`lobby-tile ${goal === g ? 'lobby-selected' : ''}`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Stake</h3>
        <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
      </div>
      <button
        onClick={startGame}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded"
      >
        START
      </button>
    </div>
  );
}

