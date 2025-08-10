import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTransactions } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import LoginOptions from './LoginOptions.jsx';

export default function WalletCard() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return (
      <div className="bg-surface border border-border rounded-xl wide-card">
        <LoginOptions />
      </div>
    );
  }

  const [tpcBalance, setTpcBalance] = useState(null);

  const loadBalance = async () => {
    const tx = await getTransactions(telegramId);
    const total = (tx.transactions || []).reduce(
      (sum, t) => sum + (typeof t.amount === 'number' ? t.amount : 0),
      0
    );
    setTpcBalance(total);
  };

  useEffect(() => {
    loadBalance();
  }, []);

  return (
    <div className="relative bg-surface border border-border p-4 rounded-xl shadow-lg text-text space-y-2 overflow-hidden wide-card">
      <img
        src="/assets/icons/snakes_and_ladders.webp"
        className="background-behind-board object-cover"
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      <h3 className="text-lg font-bold flex items-center space-x-2">
        <span>💰</span>
        <span>Wallet</span>
      </h3>
      <p>TPC Balance: {tpcBalance === null ? '...' : tpcBalance}</p>
      <Link to="/wallet" className="inline-block mt-1 px-3 py-1 bg-primary hover:bg-primary-hover text-background rounded">
        Open
      </Link>
    </div>
  );
}
