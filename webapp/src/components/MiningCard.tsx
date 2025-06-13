import { useEffect, useState } from 'react';
import { FaWallet } from 'react-icons/fa';
import {
  getMiningStatus,
  startMining,
  claimMining,
  getWalletBalance,
  getTonBalance
} from '../utils/api.js';
import { useTonWallet } from '@tonconnect/ui-react';
import { getTelegramId } from '../utils/telegram.js';

export default function MiningCard() {
  const [status, setStatus] = useState<string>('Not Mining');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [balances, setBalances] = useState<{ ton: number | null; tpc: number | null; usdt: number }>({ ton: null, tpc: null, usdt: 0 });
  const wallet = useTonWallet();

  const loadBalances = async () => {
    try {
      const prof = await getWalletBalance(getTelegramId());
      const ton = wallet?.account?.address ? (await getTonBalance(wallet.account.address)).balance : null;
      setBalances({ ton, tpc: prof.balance, usdt: 0 });
    } catch (err) {
      console.error('Failed to load balances:', err);
    }
  };

  const refresh = async () => {
    try {
      const data = await getMiningStatus(getTelegramId());
      setStatus(data.isMining ? 'Mining' : 'Not Mining');
    } catch (err) {
      console.warn('Mining status check failed, loading balances anyway.');
    }
    loadBalances();
  };

  useEffect(() => {
    refresh();
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

  const handleStart = async () => {
    const now = Date.now();
    setStartTime(now);
    setTimeLeft(12 * 60 * 60 * 1000);
    localStorage.setItem('miningStart', String(now));
    setStatus('Mining');
    await startMining(getTelegramId());
    loadBalances();
  };

  useEffect(() => {
    if (status === 'Mining') {
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - (startTime ?? now);
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

  const autoDistributeRewards = async () => {
    try {
      await claimMining(getTelegramId());
    } catch (err) {
      console.error('Auto-claim failed:', err);
    }
    localStorage.removeItem('miningStart');
    setTimeLeft(0);
    refresh();
  };

  return (
    <div className="bg-gray-800/60 p-4 rounded-xl shadow-lg text-white space-y-2">
      <h3 className="text-lg font-bold flex items-center space-x-2">
        <span>⛏</span>
        <span>Mining</span>
      </h3>

      <div className="flex items-center justify-between text-sm">
        <button
          className="px-2 py-1 bg-green-500 text-white rounded disabled:opacity-50"
          onClick={handleStart}
          disabled={status === 'Mining'}
        >
          Start
        </button>
        <p className="text-accent font-medium">
          {status === 'Mining' ? formatTimeLeft(timeLeft) : '00:00:00'}
        </p>
        <p>
          Status{' '}
          <span className={status === 'Mining' ? 'text-green-500' : 'text-red-500'}>
            {status}
          </span>
        </p>
      </div>

      <p className="text-lg font-bold text-gray-300 flex items-center space-x-1">
        <FaWallet />
        <span>Total Balance</span>
      </p>
      <div className="flex justify-around text-sm mb-2">
        <Token icon="/icons/ton.svg" label="TON" value={balances.ton ?? '...'} />
        <Token icon="/icons/tpc.svg" label="TPC" value={balances.tpc ?? '...'} />
        <Token icon="/icons/usdt.svg" label="USDT" value={balances.usdt ?? '0'} />
      </div>
    </div>
  );
}

interface TokenProps {
  icon: string;
  value: string | number | null;
  label: string;
}

function Token({ icon, value, label }: TokenProps) {
  return (
    <div className="flex items-center space-x-1">
      <img src={icon} alt={label} className="w-4 h-4" />
      <span className="text-base">{value}</span>
    </div>
  );
}

function formatTimeLeft(ms: number) {
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
