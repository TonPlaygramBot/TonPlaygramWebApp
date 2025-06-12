import { useEffect, useState } from 'react';
import GameCard from '../components/GameCard.jsx';
import WalletCard from '../components/WalletCard.jsx';
import MiningCard from '../components/MiningCard.jsx';
import Branding from '../components/Branding.jsx';
import SpinGame from '../components/SpinGame.jsx';
import { ping } from '../utils/api.js';

export default function Home() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    ping()
      .then(() => setStatus('online'))
      .catch(() => setStatus('offline'));
  }, []);

  return (
    <div className="space-y-4">
      <Branding />
      <div className="grid grid-cols-1 gap-4">
        <SpinGame />
        <WalletCard />
        <MiningCard />
        <GameCard title="Tasks" icon="✅" link="/tasks" />
        <GameCard title="Profile" icon="👤" link="/account" />
      </div>
      <p className="text-center text-xs text-gray-500">Status: {status}</p>
    </div>
  );
}
