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
          Sign in with Google on Chrome or continue from the Telegram mini app. Your account and
          rewards stay in sync.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <LinkGoogleButton
          telegramId={null}
          label="Continue with Google"
          onAuthenticated={handleAuthenticated}
        />
        <div className="text-xs text-subtext">
          <p>Prefer Telegram? Open @TonPlaygramBot and tap <strong>Open Web App</strong>.</p>
          {googleProfile?.email && (
            <p className="text-green-400 mt-1">
              Signed in as {googleProfile.email}. We&apos;ll finish setting up your TPC account.
            </p>
          )}
          {status === 'error' && (
            <p className="text-red-400 mt-1">We couldn&apos;t finish setup. Try again in a moment.</p>
          )}
        </div>
      </div>
    </div>
  );
}
