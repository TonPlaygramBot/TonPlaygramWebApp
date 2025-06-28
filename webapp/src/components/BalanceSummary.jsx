import { useEffect, useState } from 'react';
import { FaWallet } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { createAccount, getAccountBalance } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import LoginOptions from './LoginOptions.jsx';

export default function BalanceSummary() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }

  const [balance, setBalance] = useState(null);

  const loadBalances = async () => {
    try {
      const acc = await createAccount(telegramId);
      if (acc?.error) throw new Error(acc.error);
      const bal = await getAccountBalance(acc.accountId);
      if (bal?.error) throw new Error(bal.error);
      setBalance(bal.balance ?? 0);
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
