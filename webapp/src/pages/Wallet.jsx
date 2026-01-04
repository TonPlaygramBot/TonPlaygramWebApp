import { useEffect, useState, useRef } from 'react';
import QRCode from 'react-qr-code';
import {
  createAccount,
  getAccountBalance,
  sendAccountTpc,
  getAccountTransactions,
  depositAccount
} from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import { STORE_ADDRESS } from '../utils/storeData.js';
import ConfirmPopup from '../components/ConfirmPopup.jsx';
import InfoPopup from '../components/InfoPopup.jsx';
import TransactionDetailsPopup from '../components/TransactionDetailsPopup.jsx';
import NftGiftCard from '../components/NftGiftCard.jsx';
import { AiOutlineCalendar } from 'react-icons/ai';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import { loadGoogleProfile } from '../utils/google.js';
import LoginOptions from '../components/LoginOptions.jsx';
import { useTonAddress, useTonWallet } from '@tonconnect/ui-react';

const urlParams = new URLSearchParams(window.location.search);
const DEV_ACCOUNT_ID =
  urlParams.get('dev') ||
  localStorage.getItem('devAccountId') ||
  import.meta.env.VITE_DEV_ACCOUNT_ID;
const DEV_ACCOUNT_ID_1 = import.meta.env.VITE_DEV_ACCOUNT_ID_1;
const DEV_ACCOUNT_ID_2 = import.meta.env.VITE_DEV_ACCOUNT_ID_2;
const DEV_ACCOUNTS = [
  DEV_ACCOUNT_ID,
  DEV_ACCOUNT_ID_1,
  DEV_ACCOUNT_ID_2,
].filter(Boolean);
if (urlParams.get('dev')) {
  localStorage.setItem('devAccountId', urlParams.get('dev'));
}

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

export default function Wallet({ hideClaim = false }) {
  useTelegramBackButton();
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    telegramId = undefined;
  }
  const [googleProfile, setGoogleProfile] = useState(() => (telegramId ? null : loadGoogleProfile()));
  const tonAddress = useTonAddress(true);
  const tonWallet = useTonWallet();
  if (!telegramId && !googleProfile?.id && !tonAddress) {
    return <LoginOptions onAuthenticated={setGoogleProfile} />;
  }

  const [accountId, setAccountId] = useState('');
  const [tpcBalance, setTpcBalance] = useState(null);
  const [receiver, setReceiver] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [devShare, setDevShare] = useState(0);
  const [feeShare, setFeeShare] = useState(0);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupSending, setTopupSending] = useState(false);
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedTx, setSelectedTx] = useState(null);
  const dateInputRef = useRef(null);

  const txTypes = Array.from(
    new Set(
      transactions.map((t) => {
        if (t.type === 'gift') return 'gift-sent';
        if (t.type === 'gift-receive') return 'gift-received';
        if (t.type === 'gift-fee') return 'gift-fee';
        return t.type;
      })
    )
  ).filter(Boolean);


  const loadBalances = async () => {
    const devMode = urlParams.get('dev') || localStorage.getItem('devAccountId');
    let id = devMode ? DEV_ACCOUNT_ID : localStorage.getItem('accountId');
    let acc;
    if (id) {
      acc = { accountId: id };
    } else {
      acc = await createAccount(telegramId, googleProfile, undefined, {
        address: tonAddress || undefined,
        publicKey: tonWallet?.account?.publicKey
      });
      if (acc?.error) {
        console.error('Failed to load account:', acc.error);
        return null;
      }
      localStorage.setItem('accountId', acc.accountId);
      if (acc.walletAddress) {
        localStorage.setItem('walletAddress', acc.walletAddress);
      }
      id = acc.accountId;
    }
    setAccountId(acc.accountId || id);

    const bal = await getAccountBalance(acc.accountId || id);
    if (bal?.error || typeof bal.balance !== 'number') {
      console.error('Failed to load TPC balance:', bal?.error);
      setTpcBalance(0);
    } else {
      setTpcBalance(bal.balance);
    }
    return acc.accountId || id;
  };

  useEffect(() => {
    loadBalances().then(async (id) => {
      if (id) {
        const txRes = await getAccountTransactions(id);
        const list = txRes.transactions || [];
        setTransactions(list);
        if (DEV_ACCOUNTS.includes(id)) {
          const gameSum = list
            .filter((t) => t.type === 'deposit' && t.game)
            .reduce((s, t) => s + (t.amount || 0), 0);
          const feeSum = list
            .filter((t) => t.type === 'fee')
            .reduce((s, t) => s + (t.amount || 0), 0);
          setDevShare(gameSum);
          setFeeShare(feeSum);
        }
      }
    });
  }, [tonAddress, tonWallet?.account?.publicKey]);

  useEffect(() => {
    if (DEV_ACCOUNTS.includes(accountId)) {
      const gameSum = transactions
        .filter((t) => t.type === 'deposit' && t.game)
        .reduce((s, t) => s + (t.amount || 0), 0);
      const feeSum = transactions
        .filter((t) => t.type === 'fee')
        .reduce((s, t) => s + (t.amount || 0), 0);
      setDevShare(gameSum);
      setFeeShare(feeSum);
    }
  }, [transactions, accountId]);

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
    const res = await sendAccountTpc(accountId, to, amt, note.trim());
      if (res?.error) {
        if (res.error === 'unauthorized' || res.error === 'forbidden') {
          setErrorMsg(
            'Authorization failed. Make sure you opened this page from Telegram and that your bot token is correct.'
          );
        } else {
          setErrorMsg(res.error);
        }
        return;
      }
      setReceipt(res.transaction);
      setReceiver('');
      setAmount('');
      setNote('');
      const id = await loadBalances();
      const txRes = await getAccountTransactions(id || accountId);
      const list = txRes.transactions || [];
      setTransactions(list);
      if (DEV_ACCOUNTS.includes(id || accountId)) {
        const gameSum = list
          .filter((t) => t.type === 'deposit' && t.game)
          .reduce((s, t) => s + (t.amount || 0), 0);
        const feeSum = list
          .filter((t) => t.type === 'fee')
          .reduce((s, t) => s + (t.amount || 0), 0);
        setDevShare(gameSum);
        setFeeShare(feeSum);
      }
    } catch (err) {
      console.error('Send failed', err);
      setErrorMsg('Failed to send TPC');
    } finally {
      setSending(false);
    }
  };

  const handleTopup = async () => {
    const amt = Number(topupAmount);
    if (!amt) return;
    setTopupSending(true);
    try {
      const res = await depositAccount(accountId, amt);
      if (res?.error) {
        setErrorMsg(res.error);
        return;
      }
      setTopupAmount('');
      const id = await loadBalances();
      const txRes = await getAccountTransactions(id || accountId);
      const list = txRes.transactions || [];
      setTransactions(list);
      if (DEV_ACCOUNTS.includes(id || accountId)) {
        const gameSum = list
          .filter((t) => t.type === 'deposit' && t.game)
          .reduce((s, t) => s + (t.amount || 0), 0);
        const feeSum = list
          .filter((t) => t.type === 'fee')
          .reduce((s, t) => s + (t.amount || 0), 0);
        setDevShare(gameSum);
        setFeeShare(feeSum);
      }
    } catch (err) {
      console.error('Top up failed', err);
      setErrorMsg('Failed to top up');
    } finally {
      setTopupSending(false);
    }
  };


  const filteredTransactions = transactions.filter((tx) => {
    if (filterDate) {
      const d = new Date(tx.date).toISOString().slice(0, 10);
      if (d !== filterDate) return false;
    }
    if (filterType) {
      if (filterType === 'gift-sent' && tx.type !== 'gift') {
        return false;
      }
      if (filterType === 'gift-received' && tx.type !== 'gift-receive') {
        return false;
      }
      if (filterType === 'gift-fee' && tx.type !== 'gift-fee') {
        return false;
      }
      if (
        !['gift-sent', 'gift-received', 'gift-fee'].includes(filterType) &&
        tx.type !== filterType
      ) {
        return false;
      }
    }
    if (filterUser) {
      const q = filterUser.toLowerCase();
      const name = (tx.fromName || tx.toName || '').toLowerCase();
      const account = tx.fromAccount || tx.toAccount || '';
      if (!name.includes(q) && !String(account).includes(q)) return false;
    }
    return true;
  });
  const sortedTransactions = [...filteredTransactions].sort((a, b) =>
    sortOrder === 'desc'
      ? new Date(b.date) - new Date(a.date)
      : new Date(a.date) - new Date(b.date)
  );







  return (
    <div className="relative p-4 space-y-4 text-text wide-card">
      <h2 className="text-xl font-bold text-center">TPC Account Wallet</h2>
      <div className="prism-box p-6 space-y-2 min-h-40 flex flex-col items-start wide-card mx-auto">
        <p className="text-xs break-all w-full text-left">
          <span className="text-white text-outline-black">Account:</span>{' '}
          <span className="text-yellow-400 text-outline-black">
            {accountId || '...'}
          </span>
        </p>
        <div className="flex items-center space-x-1">
          <img src="/assets/icons/ezgif-54c96d8a9b9236.webp" alt="TPC" className="w-16 h-16" />
          <span className="text-lg font-medium text-white text-outline-black">
            TPC Balance
          </span>
        </div>
        <p className="text-xl font-medium text-yellow-400 text-outline-black">
          {tpcBalance === null ? '...' : formatValue(tpcBalance, 2)}
        </p>
        <p className="text-xs text-subtext">
          Balance is off-chain and stored within the app
        </p>
        {DEV_ACCOUNTS.includes(accountId) && (
          <>
            <p className="text-sm">Earnings from games: {formatValue(devShare, 2)}</p>
            <p className="text-sm">Earnings from transfers: {formatValue(feeShare, 2)}</p>
          </>
        )}
      </div>

      {/* TPC account section */}
      <div className="space-y-4">
        <div className="prism-box p-6 space-y-3 text-center flex flex-col items-center min-h-40 wide-card mx-auto">
          <label className="block font-semibold text-white text-outline-black">
            Send TPC
          </label>
          <input
            type="text"
            placeholder="Receiver Account Number"
            value={receiver}
            onChange={(e) => setReceiver(e.target.value)}
            className="border p-1 rounded w-full max-w-xs mx-auto text-black"
          />
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="border p-1 rounded w-full max-w-xs mx-auto mt-1 text-black"
          />
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            maxLength={150}
            onChange={(e) => setNote(e.target.value.slice(0, 150))}
            className="border p-1 rounded w-full max-w-xs mx-auto mt-1 text-black"
          />
          <button
            onClick={handleSendClick}
            className="mt-1 px-3 py-1 bg-primary hover:bg-primary-hover rounded text-white-shadow"
          >
            Send
          </button>
          <p className="text-xs text-subtext mt-1">
            Sending TPC 2% charge will be applied.
          </p>
          {sending && (
            <div className="mt-1">
              <div className="h-1 bg-green-500 animate-pulse" />
              <div className="text-sm text-subtext">Sending...</div>
            </div>
          )}
          {receipt && (
            <TransactionDetailsPopup tx={receipt} onClose={() => setReceipt(null)} />
          )}
        </div>

      <div className="prism-box p-6 space-y-3 text-center mt-4 flex flex-col items-center wide-card mx-auto">
        <label className="block font-semibold text-white text-outline-black">
          Receive TPC
        </label>
          <button
            onClick={() => navigator.clipboard.writeText(String(accountId))}
            className="mt-2 px-3 py-1 bg-primary hover:bg-primary-hover rounded text-white-shadow"
          >
            Copy Account Number
          </button>
          <p className="text-xs text-subtext mt-1">Receive TPC 1% charge will be applied.</p>
        {accountId && (
          <div className="mt-4 flex justify-center">
            <QRCode value={String(accountId)} size={100} />
          </div>
        )}
      </div>

      <NftGiftCard accountId={accountId} />

      {DEV_ACCOUNTS.includes(accountId) && (
        <div className="prism-box p-6 space-y-3 text-center mt-4 flex flex-col items-center w-80 mx-auto">
          <label className="block font-semibold">Top Up Developer Account</label>
          <input
            type="number"
            placeholder="Amount"
            value={topupAmount}
            onChange={(e) => setTopupAmount(e.target.value)}
            className="border p-1 rounded w-full max-w-xs mx-auto text-black"
          />
          <button
            onClick={handleTopup}
            className="mt-1 px-3 py-1 bg-primary hover:bg-primary-hover text-background rounded"
            disabled={topupSending}
          >
            {topupSending ? 'Processing...' : 'Top Up'}
          </button>
        </div>
      )}
    </div>


    <div className="bg-surface border border-border rounded-xl p-4 space-y-2 text-center mt-4 wide-card">
        <h3 className="font-semibold text-center">TPC Statements</h3>
        <div className="flex items-center justify-center">
          <div className="flex items-center space-x-1 flex-wrap justify-center">
            <input
              type="date"
              ref={dateInputRef}
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="hidden"
            />
            <AiOutlineCalendar
              className="w-5 h-5 cursor-pointer"
              onClick={() => dateInputRef.current?.showPicker && dateInputRef.current.showPicker()}
            />
            {filterDate && (
              <button onClick={() => setFilterDate('')} className="text-xs text-subtext">Clear</button>
            )}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-border rounded text-black text-xs px-1"
            >
              <option value="">All</option>
              {txTypes.map((t) => (
                <option key={t} value={t} className="capitalize">
                  {t.replace(/-/g, ' ')}
                </option>
              ))}
            </select>
            {filterType && (
              <button onClick={() => setFilterType('')} className="text-xs text-subtext">Clear</button>
            )}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="border border-border rounded text-black text-xs px-1"
            >
              <option value="desc">Newest</option>
              <option value="asc">Oldest</option>
            </select>
            <input
              type="text"
              placeholder="User or account"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="border border-border rounded text-black text-xs px-1"
            />
            {filterUser && (
              <button onClick={() => setFilterUser('')} className="text-xs text-subtext">Clear</button>
            )}
          </div>
        </div>
        <div className="space-y-1 text-sm max-h-[40rem] overflow-y-auto border border-border rounded">
          {sortedTransactions.map((tx, i) => {
            const typeLabel = (() => {
              if (tx.type === 'gift') return 'gift sent';
              if (tx.type === 'gift-receive') return 'gift received';
              if (tx.type === 'gift-fee') return 'gift fee';
              return tx.game ? 'game' : tx.type;
            })();
            const categoryLabel = tx.category ? ` (Tier ${tx.category})` : '';
            const sign = tx.amount > 0 ? '+' : '-';
            const amt = formatValue(Math.abs(tx.amount), 2);
            return (
              <div
                key={i}
                className="lobby-tile w-full flex justify-between items-center cursor-pointer"
                onClick={() => setSelectedTx(tx)}
              >
                <span className="capitalize">
                  {typeLabel}
                  {categoryLabel}
                </span>
                <span className={tx.amount > 0 ? 'text-green-500' : 'text-red-500'}>
                  {sign}
                  {amt} {(tx.token || 'TPC').toUpperCase()}
                </span>
                <span className="text-xs">
                  {new Date(tx.date).toLocaleString(undefined, { hour12: false })}
                </span>
                <span className={`text-xs ${tx.status?.toLowerCase() === 'delivered' ? 'text-green-500' : ''}`}>{tx.status}</span>
              </div>
            );
          })}
        </div>
        {/* pagination removed: transactions displayed in scrollable list */}
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
      <TransactionDetailsPopup tx={selectedTx} onClose={() => setSelectedTx(null)} />
    </div>
  );
}
