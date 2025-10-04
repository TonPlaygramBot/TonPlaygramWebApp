import { useEffect, useState } from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import { getMiningTransactions } from '../utils/api.js';
import { getAvatarUrl } from '../utils/avatarUtils.js';

const TYPE_NAME_MAP = {
  daily: 'Daily Streak',
  spin: 'Spin & Win',
  lucky: 'Lucky Card',
  roulette: 'Roulette Spin',
  task: 'Task'
};

export default function MiningTransactions() {
  useTelegramBackButton();
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    getMiningTransactions(1000)
      .then((res) => setTransactions(res.transactions || []))
      .catch(() => setTransactions([]));
  }, []);

  const formatValue = (v) =>
    Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  return (
    <div className="relative space-y-4 text-text">
      <h2 className="text-2xl font-bold text-center mt-4">Mining Transactions</h2>
      <div className="bg-surface border border-border rounded-xl p-4 shadow-lg space-y-1 text-sm">
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
      <div className="space-y-1 text-sm max-h-[40rem] overflow-y-auto border border-border rounded">
        {transactions.length === 0 && <div className="p-2">No transactions yet.</div>}
        {transactions.map((tx, i) => {
          const avatarSrc = tx.fromPhoto || tx.photo || '';
          const avatarUrl = avatarSrc ? getAvatarUrl(avatarSrc) : '/assets/icons/profile.svg';
          const category = TYPE_NAME_MAP[tx.type] || tx.type;
          const token = (tx.token || 'TPC').toUpperCase();
          const iconMap = {
            TPC: '/assets/icons/ezgif-54c96d8a9b9236.webp',
            TON: '/assets/icons/TON.webp',
            USDT: '/assets/icons/Usdt.webp'
          };
          const icon = iconMap[token] || `/assets/icons/${token}.webp`;
          return (
            <div key={i} className="lobby-tile w-full flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <img src={avatarUrl} alt="avatar" className="w-8 h-8 rounded-full" />
                <div>
                  <div className="font-semibold">{tx.fromName || tx.accountId}</div>
                  {category && <div className="text-xs text-subtext">{category}</div>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-green-500">
                  +{formatValue(tx.amount)}
                  <img src={icon} alt={token} className="inline w-4 h-4 ml-1" />
                </div>
                <div className="text-xs">
                  {tx.date ? new Date(tx.date).toLocaleString(undefined, { hour12: false }) : ''}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
