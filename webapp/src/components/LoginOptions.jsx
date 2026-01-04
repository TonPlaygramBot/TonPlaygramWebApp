import React, { useEffect, useState } from 'react';
import { createAccount } from '../utils/api.js';
import { ensureAccountId } from '../utils/telegram.js';
import LinkGoogleButton from './LinkGoogleButton.jsx';
import { loadGoogleProfile } from '../utils/google.js';

export default function LoginOptions({ onAuthenticated }) {
  const [googleProfile, setGoogleProfile] = useState(() => loadGoogleProfile());
  const [status, setStatus] = useState('initializing');

  const handleAuthenticated = (profile) => {
    setGoogleProfile(profile);
    if (onAuthenticated) onAuthenticated(profile);
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

  return (
    <div className="p-6 text-text space-y-4 max-w-xl mx-auto">
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-white">Welcome to TonPlaygram</h2>
        <p className="text-sm text-subtext">
          Pick Telegram or Google to continue. We&apos;ll create a TPC account for you instantly so you can access
          staking, gifts, and every game.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-surface/60 p-4 space-y-3">
        <p className="text-sm text-white-shadow">
          Choose how you want to sign in. You&apos;ll keep the same balance and profile whether you play from Telegram or
          the browser.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <LinkGoogleButton
            telegramId={null}
            label="Continue with Google"
            onAuthenticated={handleAuthenticated}
          />
          <a
            href="https://t.me/TonPlaygramBot?start=webapp"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center px-3 py-2 rounded bg-primary hover:bg-primary-hover text-black font-semibold text-sm"
          >
            Open in Telegram
          </a>
        </div>
        <ul className="list-disc list-inside text-xs text-subtext space-y-1">
          <li>New here? We&apos;ll create your TPC wallet so you can stake right away.</li>
          <li>Already played on Telegram? Use the same login to sync your wins and NFTs.</li>
        </ul>
        {googleProfile?.email && (
          <p className="text-green-400 text-xs">
            Signed in as {googleProfile.email}. We&apos;ll finish setting up your TPC account.
          </p>
        )}
        {status === 'error' && (
          <p className="text-red-400 text-xs">We couldn&apos;t finish setup. Try again in a moment.</p>
        )}
      </div>
    </div>
  );
}
