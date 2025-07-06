import { useEffect, useState } from 'react';
import { getAccountBalance, getTonBalance, getUsdtBalance } from '../utils/api.js';
import { getTelegramId, ensureAccountId } from '../utils/telegram.js';
import { useTonAddress } from '@tonconnect/ui-react';

export default function useTokenBalances() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    telegramId = undefined;
  }

  const [tpcBalance, setTpcBalance] = useState(null);
  const [tonBalance, setTonBalance] = useState(null);
  const [usdtBalance, setUsdtBalance] = useState(null);

  const walletAddress = useTonAddress(true);

  useEffect(() => {
    async function loadTpc() {
      if (!telegramId) return;
      try {
        const id = await ensureAccountId();
        const bal = await getAccountBalance(id);
        if (bal?.error) throw new Error(bal.error);
        setTpcBalance(bal.balance ?? 0);
      } catch (err) {
        console.error('Failed to load TPC balance:', err);
        setTpcBalance(0);
      }
    }
    loadTpc();
  }, [telegramId]);

  useEffect(() => {
    async function loadExternal() {
      if (!walletAddress) {
        setTonBalance(null);
        setUsdtBalance(null);
        return;
      }
      try {
        const ton = await getTonBalance(walletAddress);
        if (ton?.error) throw new Error(ton.error);
        setTonBalance(ton.balance ?? 0);
      } catch (err) {
        console.error('Failed to load TON balance:', err);
        setTonBalance(0);
      }
      try {
        const usdt = await getUsdtBalance(walletAddress);
        if (usdt?.error) throw new Error(usdt.error);
        setUsdtBalance(usdt.balance ?? 0);
      } catch (err) {
        console.error('Failed to load USDT balance:', err);
        setUsdtBalance(0);
      }
    }
    loadExternal();
  }, [walletAddress]);

  return { tpcBalance, tonBalance, usdtBalance, telegramId };
}
