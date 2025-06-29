import { useEffect, useState } from 'react';
import { FaWallet } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import {
  createAccount,
  getAccountBalance,
  getTonBalance,
  getUsdtBalance
} from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import LoginOptions from './LoginOptions.jsx';
import { useTonAddress } from '@tonconnect/ui-react';

export default function BalanceSummary() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }

  const [balance, setBalance] = useState(null);
  const [tonBalance, setTonBalance] = useState(null);
  const [usdtBalance, setUsdtBalance] = useState(null);

  const walletAddress = useTonAddress(true);

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

  const loadExternalBalances = async () => {
    if (!walletAddress) {
      setTonBalance(null);
      setUsdtBalance(null);
      return;
    }
    try {
      const ton = await getTonBalance(walletAddress);
      if (ton?.error) throw new Error(ton.error);
      setTonBalance(ton.balance ?? 0);
    } catch (err) {
      console.error('Failed to load TON balance:', err);
      setTonBalance(0);
    }
    try {
      const usdt = await getUsdtBalance(walletAddress);
      if (usdt?.error) throw new Error(usdt.error);
      setUsdtBalance(usdt.balance ?? 0);
    } catch (err) {
      console.error('Failed to load USDT balance:', err);
      setUsdtBalance(0);
    }
  };

  useEffect(() => {
    loadBalances();
  }, []);

  useEffect(() => {
    loadExternalBalances();
  }, [walletAddress]);

  return (
    <div className="text-center">
      <p className="text-lg font-bold text-gray-300 flex items-center justify-center space-x-1">
        <Link to="/wallet" className="flex items-center space-x-1">
          <FaWallet className="text-primary" />
          <span>Wallet</span>
        </Link>
      </p>
      <div className="grid grid-cols-3 text-sm mt-2">
        <Token icon="/icons/TON.png" label="TON" value={tonBalance ?? '...'} />
        <Token icon="/icons/TPCcoin.png" label="TPC" value={balance ?? 0} />
        <Token icon="/icons/Usdt.png" label="USDT" value={usdtBalance ?? '...'} />
      </div>
    </div>
  );
}

function Token({ icon, value, label }) {
  return (
    <div className="flex items-center justify-center space-x-1 w-full">
      <img src={icon} alt={label} className="w-8 h-8" />
      <span>{value}</span>
    </div>
  );
}
