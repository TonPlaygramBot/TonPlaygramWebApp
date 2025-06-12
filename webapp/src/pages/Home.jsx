import { useEffect, useState } from 'react';
import GameCard from '../components/GameCard.jsx';
import MiningCard from '../components/MiningCard.jsx';
import Branding from '../components/Branding.jsx';
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
        <GameCard title="Wallet" icon="💰" link="/wallet" />
        <MiningCard />
        <GameCard title="Dice Duel" icon="🎲" link="/games/dice" />
        <GameCard title="Snakes & Ladders" icon="🐍" link="/games/snake" />
        <GameCard title="Tasks" icon="✅" link="/tasks" />
        <GameCard title="Profile" icon="👤" link="/account" />
      </div>
      <p className="text-center text-xs text-subtext">Status: {status}</p>
    </div>
  );
}
