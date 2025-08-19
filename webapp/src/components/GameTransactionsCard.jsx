import { useEffect, useState } from 'react';
import { getAccountTransactions } from '../utils/api.js';

const GAME_ACCOUNT =
  import.meta.env.VITE_GAME_ACCOUNT_ID || import.meta.env.VITE_DEV_ACCOUNT_ID;

export default function GameTransactionsCard() {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (!GAME_ACCOUNT) return;
    getAccountTransactions(GAME_ACCOUNT)
      .then((res) => setTransactions(res.transactions || []))
      .catch(() => setTransactions([]));
  }, []);

  if (!GAME_ACCOUNT) return null;

  return (
    <section className="relative bg-surface border border-border rounded-xl p-4 shadow-lg overflow-hidden wide-card">
      <h3 className="text-lg font-semibold text-center">Games Transactions</h3>
      <ul className="mt-2 space-y-1 max-h-64 overflow-y-auto text-sm">
        {transactions.length === 0 && <li>No transactions yet.</li>}
        {transactions.map((t, i) => (
          <li key={i} className="flex justify-between">
            <span className="capitalize">{t.type}</span>
            <span>{t.amount}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

