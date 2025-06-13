import { useEffect, useState } from 'react';
import GameCard from '../components/GameCard.jsx';
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

      {/* Embedded Spin & Win */}
      <SpinGame />

      <div className="grid grid-cols-1 gap-4">
        <MiningCard />
        <GameCard title="Dice Duel" icon="/assets/icons/dice.svg" link="/games/dice" />
        <GameCard title="Snakes & Ladders" icon="/assets/icons/snake.svg" link="/games/snake" />
        <GameCard title="Tasks" icon="/assets/icons/tasks.svg" link="/tasks" />
        <GameCard title="Profile" icon="/assets/icons/profile.svg" link="/account" />
      </div>

      <p className="text-center text-xs text-subtext">Status: {status}</p>
    </div>
  );
}
