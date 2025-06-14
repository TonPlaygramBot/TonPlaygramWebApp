import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTonWallet } from '@tonconnect/ui-react';
import ConnectWallet from './ConnectWallet.jsx';
import { getWalletBalance, getTonBalance } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';

export default function WalletCard() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return (
      <div className="bg-gray-800/60 p-4 rounded-xl text-white">
        Please open this application via the Telegram bot.
      </div>
    );
  }
  const [tonBalance, setTonBalance] = useState(null);
  const [tpcBalance, setTpcBalance] = useState(null);
  const [usdtBalance, setUsdtBalance] = useState(null);
  const wallet = useTonWallet();

  const loadBalances = async () => {
    const prof = await getWalletBalance(telegramId);
    setTpcBalance(prof.balance);
    if (wallet?.account?.address) {
      const bal = await getTonBalance(wallet.account.address);
      setTonBalance(bal.balance);
    }
    // USDT balance not implemented yet
    setUsdtBalance(0);
  };

  useEffect(() => {
    loadBalances();
  }, [wallet]);

  return (
    <div className="bg-gray-800/60 p-4 rounded-xl shadow-lg text-white space-y-2">
      <h3 className="text-lg font-bold flex items-center space-x-2">
        <span>💰</span>
        <span>Wallet</span>
      </h3>
      <ConnectWallet />
      <p>TON Balance: {tonBalance === null ? '...' : tonBalance}</p>
      <p>TPC Balance: {tpcBalance === null ? '...' : tpcBalance}</p>
      <p>USDT Balance: {usdtBalance === null ? '...' : usdtBalance}</p>
      <Link to="/wallet" className="inline-block mt-1 px-3 py-1 bg-blue-600 rounded hover:bg-blue-500">
        Open
      </Link>
    </div>
  );
}
