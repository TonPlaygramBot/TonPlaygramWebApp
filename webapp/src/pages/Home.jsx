import { useEffect, useState } from 'react';
import GameCard from '../components/GameCard.jsx';
import MiningCard from '../components/MiningCard.tsx';
import Branding from '../components/Branding.jsx';
import SpinGame from '../components/SpinGame.jsx';
import TasksCard from '../components/TasksCard.jsx';
import { FaUser } from 'react-icons/fa';
import { ping } from '../utils/api.js';
import ConnectWallet from "../components/ConnectWallet.jsx";

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
        <div className="flex justify-center">
            <ConnectWallet />
        </div>
      {/* Embedded Spin & Win */}
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
