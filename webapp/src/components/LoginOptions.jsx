import React, { useEffect } from 'react';
import { ensureAccountId } from '../utils/telegram.js';
import { ensureAccountForUser, persistAccountLocally } from '../utils/account.js';

export default function LoginOptions() {
  useEffect(() => {
    (async () => {
      const accountId = await ensureAccountId();
      try {
        const account = await ensureAccountForUser({
          googleId: localStorage.getItem('googleId')
        });
        if (account?.accountId) {
          persistAccountLocally({ ...account, googleId: account.googleId });
        } else if (accountId) {
          localStorage.setItem('accountId', accountId);
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
