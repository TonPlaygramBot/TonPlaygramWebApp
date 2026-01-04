import React, { useEffect, useMemo, useState } from 'react';
import { useTonAddress } from '@tonconnect/ui-react';
import { createAccount } from '../utils/api.js';
import { ensureAccountId } from '../utils/telegram.js';
import LinkGoogleButton from './LinkGoogleButton.jsx';
import TonConnectButton from './TonConnectButton.jsx';
import { loadGoogleProfile } from '../utils/google.js';

export default function LoginOptions({ onAuthenticated, onTonConnected }) {
  const [googleProfile, setGoogleProfile] = useState(() => loadGoogleProfile());
  const [status, setStatus] = useState('initializing');
  const [ctaMessage, setCtaMessage] = useState('');
  const [tonStatus, setTonStatus] = useState('idle');
  const tonAddress = useTonAddress();
  const isChrome = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('chrome') && !ua.includes('edge') && !ua.includes('opr');
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
    if (!tonAddress) return;
    let cancelled = false;
    setTonStatus('linking');
    (async () => {
      const existingProfile = googleProfile || loadGoogleProfile();
      const res = await createAccount(undefined, existingProfile || undefined, undefined, tonAddress);
      if (cancelled) return;
      if (res?.accountId) {
        localStorage.setItem('accountId', res.accountId);
      }
      localStorage.setItem('walletAddress', tonAddress);
      setTonStatus('ready');
      if (onTonConnected) onTonConnected(tonAddress);
    })();
    return () => {
      cancelled = true;
    };
  }, [tonAddress, googleProfile, onTonConnected]);

  return (
    <div className="p-6 text-text space-y-4 max-w-3xl mx-auto">
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-white">Welcome to TonPlaygram</h2>
        <p className="text-sm text-subtext">
          Sign in with Google on Chrome or continue from the Telegram mini app. We&apos;ll create a fresh
          TPC profile so you can access the full site, stake, and sync rewards anywhere.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
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
          {isChrome && (
            <p className="text-[11px] text-amber-200">
              Chrome detected — tap below to create your TPC account with your Google details.
            </p>
          )}
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
          {status === 'error' && (
            <p className="text-red-400 text-xs">We couldn&apos;t finish setup. Try again in a moment.</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface/60 p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Sign up with TON Connect</p>
          <p className="text-xs text-subtext">
            Use your TON wallet to create a TPC account and sync rewards from anywhere.
          </p>
          <TonConnectButton className="w-full" />
          {tonAddress && (
            <p className="text-green-400 text-xs break-all">
              Wallet connected: {tonAddress}
            </p>
          )}
          {tonStatus === 'linking' && (
            <p className="text-[11px] text-amber-200">Creating your TPC account with TON…</p>
          )}
          {tonStatus === 'ready' && (
            <p className="text-[11px] text-green-400">TON wallet linked. Reloading your profile…</p>
          )}
        </div>
      </div>
    </div>
  );
}
