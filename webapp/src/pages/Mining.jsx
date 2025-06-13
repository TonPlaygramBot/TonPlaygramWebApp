import { useEffect, useState } from 'react';
import { useTonWallet } from '@tonconnect/ui-react';
import { startMining, claimMining, getWalletBalance, getTonBalance } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import Token from '../components/Token.jsx';

export default function Mining() {
  const [status, setStatus] = useState('Not Mining');
  const [startTime, setStartTime] = useState(null);
  const [balances, setBalances] = useState({ ton: null, tpc: null, usdt: 0 });
  const wallet = useTonWallet();

  const loadBalances = async () => {
    try {
      const prof = await getWalletBalance(getTelegramId());
      const ton = wallet?.account?.address
        ? (await getTonBalance(wallet.account.address)).balance
        : null;
      setBalances({ ton, tpc: prof.balance, usdt: 0 });
    } catch (err) {
      console.warn('Failed to load balances', err);
    }
  };

  useEffect(() => {
    loadBalances();
  }, [wallet]);

  useEffect(() => {
    if (status === 'Mining') {
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTime;
        const twentyFourHours = 24 * 60 * 60 * 1000;
        if (elapsed >= twentyFourHours) {
          setStatus('Not Mining');
          autoDistributeRewards();
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status, startTime]);

  const handleStart = async () => {
    setStartTime(Date.now());
    setStatus('Mining');
    try {
      await startMining(getTelegramId());
    } catch (err) {
      console.warn('Failed to start mining', err);
    }
  };

  const autoDistributeRewards = async () => {
    try {
      await claimMining(getTelegramId());
      loadBalances();
    } catch (err) {
      console.warn('Failed to distribute rewards', err);
    }
  };

  return (
    <div className="bg-[#11172a] text-white p-4 rounded-lg shadow-lg">
      <div className="text-center mb-4">
        <p className="text-gray-300 mb-2">Total Balance</p>
        <div className="flex justify-around items-center text-sm">
          <Token icon="/icons/ton.svg" value={balances.ton ?? '...'} />
          <Token icon="/icons/tpc.svg" value={balances.tpc ?? '...'} />
          <Token icon="/icons/usdt.svg" value={balances.usdt ?? '0'} />
        </div>
      </div>

      <div className="text-center mt-4">
        <p>
          Status:{' '}
          <span className={status === 'Mining' ? 'text-green-400' : 'text-red-400'}>
            {status}
          </span>
        </p>
        <button
          onClick={handleStart}
          disabled={status === 'Mining'}
          className="mt-2 bg-green-500 hover:bg-green-600 text-white px-4 py-1 rounded-full font-semibold"
        >
          Start
        </button>
      </div>
    </div>
  );
}

