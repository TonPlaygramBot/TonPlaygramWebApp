import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import {
  createAccount,
  getAccountBalance,
  sendAccountTpc,
  getAccountTransactions
} from '../utils/api.js';
import ConfirmPopup from '../components/ConfirmPopup.jsx';
import InfoPopup from '../components/InfoPopup.jsx';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';

export default function Wallet() {
  useTelegramBackButton();

  const [accountId, setAccountId] = useState(() => localStorage.getItem('accountId') || '');
  const [tpcBalance, setTpcBalance] = useState(null);
  const [receiver, setReceiver] = useState('');
  const [amount, setAmount] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');


  const loadBalances = async () => {
    let id = accountId;
    if (!id) {
      const acc = await createAccount();
      if (acc?.error) {
        console.error('Failed to load account:', acc.error);
        return null;
      }
      id = acc.accountId;
      localStorage.setItem('accountId', id);
    }
    setAccountId(id);

    const bal = await getAccountBalance(id);
    if (bal?.error || typeof bal.balance !== 'number') {
      console.error('Failed to load TPC balance:', bal?.error);
      setTpcBalance(0);
    } else {
      setTpcBalance(bal.balance);
    }
    return id;
  };

  useEffect(() => {
    loadBalances().then(async (id) => {
      if (id) {
        const txRes = await getAccountTransactions(id);
        setTransactions(txRes.transactions || []);
      }
    });
  }, []);

  const handleSendClick = () => {
    const to = receiver.trim();
    const amt = Number(amount);
    if (!to || !amt) return;
    setConfirmOpen(true);
  };

  const handleSend = async () => {
    const to = receiver.trim();
    const amt = Number(amount);
    if (!to || !amt) return;
    setConfirmOpen(false);
    setSending(true);
    try {
      const res = await sendAccountTpc(accountId, to, amt);
      if (res?.error) {
        if (res.error === 'unauthorized' || res.error === 'forbidden') {
          setErrorMsg('Authorization failed.');
        } else {
          setErrorMsg(res.error);
        }
        return;
      }
      setReceipt({
        to,
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
      setErrorMsg('Failed to send TPC');
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
            type="text"
            placeholder="Receiver Account Number"
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
            onClick={handleSendClick}
            className="mt-1 px-3 py-1 bg-primary hover:bg-primary-hover text-text rounded"
          >
            Send
          </button>
          {sending && (
            <div className="mt-1">
              <div className="h-1 bg-green-500 animate-pulse" />
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

      <ConfirmPopup
        open={confirmOpen}
        message={`Send ${Number(amount)} TPC to ${receiver.trim()}?`}
        onConfirm={handleSend}
        onCancel={() => setConfirmOpen(false)}
      />

      <InfoPopup
        open={Boolean(errorMsg)}
        onClose={() => setErrorMsg('')}
        title="Transaction Failed"
        info={errorMsg}
      />
    </div>
  );
}
