import React, { useEffect, useState } from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { createAccount, registerWallet } from '../utils/api.js';
import { ensureAccountId } from '../utils/telegram.js';
import LinkGoogleButton from './LinkGoogleButton.jsx';
import { loadGoogleProfile } from '../utils/google.js';
import TonConnectButton from './TonConnectButton.jsx';

export default function LoginOptions({ onAuthenticated }) {
  const [googleProfile, setGoogleProfile] = useState(() => loadGoogleProfile());
  const [accountStatus, setAccountStatus] = useState('initializing');
  const [ctaMessage, setCtaMessage] = useState('');
  const [walletStatus, setWalletStatus] = useState('idle');
  const [walletMessage, setWalletMessage] = useState('');
  const walletAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();

  const handleAuthenticated = (profile) => {
    setGoogleProfile(profile);
    if (onAuthenticated) onAuthenticated(profile);
  };

  const handleOpenTelegram = () => {
    setCtaMessage('Opening Telegram…');
    const deepLink = 'tg://resolve?domain=TonPlaygramBot&startapp=account';
    const fallback = 'https://t.me/TonPlaygramBot/webapp';
    window.location.href = deepLink;
    setTimeout(() => {
      window.open(fallback, '_blank', 'noopener');
      setTimeout(() => setCtaMessage(''), 1500);
    }, 400);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existingProfile = googleProfile || loadGoogleProfile();
      if (!googleProfile && existingProfile) {
        handleAuthenticated(existingProfile);
      }
      const accountId = await ensureAccountId();
      try {
        const res = await createAccount(undefined, existingProfile || undefined);
        if (cancelled) return;
        if (res?.accountId) {
          localStorage.setItem('accountId', res.accountId);
        } else if (accountId) {
          localStorage.setItem('accountId', accountId);
        }
        if (res?.walletAddress) {
          localStorage.setItem('walletAddress', res.walletAddress);
        }
        setAccountStatus('ready');
      } catch (err) {
        console.error('Account setup failed', err);
        if (!cancelled) setAccountStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [googleProfile?.id]);

  useEffect(() => {
    if (googleProfile?.id && onAuthenticated) {
      onAuthenticated(googleProfile);
    }
  }, [googleProfile, onAuthenticated]);

  useEffect(() => {
    if (!walletAddress) {
      setWalletStatus('idle');
      setWalletMessage('');
      return undefined;
    }

    let cancelled = false;
    setWalletStatus('connecting');
    setWalletMessage('Linking your TON wallet…');

    (async () => {
      try {
        const res = await registerWallet(walletAddress);
        if (cancelled) return;
        if (res?.accountId) {
          localStorage.setItem('accountId', res.accountId);
        }
        localStorage.setItem('walletAddress', walletAddress);
        setWalletStatus('connected');
        setWalletMessage('Wallet connected. You can continue.');
        if (onAuthenticated) {
          onAuthenticated({ walletAddress, accountId: res?.accountId });
        }
      } catch (err) {
        console.error('Failed to register TON wallet', err);
        if (!cancelled) {
          setWalletStatus('error');
          setWalletMessage('Could not link the wallet. Please retry.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [walletAddress, onAuthenticated]);

  return (
    <div className="p-6 text-text space-y-4 max-w-4xl mx-auto">
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-white">Welcome to TonPlaygram</h2>
        <p className="text-sm text-subtext">
          Choose how you want to sign in on Chrome: TON wallet, Telegram, or Google. We&apos;ll create
          or restore your TPC profile so you can sync rewards everywhere.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
        <div className="rounded-xl border border-border bg-surface/60 p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Login with TON Wallet</p>
          <p className="text-xs text-subtext">
            Connect Tonkeeper, Tonhub, or another TON wallet to continue in Chrome and keep your on-chain address.
          </p>
          <TonConnectButton className="w-full" />
          {walletAddress && (
            <p className="text-green-400 text-xs break-all">
              Connected to {walletAddress}
            </p>
          )}
          {walletMessage && (
            <p className={walletStatus === 'error' ? 'text-red-400 text-xs' : 'text-amber-200 text-xs'}>
              {walletMessage}
            </p>
          )}
          {walletStatus === 'error' && (
            <button
              className="w-full px-3 py-2 bg-primary hover:bg-primary-hover text-background rounded font-semibold"
              onClick={() => tonConnectUI?.openModal?.()}
            >
              Retry wallet connect
            </button>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface/60 p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Login with Telegram</p>
          <p className="text-xs text-subtext">
            Opens the @TonPlaygramBot mini app so you can unlock with Telegram and enable biometrics.
          </p>
          <button
            onClick={handleOpenTelegram}
            className="w-full px-3 py-2 bg-primary hover:bg-primary-hover text-background rounded font-semibold"
          >
            Continue in Telegram
          </button>
          {ctaMessage && <p className="text-[11px] text-amber-200">{ctaMessage}</p>}
        </div>

        <div className="rounded-xl border border-border bg-surface/60 p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Login with Google</p>
          <p className="text-xs text-subtext">
            Ideal for desktop browsers. We&apos;ll link your Google profile to a new TPC account if you don&apos;t have one.
          </p>
          <LinkGoogleButton
            telegramId={null}
            label="Continue with Google"
            onAuthenticated={handleAuthenticated}
          />
          {googleProfile?.email && (
            <p className="text-green-400 text-xs">
              Signed in as {googleProfile.email}. Completing your TPC profile…
            </p>
          )}
          {accountStatus === 'error' && (
            <p className="text-red-400 text-xs">We couldn&apos;t finish setup. Try again in a moment.</p>
          )}
        </div>
      </div>
    </div>
  );
}
