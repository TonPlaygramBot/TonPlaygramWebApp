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

  // Loads balances from both TON wallet and project wallet
  const loadBalances = async () => {
    const prof = await getWalletBalance(getTelegramId());
    const ton = wallet?.account?.address
      ? (await getTonBalance(wallet.account.address)).balance
      : null;
    setBalances({ ton, tpc: prof.balance, usdt: 0 });
  };

  // Loads mining status from backend
  const refresh = async () => {
    const data = await getMiningStatus(getTelegramId());
    setStatus(data.isMining ? 'Mining' : 'Not Mining');
    if (data.isMining && data.startTime) {
      setStartTime(data.startTime);
    }
  };

  useEffect(() => {
    refresh();
    loadBalances();
    // eslint-disable-next-line
  }, [wallet]);

  // Start mining action
  const handleStart = async () => {
    setStartTime(Date.now());
    setStatus('Mining');
    await startMining(getTelegramId());
    refresh();
  };

  // Handles mining session end and auto claim
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

  const autoDistributeRewards = async () => {
    await claimMining(getTelegramId());
    refresh();
    loadBalances();
  };

  if (!status) {
    return (
      <div className="bg-gray-800/60 p-4 rounded-xl s
