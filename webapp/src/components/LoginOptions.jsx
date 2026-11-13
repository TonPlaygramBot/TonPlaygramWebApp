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
  const [googleAuthError, setGoogleAuthError] = useState('');
  const tonAddress = useTonAddress();
  const isChrome = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('chrome') && !ua.includes('edge') && !ua.includes('opr');
  }, []);

  const handleAuthenticated = (profile) => {
    setGoogleAuthError('');
    setGoogleProfile(profile);
    if (onAuthenticated) onAuthenticated(profile);
  };

  const handleOpenTelegram = () => {
    setCtaMessage('Opening Telegram…');
    const deepLink = 'tg://resolve?domain=TonPlaygramBot&startapp=account';
    const fallback = 'https://t.me/TonPlaygramBot?startapp=account';
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
      const accountId = await ensureAccountId();
      try {
        const res = await createAccount(undefined, existingProfile || undefined);
        if (cancelled) return;
        if (res?.error) throw new Error(res.error);
        if (res?.accountId) {
          localStorage.setItem('accountId', res.accountId);
        } else if (accountId) {
          localStorage.setItem('accountId', accountId);
        }
        if (res?.walletAddress) {
          localStorage.setItem('walletAddress', res.walletAddress);
        }
        if (existingProfile && res?.sessionToken) handleAuthenticated(existingProfile);
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
    if (!tonAddress) return;
    // A connected public address is useful for viewing balances but is not an
    // account credential. Account login requires Google or Telegram verification.
    localStorage.setItem('walletAddress', tonAddress);
    if (onTonConnected) onTonConnected(tonAddress);
  }, [tonAddress, onTonConnected]);

  return (
    <div className="p-6 text-text space-y-4 max-w-3xl mx-auto">
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-white">Welcome to TonPlaygram</h2>
        <p className="text-sm text-subtext">
          Sign in with Google or continue from the Telegram mini app to access your TPG profile.
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
            Ideal for desktop browsers. We&apos;ll link your Google profile to a new TPG account if you don&apos;t have one.
          </p>
          {isChrome && (
            <p className="text-[11px] text-amber-200">
              Chrome detected — tap below to create your TPG account with your Google details.
            </p>
          )}
          <LinkGoogleButton
            telegramId={null}
            label="Continue with Google"
            onAuthenticated={handleAuthenticated}
            onError={({ message, details }) => {
              const suffix = details ? ` (${details})` : '';
              setGoogleAuthError(`${message}${suffix}`);
            }}
          />
          {googleAuthError && (
            <p className="text-red-300 text-xs">{googleAuthError}</p>
          )}
          {googleProfile?.email && (
            <p className="text-green-400 text-xs">
              Signed in as {googleProfile.email}. Completing your TPG profile…
            </p>
          )}
          {status === 'error' && (
            <p className="text-red-400 text-xs">We couldn&apos;t finish setup. Try again in a moment.</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface/60 p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Connect a TON wallet</p>
          <p className="text-xs text-subtext">
            Connect a wallet to view its balance. Sign in with Google or Telegram to access your TPG account.
          </p>
          <TonConnectButton className="w-full" />
          {tonAddress && (
            <p className="text-green-400 text-xs break-all">
              Wallet connected: {tonAddress}
            </p>
          )}
          {tonAddress && (
            <p className="text-[11px] text-amber-200">
              Wallet sign-in is unavailable. Continue with Google or Telegram above.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
