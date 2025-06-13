import { useEffect, useState } from 'react';
import {
  getMiningStatus,
  startMining,
  claimMining,
  getWalletBalance,
  getTonBalance
} from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import { useTonWallet } from '@tonconnect/ui-react';

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
  };

  useEffect(() => {
    refresh();
    loadBalances();
  }, [wallet]);

  const handleStart = async () => {
    setStartTime(Date.now());
    setStatus('Mining');
    await startMining(getTelegramId());
  };

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

  const autoDistributeRewards = async () => {
    await claimMining(getTelegramId());
    refresh();
    loadBalances();
  };

  if (!status) {
    return (
      <div className="bg-gray-800/60 p-4 rounded-xl shadow-lg text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="bg-gray-800/60 p-4 rounded-xl shadow-lg text-white flex justify-between">
      <div className="space-y-2">
        <h3 className="text-lg font-bold flex items-center space-x-2">
          <span>⛏</span>
          <span>Mining</span>
        </h3>
        <p>
          Status:{' '}
          <span className={status === 'Mining' ? 'text-green-500' : 'text-red-500'}>
            {status}
          </span>
        </p>
        <button
          className="px-2 py-1 bg-green-500 text-white"
          onClick={handleStart}
          disabled={status === 'Mining'}
        >
          Start
        </button>
      </div>
      <div className="text-right space-y-2">
        <p className="text-gray-300">Total Balance</p>
        <div className="flex justify-end items-center space-x-2 text-sm">
          <Token icon="/icons/ton.svg" value={balances.ton ?? '...'} />
          <Token icon="/icons/tpc.svg" value={balances.tpc ?? '...'} />
          <Token icon="/icons/usdt.svg" value={balances.usdt ?? '0'} />
        </div>
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
