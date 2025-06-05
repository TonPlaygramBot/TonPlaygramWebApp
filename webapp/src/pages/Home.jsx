import { useEffect, useState } from 'react';
import GameCard from '../components/GameCard.jsx';
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
      <h1 className="text-2xl font-bold">TonPlaygram ({status})</h1>
      <GameCard title="Mining" description="Earn tokens over time." link="/mining" />
      <GameCard title="Dice Duel" description="Play dice against friends." link="/games/dice" />
      <GameCard title="Watch to Earn" description="Earn tokens by watching videos." link="/watch" />
    </div>
  );
}
