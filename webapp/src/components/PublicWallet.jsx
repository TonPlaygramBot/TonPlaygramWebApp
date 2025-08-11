import { useEffect, useState } from 'react';
import { getAccountBalance, getAccountTransactions } from '../utils/api.js';
import TransactionDetailsPopup from './TransactionDetailsPopup.jsx';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';

function formatValue(value, decimals = 2) {
  if (typeof value !== 'number') {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return value;
    return parsed.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function PublicWallet({ title, accountId }) {
  useTelegramBackButton();
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [selectedTx, setSelectedTx] = useState(null);

  useEffect(() => {
    if (!accountId) return;
    getAccountBalance(accountId).then((b) => {
      if (b && typeof b.balance === 'number') {
        setBalance(b.balance);
      } else {
        setBalance(0);
      }
    });
    getAccountTransactions(accountId).then((tx) => {
      setTransactions(tx.transactions || []);
    });
  }, [accountId]);

  return (
    <div className="relative space-y-4 text-text">
      <h2 className="text-2xl font-bold text-center mt-4">{title}</h2>

      <div className="bg-surface border border-border rounded-xl p-4 space-y-2 text-center wide-card">
        <h3 className="font-semibold">TPC Balance</h3>
        <div>{balance === null ? '...' : formatValue(balance)}</div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 space-y-2 text-center mt-4 wide-card">
        <h3 className="font-semibold text-center">TPC Statements</h3>
        <div className="space-y-1 text-sm max-h-[40rem] overflow-y-auto border border-border rounded">
          {transactions.map((tx, i) => (
            <div
              key={i}
              className="lobby-tile w-full flex flex-col cursor-pointer"
              onClick={() => setSelectedTx(tx)}
            >
              <div className="flex justify-between">
                <span className="capitalize">{tx.game || tx.type}</span>
                <span className={tx.amount > 0 ? 'text-green-500' : 'text-red-500'}>
                  {tx.amount > 0 ? '+' : '-'}
                  {formatValue(Math.abs(tx.amount))} {(tx.token || 'TPC').toUpperCase()}
                </span>
              </div>
              {(tx.fromAccount || tx.fromName) && (
                <div className="text-xs text-subtext">
                  {tx.fromName ? `${tx.fromName} ` : ''}
                  {tx.fromAccount ? `#${tx.fromAccount}` : ''}
                </div>
              )}
              {tx.toAccount && tx.game && (
                <div className="text-xs text-subtext">To #{tx.toAccount}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <TransactionDetailsPopup tx={selectedTx} onClose={() => setSelectedTx(null)} />
    </div>
  );
}
