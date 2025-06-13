import { useEffect, useState } from 'react';
import GameCard from '../components/GameCard.jsx';
import MiningCard from '../components/MiningCard.tsx';
import Branding from '../components/Branding.jsx';
import SpinGame from '../components/SpinGame.jsx';
import { FaTasks, FaUser } from 'react-icons/fa';
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

      {/* Embedded Spin & Win */}
      <SpinGame />

      <div className="grid grid-cols-1 gap-4">
        <MiningCard />
        <GameCard
          title="Tasks"
          icon={<FaTasks className="text-primary" />}
          link="/tasks"
        />
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
