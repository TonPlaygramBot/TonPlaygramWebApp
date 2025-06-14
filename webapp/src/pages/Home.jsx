import { useEffect, useState } from 'react';
import GameCard from '../components/GameCard.jsx';
import MiningCard from '../components/MiningCard.tsx';
import SpinGame from '../components/SpinGame.jsx';
import TasksCard from '../components/TasksCard.jsx';
import { FaUser } from 'react-icons/fa';
import { ping } from '../utils/api.js';
import ConnectWallet from "../components/ConnectWallet.jsx";
import BalanceSummary from '../components/BalanceSummary.jsx';
import { getTelegramPhotoUrl } from '../utils/telegram.js';

export default function Home() {
  const [status, setStatus] = useState('checking');
  const [photoUrl, setPhotoUrl] = useState('');

  useEffect(() => {
    ping()
      .then(() => setStatus('online'))
      .catch(() => setStatus('offline'));
    setPhotoUrl(getTelegramPhotoUrl());
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center">
        <ConnectWallet />
        {photoUrl && (
          <img
            src={photoUrl}
            alt="profile"
            className="w-36 h-36 hexagon border-4 border-brand-gold mt-2 object-cover"
          />
        )}
        <BalanceSummary />
      </div>

      <SpinGame />

      <div className="grid grid-cols-1 gap-4">
        <MiningCard />
        <TasksCard />
        <GameCard
          title="Profile"
          icon={<FaUser className="text-accent" />}
          link="/account"
        />
      </div>

      <p className="text-center text-xs text-subtext">Status: {status}</p>
    </div>
  );
}
