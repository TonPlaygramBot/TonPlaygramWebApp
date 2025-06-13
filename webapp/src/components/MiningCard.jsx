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

export default function MiningCard() {
  const [status, setStatus] = useState('Not Mining');
  const [startTime, setStartTime] = useState(null);
  const [balances, setBalances] = useState({ ton: null, tpc: null, usdt: 0 });
  const wallet = useTonWallet();

  const loadBalances = async () => {
    const prof = await getWalletBalance(getTelegramId());
    const ton = wallet?.account?.address
      ? (await getTonBalance(wallet.account.address)).balance
      : null;
    setBalances({ ton, tpc: prof.balance, usdt: 0 });
  };

  const refresh = async () => {
    const data = await getMiningStatus(getTelegramId());
    setStatus(data.isMining ? 'Mining' : 'Not Mining');
    loadBalances();
  };

  useEffect(() => {
    refresh();
    const saved = localStorage.getItem('miningStart');
    if (saved) {
      setStartTime(parseInt(saved, 10));
      setStatus('Mining');
    }
  }, [wallet]);

  const handleStart = async () => {
    const now = Date.now();
    setStartTime(now);
    localStorage.setItem('miningStart', String(now));
    setStatus('Mining');
    await startMining(getTelegramId());
    loadBalances();
  };

  useEffect(() => {
    if (status === 'Mining') {
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTime;
        const twelveHours = 12 * 60 * 60 * 1000;
        if (elapsed >= twelveHours) {
          setStatus('Not Mining');
          autoDistributeRewards();
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status, startTime]);

  const autoDistributeRewards = async () => {
    await claimMining(getTelegramId());
    localStorage.removeItem('miningStart');
    refresh();
  };

  if (!status) {
    return (
      <div className="bg-gray-800/60 p-4 rounded-xl shadow-lg text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="bg-gray-800/60 p-4 rounded-xl shadow-lg text-white space-y-2">
      <h3 className="text-lg font-bold flex items-center space-x-2">
        <span>⛏</span>
        <span>Mining</span>
      </h3>
      <p>
        Status{' '}
        <span className={status === 'Mining' ? 'text-green-500' : 'text-red-500'}>
          {status}
        </span>
      </p>
      <div className="flex justify-around text-xs">
        <Token icon="/icons/ton.svg" value={balances.ton ?? '...'} />
        <Token icon="/icons/tpc.svg" value={balances.tpc ?? '...'} />
        <Token icon="/icons/usdt.svg" value={balances.usdt ?? '0'} />
      </div>
      <div>
        <button className="px-2 py-1 bg-green-500 text-white" onClick={handleStart} disabled={status === 'Mining'}>
          Start
        </button>
      </div>
    </div>
  );
}

function Token({ icon, value }) {
  return (
    <div className="flex items-center space-x-1">
      <img src={icon} alt="token" className="w-4 h-4" />
      <span>{value}</span>
    </div>
  );
}
