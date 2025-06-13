import { useEffect, useState } from 'react';
import { tonToTpc, tpcToTon } from '../utils/tokenomics.js';
import { getWalletBalance, getTonBalance } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import ConnectWallet from '../components/ConnectWallet.jsx';
import { useTonWallet } from '@tonconnect/ui-react';

export default function Wallet() {
  const [ton, setTon] = useState('');
  const [tpc, setTpc] = useState('');
  const [tonBalance, setTonBalance] = useState(null);
  const [tpcBalance, setTpcBalance] = useState(null);
  const wallet = useTonWallet();

  const loadBalances = async () => {
    try {
      const prof = await getWalletBalance(getTelegramId());
      setTpcBalance(prof.balance);
      if (wallet?.account?.address) {
        const bal = await getTonBalance(wallet.account.address);
        setTonBalance(bal.balance);
      }
    } catch (err) {
      console.warn('Failed to load balances', err);
    }
  };

  useEffect(() => {
    loadBalances();
  }, [wallet]);

  const handleTonChange = (e) => {
    const value = e.target.value;
    setTon(value);
    setTpc(value ? tonToTpc(Number(value)) : '');
  };

  const handleTpcChange = (e) => {
    const value = e.target.value;
    setTpc(value);
    setTon(value ? tpcToTon(Number(value)) : '');
  };

  return (
    <div className="p-4 space-y-2">
      <h2 className="text-xl font-bold">Wallet</h2>
      <ConnectWallet />
      <p>TON Balance: {tonBalance === null ? '...' : tonBalance}</p>
      <p>TPC Balance: {tpcBalance === null ? '...' : tpcBalance}</p>
      <div className="space-y-1">
        <label className="block">TON</label>
        <input
          type="number"
          value={ton}
          onChange={handleTonChange}
          className="border p-1 rounded w-full"
        />
      </div>
      <div className="space-y-1">
        <label className="block">TPC</label>
        <input
          type="number"
          value={tpc}
          onChange={handleTpcChange}
          className="border p-1 rounded w-full"
        />
      </div>
    </div>
  );
}
