import React, { useEffect, useState } from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { createAccount, registerWallet } from '../utils/api.js';
import { ensureAccountId } from '../utils/telegram.js';
import LinkGoogleButton from './LinkGoogleButton.jsx';
import { loadGoogleProfile } from '../utils/google.js';
import TonConnectButton from './TonConnectButton.jsx';

export default function LoginOptions({ onAuthenticated, onAccountReady }) {
  const [googleProfile, setGoogleProfile] = useState(() => loadGoogleProfile());
  const [status, setStatus] = useState('initializing');
  const [ctaMessage, setCtaMessage] = useState('');
  const [tonMessage, setTonMessage] = useState('');
  const [tonStatus, setTonStatus] = useState('idle');
  const [isChrome, setIsChrome] = useState(false);
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
    const ua = navigator.userAgent || '';
    const isChromium = /Chrome/i.test(ua) && !/Edg/i.test(ua) && !/OPR/i.test(ua);
    setIsChrome(isChromium);
  }, []);

  useEffect(() => {
    if (googleProfile?.id && onAuthenticated) {
      onAuthenticated(googleProfile);
    }
  }, [googleProfile, onAuthenticated]);

  const handleTonSignup = async () => {
    setTonMessage('');
    if (!walletAddress) {
      setTonMessage('Connect your TON wallet to continue.');
      tonConnectUI?.openModal?.();
      return;
    }
    setTonStatus('working');
    try {
      const res = await registerWallet(walletAddress);
      if (res?.error || !res.accountId) {
        setTonMessage(res?.error || 'Unable to register your TON wallet right now.');
        setTonStatus('idle');
        return;
      }
      localStorage.setItem('accountId', res.accountId);
      localStorage.setItem('walletAddress', res.walletAddress || walletAddress);
      window.dispatchEvent(new Event('accountDataUpdated'));
      setTonMessage('Wallet connected. Loading your TPC profile…');
      setTonStatus('complete');
      if (onAccountReady) {
        onAccountReady({
          accountId: res.accountId,
          walletAddress: res.walletAddress || walletAddress
        });
      }
    } catch (err) {
      console.error('TON signup failed', err);
      setTonMessage('Could not finish TON signup. Please try again.');
      setTonStatus('idle');
    }
  };

  return (
    <div className="p-6 text-text space-y-4 max-w-3xl mx-auto">
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-white">Welcome to TonPlaygram</h2>
        <p className="text-sm text-subtext">
          Sign in with Google on Chrome or continue from the Telegram mini app. We&apos;ll create a fresh
          TPC profile so you can access the full site, stake, and sync rewards anywhere.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
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
            label={isChrome ? 'Sign up with Google (Chrome)' : 'Sign up with Google'}
            onAuthenticated={handleAuthenticated}
          />
          {!isChrome && (
            <p className="text-[11px] text-amber-200">
              Google sign-in works best on Google Chrome. For other browsers, complete the flow in a Chrome tab.
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
            Use the same TON Connect flow from the home page to register with your TON wallet and get a TPC account.
          </p>
          <TonConnectButton className="w-full" />
          <button
            onClick={handleTonSignup}
            disabled={tonStatus === 'working'}
            className="w-full px-3 py-2 bg-primary hover:bg-primary-hover text-background rounded font-semibold disabled:opacity-60"
          >
            {tonStatus === 'working' ? 'Creating account…' : 'Create TPC account'}
          </button>
          {walletAddress ? (
            <p className="text-[11px] text-green-300 break-all">Connected wallet: {walletAddress}</p>
          ) : (
            <p className="text-[11px] text-amber-200">Connect your TON wallet above to enable signup.</p>
          )}
          {tonMessage && <p className="text-[11px] text-amber-200">{tonMessage}</p>}
        </div>
      </div>
    </div>
  );
}
