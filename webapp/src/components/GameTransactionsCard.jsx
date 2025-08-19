import { useEffect, useState } from 'react';
import { getGameTransactions } from '../utils/api.js';

export default function GameTransactionsCard() {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    getGameTransactions()
      .then((res) => setTransactions(res.transactions || []))
      .catch(() => setTransactions([]));
  }, []);
  const Content = () => (
    <ul className="mt-2 space-y-1 max-h-64 overflow-y-auto text-sm">
      {transactions.length === 0 && <li>No transactions yet.</li>}
      {transactions.map((t, i) => (
        <li key={i} className="flex justify-between">
          <span className="capitalize">{t.type}</span>
          <span>{t.amount}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="relative bg-surface border border-border rounded-xl p-4 shadow-lg overflow-hidden wide-card">
      <h3 className="text-lg font-semibold text-center">Games Transactions</h3>
      <Content />
    </section>
  );
}
