import { useEffect, useState } from 'react';
import { useTonWallet } from '@tonconnect/ui-react';
import { startMining, claimMining, getWalletBalance, getTonBalance } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';

export default function Mining() {
  const [status, setStatus] = useState('Not Mining');
  const [startTime, setStartTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [balances, setBalances] = useState({ ton: null, tpc: null, usdt: 0 });
  const wallet = useTonWallet();

  const loadBalances = async () => {
    const prof = await getWalletBalance(getTelegramId());
    const ton = wallet?.account?.address
      ? (await getTonBalance(wallet.account.address)).balance
      : null;
    setBalances({ ton, tpc: prof.balance, usdt: 0 });
  };

  useEffect(() => {
    loadBalances();
    const saved = localStorage.getItem('miningStart');
    if (saved) {
      const start = parseInt(saved, 10);
      setStartTime(start);
      setStatus('Mining');
      const elapsed = Date.now() - start;
      const twelveHours = 12 * 60 * 60 * 1000;
      setTimeLeft(Math.max(0, twelveHours - elapsed));
    }
  }, [wallet]);

  useEffect(() => {
    if (status === 'Mining') {
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTime;
        const twelveHours = 12 * 60 * 60 * 1000;
        setTimeLeft(Math.max(0, twelveHours - elapsed));
        if (elapsed >= twelveHours) {
          setStatus('Not Mining');
          autoDistributeRewards();
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status, startTime]);

  const handleStart = async () => {
    const now = Date.now();
    setStartTime(now);
    setTimeLeft(12 * 60 * 60 * 1000);
    localStorage.setItem('miningStart', String(now));
    setStatus('Mining');
    await startMining(getTelegramId());
  };

  const autoDistributeRewards = async () => {
    await claimMining(getTelegramId());
    localStorage.removeItem('miningStart');
    setTimeLeft(0);
    loadBalances();
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

      <div className="flex items-center justify-between mt-4">
        <button
          onClick={handleStart}
          disabled={status === 'Mining'}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-1 rounded-full font-semibold disabled:opacity-50"
        >
          Start
        </button>
        <p>
          Status:{' '}
          <span className={status === 'Mining' ? 'text-green-400' : 'text-red-400'}>
            {status}
            {status === 'Mining' && ` - ${formatTimeLeft(timeLeft)}`}
          </span>
        </p>
      </div>
    </div>
  );
}

function Token({ icon, value }) {
  return (
    <div className="flex items-center space-x-1">
      <img src={icon} alt="token" className="w-5 h-5" />
      <span>{value}</span>
    </div>
  );
}

function formatTimeLeft(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return (
    hours.toString().padStart(2, '0') +
    ':' +
    minutes.toString().padStart(2, '0') +
    ':' +
    seconds.toString().padStart(2, '0')
  );
}
