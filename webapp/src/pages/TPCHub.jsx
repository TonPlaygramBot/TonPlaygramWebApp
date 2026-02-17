import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTonAddress } from '@tonconnect/ui-react';
import TonConnectButton from '../components/TonConnectButton.jsx';
import LinkGoogleButton from '../components/LinkGoogleButton.jsx';
import { createAccount, getAccountTransactions } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import { loadGoogleProfile } from '../utils/google.js';

function formatAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0';
}

export default function TPCHub() {
  const tonAddress = useTonAddress();
  const [googleProfile, setGoogleProfile] = useState(() => loadGoogleProfile());
  let telegramId = null;
  try {
    telegramId = getTelegramId();
  } catch {
    telegramId = null;
  }
  const [accountId, setAccountId] = useState(localStorage.getItem('accountId') || '');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const authStatus = useMemo(() => ({
    telegram: Boolean(telegramId),
    google: Boolean(googleProfile?.id),
    wallet: Boolean(tonAddress || localStorage.getItem('walletAddress'))
  }), [telegramId, googleProfile?.id, tonAddress]);

  useEffect(() => {
    const syncGoogle = () => setGoogleProfile(loadGoogleProfile());
    window.addEventListener('googleProfileUpdated', syncGoogle);
    return () => window.removeEventListener('googleProfileUpdated', syncGoogle);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadHub() {
      setLoading(true);
      setError('');
      try {
        const account = await createAccount(telegramId, googleProfile, accountId || undefined, tonAddress || undefined);
        if (account?.error || !account?.accountId) {
          throw new Error(account?.error || 'Unable to load TPC account hub');
        }
        if (cancelled) return;
        setAccountId(account.accountId);
        localStorage.setItem('accountId', account.accountId);
        const tx = await getAccountTransactions(account.accountId, { googleId: googleProfile?.id, walletAddress: tonAddress || localStorage.getItem('walletAddress') });
        if (!cancelled) {
          setTransactions(Array.isArray(tx) ? tx : tx?.transactions || []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load TPC hub');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadHub();
    return () => {
      cancelled = true;
    };
  }, [telegramId, googleProfile?.id, tonAddress]);

  return (
    <div className="space-y-4 pb-24">
      <section className="rounded-xl border border-border bg-surface p-4">
        <h1 className="text-xl font-semibold text-white">TPC Account Hub</h1>
        <p className="text-xs text-subtext mt-1">Unified account center for identity, wallets, exchange access, and statements.</p>
        <p className="text-[11px] text-green-300 mt-2">Account ID: {accountId || 'initializing...'}</p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <h2 className="text-lg text-white font-semibold">Identity & Wallet Connections</h2>
        <div className="grid grid-cols-1 gap-2">
          <div className="rounded-lg border border-border bg-background/60 p-3 flex items-center justify-between">
            <span className="text-sm">Telegram</span>
            <span className={`text-xs font-semibold ${authStatus.telegram ? 'text-green-300' : 'text-amber-300'}`}>{authStatus.telegram ? 'Connected' : 'Not connected'}</span>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-3 flex items-center justify-between">
            <span className="text-sm">Google</span>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${authStatus.google ? 'text-green-300' : 'text-amber-300'}`}>{authStatus.google ? 'Connected' : 'Not connected'}</span>
              <LinkGoogleButton telegramId={telegramId || null} label={authStatus.google ? 'Re-link' : 'Connect'} onAuthenticated={setGoogleProfile} />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-3 flex items-center justify-between">
            <span className="text-sm">Web3 Wallet (TON Connect)</span>
            <TonConnectButton small className="mt-0" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <h2 className="text-lg text-white font-semibold">Hub Actions</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Link to="/exchange" className="rounded-lg border border-border bg-background/60 px-3 py-2 text-center">Open Exchange</Link>
          <Link to="/wallet" className="rounded-lg border border-border bg-background/60 px-3 py-2 text-center">Wallet</Link>
          <Link to="/account" className="rounded-lg border border-border bg-background/60 px-3 py-2 text-center">Profile Settings</Link>
          <Link to="/mining/transactions" className="rounded-lg border border-border bg-background/60 px-3 py-2 text-center">Mining Tx</Link>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <h2 className="text-lg text-white font-semibold">My Statements</h2>
        {loading && <p className="text-sm text-subtext">Loading statements...</p>}
        {error && <p className="text-sm text-red-300">{error}</p>}
        <div className="space-y-2 max-h-[50vh] overflow-auto pr-1">
          {transactions.slice(0, 50).map((tx, idx) => (
            <div key={`${tx.txHash || tx.date || idx}-${idx}`} className="rounded-lg border border-border bg-background/60 px-3 py-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-white font-semibold">{tx.type || tx.category || 'Transaction'}</span>
                <span>{formatAmount(tx.amount)} {tx.token || 'TPC'}</span>
              </div>
              <div className="text-subtext mt-1">{tx.detail || tx.game || 'No details'}</div>
              <div className="text-[10px] text-subtext mt-1">{tx.date ? new Date(tx.date).toLocaleString() : '—'}</div>
            </div>
          ))}
          {!loading && !transactions.length && !error && (
            <p className="text-xs text-subtext">No statements yet. Your activity will appear here.</p>
          )}
        </div>
      </section>
    </div>
  );
}
