import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ConnectWallet from './ConnectWallet.jsx';
import { getWalletBalance } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import OpenInTelegram from './OpenInTelegram.jsx';

export default function WalletCard() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return (
      <div className="bg-gray-800/60 rounded-xl">
        <OpenInTelegram />
      </div>
    );
  }
  const [tpcBalance, setTpcBalance] = useState(null);
  const [usdtBalance, setUsdtBalance] = useState(null);

  const loadBalances = async () => {
    const prof = await getWalletBalance(telegramId);
    setTpcBalance(prof.balance);
    // TonConnect removed - TON balance unavailable
    // USDT balance not implemented yet
    setUsdtBalance(0);
  };

  useEffect(() => {
    loadBalances();
  }, []);

  return (
    <div className="bg-gray-800/60 p-4 rounded-xl shadow-lg text-white space-y-2">
      <h3 className="text-lg font-bold flex items-center space-x-2">
        <span>💰</span>
        <span>Wallet</span>
      </h3>
      <ConnectWallet />
      <p>TPC Balance: {tpcBalance === null ? '...' : tpcBalance}</p>
      <p>USDT Balance: {usdtBalance === null ? '...' : usdtBalance}</p>
      <Link to="/wallet" className="inline-block mt-1 px-3 py-1 bg-blue-600 rounded hover:bg-blue-500">
        Open
      </Link>
    </div>
  );
}
