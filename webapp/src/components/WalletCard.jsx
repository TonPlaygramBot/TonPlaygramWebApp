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
      <div className="bg-gray-800/60 rounded-xl">
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
    <div className="bg-gray-800/60 p-4 rounded-xl shadow-lg text-white space-y-2">
      <h3 className="text-lg font-bold flex items-center space-x-2">
        <span>💰</span>
        <span>Wallet</span>
      </h3>
      <p>TPC Balance: {tpcBalance === null ? '...' : tpcBalance}</p>
      <Link to="/wallet" className="inline-block mt-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500">
        Open
      </Link>
    </div>
  );
}
