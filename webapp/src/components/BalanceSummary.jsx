import { useEffect, useState } from 'react';
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
    }
  };

  useEffect(() => {
    loadBalances();
  }, [wallet]);

  return (
    <div className="text-center mt-2">
      <p className="text-lg font-bold text-gray-300">
        Total Balance
      </p>
    </div>
  );
}

