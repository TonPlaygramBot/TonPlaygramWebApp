import { useEffect, useState } from 'react';
import {
  getMiningStatus,
  startMining,
  claimMining,
  getWalletBalance,
  getTonBalance
} from '../utils/api.js';
import { useTonWallet } from '@tonconnect/ui-react';
import { getTelegramId } from '../utils/telegram.js';
import OpenInTelegram from './OpenInTelegram.jsx';

export default function MiningCard() {
  let telegramId: number;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <OpenInTelegram />;
  }
  const [status, setStatus] = useState<string>('Not Mining');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [balances, setBalances] = useState<{ ton: number | null; tpc: number | null; usdt: number }>({ ton: null, tpc: null, usdt: 0 });
  const wallet = useTonWallet();

  const loadBalances = async () => {
    try {
      const prof = await getWalletBalance(telegramId);
      const ton = wallet?.account?.address ? (await getTonBalance(wallet.account.address)).balance : null;
      setBalances({ ton, tpc: prof.balance, usdt: 0 });
    } catch (err) {
      console.error('Failed to load balances:', err);
    }
  };

  const refresh = async () => {
    try {
      const data = await getMiningStatus(telegramId);
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
    await startMining(telegramId);
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
      await claimMining(telegramId);
    } catch (err) {
      console.error('Auto-claim failed:', err);
    }
    localStorage.removeItem('miningStart');
    setTimeLeft(0);
    refresh();
  };

  return (
    <div className="bg-surface border border-border p-4 rounded-xl shadow-lg text-text space-y-2">
      <h3 className="text-lg font-bold text-text flex items-center justify-center space-x-1">
        <span>⛏</span>
        <span>Mining</span>
      </h3>

      <button
        className={`w-full py-4 rounded text-white font-semibold ${status === 'Mining' ? 'bg-green-600' : 'bg-red-600'}`}
        onClick={handleStart}
        disabled={status === 'Mining'}
      >
        {status === 'Mining' ? formatTimeLeft(timeLeft) : 'Start Mining'}
      </button>
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
