import React, { useEffect, useMemo, useState } from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { createAccount, registerWallet } from '../utils/api.js';
import { ensureAccountId } from '../utils/telegram.js';
import LinkGoogleButton from './LinkGoogleButton.jsx';
import { loadGoogleProfile } from '../utils/google.js';

export default function LoginOptions({ onAuthenticated }) {
  const [googleProfile, setGoogleProfile] = useState(() => loadGoogleProfile());
  const [status, setStatus] = useState('initializing');
  const [ctaMessage, setCtaMessage] = useState('');
  const [tonStatus, setTonStatus] = useState('idle');
  const [tonError, setTonError] = useState('');

  const walletAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();

  const isChrome = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isChromium = /Chrome\/\d+/i.test(ua) && !/Edg|OPR|Brave/i.test(ua);
    return isChromium;
  }, []);

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
        setStatus('ready');
      } catch (err) {
        console.error('Account setup failed', err);
        if (!cancelled) setStatus('error');
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
      setTonStatus('idle');
      setTonError('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setTonStatus('linking');
        setTonError('');
        const res = await registerWallet(walletAddress);
        if (cancelled) return;
        if (res?.accountId) {
          localStorage.setItem('accountId', res.accountId);
        }
        localStorage.setItem('walletAddress', walletAddress);
        const accountRes = await createAccount(undefined, undefined, res?.accountId);
        if (cancelled) return;
        if (accountRes?.accountId) {
          localStorage.setItem('accountId', accountRes.accountId);
        }
        setTonStatus('connected');
      } catch (err) {
        console.error('Ton Connect setup failed', err);
        if (!cancelled) {
          setTonStatus('error');
          setTonError('We could not link your TON wallet. Please try again.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  const handleTonConnect = async () => {
    if (!tonConnectUI) return;
    try {
      setTonStatus('connecting');
      await tonConnectUI.openModal();
      setTonStatus((prev) => (prev === 'connecting' ? 'idle' : prev));
    } catch (err) {
      console.error('Failed to open TON Connect', err);
      setTonStatus('error');
      setTonError('Unable to open TON Connect. Please try again.');
    }
  };

  const tonCtaLabel = tonStatus === 'connecting' || tonStatus === 'linking'
    ? 'Connecting to TON…'
    : walletAddress
      ? 'TON Wallet Connected'
      : 'Sign up with TON Connect';

  return (
    <div className="p-6 text-text space-y-4 max-w-3xl mx-auto">
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-white">Welcome to TonPlaygram</h2>
        <p className="text-sm text-subtext">
          Sign in with Google on Chrome or continue from the Telegram mini app. We&apos;ll create a fresh
          TPC profile so you can access the full site, stake, and sync rewards anywhere.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
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
            Ideal for Google Chrome on desktop. We&apos;ll link your Google profile to a new TPC account if you don&apos;t have one.
          </p>
          {isChrome ? (
            <LinkGoogleButton
              telegramId={null}
              label="Continue with Google"
              onAuthenticated={handleAuthenticated}
            />
          ) : (
            <p className="text-[11px] text-amber-200">
              Switch to Google Chrome to unlock sign up with your Google account.
            </p>
          )}
          {googleProfile?.email && (
            <p className="text-green-400 text-xs">
              Signed in as {googleProfile.email}. Completing your TPC profile…
            </p>
          )}
          {status === 'error' && (
            <p className="text-red-400 text-xs">We couldn&apos;t finish setup. Try again in a moment.</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface/60 p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Sign up with TON Connect</p>
          <p className="text-xs text-subtext">
            Use the TON Connect wallet flow from the home page to create or link your TPC account with your TON wallet.
          </p>
          <button
            onClick={handleTonConnect}
            disabled={tonStatus === 'connecting' || tonStatus === 'linking' || tonStatus === 'connected'}
            className="w-full px-3 py-2 bg-[#0098ea] hover:bg-[#007ac0] text-white rounded font-semibold disabled:opacity-50"
          >
            {tonCtaLabel}
          </button>
          {walletAddress && (
            <p className="text-green-400 text-xs">
              Connected wallet: {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
            </p>
          )}
          {tonError && <p className="text-red-400 text-xs">{tonError}</p>}
        </div>
      </div>
    </div>
  );
}
