import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import {
  createAccount,
  getAccountBalance,
  sendAccountTpc,
  getAccountTransactions
} from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import LoginOptions from '../components/LoginOptions.jsx';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';

export default function Wallet() {
  useTelegramBackButton();
  let telegramId;

  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }

  const [accountId, setAccountId] = useState('');
  const [tpcBalance, setTpcBalance] = useState(null);
  const [receiver, setReceiver] = useState('');
  const [amount, setAmount] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState(null);


  const loadBalances = async () => {
    const acc = await createAccount(telegramId);
    if (acc?.error) {
      console.error('Failed to load account:', acc.error);
      return null;
    }
    setAccountId(acc.accountId);

    const bal = await getAccountBalance(acc.accountId);
    if (bal?.error || typeof bal.balance !== 'number') {
      console.error('Failed to load TPC balance:', bal?.error);
      setTpcBalance(0);
    } else {
      setTpcBalance(bal.balance);
    }
    return acc.accountId;
  };

  useEffect(() => {
    loadBalances().then(async (id) => {
      if (id) {
        const txRes = await getAccountTransactions(id);
        setTransactions(txRes.transactions || []);
      }
    });
  }, []);

  const handleSend = async () => {
    const amt = Number(amount);
    if (!receiver || !amt) return;
    if (!window.confirm(`Send ${amt} TPC to ${receiver}?`)) return;
    setSending(true);
    try {
      const res = await sendAccountTpc(accountId, receiver, amt);
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
      const id = await loadBalances();
      const txRes = await getAccountTransactions(id || accountId);
      setTransactions(txRes.transactions || []);
    } catch (err) {
      console.error('Send failed', err);
      alert('Failed to send TPC');
    } finally {
      setSending(false);
    }
  };




  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Wallet</h2>
      <p className="text-sm">Account #{accountId || '...'}</p>

      {/* TPC account section */}
      <div className="space-y-2 border-b border-border pb-4">
        <h3 className="text-lg font-semibold">TPC Account Wallet</h3>
        <p>TPC Balance: {tpcBalance === null ? '...' : tpcBalance}</p>

        <div className="space-y-1">
          <label className="block">Send TPC</label>
          <input
            type="number"
            placeholder="Receiver Account ID"
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
            className="mt-1 px-3 py-1 bg-primary hover:bg-primary-hover text-text rounded"
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
            onClick={() => navigator.clipboard.writeText(String(accountId))}
            className="px-3 py-1 bg-primary hover:bg-primary-hover text-text rounded"
          >
            Copy Account Number
          </button>
          {accountId && (
            <div className="mt-2 flex justify-center">
              <QRCode value={String(accountId)} size={100} />
            </div>
          )}
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
              <span className={tx.amount > 0 ? 'text-green-500' : 'text-red-500'}>
                {tx.amount}
              </span>
              <span>{new Date(tx.date).toLocaleString()}</span>
              <span className="text-xs">{tx.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
