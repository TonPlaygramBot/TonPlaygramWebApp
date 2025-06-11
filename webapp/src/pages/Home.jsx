import { useEffect, useState } from 'react';
import GameCard from '../components/GameCard.jsx';
import Branding from '../components/Branding.jsx';
import ConnectWallet from '../components/ConnectWallet.jsx';
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
      <div className="flex justify-center">
        <ConnectWallet />
      </div>
      <div className="grid grid-cols-1 gap-4">
        <GameCard title="Wallet" icon="💰" link="/wallet" />
        <GameCard title="Mining" icon="⛏" link="/mining" />
        <GameCard title="Dice Duel" icon="🎲" link="/games/dice" />
        <GameCard title="Tasks" icon="✅" link="/tasks" />
        <GameCard title="My Account" icon="👤" link="/account" />
      </div>
      <p className="text-center text-xs text-gray-500">Status: {status}</p>
    </div>
  );
}
