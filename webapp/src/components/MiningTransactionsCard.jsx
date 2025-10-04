import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMiningTransactions } from '../utils/api.js';

export default function MiningTransactionsCard() {
  const [transactions, setTransactions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    getMiningTransactions(1000)
      .then((res) => setTransactions(res.transactions || []))
      .catch(() => setTransactions([]));
  }, []);

  const totalPayouts = transactions.reduce((s, t) => s + Math.abs(t.amount || 0), 0);
  const dailyPayouts = transactions
    .filter((t) => t.type === 'daily')
    .reduce((s, t) => s + Math.abs(t.amount || 0), 0);
  const spinPayouts = transactions
    .filter((t) => t.type === 'spin' || t.type === 'lucky' || t.type === 'roulette')
    .reduce((s, t) => s + Math.abs(t.amount || 0), 0);
  const taskPayouts = transactions
    .filter((t) => t.type === 'task')
    .reduce((s, t) => s + Math.abs(t.amount || 0), 0);

  const formatValue = (v) =>
    v.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });

  return (
    <section
      className="relative bg-surface border border-border rounded-xl p-4 shadow-lg overflow-hidden wide-card cursor-pointer"
      onClick={() => navigate('/mining/transactions')}
    >
      <h3 className="text-lg font-semibold text-center">Mining Transactions</h3>
      <div className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Total payouts</span>
          <span>{formatValue(totalPayouts)}</span>
        </div>
        <div className="flex justify-between">
          <span>Daily streaks</span>
          <span>{formatValue(dailyPayouts)}</span>
        </div>
        <div className="flex justify-between">
          <span>Spin &amp; Roulette</span>
          <span>{formatValue(spinPayouts)}</span>
        </div>
        <div className="flex justify-between">
          <span>Tasks</span>
          <span>{formatValue(taskPayouts)}</span>
        </div>
      </div>
      <div className="mt-2 text-xs text-center text-subtext">More Details</div>
    </section>
  );
}
