import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTonAddress } from '@tonconnect/ui-react';
import TonConnectButton from '../components/TonConnectButton.jsx';
import LinkGoogleButton from '../components/LinkGoogleButton.jsx';
import {
  createAccount,
  getAccountInfo,
  getAccountTransactions,
  getExchangeConversionQuote
} from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import { loadGoogleProfile } from '../utils/google.js';

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function formatAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function TpcAccountHub() {
  const tonAddress = useTonAddress();
  const [googleProfile, setGoogleProfile] = useState(() => loadGoogleProfile());
  const [telegramId, setTelegramId] = useState(() => getTelegramId());
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [converterAmount, setConverterAmount] = useState('10');
  const [quote, setQuote] = useState(null);

  const identityState = useMemo(
    () => ({
      telegram: Boolean(telegramId),
      google: Boolean(googleProfile?.id),
      wallet: Boolean(tonAddress)
    }),
    [telegramId, googleProfile?.id, tonAddress]
  );

  const handleOpenTelegram = () => {
    const deepLink = 'tg://resolve?domain=TonPlaygramBot&startapp=account';
    const fallback = 'https://t.me/TonPlaygramBot?startapp=account';
    window.location.href = deepLink;
    setTimeout(() => window.open(fallback, '_blank', 'noopener'), 450);
  };

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const acc = await createAccount(telegramId, googleProfile, undefined, tonAddress);
      if (acc?.error || !acc?.accountId) throw new Error(acc?.error || 'Failed to load TPC account');
      setAccount(acc);
      const [profile, statementRes] = await Promise.all([
        getAccountInfo(acc.accountId),
        getAccountTransactions(acc.accountId)
      ]);
      if (profile?.error) throw new Error(profile.error);
      if (statementRes?.error) throw new Error(statementRes.error);
      setTransactions(Array.isArray(statementRes.transactions) ? statementRes.transactions : []);
    } catch (err) {
      setError(err?.message || 'Unable to load account hub');
    } finally {
      setLoading(false);
    }
  };

  const convertTon = async () => {
    const data = await getExchangeConversionQuote('TON', converterAmount);
    if (data?.error) {
      setError(data.error);
      setQuote(null);
      return;
    }
    setQuote(data);
  };

  useEffect(() => {
    const onGoogleUpdate = () => setGoogleProfile(loadGoogleProfile());
    const onStorage = () => setTelegramId(getTelegramId());
    window.addEventListener('googleProfileUpdated', onGoogleUpdate);
    window.addEventListener('storage', onStorage);
    refresh();
    return () => {
      window.removeEventListener('googleProfileUpdated', onGoogleUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, [tonAddress]);

  return (
    <div className="space-y-4 pb-24">
      <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
        <h1 className="text-xl font-semibold text-white">TPC Account Hub</h1>
        <p className="text-xs text-subtext">Unified identity + wallet center with statements and exchange shortcuts.</p>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <h2 className="text-lg text-white font-semibold">Identity Connectors</h2>
        <div className="grid grid-cols-1 gap-2">
          <button onClick={handleOpenTelegram} className="px-3 py-2 rounded-lg bg-[#229ED9] text-white text-sm font-semibold">
            {identityState.telegram ? 'Telegram Connected' : 'Connect Telegram'}
          </button>
          <div className="rounded-lg border border-border bg-background/60 px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-subtext">Google</span>
            <LinkGoogleButton telegramId={telegramId || null} label={identityState.google ? 'Google Connected' : 'Connect Google'} />
          </div>
          <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
            <p className="text-xs text-subtext mb-1">Web3 Wallet (TON Connect)</p>
            <TonConnectButton className="mt-0" />
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
        <h2 className="text-lg text-white font-semibold">Hub Overview</h2>
        {loading ? (
          <p className="text-xs text-subtext">Loading account data…</p>
        ) : (
          <>
            <p className="text-sm">Account ID: <span className="text-primary break-all">{account?.accountId || '—'}</span></p>
            <p className="text-sm">TPC Balance: <span className="text-green-300">{formatAmount(account?.balance)} TPC</span></p>
            <div className="flex gap-2 pt-1">
              <Link to="/exchange" className="text-xs underline text-primary">Open Exchange</Link>
              <Link to="/account" className="text-xs underline text-primary">Open Full Profile</Link>
            </div>
          </>
        )}
        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
        <h2 className="text-lg text-white font-semibold">Quick TON → TPC Quote</h2>
        <div className="flex gap-2">
          <input
            value={converterAmount}
            onChange={(e) => setConverterAmount(e.target.value)}
            className="bg-background border border-border rounded px-3 py-2 flex-1"
            placeholder="TON amount"
          />
          <button onClick={convertTon} className="px-3 py-2 bg-primary text-black rounded font-semibold">Quote</button>
        </div>
        {quote && (
          <p className="text-sm text-green-300">
            {quote.amount} TON ≈ {Number(quote.estimatedTpc || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} TPC
          </p>
        )}
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg text-white font-semibold">My Statements</h2>
          <button onClick={refresh} className="text-xs text-primary underline">Refresh</button>
        </div>
        {transactions.length === 0 ? (
          <p className="text-xs text-subtext">No transactions yet.</p>
        ) : (
          <div className="space-y-2 max-h-[45vh] overflow-auto pr-1">
            {transactions.slice(0, 50).map((tx, idx) => (
              <div key={`${tx.date || idx}-${tx.type || idx}`} className="rounded-lg border border-border bg-background/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-white truncate">{tx.type || 'Transaction'}</p>
                  <p className="text-sm text-primary">{formatAmount(tx.amount)} {tx.token || 'TPC'}</p>
                </div>
                <p className="text-[11px] text-subtext">{formatDate(tx.date)}</p>
                {tx.detail && <p className="text-[11px] text-subtext">{tx.detail}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
