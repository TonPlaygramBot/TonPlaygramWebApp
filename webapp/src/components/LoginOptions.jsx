import React, { useEffect } from 'react';
import { createAccount } from '../utils/api.js';
import { ensureAccountId } from '../utils/telegram.js';

export default function LoginOptions() {
  useEffect(() => {
    (async () => {
      const accountId = await ensureAccountId();
      try {
        const res = await createAccount(undefined, localStorage.getItem('googleId'));
        if (res?.accountId) {
          localStorage.setItem('accountId', res.accountId);
        } else if (accountId) {
          localStorage.setItem('accountId', accountId);
        }
        if (res?.walletAddress) {
          localStorage.setItem('walletAddress', res.walletAddress);
        }
      } catch (err) {
        console.error('Account setup failed', err);
      }
    })();
  }, []);

  return (
    <div className="p-4 text-text">
      <p>Loading...</p>
    </div>
  );
}
