import { useEffect, useState } from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import { getGameTransactions } from '../utils/api.js';

export default function GameTransactions() {
  useTelegramBackButton();
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    getGameTransactions()
      .then((res) => setTransactions(res.transactions || []))
      .catch(() => setTransactions([]));
  }, []);

  const formatValue = (v) =>
    Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="relative space-y-4 text-text">
      <h2 className="text-2xl font-bold text-center mt-4">Game Transactions</h2>
      <div className="space-y-1 text-sm max-h-[40rem] overflow-y-auto border border-border rounded">
        {transactions.length === 0 && <div className="p-2">No transactions yet.</div>}
        {transactions.map((tx, i) => (
          <div key={i} className="lobby-tile w-full flex justify-between items-center">
            <div>
              <div className="capitalize">{tx.type}</div>
              <div className="text-xs text-subtext">
                {tx.fromName || tx.fromAccount} → {tx.toName || tx.toAccount}
              </div>
            </div>
            <div className="text-right">
              <div className={tx.amount > 0 ? 'text-green-500' : 'text-red-500'}>
                {tx.amount > 0 ? '+' : ''}
                {formatValue(tx.amount)} {(tx.token || 'TPC').toUpperCase()}
              </div>
              <div className="text-xs">
                {tx.date ? new Date(tx.date).toLocaleString(undefined, { hour12: false }) : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
