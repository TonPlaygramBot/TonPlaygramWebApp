import { useEffect, useState } from 'react';
import {
  getWalletBalance,
  sendTpc,
  getTransactions,
  resetTpcWallet
} from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import OpenInTelegram from '../components/OpenInTelegram.jsx';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';

export default function Wallet() {
  useTelegramBackButton();
  let telegramId;

  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <OpenInTelegram />;
  }

  const [tpcBalance, setTpcBalance] = useState(null);
  const [receiver, setReceiver] = useState('');
  const [amount, setAmount] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState(null);


  const loadBalances = async () => {
    const prof = await getWalletBalance(telegramId);
    if (prof?.error || typeof prof.balance !== 'number') {
      console.error('Failed to load TPC balance:', prof?.error);
      setTpcBalance(0);
    } else {
      setTpcBalance(prof.balance);
    }

  };

  useEffect(() => {
    loadBalances();
    getTransactions(telegramId).then((res) => setTransactions(res.transactions));
  }, []);

  const handleSend = async () => {
    const amt = Number(amount);
    if (!receiver || !amt) return;
    if (!window.confirm(`Send ${amt} TPC to ${receiver}?`)) return;
    setSending(true);
    try {
      const res = await sendTpc(telegramId, Number(receiver), amt);
      if (res?.error) {
        alert(res.error);
        return;
      }
      setReceipt({
        to: receiver,
        amount: amt,
        date: res.transaction?.date
          ? new Date(res.transaction.date).toLocaleString()
          : new Date().toLocaleString()
      });
      setReceiver('');
      setAmount('');
      await loadBalances();
      const txRes = await getTransactions(telegramId);
      setTransactions(txRes.transactions);
    } catch (err) {
      console.error('Send failed', err);
      alert('Failed to send TPC');
    } finally {
      setSending(false);
    }
  };


  const handleResetTpc = async () => {
    if (!window.confirm('Reset your TPC wallet? This will delete all balance and transactions.')) return;
    const res = await resetTpcWallet(telegramId);
    if (res?.error) {
      alert(res.error);
      return;
    }
    setTpcBalance(0);
    setTransactions([]);
  };


  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Wallet</h2>
      <p className="text-sm">Account #{telegramId}</p>

      {/* TPC account section */}
      <div className="space-y-2 border-b border-border pb-4">
        <h3 className="text-lg font-semibold">TPC Account Wallet</h3>
        <p>TPC Balance: {tpcBalance === null ? '...' : tpcBalance}</p>

        <div className="space-y-1">
          <label className="block">Send TPC</label>
          <input
            type="number"
            placeholder="Receiver Telegram ID"
            value={receiver}
            onChange={(e) => setReceiver(e.target.value)}
            className="border p-1 rounded w-full text-black"
          />
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="border p-1 rounded w-full mt-1 text-black"
          />
          <button
            onClick={handleSend}
            className="mt-1 px-3 py-1 bg-blue-600 text-white rounded"
          >
            Send
          </button>
          {sending && (
            <div className="mt-1">
              <div className="h-1 bg-primary animate-pulse" />
              <div className="text-sm text-subtext">Sending...</div>
            </div>
          )}
          {receipt && (
            <div className="border border-border p-2 rounded mt-2 text-sm flex justify-between items-center">
              <div>
                <div>Sent {receipt.amount} TPC to {receipt.to}</div>
                <div className="text-xs">{receipt.date}</div>
                <div className="text-xs text-green-600">Delivered</div>
              </div>
              <button className="text-xs" onClick={() => setReceipt(null)}>x</button>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="block">Receive TPC</label>
          <button
            onClick={() => navigator.clipboard.writeText(String(telegramId))}
            className="px-3 py-1 bg-green-600 text-white rounded"
          >
            Copy Account Number
          </button>
          <button
            onClick={handleResetTpc}
            className="mt-1 px-3 py-1 bg-red-600 text-white rounded"
          >
            Reset TPC Wallet
          </button>
        </div>
      </div>


      <div className="mt-4">
        <h3 className="font-semibold">Transactions</h3>
        <div className="space-y-1 text-sm">
          {transactions.map((tx, i) => (
            <div
              key={i}
              className="flex justify-between border-b border-border pb-1"
            >
              <span>{tx.type}</span>
              <span>{tx.amount}</span>
              <span>{new Date(tx.date).toLocaleString()}</span>
              <span className="text-xs">{tx.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
