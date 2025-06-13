import { useEffect, useState } from 'react';
import { useTonWallet } from '@tonconnect/ui-react';
import {
  startMining,
  claimMining,
  getWalletBalance,
  getTonBalance,
  getMiningStatus
} from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';

export default function Mining() {
  const [status, setStatus] = useState('Not Mining');
  const [startTime, setStartTime] = useState(null);
  const [balances, setBalances] = useState({ ton: null, tpc: null, usdt: 0 });
  const wallet = useTonWallet();

  const refreshStatus = async () => {
    const data = await getMiningStatus(getTelegramId());
    setStatus(data.isMining ? 'Mining' : 'Not Mining');
    if (data.isMining && data.startTime) setStartTime(data.startTime);
  };

  const loadBalances = async () => {
    const prof = await getWalletBalance(getTelegramId());
    const ton = wallet?.account?.address
      ? (await getTonBalance(wallet.account.address)).balance
      : null;
    setBalances({ ton, tpc: prof.balance, usdt: 0 });
  };

  useEffect(() => {
    loadBalances();
    refreshStatus();
    // eslint-disable-next-line
  }, [wallet]);

  useEffect(() => {
    if (status === 'Mining' && startTime) {
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
    // eslint-disable-next-line
  }, [status, startTime]);

  const handleStart = async () => {
    setStartTime(Date.now());
    setStatus('Mining');
    await startMining(getTelegramId());
    refreshStatus();
  };

  const autoDistributeRewards = async () => {
    await claimMining(getTelegramId());
    loadBalances();
    refreshStatus();
  };

  return (
    <div className="bg-[#11172a] text-white p-4 rounded-lg shadow-lg">
      <div className="text-center mb-4">
        <p className="text-gray-300 mb-2">Total Balance</p>
        <div className="flex justify-around items-center text
