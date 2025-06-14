import { useEffect, useState } from 'react';
import { FaWallet } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { useTonWallet } from '@tonconnect/ui-react';
import { getWalletBalance, getTonBalance } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import OpenInTelegram from './OpenInTelegram.jsx';

export default function BalanceSummary() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <OpenInTelegram />;
  }

  const [balances, setBalances] = useState({ ton: null, tpc: null, usdt: 0 });
  const wallet = useTonWallet();

  const loadBalances = async () => {
    try {
      const prof = await getWalletBalance(telegramId);
      const ton = wallet?.account?.address
        ? (await getTonBalance(wallet.account.address)).balance
        : null;
      setBalances({ ton, tpc: prof.balance, usdt: 0 });
    } catch (err) {
      console.error('Failed to load balances:', err);
      setBalances({ ton: null, tpc: 0, usdt: 0 });
    }
  };

  useEffect(() => {
    loadBalances();
  }, [wallet]);

  return (
    <div className="text-center mt-2">
      <p className="text-lg font-bold text-gray-300 flex items-center justify-center space-x-1">
        <Link to="/wallet" className="flex items-center space-x-1">
          <FaWallet className="text-primary" />
          <span>Wallet</span>
        </Link>
      </p>
      <div className="flex justify-around text-sm mt-1">
        <Token icon="/icons/ton.svg" label="TON" value={balances.ton ?? '...'} />
        <Token icon="/icons/tpc.svg" label="TPC" value={balances.tpc ?? '...'} />
        <Token icon="/icons/usdt.svg" label="USDT" value={balances.usdt ?? '0'} />
      </div>
    </div>
  );
}

function Token({ icon, value, label }) {
  return (
    <div className="flex items-center space-x-1">
      <img src={icon} alt={label} className="w-4 h-4" />
      <span>{value}</span>
    </div>
  );
}
