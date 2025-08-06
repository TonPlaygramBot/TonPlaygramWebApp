import { useEffect, useState } from 'react';
import { createAccount, getAccountBalance } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';

export default function useTokenBalances() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    telegramId = undefined;
  }

  const [tpcBalance, setTpcBalance] = useState(null);

  useEffect(() => {
    async function loadTpc() {
      if (!telegramId) return;
      try {
        const acc = await createAccount(telegramId);
        if (acc?.error) throw new Error(acc.error);
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
  return { tpcBalance, telegramId };
}
