import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameTransactions } from '../utils/api.js';

export default function GameTransactionsCard() {
  const [transactions, setTransactions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    getGameTransactions()
      .then((res) => setTransactions(res.transactions || []))
      .catch(() => setTransactions([]));
  }, []);

  const games = transactions.filter((t) => t.game);
  const totalGames = games.length;
  const totalDeposited = games
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount || 0), 0);
  const totalPayouts = games
    .filter((t) => t.amount > 0)
    .reduce((s, t) => s + Math.abs(t.amount || 0), 0);

  const formatValue = (v) =>
    v.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });

  return (
    <section
      className="relative bg-surface border border-border rounded-xl p-4 shadow-lg overflow-hidden wide-card cursor-pointer"
      onClick={() => navigate('/games/transactions')}
    >
      <h3 className="text-lg font-semibold text-center">Games Transactions</h3>
      <div className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Total games played</span>
          <span>{totalGames}</span>
        </div>
        <div className="flex justify-between">
          <span>Total payouts</span>
          <span>{formatValue(totalPayouts)}</span>
        </div>
        <div className="flex justify-between">
          <span>Total deposited</span>
          <span>{formatValue(totalDeposited)}</span>
        </div>
      </div>
      <div className="mt-2 text-xs text-center text-subtext">More Details</div>
    </section>
  );
}
