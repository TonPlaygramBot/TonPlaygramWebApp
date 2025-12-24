import { useEffect, useState } from 'react';
import { getAccountBalance, getTonBalance } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import { useTonAddress } from '@tonconnect/ui-react';
import { ensureAccountForUser } from '../utils/account.js';

export default function useTokenBalances() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    telegramId = undefined;
  }
  const googleId = telegramId ? null : localStorage.getItem('googleId');

  const [tpcBalance, setTpcBalance] = useState(null);
  const [tonBalance, setTonBalance] = useState(null);
  const [tpcWalletBalance, setTpcWalletBalance] = useState(null);

  const walletAddress = useTonAddress(true);

  useEffect(() => {
    async function loadTpc() {
      if (!telegramId && !googleId) return;
      try {
        const acc = await ensureAccountForUser({ telegramId, googleId });
        const bal = await getAccountBalance(acc.accountId);
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
        setTpcWalletBalance(null);
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
        const res = await fetch(
          `https://tonapi.io/v2/accounts/${walletAddress}/jettons/EQDY3qbfGN6IMI5d4MsEoprhuMTz09OkqjyhPKX6DVtzbi6X`
        );
        if (!res.ok) throw new Error('request failed');
        const data = await res.json();
        const decimals = Number(data.jetton?.decimals) || 0;
        setTpcWalletBalance(Number(data.balance) / 10 ** decimals);
      } catch (err) {
        console.error('Failed to load TPC balance:', err);
        setTpcWalletBalance(0);
      }
    }
    loadExternal();
  }, [walletAddress]);

  return { tpcBalance, tonBalance, tpcWalletBalance, telegramId };
}
