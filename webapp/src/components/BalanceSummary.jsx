import { useEffect, useState } from 'react';
import { FaWallet } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { getWalletBalance } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import OpenInTelegram from './OpenInTelegram.jsx';

export default function BalanceSummary() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <OpenInTelegram />;
  }

  const [balance, setBalance] = useState(null);

  const loadBalances = async () => {
    try {
      const prof = await getWalletBalance(telegramId);
      setBalance(prof.balance);
    } catch (err) {
      console.error('Failed to load balances:', err);
      setBalance(0);
    }
  };

  useEffect(() => {
    loadBalances();
  }, []);

  return (
    <div className="text-center mt-2">
      <p className="text-lg font-bold text-gray-300 flex items-center justify-center space-x-1">
        <Link to="/wallet" className="flex items-center space-x-1">
          <FaWallet className="text-primary" />
          <span>Wallet</span>
        </Link>
      </p>
      <div className="flex justify-center text-sm mt-1">
        <Token icon="/icons/TPCcoin.png" label="TPC" value={balance ?? 0} />
      </div>
    </div>
  );
}

function Token({ icon, value, label }) {
  return (
    <div className="flex items-center space-x-1">
      <img src={icon} alt={label} className="w-8 h-8" />
      <span>{value}</span>
    </div>
  );
}
