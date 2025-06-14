import { useEffect, useState } from 'react';
import { useTonWallet } from '@tonconnect/ui-react';
import {
  startMining,
  claimMining,
  getWalletBalance,
  getTonBalance,
  getLeaderboard
} from '../utils/api.js';
import { getTelegramId, getTelegramPhotoUrl } from '../utils/telegram.js';
import OpenInTelegram from '../components/OpenInTelegram.jsx';

export default function Mining() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <OpenInTelegram />;
  }

  const [status, setStatus] = useState('Not Mining');
  const [startTime, setStartTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [balances, setBalances] = useState({ ton: null, tpc: null, usdt: 0 });
  const [leaderboard, setLeaderboard] = useState([]);
  const [rank, setRank] = useState(null);
  const wallet = useTonWallet();

  const loadBalances = async () => {
    try {
      const prof = await getWalletBalance(telegramId);
      const ton = wallet?.account?.address
        ? (await getTonBalance(wallet.account.address)).balance
        : null;
      setBalances({ ton, tpc: prof.balance, usdt: 0 });
    } catch (err) {
      console.error('Failed to load balances:', err);
    }
  };

  useEffect(() => {
    loadBalances();
    const saved = localStorage.getItem('miningStart');
    if (saved) {
      const start = parseInt(saved, 10);
      setStartTime(start);
      setStatus('Mining');
      const elapsed = Date.now() - start;
