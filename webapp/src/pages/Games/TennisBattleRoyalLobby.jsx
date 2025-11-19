import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  ensureAccountId,
  getTelegramFirstName,
  getTelegramId,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import { addTransaction, getAccountBalance } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';

export default function TennisBattleRoyalLobby() {
  useTelegramBackButton();
  const navigate = useNavigate();
  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [avatar, setAvatar] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {
      setAvatar('');
    }
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

      navigate(`/games/tennisbattleroyal?${params.toString()}`);
    } catch (err) {
      console.error(err);
      alert('Unable to start fundraising match right now.');
      setLoading(false);
    }
  };

  return (
    <div className="relative p-4 space-y-4 text-text min-h-screen tetris-grid-bg">
      <h2 className="text-xl font-bold text-center">3D Tennis Battle Royal Lobby</h2>
      <p className="text-sm text-subtext text-center">
        Për momentin ndeshja luhet si Fundraising AI – stake TPC dhe merr pjesë në rally për të rritur pot-in e komunitetit.
      </p>
      <div className="space-y-2">
        <h3 className="font-semibold">Modaliteti</h3>
        <div className="lobby-tile lobby-selected">Fundraising · Vs AI</div>
        <p className="text-xs text-subtext">
          Stadiumi përdor shkallët, dhomat VIP dhe roof-in e rikrijuar nga përvoja jonë Free Kick 3D.
        </p>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Stake</h3>
        <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
      </div>
      <button
        onClick={startGame}
        disabled={loading}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded disabled:opacity-60"
      >
        {loading ? 'Duke u përgatitur…' : 'Start Fundraising Rally'}
      </button>
    </div>
  );
}
